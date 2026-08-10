-- ============================================================
-- Decisões fechadas nesta rodada:
--  - Carência de 7 dias antes de uma bonificação poder ser sacada.
--  - Limite de saque: R$ 1.000,00 por assinante a cada 30 dias, sem taxa
--    por enquanto (o Asaas, quando integrado, cobra sua própria taxa por
--    transferência Pix).
--  - Comissões de indicação incidem sobre o valor bruto do pagamento
--    confirmado (já era assim — só fica registrado como decisão fechada).
--  - Log de auditoria: estende para as duas ações financeiras que mais
--    faltavam (confirmar pagamento, processar saque). set_partner_status/
--    set_promotion_status/set_subscriber_active já logavam.
-- ============================================================

-- ------------------------------------------------------------
-- Carência de 7 dias: um crédito ('in') só entra na conta sacável depois
-- de 7 dias na carteira; débitos ('out') sempre abatem na hora. O saldo
-- TOTAL mostrado no app (current_wallet_balance) não muda — só o quanto
-- dá pra sacar agora.
-- ------------------------------------------------------------
create or replace function available_balance(p_user_id uuid) returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(case
    when direction = 'in' and created_at <= now() - interval '7 days' then amount
    when direction = 'out' then -amount
    else 0
  end), 0) - pending_withdrawals_total(p_user_id)
  from wallet_transactions where user_id = p_user_id and status = 'confirmed';
$$;

create or replace function request_withdrawal(p_amount numeric, p_pix_key text) returns withdrawals language plpgsql security definer set search_path = public as $$
declare
  v_avail numeric;
  v_recent_total numeric;
  v_w withdrawals;
begin
  if not is_active_subscriber() then
    raise exception 'ACCOUNT_SUSPENDED';
  end if;
  if p_amount < 100 then raise exception 'MINIMUM_WITHDRAWAL_100'; end if;

  select available_balance(auth.uid()) into v_avail;
  if v_avail < p_amount then raise exception 'INSUFFICIENT_BALANCE'; end if;

  select coalesce(sum(amount), 0) into v_recent_total
  from withdrawals
  where user_id = auth.uid() and status <> 'rejected' and requested_at >= now() - interval '30 days';
  if v_recent_total + p_amount > 1000 then raise exception 'MONTHLY_LIMIT_EXCEEDED'; end if;

  insert into withdrawals (user_id, amount, pix_key) values (auth.uid(), p_amount, p_pix_key)
  returning * into v_w;

  insert into notifications (user_id, type, title, message)
  values (auth.uid(), 'withdrawal', 'Saque solicitado', 'Seu saque de R$ ' || p_amount || ' está em análise.');

  return v_w;
end;
$$;

-- ------------------------------------------------------------
-- Auditoria: confirmar pagamento e processar saque passam a deixar
-- registro em audit_logs, igual às ações de status de parceiro/promoção/
-- assinante que já logavam.
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

  insert into audit_logs (actor_id, action, entity, entity_id, after)
  values (auth.uid(), 'confirm_payment', 'payments', v_payment.id, jsonb_build_object('amount', v_payment.amount, 'type', v_payment.type));

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

create or replace function process_withdrawal(p_withdrawal_id uuid, p_new_status withdrawal_status, p_notes text default null) returns withdrawals language plpgsql security definer set search_path = public as $$
declare
  v_w withdrawals;
  v_balance numeric;
begin
  if not is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  select * into v_w from withdrawals where id = p_withdrawal_id;
  if v_w.id is null then raise exception 'NOT_FOUND'; end if;

  update withdrawals set status = p_new_status, processed_by = auth.uid(), processed_at = now(),
    notes = coalesce(p_notes, notes)
  where id = p_withdrawal_id returning * into v_w;

  insert into audit_logs (actor_id, action, entity, entity_id, before, after)
  values (auth.uid(), 'process_withdrawal', 'withdrawals', v_w.id, jsonb_build_object('amount', v_w.amount), jsonb_build_object('status', p_new_status, 'notes', p_notes));

  if p_new_status = 'paid' then
    select current_wallet_balance(v_w.user_id) - v_w.amount into v_balance;
    insert into wallet_transactions (user_id, type, direction, amount, balance_after, reference_type, reference_id, description)
    values (v_w.user_id, 'withdrawal', 'out', v_w.amount, v_balance, 'withdrawal', v_w.id, 'Saque via Pix');
  end if;

  insert into notifications (user_id, type, title, message)
  values (v_w.user_id, 'withdrawal',
    case p_new_status when 'approved' then 'Saque aprovado' when 'paid' then 'Saque pago' when 'rejected' then 'Saque recusado' else 'Saque atualizado' end,
    'Seu saque de R$ ' || v_w.amount || ' foi ' ||
    case p_new_status when 'approved' then 'aprovado.' when 'paid' then 'pago com sucesso.' when 'rejected' then ('recusado. ' || coalesce(p_notes,'')) else 'atualizado.' end
  );

  return v_w;
end;
$$;
