-- ============================================================
-- Indicação com nome em vez de código aleatório, e indicação
-- obrigatória no cadastro (tanto assinante quanto parceiro).
--
-- Antes: referral_code era sempre gerado automaticamente (ex: BM9WIMDJ)
-- e o campo "quem indicou" era opcional, só preenchido se viesse um
-- ?ref= na URL. Agora: a pessoa escolhe seu próprio link de indicação
-- (nome artístico, nome do estabelecimento, apelido etc.) no cadastro, e
-- é obrigatório informar quem indicou pra concluir o cadastro.
--
-- NOTA: "drop function" nesta instância do projeto trava indefinidamente
-- (ver migration 0050). Workaround: renomear o overload antigo e
-- revogar toda permissão dele, em vez de dropar.
-- ============================================================

create or replace function normalize_referral_code(p_input text) returns text
language sql immutable set search_path = public as $$
  select nullif(
    regexp_replace(
      regexp_replace(
        lower(
          translate(
            trim(coalesce(p_input, '')),
            'àáâãäåāăąèéêëēĕėęěìíîïĩīĭįòóôõöøōŏőùúûüũūŭůűųçćĉċčñńņňÿý',
            'aaaaaaaaaeeeeeeeeeiiiiiiiiooooooooouuuuuuuuuucccccnnnnyy'
          )
        ),
        '[^a-z0-9]+', '-', 'g'
      ),
      '(^-+)|(-+$)', '', 'g'
    ),
    ''
  )
$$;

-- Lookup público (anon) pra validar "quem indicou" antes mesmo de criar a
-- conta — evita criar um usuário no auth.users órfão (sem profile) por
-- causa de um código de indicação inválido.
create or replace function resolve_referral_code(p_code text) returns text
language sql security definer set search_path = public as $$
  select full_name from profiles where lower(referral_code) = normalize_referral_code(p_code) limit 1;
$$;
revoke all on function resolve_referral_code(text) from public;
grant execute on function resolve_referral_code(text) to anon, authenticated;

-- Checagem pública de disponibilidade do link próprio que a pessoa está
-- tentando criar pra si mesma durante o cadastro.
create or replace function referral_code_available(p_code text) returns boolean
language sql security definer set search_path = public as $$
  select normalize_referral_code(p_code) <> ''
    and length(normalize_referral_code(p_code)) >= 3
    and not exists (select 1 from profiles where lower(referral_code) = normalize_referral_code(p_code));
$$;
revoke all on function referral_code_available(text) from public;
grant execute on function referral_code_available(text) to anon, authenticated;

-- complete_signup ganha p_my_referral_code (link próprio escolhido) e
-- p_referral_code deixa de ter default: agora é obrigatório apontar pra
-- um indicador existente, senão a função recusa o cadastro.
alter function complete_signup(text, text, date, text, text, text)
  rename to complete_signup_stale_v1;
revoke all on function complete_signup_stale_v1(text, text, date, text, text, text)
  from public, anon, authenticated, service_role;

create or replace function complete_signup(
  p_full_name text, p_cpf text, p_birth_date date, p_phone text, p_email text,
  p_referral_code text, p_my_referral_code text default null
) returns profiles language plpgsql security definer set search_path = public as $$
declare
  v_referrer_id uuid;
  v_profile profiles;
  v_ref_norm text;
  v_my_norm text;
  v_my_code text;
