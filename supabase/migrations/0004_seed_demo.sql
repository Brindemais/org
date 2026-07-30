-- ============================================================
-- OPTIONAL: demo/seed data for a fresh environment.
-- Creates one admin, one partner (Empório das Cervejas) with
-- products/stock, four partner listings, and 7 demo subscribers
-- with an active referral chain and pending pickups.
-- Safe to skip in a real production deploy.
-- ============================================================
create or replace function seed_create_auth_user(p_email text, p_password text) returns uuid language plpgsql set search_path = public, extensions, auth as $$
declare
  v_id uuid := gen_random_uuid();
begin
  if exists (select 1 from auth.users where email = p_email) then
    select id into v_id from auth.users where email = p_email;
    return v_id;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change, is_sso_user, is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', p_email,
    crypt(p_password, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', false, now(), now(),
    '', '', '', '', false, false
  );

  insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
  values (gen_random_uuid(), v_id::text, v_id, jsonb_build_object('sub', v_id::text, 'email', p_email), 'email', now(), now(), now());

  return v_id;
end;
$$;

do $$
declare
  v_admin uuid;
  v_partner1_user uuid;
  v_partner1 uuid;
  v_partner2 uuid;
  v_partner3 uuid;
  v_partner4 uuid;
  v_joao uuid; v_ana uuid; v_lucas uuid; v_mariana uuid; v_rafael uuid; v_camila uuid; v_felipe uuid;
  v_sub_joao uuid; v_sub_ana uuid; v_sub_lucas uuid; v_sub_mariana uuid;
  v_prod_taca uuid; v_prod_balde uuid; v_prod_kit uuid; v_prod_abridor uuid;
  v_pay uuid;
