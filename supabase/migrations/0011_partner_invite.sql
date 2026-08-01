-- Partner activation flow: admin approves -> edge function invites the
-- partner by e-mail (creates their auth user, no password yet) -> partner
-- clicks the e-mail link, sets a password, lands straight in /parceiro.

alter table partners add column if not exists invited_at timestamptz;

-- Called only by the invite-partner Edge Function using the service_role
-- key (never exposed to the browser). Not reachable by anon/authenticated —
-- the Edge Function itself verifies the caller is an admin before invoking
-- this, using the caller's own JWT, so this function doesn't need to
-- re-check is_admin() (auth.uid() would be null under service_role anyway).
create or replace function admin_complete_partner_invite(
  p_partner_id uuid, p_user_id uuid, p_email text, p_full_name text, p_phone text
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, role, full_name, email, phone, referral_code)
  values (p_user_id, 'partner', coalesce(p_full_name, 'Parceiro Brinde Mais'), p_email, p_phone, generate_referral_code())
  on conflict (id) do update set role = 'partner';

  insert into partner_staff (partner_id, profile_id) values (p_partner_id, p_user_id)
  on conflict (partner_id, profile_id) do nothing;

  update partners set invited_at = now() where id = p_partner_id;
end;
$$;

-- 0006's default-privileges rule grants EXECUTE directly to anon/authenticated
-- on every new function (separate from the PUBLIC grant) — revoke from both
-- explicitly, same lesson as 0007's fix for the maintenance functions.
revoke execute on function admin_complete_partner_invite(uuid,uuid,text,text,text) from public, anon, authenticated;
grant execute on function admin_complete_partner_invite(uuid,uuid,text,text,text) to service_role;
