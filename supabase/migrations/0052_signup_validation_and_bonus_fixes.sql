-- ============================================================
-- Validações de cadastro (e-mail, nome duplicado, maioridade, celular),
-- proteção contra ativação manual duplicada (causa do bônus nível 1
-- duplicado visto em teste) e extrato mostrando quem gerou o bônus.
-- ============================================================

create or replace function is_valid_br_phone(p_phone text) returns boolean
language sql immutable as $$
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
language sql immutable as $$
  select coalesce(p_email, '') ~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' and length(p_email) <= 254
$$;

-- admin_activate_subscription_manually ganha p_force: sem ele, recusa
-- ativar de novo quem já tem assinatura ativa e não vencida (foi assim
-- que o bônus de nível 1 duplicou em teste — dois cliques de ativação
-- manual pro mesmo assinante, dois pagamentos, duas bonificações).
alter function admin_activate_subscription_manually(uuid, subscription_plan, text)
  rename to admin_activate_subscription_manually_stale_v1;
revoke all on function admin_activate_subscription_manually_stale_v1(uuid, subscription_plan, text)
  from public, anon, authenticated, service_role;

create or replace function admin_activate_subscription_manually(
  p_subscriber_id uuid, p_plan subscription_plan, p_note text, p_force boolean default false
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

  v_amount := case p_plan when 'annual' then 1439.04 else 149.90 end;

  insert into payments (subscriber_id, amount, plan, type, payment_method, notes, confirmed_by)
  values (p_subscriber_id, v_amount, p_plan, 'subscription', 'manual', trim(p_note), auth.uid())
  returning * into v_payment;

  return confirm_payment(v_payment.id);
end;
$$;

revoke all on function admin_activate_subscription_manually(uuid, subscription_plan, text, boolean) from public, anon;
grant execute on function admin_activate_subscription_manually(uuid, subscription_plan, text, boolean) to authenticated;

-- complete_signup: e-mail válido, nome não duplicado, maior de idade,
-- celular em formato real (DDD válido, não é sequência repetida).
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

-- complete_partner_signup: mesmas validações de e-mail, nome e celular
-- (não se aplica maioridade — não coleta data de nascimento do responsável).
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

-- award_referral_bonuses: descrição do extrato passa a citar quem gerou
-- o bônus (ex: "Nível 1 · assinatura de João"), em vez de só o nível/tipo.
create or replace function award_referral_bonuses(
  p_source_subscriber_id uuid, p_base_amount numeric, p_type text, p_origin_payment_id uuid,
  p_origin_pickup_id uuid default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_current uuid;
  v_level int := 1;
  v_pct numeric;
  v_amount numeric;
  v_balance numeric;
  v_ref_type text;
  v_ref_id uuid;
  v_label text;
  v_source_name text;
begin
  select referred_by into v_current from profiles where id = p_source_subscriber_id;
  select full_name into v_source_name from profiles where id = p_source_subscriber_id;

  v_ref_type := case when p_origin_pickup_id is not null then 'pickup' else 'payment' end;
  v_ref_id := coalesce(p_origin_pickup_id, p_origin_payment_id);
  v_label := case p_type when 'subscription' then 'assinatura' when 'partner_fee' then 'indicação de parceiro' else 'consumo' end;

  while v_current is not null and v_level <= 4 loop
    if p_type = 'subscription' then
      v_pct := case when v_level <= 2 then 10.0 else 1.0 end;
    else
      v_pct := 1.0;
    end if;

    v_amount := round(p_base_amount * v_pct / 100.0, 2);

    insert into bonuses (beneficiary_id, source_subscriber_id, type, level, percent, amount, origin_payment_id, origin_pickup_id)
    values (v_current, p_source_subscriber_id, p_type, v_level, v_pct, v_amount, p_origin_payment_id, p_origin_pickup_id);

    select current_wallet_balance(v_current) + v_amount into v_balance;

    insert into wallet_transactions (user_id, type, direction, amount, balance_after, reference_type, reference_id, description)
    values (
      v_current,
      (case when p_type = 'subscription' then 'bonus_subscription' else 'bonus_consumption' end)::wallet_tx_type,
      'in', v_amount, v_balance, v_ref_type, v_ref_id,
      'Nível ' || v_level || ' (' || v_pct || '%) · ' || v_label || ' de ' || coalesce(v_source_name, 'alguém da sua rede')
    );

    insert into notifications (user_id, type, title, message)
    values (v_current, 'bonus', 'Nova bonificação recebida', 'Você recebeu R$ ' || v_amount || ' de bonificação (nível ' || v_level || ').');

    select referred_by into v_current from profiles where id = v_current;
    v_level := v_level + 1;
  end loop;
end;
$$;
