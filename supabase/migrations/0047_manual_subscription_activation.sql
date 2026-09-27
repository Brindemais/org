-- ============================================================
-- Ativação manual de assinatura pelo admin (ex.: pagamento combinado por
-- fora, cortesia, migração de assinante antigo) — sem gerar Pix nem
-- passar pela Asaas. Reaproveita confirm_payment() pra disparar exatamente
-- os mesmos efeitos de qualquer outra confirmação (ativa assinatura,
-- paga bonificação de indicação, notifica o assinante), só que a origem
-- fica marcada: payment_method = 'manual' e uma observação obrigatória
-- em payments.notes, visível na tela de pagamentos do admin.
-- ============================================================

alter table payments add column if not exists notes text;

alter table payments drop constraint if exists payments_payment_method_check;
alter table payments add constraint payments_payment_method_check
  check (payment_method in ('pix','credit_card','manual'));

create or replace function admin_activate_subscription_manually(
  p_subscriber_id uuid, p_plan subscription_plan, p_note text
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

  v_amount := case p_plan when 'annual' then 1439.04 else 149.90 end;

  insert into payments (subscriber_id, amount, plan, type, payment_method, notes, confirmed_by)
  values (p_subscriber_id, v_amount, p_plan, 'subscription', 'manual', trim(p_note), auth.uid())
  returning * into v_payment;

  return confirm_payment(v_payment.id);
end;
$$;

revoke execute on function admin_activate_subscription_manually(uuid, subscription_plan, text) from public, anon;
grant execute on function admin_activate_subscription_manually(uuid, subscription_plan, text) to authenticated;
