-- ============================================================
-- Two subscription plans (monthly / annual with 20% off) + server-side
-- price enforcement, and plan-aware renewal windows.
--
-- Pricing: monthly R$ 99,90/mês; annual R$ 959,04 (= 99,90 * 12 * 0.8),
-- billed once for the 12-month package.
-- ============================================================

create type subscription_plan as enum ('monthly', 'annual');

alter table subscriptions add column plan subscription_plan not null default 'monthly';
alter table payments add column plan subscription_plan;

-- ------------------------------------------------------------
-- Canonical prices enforced server-side. payments_insert (0003_rls.sql)
-- only checks `subscriber_id = auth.uid()` — it never validated `amount`,
-- so a subscriber could otherwise insert a 'subscription' payment with an
-- arbitrary low amount from the client and hope an admin confirms it
-- without noticing. This trigger closes that gap.
-- ------------------------------------------------------------
create or replace function validate_subscription_payment() returns trigger language plpgsql as $$
begin
  if new.type = 'subscription' then
    if new.plan is null then
      new.plan := 'monthly';
    end if;
    if new.plan = 'monthly' and new.amount <> 99.90 then
      raise exception 'INVALID_PLAN_AMOUNT';
    end if;
    if new.plan = 'annual' and new.amount <> 959.04 then
      raise exception 'INVALID_PLAN_AMOUNT';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_subscription_payment on payments;
create trigger trg_validate_subscription_payment
  before insert or update on payments
  for each row execute function validate_subscription_payment();

-- ------------------------------------------------------------
-- confirm_payment(): extend expires_at by 30 days (monthly) or 365 days
-- (annual) instead of always 30, and stamp the subscription with the
-- plan/amount actually paid so a renewal that switches plans sticks.
-- ------------------------------------------------------------
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
        expires_at = greatest(coalesce(expires_at, now()), now()) + v_interval
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
