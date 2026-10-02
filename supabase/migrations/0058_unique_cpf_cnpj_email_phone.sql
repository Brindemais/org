-- Cada CPF, CNPJ, e-mail e telefone só pode ter 1 cadastro na plataforma.
-- profiles.cpf já tinha unique constraint; os outros cinco não tinham
-- nenhuma — nem no banco nem checagem de app (complete_partner_signup
-- nunca verificava CNPJ duplicado, por exemplo). profiles.phone/email
-- cobrem assinante e parceiro juntos (mesma tabela pros dois logins,
-- mesmo padrão já usado pra nome completo único). partners.cnpj_cpf/
-- phone/email são um pool separado — identidade do estabelecimento, não
-- da pessoa responsável.
--
-- Dado de teste limpo antes de aplicar: 4 profiles (Andre Americo,
-- Teste1, Teste2, teste3) compartilhavam o mesmo telefone de teste —
-- mantido só no profile mais antigo (Andre Americo), null nos outros 3.
update profiles set phone = null
where id in ('5deaed0e-dbac-49c8-a08e-a14660d04db5','0e6eef34-0ba7-445b-adff-f9991d1d0868','0c73cc62-7639-4dc9-acda-a46c923ce228');

alter table profiles add constraint profiles_phone_key unique (phone);
alter table profiles add constraint profiles_email_key unique (email);
alter table partners add constraint partners_cnpj_cpf_key unique (cnpj_cpf);
alter table partners add constraint partners_phone_key unique (phone);
alter table partners add constraint partners_email_key unique (email);

-- complete_signup ganha checagem de telefone duplicado (CPF já checava).
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

  if exists (select 1 from profiles where phone = regexp_replace(p_phone, '\D', '', 'g')) then
    raise exception 'PHONE_ALREADY_REGISTERED';
  end if;

  if not is_valid_email(p_email) then
    raise exception 'INVALID_EMAIL';
  end if;

  if exists (select 1 from profiles where lower(trim(regexp_replace(full_name, '\s+', ' ', 'g'))) = lower(trim(regexp_replace(p_full_name, '\s+', ' ', 'g')))) then
    raise exception 'FULL_NAME_ALREADY_REGISTERED';
  end if;

  if age(p_birth_date) < interval '18 years' then
    raise exception 'MINOR_NOT_ALLOWED';
  end if;

  if not is_valid_br_phone(p_phone) then
    raise exception 'INVALID_PHONE';
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

-- complete_partner_signup ganha checagem de CNPJ/CPF duplicado (nunca
-- tinha) e de telefone duplicado, cruzando tanto profiles quanto
-- partners (pode já existir como login de assinante ou como telefone de
-- outro estabelecimento).
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

  if p_cnpj_cpf is not null and length(trim(p_cnpj_cpf)) > 0
    and exists (select 1 from partners where regexp_replace(cnpj_cpf, '\D', '', 'g') = regexp_replace(p_cnpj_cpf, '\D', '', 'g')) then
    raise exception 'CNPJ_ALREADY_REGISTERED';
  end if;

  if exists (select 1 from profiles where phone = regexp_replace(p_phone, '\D', '', 'g')) then
    raise exception 'PHONE_ALREADY_REGISTERED';
  end if;

  if exists (select 1 from partners where phone = regexp_replace(p_phone, '\D', '', 'g')) then
    raise exception 'PHONE_ALREADY_REGISTERED';
  end if;

  if not is_valid_email(p_email) then
    raise exception 'INVALID_EMAIL';
  end if;

  if exists (select 1 from profiles where lower(trim(regexp_replace(full_name, '\s+', ' ', 'g'))) = lower(trim(regexp_replace(p_responsible_name, '\s+', ' ', 'g')))) then
    raise exception 'FULL_NAME_ALREADY_REGISTERED';
  end if;

  if not is_valid_br_phone(p_phone) then
    raise exception 'INVALID_PHONE';
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
