-- Mirrors admin_complete_partner_invite (0011) but for internal staff
-- (admin/operator) accounts. Only callable by service_role — the
-- invite-staff Edge Function is the only caller, and it independently
-- checks the inviting user is themselves role='admin' before invoking
-- this, so operators can't use it to create more staff accounts.
create or replace function admin_complete_staff_invite(
  p_user_id uuid, p_email text, p_full_name text, p_role user_role
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_role not in ('admin', 'operator') then
    raise exception 'INVALID_ROLE';
  end if;

  insert into profiles (id, role, full_name, email, referral_code)
  values (p_user_id, p_role, coalesce(p_full_name, 'Equipe Brinde Mais'), p_email, generate_referral_code())
  on conflict (id) do update set role = p_role;
end;
$$;

revoke execute on function admin_complete_staff_invite(uuid, text, text, user_role) from public, anon, authenticated;
grant execute on function admin_complete_staff_invite(uuid, text, text, user_role) to service_role;
