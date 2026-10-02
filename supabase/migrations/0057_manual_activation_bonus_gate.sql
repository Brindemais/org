-- Ativação manual (admin) cobre três casos: pagamento combinado por fora,
-- cortesia, migração de conta antiga. Até aqui, os três sempre
-- disparavam bônus de indicação igual a um pagamento real via Asaas —
-- errado pra cortesia/migração, onde não existe receita de verdade por
-- trás. confirm_payment ganha p_award_bonus (default true, preserva o
-- comportamento de hoje pro caso comum de pagamento real) e as duas
-- funções de ativação manual repassam esse parâmetro — o admin decide no
-- formulário se confirma o pagamento (libera bônus) ou não.
alter function confirm_payment(uuid, uuid) rename to confirm_payment_stale_v1;
revoke all on function confirm_payment_stale_v1(uuid, uuid) from public, anon, authenticated, service_role;

create or replace function confirm_payment(p_payment_id uuid, p_confirmed_by uuid default null, p_award_bonus boolean default true)
returns payments language plpgsql security definer set search_path = public as $$
declare
  v_payment payments;
  v_sub subscriptions;
  v_interval interval;
begin
  if not (is_admin() or auth.role() = 'service_role') then
    raise exception 'NOT_AUTHORIZED';
  end if;

  update payments set status = 'confirmed', confirmed_at = now(), confirmed_by = coalesce(p_confirmed_by, auth.uid())
  where id = p_payment_id and status = 'pending'
  returning * into v_payment;

  if v_payment.id is null then
    select * into v_payment from payments where id = p_payment_id;
    return v_payment;
  end if;

  insert into audit_logs (actor_id, action, entity, entity_id, after)
  values (auth.uid(), 'confirm_payment', 'payments', v_payment.id, jsonb_build_object('amount', v_payment.amount, 'type', v_payment.type, 'award_bonus', p_award_bonus));

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

    if p_award_bonus then
      perform award_referral_bonuses(v_payment.subscriber_id, v_payment.amount, 'subscription', v_payment.id);
    end if;

    insert into notifications (user_id, type, title, message)
    values (v_payment.subscriber_id, 'payment', 'Pagamento confirmado', 'Sua assinatura Brinde Mais está ativa! Escolha seu ponto de retirada.');

  elsif v_payment.type = 'store' then
    update store_orders set status = 'paid', payment_id = v_payment.id where id = v_payment.order_id;
    if p_award_bonus then
      perform award_referral_bonuses(v_payment.subscriber_id, v_payment.amount, 'consumption', v_payment.id);
    end if;
    insert into notifications (user_id, type, title, message)
    values (v_payment.subscriber_id, 'order', 'Pedido confirmado', 'Seu pedido na loja Brinde Mais foi confirmado.');

  elsif v_payment.type = 'partner_fee' then
    update partners set is_advertiser = true,
      advertiser_expires_at = greatest(coalesce(advertiser_expires_at, now()), now()) + interval '30 days'
    where id = v_payment.partner_id;

    if p_award_bonus then
      perform award_referral_bonuses(v_payment.subscriber_id, v_payment.amount, 'partner_fee', v_payment.id);
    end if;

    insert into notifications (user_id, type, title, message)
    values (v_payment.subscriber_id, 'payment', 'Você é Anunciante Brinde Mais!', 'Sua taxa de anunciante foi confirmada. Acesse a área de anunciante no seu painel.');
  end if;

  return v_payment;
end;
$$;

revoke all on function confirm_payment(uuid, uuid, boolean) from public, anon;
grant execute on function confirm_payment(uuid, uuid, boolean) to authenticated, service_role;

alter function admin_activate_subscription_manually(uuid, subscription_plan, text, boolean) rename to admin_activate_subscription_manually_stale_v2;
revoke all on function admin_activate_subscription_manually_stale_v2(uuid, subscription_plan, text, boolean) from public, anon, authenticated, service_role;

create or replace function admin_activate_subscription_manually(
  p_subscriber_id uuid, p_plan subscription_plan, p_note text, p_force boolean default false, p_award_bonus boolean default true
) returns payments language plpgsql security definer set search_path = public as $$
declare
  v_amount numeric;
  v_payment payments;
begin
  if not is_admin() then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if p_note is null or length(trim(p_note)) = 0 then
    raise exception 'NOTE_REQUIRED';
  end if;

  if not p_force and exists (
    select 1 from subscriptions where subscriber_id = p_subscriber_id and status = 'active' and expires_at > now()
  ) then
    raise exception 'ALREADY_ACTIVE';
  end if;

  v_amount := case p_plan when 'annual' then 1439.04 else 149.90 end;

  insert into payments (subscriber_id, amount, plan, type, payment_method, notes, confirmed_by)
  values (p_subscriber_id, v_amount, p_plan, 'subscription', 'manual', trim(p_note), auth.uid())
  returning * into v_payment;

  return confirm_payment(v_payment.id, auth.uid(), p_award_bonus);
end;
$$;

revoke all on function admin_activate_subscription_manually(uuid, subscription_plan, text, boolean, boolean) from public, anon;
grant execute on function admin_activate_subscription_manually(uuid, subscription_plan, text, boolean, boolean) to authenticated;

alter function admin_activate_advertiser_manually(uuid, text) rename to admin_activate_advertiser_manually_stale_v1;
revoke all on function admin_activate_advertiser_manually_stale_v1(uuid, text) from public, anon, authenticated, service_role;

create or replace function admin_activate_advertiser_manually(p_partner_id uuid, p_note text, p_award_bonus boolean default true)
returns payments language plpgsql security definer set search_path = public as $$
declare
  v_staff_id uuid;
  v_payment payments;
begin
  if not is_admin() then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if p_note is null or length(trim(p_note)) = 0 then
    raise exception 'NOTE_REQUIRED';
  end if;

  select profile_id into v_staff_id from partner_staff where partner_id = p_partner_id limit 1;
  if v_staff_id is null then
    raise exception 'PARTNER_HAS_NO_STAFF';
  end if;

  insert into payments (subscriber_id, partner_id, amount, type, payment_method, notes, confirmed_by)
  values (v_staff_id, p_partner_id, 149.90, 'partner_fee', 'manual', trim(p_note), auth.uid())
  returning * into v_payment;

  return confirm_payment(v_payment.id, auth.uid(), p_award_bonus);
end;
$$;

revoke all on function admin_activate_advertiser_manually(uuid, text, boolean) from public, anon;
grant execute on function admin_activate_advertiser_manually(uuid, text, boolean) to authenticated;
