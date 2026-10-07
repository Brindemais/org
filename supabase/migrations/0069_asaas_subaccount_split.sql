-- Repasse automático via Asaas: cada parceiro pode ter uma subconta
-- Asaas (POST /v3/accounts, criada pela edge function
-- asaas-create-subaccount), identificada por asaas_wallet_id. Quando ela
-- existe, a compra de produto usa split de pagamento (Asaas já manda o
-- líquido direto pra conta do parceiro) em vez de creditar a carteira
-- interna — ver asaas-create-pix-charge/asaas-charge-card.
alter table partners
  add column address_number text,
  add column income_value numeric(12,2),
  add column company_type text check (company_type in ('MEI','LIMITED','INDIVIDUAL','ASSOCIATION')),
  add column birth_date date,
  add column asaas_account_id text,
  add column asaas_wallet_id text,
  add column asaas_subaccount_status text not null default 'pending' check (asaas_subaccount_status in ('pending','created','failed')),
  add column asaas_subaccount_error text;

alter table product_orders add column split_applied boolean not null default false;

-- complete_partner_signup ganha os 4 campos novos (precisa deles pra
-- conseguir criar a subconta já no cadastro). A versão antiga (13 args)
-- é removida — ela e a nova (17 args) seriam ambíguas pro PostgREST se
-- as duas existissem com os mesmos 13 primeiros nomes de parâmetro.
drop function if exists complete_partner_signup(text, text, text, text, text, text, text, text, text, text, text, text, text);

