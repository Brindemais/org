-- Os dados que a Asaas exige pra criar a subconta (endereço completo,
-- faturamento, tipo de empresa/data de nascimento) passam a ser
-- obrigatórios já no cadastro do parceiro, não mais opcionais — era por
-- causa disso que o vínculo com a Asaas ficava travado em silêncio pra
-- quem pulava esses campos. CEP também vira parâmetro direto da função
-- (antes só era salvo num update separado depois, saveExtras no front,
-- que podia falhar sem travar o cadastro).
drop function if exists complete_partner_signup(text, text, text, text, text, text, text, text, text, text, text, text, text, text, numeric, text, date);

create function complete_partner_signup(
  p_company_name text, p_trade_name text, p_cnpj_cpf text, p_responsible_name text,
  p_phone text, p_whatsapp text, p_email text, p_category text,
  p_city text, p_neighborhood text, p_address text,
  p_referral_code text, p_my_referral_code text default null,
  p_address_number text default null, p_income_value numeric default null,
  p_company_type text default null, p_birth_date date default null, p_cep text default null
) returns partners language plpgsql security definer set search_path = public as $$
declare
  v_partner partners;
  v_referrer_id uuid;
  v_ref_norm text;
  v_my_norm text;
  v_my_code text;
  v_is_cpf boolean;
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

  -- Dados exigidos pela Asaas pra criar a subconta (split automático de
  -- venda) — obrigatórios aqui pra nunca mais cair no caso de parceiro
  -- cadastrado sem conseguir completar o vínculo depois.
  if p_address is null or length(trim(p_address)) = 0 then raise exception 'MISSING_ADDRESS'; end if;
  if p_address_number is null or length(trim(p_address_number)) = 0 then raise exception 'MISSING_ADDRESS_NUMBER'; end if;
  if p_neighborhood is null or length(trim(p_neighborhood)) = 0 then raise exception 'MISSING_NEIGHBORHOOD'; end if;
  if p_cep is null or length(trim(p_cep)) = 0 then raise exception 'MISSING_CEP'; end if;
  if p_income_value is null then raise exception 'MISSING_INCOME_VALUE'; end if;

  v_is_cpf := length(regexp_replace(coalesce(p_cnpj_cpf, ''), '\D', '', 'g')) = 11;
  if v_is_cpf then
    if p_birth_date is null then raise exception 'MISSING_BIRTH_DATE'; end if;
  else
    if p_company_type is null or length(trim(p_company_type)) = 0 then raise exception 'MISSING_COMPANY_TYPE'; end if;
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

  insert into partners (
    company_name, trade_name, cnpj_cpf, responsible_name, phone, whatsapp, email, category,
    city, neighborhood, address, requires_fee, address_number, income_value, company_type, birth_date, cep
  )
  values (
    p_company_name, p_trade_name, p_cnpj_cpf, p_responsible_name, p_phone, coalesce(nullif(p_whatsapp, ''), p_phone), p_email, p_category,
    p_city, p_neighborhood, p_address, true, p_address_number, p_income_value,
    case when v_is_cpf then null else p_company_type end,
    case when v_is_cpf then p_birth_date else null end,
    regexp_replace(p_cep, '\D', '', 'g')
  )
  returning * into v_partner;

  insert into partner_staff (partner_id, profile_id) values (v_partner.id, auth.uid());

  insert into referrals (referrer_id, referred_id) values (v_referrer_id, auth.uid());

  return v_partner;
end;
$$;

revoke all on function complete_partner_signup(text, text, text, text, text, text, text, text, text, text, text, text, text, text, numeric, text, date, text) from public, anon;
grant execute on function complete_partner_signup(text, text, text, text, text, text, text, text, text, text, text, text, text, text, numeric, text, date, text) to authenticated;
