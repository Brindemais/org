-- ============================================================
-- Automatic renewal reminders (email + in-app) 7 days before a
-- subscription expires, sent by the notify-renewal-reminders Edge
-- Function on a daily pg_cron schedule.
-- ============================================================

alter table subscriptions add column renewal_reminder_sent_at timestamptz;

-- confirm_payment() extends expires_at on renewal without ever touching
-- this column — without a reset, a subscriber who already got a reminder
-- once would never get another one on later cycles. Reset it every time
-- the subscription is (re)activated, since that's the only place
-- expires_at moves forward.
create or replace function confirm_payment(p_payment_id uuid, p_confirmed_by uuid default null) returns payments language plpgsql security definer set search_path = public as $$
declare
  v_payment payments;
  v_sub subscriptions;
  v_interval interval;
begin
  if not is_admin() then
    raise exception 'NOT_AUTHORIZED';
  end if;

  update payments set status = 'confirmed', confirmed_at = now(), confirmed_by = coalesce(p_confirmed_by, auth.uid())
  where id = p_payment_id and status = 'pending'
  returning * into v_payment;

  if v_payment.id is null then
    select * into v_payment from payments where id = p_payment_id;
    return v_payment;
  end if;

  if v_payment.type = 'subscription' then
    v_interval := case coalesce(v_payment.plan, 'monthly') when 'annual' then interval '365 days' else interval '30 days' end;

    if v_payment.subscription_id is not null then
      update subscriptions set status = 'active', activated_at = now(),
        plan = coalesce(v_payment.plan, 'monthly'), amount = v_payment.amount,
        expires_at = greatest(coalesce(expires_at, now()), now()) + v_interval,
        renewal_reminder_sent_at = null
      where id = v_payment.subscription_id
      returning * into v_sub;
    else
      insert into subscriptions (subscriber_id, status, plan, amount, activated_at, expires_at)
      values (v_payment.subscriber_id, 'active', coalesce(v_payment.plan, 'monthly'), v_payment.amount, now(), now() + v_interval)
      returning * into v_sub;
      update payments set subscription_id = v_sub.id where id = v_payment.id;
    end if;

    perform award_referral_bonuses(v_payment.subscriber_id, v_payment.amount, 'subscription', v_payment.id);

    insert into notifications (user_id, type, title, message)
    values (v_payment.subscriber_id, 'payment', 'Pagamento confirmado', 'Sua assinatura Brinde Mais está ativa! Escolha seu ponto de retirada.');

  elsif v_payment.type = 'store' then
    update store_orders set status = 'paid', payment_id = v_payment.id where id = v_payment.order_id;
    perform award_referral_bonuses(v_payment.subscriber_id, v_payment.amount, 'consumption', v_payment.id);
    insert into notifications (user_id, type, title, message)
    values (v_payment.subscriber_id, 'order', 'Pedido confirmado', 'Seu pedido na loja Brinde Mais foi confirmado.');
  end if;

  return v_payment;
end;
$$;

-- ------------------------------------------------------------
-- Daily schedule. pg_net lets Postgres itself make the HTTP call. The
-- function is deployed with verify_jwt=false (it's a cron/webhook-style
-- endpoint, not a user-session one) — its own work is scoped to strictly
-- read-active-subscriptions-and-send-a-reminder, idempotent via
-- renewal_reminder_sent_at, so there's nothing sensitive an unsolicited
-- caller could extract or corrupt by hitting it early.
-- ------------------------------------------------------------
create extension if not exists pg_net;

select cron.schedule(
  'notify-renewal-reminders-daily',
  '0 12 * * *',
  $$
  select net.http_post(
    url := 'https://qfkulxboxxcqsmdgptfm.supabase.co/functions/v1/notify-renewal-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);