begin
  v_admin := seed_create_auth_user('admin@brindemais.com.br', 'BrindeMais2026!');
  insert into profiles (id, role, full_name, cpf, phone, email, referral_code)
  values (v_admin, 'admin', 'Equipe Brinde Mais', '00000000000', '21999999999', 'admin@brindemais.com.br', generate_referral_code())
  on conflict (id) do update set role = 'admin';

  insert into partners (id, company_name, trade_name, cnpj_cpf, responsible_name, phone, whatsapp, email, address, neighborhood, city, state, category, opening_hours, status, approved_at)
  values (gen_random_uuid(), 'Empório das Cervejas Ltda', 'Empório das Cervejas', '11.111.111/0001-11', 'João Silva', '21988887777', '21988887777', 'contato@emporiodascervejas.com.br', 'Rua das Flores, 123', 'Centro', 'Rio de Janeiro', 'RJ', 'deposito', 'Seg a Sáb, 10h às 22h', 'active', now() - interval '10 months')
  returning id into v_partner1;

  insert into partners (id, company_name, trade_name, cnpj_cpf, responsible_name, phone, whatsapp, email, address, neighborhood, city, state, category, opening_hours, status, approved_at)
  values (gen_random_uuid(), 'Boteco da Esquina Ltda', 'Boteco da Esquina', '22.222.222/0001-22', 'Maria Oliveira', '21977776666', '21977776666', 'contato@botecodaesquina.com.br', 'Av. Atlântica, 500', 'Copacabana', 'Rio de Janeiro', 'RJ', 'bar', 'Ter a Dom, 17h às 01h', 'active', now() - interval '6 months')
  returning id into v_partner2;

  insert into partners (id, company_name, trade_name, cnpj_cpf, responsible_name, phone, whatsapp, email, address, neighborhood, city, state, category, opening_hours, status, approved_at)
  values (gen_random_uuid(), 'Padaria Pão e Sabor Ltda', 'Padaria Pão & Sabor', '33.333.333/0001-33', 'Carlos Lima', '21966665555', '21966665555', 'contato@paoesabor.com.br', 'Rua Voluntários da Pátria, 80', 'Botafogo', 'Rio de Janeiro', 'RJ', 'conveniencia', 'Todos os dias, 6h às 22h', 'active', now() - interval '4 months')
  returning id into v_partner3;

  insert into partners (id, company_name, trade_name, cnpj_cpf, responsible_name, phone, whatsapp, email, address, neighborhood, city, state, category, opening_hours, status, approved_at)
  values (gen_random_uuid(), 'Adega Central Comércio Ltda', 'Adega Central', '44.444.444/0001-44', 'Ana Paula Souza', '21955554444', '21955554444', 'contato@adegacentral.com.br', 'Rua Barão de Ipanema, 45', 'Ipanema', 'Rio de Janeiro', 'RJ', 'adega', 'Seg a Sáb, 9h às 21h', 'active', now() - interval '2 months')
  returning id into v_partner4;

  v_partner1_user := seed_create_auth_user('parceiro@emporiodascervejas.com.br', 'BrindeMais2026!');
  insert into profiles (id, role, full_name, cpf, phone, email, referral_code)
  values (v_partner1_user, 'partner', 'João Silva', '11111111111', '21988887777', 'parceiro@emporiodascervejas.com.br', generate_referral_code())
  on conflict (id) do update set role = 'partner';
  insert into partner_staff (partner_id, profile_id) values (v_partner1, v_partner1_user) on conflict do nothing;

  insert into products (id, partner_id, name, description, category, normal_price, subscriber_price, is_gift, store_visible)
  values (gen_random_uuid(), v_partner1, 'Taça de Cerveja Premium Brinde Mais', 'Taça temática personalizada Brinde Mais + Empório das Cervejas', 'brinde', 49.90, 0, true, true)
  returning id into v_prod_taca;
  insert into stock_partner (partner_id, product_id, quantity) values (v_partner1, v_prod_taca, 28);
  insert into stock_matrix (product_id, quantity) values (v_prod_taca, 120);

  insert into products (id, partner_id, name, description, category, normal_price, subscriber_price, is_gift, store_visible)
  values (gen_random_uuid(), v_partner1, 'Balde de Gelo Brinde Mais', 'Balde de gelo personalizado', 'brinde', 39.90, 0, true, false)
  returning id into v_prod_balde;
  insert into stock_partner (partner_id, product_id, quantity) values (v_partner1, v_prod_balde, 9);

  insert into products (id, partner_id, name, description, category, normal_price, subscriber_price, is_gift, store_visible)
  values (gen_random_uuid(), v_partner1, 'Kit Cerveja Brinde Mais', 'Kit com taça e abridor', 'brinde', 69.90, 0, true, false)
  returning id into v_prod_kit;
  insert into stock_partner (partner_id, product_id, quantity) values (v_partner1, v_prod_kit, 15);

  insert into products (id, partner_id, name, description, category, normal_price, subscriber_price, is_gift, store_visible)
  values (gen_random_uuid(), v_partner1, 'Abridor de Garrafas Brinde Mais', 'Abridor de garrafas em metal personalizado', 'brinde', 19.90, 0, true, false)
  returning id into v_prod_abridor;
  insert into stock_partner (partner_id, product_id, quantity) values (v_partner1, v_prod_abridor, 32);

  insert into promotions (partner_id, title, description, normal_price, subscriber_price, discount_pct, valid_until, status)
  values (v_partner1, '10% OFF em cervejas selecionadas', '10% OFF em todas as cervejas selecionadas para assinantes Brinde Mais', null, null, 10, (now() + interval '30 days')::date, 'approved');

  v_joao := seed_create_auth_user('joao.silva@example.com', 'BrindeMais2026!');
  insert into profiles (id, role, full_name, cpf, phone, email, referral_code, city, state)
  values (v_joao, 'subscriber', 'João Silva Assinante', '22222222222', '21991111111', 'joao.silva@example.com', generate_referral_code(), 'Rio de Janeiro', 'RJ')
  on conflict (id) do nothing;

  v_ana := seed_create_auth_user('ana.paula@example.com', 'BrindeMais2026!');
  insert into profiles (id, role, full_name, cpf, phone, email, referral_code, referred_by, city, state)
  values (v_ana, 'subscriber', 'Ana Paula', '33333333333', '21992222222', 'ana.paula@example.com', generate_referral_code(), v_joao, 'Rio de Janeiro', 'RJ')
  on conflict (id) do nothing;
  insert into referrals (referrer_id, referred_id) values (v_joao, v_ana) on conflict do nothing;

  v_lucas := seed_create_auth_user('lucas@example.com', 'BrindeMais2026!');
  insert into profiles (id, role, full_name, cpf, phone, email, referral_code, referred_by, city, state)
  values (v_lucas, 'subscriber', 'Lucas', '44444444444', '21993333333', 'lucas@example.com', generate_referral_code(), v_ana, 'Rio de Janeiro', 'RJ')
  on conflict (id) do nothing;
  insert into referrals (referrer_id, referred_id) values (v_ana, v_lucas) on conflict do nothing;

  v_mariana := seed_create_auth_user('mariana@example.com', 'BrindeMais2026!');
  insert into profiles (id, role, full_name, cpf, phone, email, referral_code, referred_by, city, state)
  values (v_mariana, 'subscriber', 'Mariana', '55555555555', '21994444444', 'mariana@example.com', generate_referral_code(), v_joao, 'Rio de Janeiro', 'RJ')
  on conflict (id) do nothing;
  insert into referrals (referrer_id, referred_id) values (v_joao, v_mariana) on conflict do nothing;

  v_rafael := seed_create_auth_user('rafael@example.com', 'BrindeMais2026!');
  insert into profiles (id, role, full_name, cpf, phone, email, referral_code, city, state)
  values (v_rafael, 'subscriber', 'Rafael', '66666666666', '21995555555', 'rafael@example.com', generate_referral_code(), 'Rio de Janeiro', 'RJ')
  on conflict (id) do nothing;

  v_camila := seed_create_auth_user('camila@example.com', 'BrindeMais2026!');
  insert into profiles (id, role, full_name, cpf, phone, email, referral_code, city, state)
  values (v_camila, 'subscriber', 'Camila', '77777777777', '21996666666', 'camila@example.com', generate_referral_code(), 'Rio de Janeiro', 'RJ')
  on conflict (id) do nothing;

  v_felipe := seed_create_auth_user('felipe@example.com', 'BrindeMais2026!');
  insert into profiles (id, role, full_name, cpf, phone, email, referral_code, city, state)
  values (v_felipe, 'subscriber', 'Felipe', '88888888888', '21997777777', 'felipe@example.com', generate_referral_code(), 'Rio de Janeiro', 'RJ')
  on conflict (id) do nothing;

  insert into subscriptions (subscriber_id, status, amount, activated_at, expires_at)
  values (v_joao, 'active', 79.00, now() - interval '3 months', now() + interval '20 days') returning id into v_sub_joao;
  insert into subscriptions (subscriber_id, status, amount, activated_at, expires_at)
  values (v_ana, 'active', 79.00, now() - interval '2 months', now() + interval '15 days') returning id into v_sub_ana;
  insert into subscriptions (subscriber_id, status, amount, activated_at, expires_at)
  values (v_lucas, 'active', 79.00, now() - interval '1 months', now() + interval '10 days') returning id into v_sub_lucas;
  insert into subscriptions (subscriber_id, status, amount, activated_at, expires_at)
  values (v_mariana, 'active', 79.00, now() - interval '1 months', now() + interval '25 days') returning id into v_sub_mariana;
  insert into subscriptions (subscriber_id, status, amount, activated_at, expires_at)
  values (v_rafael, 'active', 79.00, now() - interval '2 months', now() + interval '18 days');
  insert into subscriptions (subscriber_id, status, amount, activated_at, expires_at)
  values (v_camila, 'active', 79.00, now() - interval '5 months', now() + interval '12 days');
  insert into subscriptions (subscriber_id, status, amount, activated_at, expires_at)
  values (v_felipe, 'active', 79.00, now() - interval '1 months', now() + interval '9 days');

  insert into payments (subscriber_id, subscription_id, amount, type, status, pix_code, confirmed_at, confirmed_by)
  values (v_ana, v_sub_ana, 79.00, 'subscription', 'confirmed', 'SEED-PIX-ANA', now(), v_admin) returning id into v_pay;
  perform award_referral_bonuses(v_ana, 79.00, 'subscription', v_pay);

  insert into payments (subscriber_id, subscription_id, amount, type, status, pix_code, confirmed_at, confirmed_by)
  values (v_lucas, v_sub_lucas, 79.00, 'subscription', 'confirmed', 'SEED-PIX-LUCAS', now(), v_admin) returning id into v_pay;
  perform award_referral_bonuses(v_lucas, 79.00, 'subscription', v_pay);

  insert into payments (subscriber_id, subscription_id, amount, type, status, pix_code, confirmed_at, confirmed_by)
  values (v_mariana, v_sub_mariana, 79.00, 'subscription', 'confirmed', 'SEED-PIX-MARIANA', now(), v_admin) returning id into v_pay;
  perform award_referral_bonuses(v_mariana, 79.00, 'subscription', v_pay);

  insert into pickups (subscriber_id, subscription_id, partner_id, status, code, cycle_month, cycle_year, deadline, created_at)
  values
    (v_lucas, v_sub_lucas, v_partner1, 'ready', generate_pickup_code(), extract(month from now())::int, extract(year from now())::int, now() + interval '25 days', now() - interval '2 days'),
    (v_mariana, v_sub_mariana, v_partner1, 'ready', generate_pickup_code(), extract(month from now())::int, extract(year from now())::int, now() + interval '25 days', now() - interval '2 days'),
    (v_rafael, (select id from subscriptions where subscriber_id = v_rafael limit 1), v_partner1, 'ready', generate_pickup_code(), extract(month from now())::int, extract(year from now())::int, now() + interval '25 days', now() - interval '1 days'),
    (v_camila, (select id from subscriptions where subscriber_id = v_camila limit 1), v_partner1, 'ready', generate_pickup_code(), extract(month from now())::int, extract(year from now())::int, now() + interval '25 days', now() - interval '1 days'),
    (v_felipe, (select id from subscriptions where subscriber_id = v_felipe limit 1), v_partner1, 'ready', generate_pickup_code(), extract(month from now())::int, extract(year from now())::int, now() + interval '25 days', now() - interval '1 days');

  insert into support_tickets (user_id, category, subject, status) values (v_joao, 'Retirada', 'Problema com retirada do brinde deste mês', 'open');
end;
$$;

drop function seed_create_auth_user(text, text);
