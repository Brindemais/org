-- Bug real encontrado: admin_activate_subscription_manually() ainda
-- inseria o valor antigo (R$149,90 mensal / R$1.439,04 anual), de antes
-- da mudança de preço desta sessão (migrações 0106/0110, R$79/R$853,20).
-- O gatilho validate_subscription_payment já exige o valor novo, então
-- toda tentativa de ativação manual de assinatura vinha sendo rejeitada
-- (INVALID_PLAN_AMOUNT) desde a mudança de preço — a tela só mostra a
-- mensagem genérica "Não foi possível ativar", sem detalhar o motivo.
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

  v_amount := case p_plan when 'annual' then 853.20 else 79.00 end;

  insert into payments (subscriber_id, amount, plan, type, payment_method, notes, confirmed_by)
  values (p_subscriber_id, v_amount, p_plan, 'subscription', 'manual', trim(p_note), auth.uid())
  returning * into v_payment;

  return confirm_payment(v_payment.id, auth.uid(), p_award_bonus);
end;
$$;

revoke all on function admin_activate_subscription_manually(uuid, subscription_plan, text, boolean, boolean) from public, anon;
grant execute on function admin_activate_subscription_manually(uuid, subscription_plan, text, boolean, boolean) to authenticated;
