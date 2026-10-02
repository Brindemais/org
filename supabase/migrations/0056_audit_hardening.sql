-- Achados da auditoria de segurança (Supabase advisors) depois das
-- mudanças desta sessão:
--
-- 1. is_valid_email/is_valid_br_phone (migration 0052) foram criadas sem
--    "set search_path" — toda função SECURITY DEFINER (ou, como aqui,
--    chamada de dentro de uma SECURITY DEFINER) deveria fixar o
--    search_path pra não ficar vulnerável a sequestro de schema.
-- 2. As três funções de trigger protect_*_privileged_columns tinham o
--    grant default de EXECUTE pra PUBLIC, embora só façam sentido quando
--    chamadas pelo mecanismo de trigger (usam NEW/OLD, não funcionam se
--    chamadas direto via RPC). Revoga o grant solto.
create or replace function is_valid_br_phone(p_phone text) returns boolean
language sql immutable set search_path = public as $$
  select case
    when length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) not in (10, 11) then false
    when substring(regexp_replace(p_phone, '\D', '', 'g') from 1 for 2)::int not in (
      11,12,13,14,15,16,17,18,19,21,22,24,27,28,31,32,33,34,35,37,38,
      41,42,43,44,45,46,47,48,49,51,53,54,55,61,62,63,64,65,66,67,68,69,
      71,73,74,75,77,79,81,82,83,84,85,86,87,88,89,91,92,93,94,95,96,97,98,99
    ) then false
    when substring(regexp_replace(p_phone, '\D', '', 'g') from 3) ~ '^(\d)\1+$' then false
    when length(regexp_replace(p_phone, '\D', '', 'g')) = 11
      and substring(regexp_replace(p_phone, '\D', '', 'g') from 3 for 1) <> '9' then false
    else true
  end
$$;

create or replace function is_valid_email(p_email text) returns boolean
language sql immutable set search_path = public as $$
  select coalesce(p_email, '') ~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' and length(p_email) <= 254
$$;

revoke all on function protect_partners_privileged_columns() from public, anon, authenticated;
revoke all on function protect_products_privileged_columns() from public, anon, authenticated;
revoke all on function protect_profiles_privileged_columns() from public, anon, authenticated;
