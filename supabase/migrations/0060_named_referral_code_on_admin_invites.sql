-- O código de indicação "bonito" (nome/apelido em vez de código aleatório)
-- só foi aplicado em complete_signup/complete_partner_signup (migração
-- 0051) — quem entra pelo convite do admin (admin_complete_partner_invite,
-- admin_complete_staff_invite) continuava recebendo generate_referral_code()
-- direto, sem chance de escolher um nome. A própria conta de admin (seed
-- original, antes dessa feature existir) também ficou com código aleatório
-- — corrigido manualmente pra 'brindemais' nesta sessão.
--
-- Mesma assinatura em ambas as funções (hífen em vez de parâmetro novo no
-- meio não muda a ordem dos existentes), então CREATE OR REPLACE direto
-- funciona — sem precisar do rename+revoke usado quando a assinatura muda
-- de posição/tipo dos argumentos já existentes.
create or replace function admin_complete_partner_invite(
  p_partner_id uuid, p_user_id uuid, p_email text, p_full_name text, p_phone text, p_referral_code text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_norm text;
  v_code text;
begin
  v_norm := normalize_referral_code(p_referral_code);
  if v_norm = '' then
    v_code := generate_referral_code();
  else
    if length(v_norm) < 3 then raise exception 'REFERRAL_LOGIN_TOO_SHORT'; end if;
    if exists (select 1 from profiles where lower(referral_code) = v_norm) then raise exception 'REFERRAL_LOGIN_TAKEN'; end if;
    v_code := v_norm;
  end if;

  insert into profiles (id, role, full_name, email, phone, referral_code)
  values (p_user_id, 'partner', coalesce(p_full_name, 'Parceiro Brinde Mais'), p_email, p_phone, v_code)
  on conflict (id) do update set role = 'partner';

  insert into partner_staff (partner_id, profile_id) values (p_partner_id, p_user_id)
  on conflict (partner_id, profile_id) do nothing;

  update partners set invited_at = now() where id = p_partner_id;
end;
$$;
revoke execute on function admin_complete_partner_invite(uuid,uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function admin_complete_partner_invite(uuid,uuid,text,text,text,text) to service_role;

create or replace function admin_complete_staff_invite(
  p_user_id uuid, p_email text, p_full_name text, p_role user_role, p_referral_code text default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_norm text;
  v_code text;
begin
  if p_role not in ('admin', 'operator') then
    raise exception 'INVALID_ROLE';
  end if;

  v_norm := normalize_referral_code(p_referral_code);
  if v_norm = '' then
    v_code := generate_referral_code();
  else
    if length(v_norm) < 3 then raise exception 'REFERRAL_LOGIN_TOO_SHORT'; end if;
    if exists (select 1 from profiles where lower(referral_code) = v_norm) then raise exception 'REFERRAL_LOGIN_TAKEN'; end if;
    v_code := v_norm;
  end if;

  insert into profiles (id, role, full_name, email, referral_code)
  values (p_user_id, p_role, coalesce(p_full_name, 'Equipe Brinde Mais'), p_email, v_code)
  on conflict (id) do update set role = p_role;
end;
$$;
revoke execute on function admin_complete_staff_invite(uuid, text, text, user_role, text) from public, anon, authenticated;
grant execute on function admin_complete_staff_invite(uuid, text, text, user_role, text) to service_role;