begin
  if exists (select 1 from profiles where cpf = p_cpf) then
    raise exception 'CPF_ALREADY_REGISTERED';
  end if;

  v_ref_norm := normalize_referral_code(p_referral_code);
  if v_ref_norm = '' then
    raise exception 'REFERRAL_REQUIRED';
  end if;
  select id into v_referrer_id from profiles where lower(referral_code) = v_ref_norm;
  if v_referrer_id is null then
    raise exception 'REFERRER_NOT_FOUND';
  end if;

  v_my_norm := normalize_referral_code(p_my_referral_code);
  if v_my_norm = '' then
    v_my_code := generate_referral_code();
  else
    if length(v_my_norm) < 3 then
      raise exception 'REFERRAL_LOGIN_TOO_SHORT';
    end if;
    if exists (select 1 from profiles where lower(referral_code) = v_my_norm) then
      raise exception 'REFERRAL_LOGIN_TAKEN';
    end if;
    v_my_code := v_my_norm;
  end if;

  insert into profiles (id, full_name, cpf, birth_date, phone, email, referral_code, referred_by)
  values (auth.uid(), p_full_name, p_cpf, p_birth_date, p_phone, p_email, v_my_code, v_referrer_id)
  returning * into v_profile;

  insert into referrals (referrer_id, referred_id) values (v_referrer_id, auth.uid());

  return v_profile;
end;
$$;

revoke all on function complete_signup(text, text, date, text, text, text, text) from public, anon;
grant execute on function complete_signup(text, text, date, text, text, text, text) to authenticated;

-- complete_partner_signup: mesma mudança — p_my_referral_code novo, e
-- p_referral_code passa a ser obrigatório.
alter function complete_partner_signup(text, text, text, text, text, text, text, text, text, text, text, text)
  rename to complete_partner_signup_stale_v2;
revoke all on function complete_partner_signup_stale_v2(text, text, text, text, text, text, text, text, text, text, text, text)
  from public, anon, authenticated, service_role;

create or replace function complete_partner_signup(
  p_company_name text, p_trade_name text, p_cnpj_cpf text, p_responsible_name text,
  p_phone text, p_whatsapp text, p_email text, p_category text,
  p_city text, p_neighborhood text, p_address text,
  p_referral_code text, p_my_referral_code text default null
) returns partners language plpgsql security definer set search_path = public as $$
declare
  v_partner partners;
  v_referrer_id uuid;
  v_ref_norm text;
  v_my_norm text;
  v_my_code text;
begin
  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'PROFILE_ALREADY_EXISTS';
  end if;

  v_ref_norm := normalize_referral_code(p_referral_code);
  if v_ref_norm = '' then
    raise exception 'REFERRAL_REQUIRED';
  end if;
  select id into v_referrer_id from profiles where lower(referral_code) = v_ref_norm;
  if v_referrer_id is null then
    raise exception 'REFERRER_NOT_FOUND';
  end if;

  v_my_norm := normalize_referral_code(p_my_referral_code);
  if v_my_norm = '' then
    v_my_code := generate_referral_code();
  else
    if length(v_my_norm) < 3 then
      raise exception 'REFERRAL_LOGIN_TOO_SHORT';
    end if;
    if exists (select 1 from profiles where lower(referral_code) = v_my_norm) then
      raise exception 'REFERRAL_LOGIN_TAKEN';
    end if;
    v_my_code := v_my_norm;
  end if;

  insert into profiles (id, role, full_name, email, phone, referral_code, referred_by)
  values (auth.uid(), 'partner', p_responsible_name, p_email, p_phone, v_my_code, v_referrer_id);

  insert into partners (company_name, trade_name, cnpj_cpf, responsible_name, phone, whatsapp, email, category, city, neighborhood, address, requires_fee)
  values (p_company_name, p_trade_name, p_cnpj_cpf, p_responsible_name, p_phone, coalesce(nullif(p_whatsapp, ''), p_phone), p_email, p_category, p_city, p_neighborhood, p_address, true)
  returning * into v_partner;

  insert into partner_staff (partner_id, profile_id) values (v_partner.id, auth.uid());

  insert into referrals (referrer_id, referred_id) values (v_referrer_id, auth.uid());

  return v_partner;
end;
$$;

revoke all on function complete_partner_signup(text, text, text, text, text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function complete_partner_signup(text, text, text, text, text, text, text, text, text, text, text, text, text) to authenticated;