create function complete_partner_signup(
  p_company_name text, p_trade_name text, p_cnpj_cpf text, p_responsible_name text,
  p_phone text, p_whatsapp text, p_email text, p_category text,
  p_city text, p_neighborhood text, p_address text,
  p_referral_code text, p_my_referral_code text default null,
  p_address_number text default null, p_income_value numeric default null,
  p_company_type text default null, p_birth_date date default null
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

  insert into partners (
    company_name, trade_name, cnpj_cpf, responsible_name, phone, whatsapp, email, category,
    city, neighborhood, address, requires_fee, address_number, income_value, company_type, birth_date
  )
  values (
    p_company_name, p_trade_name, p_cnpj_cpf, p_responsible_name, p_phone, coalesce(nullif(p_whatsapp, ''), p_phone), p_email, p_category,
    p_city, p_neighborhood, p_address, true, p_address_number, p_income_value, p_company_type, p_birth_date
  )
  returning * into v_partner;

  insert into partner_staff (partner_id, profile_id) values (v_partner.id, auth.uid());

  insert into referrals (referrer_id, referred_id) values (v_referrer_id, auth.uid());

  return v_partner;
end;
$$;

revoke all on function complete_partner_signup(text, text, text, text, text, text, text, text, text, text, text, text, text, text, numeric, text, date) from public, anon;
grant execute on function complete_partner_signup(text, text, text, text, text, text, text, text, text, text, text, text, text, text, numeric, text, date) to authenticated;

-- create_product_order: guarda se o pedido já nasceu com split aplicado
-- (parceiro já tinha subconta Asaas na hora da compra) — determina se
-- confirm_product_order_delivery credita a carteira interna ou não.
create or replace function create_product_order(
  p_promotion_id uuid, p_quantity int, p_payment_method text
) returns payments language plpgsql security definer set search_path = public as $$
declare
  v_promo promotions;
  v_order product_orders;
  v_payment payments;
  v_commission_pct numeric := 10.0;
  v_total numeric;
  v_commission numeric;
  v_net numeric;
  v_has_wallet boolean;
begin
  if not is_active_subscriber() then
    raise exception 'ACCOUNT_SUSPENDED';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'INVALID_QUANTITY';
  end if;
  if p_payment_method not in ('pix', 'credit_card') then
    raise exception 'INVALID_PAYMENT_METHOD';
  end if;

  select * into v_promo from promotions where id = p_promotion_id and status = 'approved' for update;
  if v_promo.id is null then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;
  if v_promo.subscriber_price is null or v_promo.subscriber_price <= 0 then
    raise exception 'PRODUCT_HAS_NO_PRICE';
  end if;

  update promotions set quantity = quantity - p_quantity where id = p_promotion_id and quantity >= p_quantity;
  if not found then
    raise exception 'OUT_OF_STOCK';
  end if;

  v_total := round(v_promo.subscriber_price * p_quantity, 2);
  v_commission := round(v_total * v_commission_pct / 100.0, 2);
  v_net := v_total - v_commission;

  select (asaas_wallet_id is not null) into v_has_wallet from partners where id = v_promo.partner_id;

  insert into product_orders (
    subscriber_id, partner_id, promotion_id, quantity, unit_price, total_amount,
    commission_pct, commission_amount, net_amount, code, deadline, split_applied
  ) values (
    auth.uid(), v_promo.partner_id, v_promo.id, p_quantity, v_promo.subscriber_price, v_total,
    v_commission_pct, v_commission, v_net, generate_product_order_code(), now() + interval '7 days', coalesce(v_has_wallet, false)
  ) returning * into v_order;

  insert into payments (subscriber_id, partner_id, amount, type, payment_method, product_order_id)
  values (auth.uid(), v_promo.partner_id, v_total, 'product_purchase', p_payment_method, v_order.id)
  returning * into v_payment;

  update product_orders set payment_id = v_payment.id where id = v_order.id;

  return v_payment;
end;
$$;

-- confirm_product_order_delivery: não credita a carteira interna se o
-- pagamento já saiu com split (Asaas já pagou o parceiro direto).
create or replace function confirm_product_order_delivery(p_order_id uuid, p_code text)
returns product_orders language plpgsql security definer set search_path = public as $$
declare
  v_order product_orders;
  v_balance numeric;
  v_subscriber_name text;
  v_partner_profile_id uuid;
begin
  select * into v_order from product_orders where id = p_order_id for update;
  if v_order.id is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if not is_partner_staff(v_order.partner_id) then raise exception 'NOT_AUTHORIZED'; end if;
  if v_order.status <> 'accepted' then raise exception 'ORDER_NOT_ACCEPTED'; end if;
  if p_code is null or upper(trim(p_code)) <> upper(v_order.code) then
    raise exception 'CODE_MISMATCH';
  end if;

  update product_orders set status = 'delivered', confirmed_by = auth.uid(), confirmed_at = now()
  where id = p_order_id
  returning * into v_order;

  if not v_order.split_applied then
    select profile_id into v_partner_profile_id from partner_staff where partner_id = v_order.partner_id limit 1;
    if v_partner_profile_id is not null then
      select current_wallet_balance(v_partner_profile_id) + v_order.net_amount into v_balance;
      insert into wallet_transactions (user_id, type, direction, amount, balance_after, reference_type, reference_id, description)
      values (v_partner_profile_id, 'purchase', 'in', v_order.net_amount, v_balance, 'product_order', v_order.id,
        'Venda confirmada (líquido após comissão de ' || v_order.commission_pct || '%)');
    end if;
  end if;

  select full_name into v_subscriber_name from profiles where id = v_order.subscriber_id;
  perform award_referral_bonuses(v_order.subscriber_id, v_order.total_amount, 'consumption', v_order.payment_id, null);

  insert into notifications (user_id, type, title, message)
  values (v_order.subscriber_id, 'order', 'Compra retirada', 'Sua compra foi retirada com sucesso.');

  return v_order;
end;
$$;

-- Leituras ganham split_applied, pra front saber se aquele pedido já
-- foi/vai ser pago direto na Asaas ou via carteira interna.
drop function get_partner_product_orders(uuid);
create function get_partner_product_orders(p_partner_id uuid)
returns table (
  order_id uuid, status product_order_status, code text, quantity int, unit_price numeric,
  total_amount numeric, net_amount numeric, split_applied boolean, promotion_title text, subscriber_name text,
  subscriber_phone text, deadline timestamptz, accepted_at timestamptz, confirmed_at timestamptz, created_at timestamptz
) language sql stable security definer set search_path = public as $$
  select o.id, o.status, o.code, o.quantity, o.unit_price, o.total_amount, o.net_amount, o.split_applied,
         pm.title, pr.full_name, pr.phone, o.deadline, o.accepted_at, o.confirmed_at, o.created_at
  from product_orders o
  join profiles pr on pr.id = o.subscriber_id
  join promotions pm on pm.id = o.promotion_id
  where o.partner_id = p_partner_id and is_partner_staff(p_partner_id)
  order by o.created_at desc;
$$;
revoke execute on function get_partner_product_orders(uuid) from public;
grant execute on function get_partner_product_orders(uuid) to authenticated;

drop function admin_list_product_orders();
create function admin_list_product_orders()
returns table (
  order_id uuid, status product_order_status, code text, quantity int, unit_price numeric,
  total_amount numeric, commission_amount numeric, net_amount numeric, split_applied boolean,
  promotion_title text, partner_id uuid, partner_trade_name text,
  subscriber_id uuid, subscriber_name text, deadline timestamptz, accepted_at timestamptz, confirmed_at timestamptz, created_at timestamptz
) language sql stable security definer set search_path = public as $$
  select o.id, o.status, o.code, o.quantity, o.unit_price, o.total_amount, o.commission_amount, o.net_amount, o.split_applied,
         pm.title, o.partner_id, pt.trade_name, o.subscriber_id, pr.full_name,
         o.deadline, o.accepted_at, o.confirmed_at, o.created_at
  from product_orders o
  join promotions pm on pm.id = o.promotion_id
  join partners pt on pt.id = o.partner_id
  join profiles pr on pr.id = o.subscriber_id
  where is_admin()
  order by pt.trade_name, o.created_at desc;
$$;
revoke execute on function admin_list_product_orders() from public, anon;
grant execute on function admin_list_product_orders() to authenticated;
