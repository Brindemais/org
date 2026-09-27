-- Espelha admin_activate_subscription_manually (0047), agora pro lado do
-- parceiro: ativa o status de anunciante (taxa de R$149,90) sem passar
-- pela Asaas. subscriber_id do pagamento é resolvido pelo primeiro staff
-- vinculado ao parceiro (partner_staff) — sem staff nenhum, não tem quem
-- notificar nem em nome de quem lançar o pagamento, então a função avisa
-- em vez de inserir um pagamento sem dono.
create or replace function admin_activate_advertiser_manually(
  p_partner_id uuid, p_note text
) returns payments language plpgsql security definer set search_path = public as $$
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

  return confirm_payment(v_payment.id);
end;
$$;

revoke execute on function admin_activate_advertiser_manually(uuid, text) from public, anon;
grant execute on function admin_activate_advertiser_manually(uuid, text) to authenticated;
