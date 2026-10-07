-- Compra de produto com preço dentro do app ("Produtos e descontos"):
-- assinante paga via Pix/cartão (mesma Asaas já usada pra assinatura e
-- taxa de anunciante), mas só libera o valor líquido pro parceiro E a
-- bonificação de consumo da rede depois que o PARCEIRO confirma a
-- entrega com um código — mesmo padrão já usado pro brinde (pickups),
-- pra não liberar dinheiro/bônus sem a entrega ter acontecido de verdade.
--
-- Comissão da plataforma: 10% fixo sobre o valor da compra. O valor
-- líquido entra no saldo interno do parceiro (wallet_transactions, mesma
-- carteira/saque já usado pelo assinante) — não existe split direto via
-- Asaas (exigiria subconta própria por parceiro).
create type product_order_status as enum ('pending_payment', 'ready', 'delivered', 'cancelled', 'expired');

create table product_orders (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references profiles(id),
  partner_id uuid not null references partners(id),
  promotion_id uuid not null references promotions(id),
  quantity int not null check (quantity > 0),
  unit_price numeric(10,2) not null,
  total_amount numeric(10,2) not null,
  commission_pct numeric(5,2) not null default 10.0,
  commission_amount numeric(10,2) not null,
  net_amount numeric(10,2) not null,
  status product_order_status not null default 'pending_payment',
  code text unique not null,
  payment_id uuid,
  deadline timestamptz,
  confirmed_by uuid references profiles(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create index product_orders_subscriber_idx on product_orders(subscriber_id);
create index product_orders_partner_idx on product_orders(partner_id);
create index product_orders_status_idx on product_orders(status);

alter table payments add column product_order_id uuid references product_orders(id);

alter table product_orders enable row level security;
create policy product_orders_select on product_orders for select using (
  subscriber_id = auth.uid() or is_admin() or is_partner_staff(partner_id)
);
create policy product_orders_insert on product_orders for insert with check (
  subscriber_id = auth.uid() or is_admin()
);

create or replace function generate_product_order_code() returns text language plpgsql set search_path = public as $$
declare
  v_code text;
  exists_code boolean;
begin
  v_code := 'PD' || to_char(floor(random()*90000+10000), 'FM00000');
  select exists(select 1 from product_orders where product_orders.code = v_code) into exists_code;
  if exists_code then
    return generate_product_order_code();
  end if;
  return v_code;
end;
$$;

-- create_product_order: assinante cria o pedido (calcula comissão de 10%
-- e valor líquido já na hora) e já reserva o estoque (decrementa de
-- forma atômica), pra não deixar dois assinantes pagarem pela mesma
-- última unidade. Devolve o payment pro front chamar
-- asaas-create-pix-charge/asaas-charge-card normalmente.
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

  insert into product_orders (
    subscriber_id, partner_id, promotion_id, quantity, unit_price, total_amount,
    commission_pct, commission_amount, net_amount, code, deadline
  ) values (
    auth.uid(), v_promo.partner_id, v_promo.id, p_quantity, v_promo.subscriber_price, v_total,
    v_commission_pct, v_commission, v_net, generate_product_order_code(), now() + interval '7 days'
  ) returning * into v_order;

  insert into payments (subscriber_id, partner_id, amount, type, payment_method, product_order_id)
  values (auth.uid(), v_promo.partner_id, v_total, 'product_purchase', p_payment_method, v_order.id)
  returning * into v_payment;

  update product_orders set payment_id = v_payment.id where id = v_order.id;

  return v_payment;
end;
$$;

revoke all on function create_product_order(uuid, int, text) from public, anon;
grant execute on function create_product_order(uuid, int, text) to authenticated;

-- confirm_payment: novo branch pra type = 'product_purchase'. Só libera o
-- código de retirada (status 'ready') — valor líquido e bônus de
-- consumo só entram em confirm_product_order_delivery.
create or replace function confirm_payment(p_payment_id uuid, p_confirmed_by uuid default null, p_award_bonus boolean default true)
returns payments language plpgsql security definer set search_path = public as $$
declare
  v_payment payments;
  v_sub subscriptions;
  v_interval interval;
begin
  if not (is_admin() or auth.role() = 'service_role') then
    raise exception 'NOT_AUTHORIZED';
  end if;

  update payments set status = 'confirmed', confirmed_at = now(), confirmed_by = coalesce(p_confirmed_by, auth.uid())
  where id = p_payment_id and status = 'pending'
  returning * into v_payment;

  if v_payment.id is null then
    select * into v_payment from payments where id = p_payment_id;
    return v_payment;
  end if;

  insert into audit_logs (actor_id, action, entity, entity_id, after)
  values (auth.uid(), 'confirm_payment', 'payments', v_payment.id, jsonb_build_object('amount', v_payment.amount, 'type', v_payment.type, 'award_bonus', p_award_bonus));

  if v_payment.type = 'subscription' then
    v_interval := case coalesce(v_payment.plan, 'monthly') when 'annual' then interval '365 days' else interval '30 days' end;

    if v_payment.subscription_id is not null then
      update subscriptions set status = 'active', activated_at = now(),
        plan = coalesce(v_payment.plan, 'monthly'), amount = v_payment.amount,
        expires_at = greatest(coalesce(expires_at, now()), now()) + v_interval,
        renewal_reminder_sent_at = null
      where id = v_payment.subscription_id
      returning * into v_sub;
    else
      insert into subscriptions (subscriber_id, status, plan, amount, activated_at, expires_at)
      values (v_payment.subscriber_id, 'active', coalesce(v_payment.plan, 'monthly'), v_payment.amount, now(), now() + v_interval)
      returning * into v_sub;
      update payments set subscription_id = v_sub.id where id = v_payment.id;
    end if;

    if p_award_bonus then
      perform award_referral_bonuses(v_payment.subscriber_id, v_payment.amount, 'subscription', v_payment.id);
    end if;

    insert into notifications (user_id, type, title, message)
    values (v_payment.subscriber_id, 'payment', 'Pagamento confirmado', 'Sua assinatura Brinde Mais está ativa! Escolha seu ponto de retirada.');

  elsif v_payment.type = 'store' then
    update store_orders set status = 'paid', payment_id = v_payment.id where id = v_payment.order_id;
    insert into notifications (user_id, type, title, message)
    values (v_payment.subscriber_id, 'order', 'Pedido confirmado', 'Seu pedido na loja Brinde Mais foi confirmado.');

  elsif v_payment.type = 'product_purchase' then
    update product_orders set status = 'ready' where id = v_payment.product_order_id;
    insert into notifications (user_id, type, title, message)
    values (v_payment.subscriber_id, 'order', 'Compra confirmada', 'Seu pagamento foi confirmado. Apresente o código ao parceiro para retirar.');

  elsif v_payment.type = 'partner_fee' then
    update partners set is_advertiser = true,
      advertiser_expires_at = greatest(coalesce(advertiser_expires_at, now()), now()) + interval '30 days'
    where id = v_payment.partner_id;

    if p_award_bonus then
      perform award_referral_bonuses(v_payment.subscriber_id, v_payment.amount, 'partner_fee', v_payment.id);
    end if;

    insert into notifications (user_id, type, title, message)
    values (v_payment.subscriber_id, 'payment', 'Você é Anunciante Brinde Mais!', 'Sua taxa de anunciante foi confirmada. Acesse a área de anunciante no seu painel.');
  end if;

  return v_payment;
end;
$$;

-- confirm_product_order_delivery: parceiro confirma com o código no
-- balcão. Estoque já foi reservado em create_product_order, não
-- decrementa de novo. Credita o líquido no saldo do parceiro (profile do
-- staff) e dispara a bonificação de consumo (1% por nível, 4 níveis).
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
  if v_order.status <> 'ready' then raise exception 'ORDER_NOT_READY'; end if;
  if p_code is null or upper(trim(p_code)) <> upper(v_order.code) then
    raise exception 'CODE_MISMATCH';
  end if;

  update product_orders set status = 'delivered', confirmed_by = auth.uid(), confirmed_at = now()
  where id = p_order_id
  returning * into v_order;

  select profile_id into v_partner_profile_id from partner_staff where partner_id = v_order.partner_id limit 1;
  if v_partner_profile_id is not null then
    select current_wallet_balance(v_partner_profile_id) + v_order.net_amount into v_balance;
    insert into wallet_transactions (user_id, type, direction, amount, balance_after, reference_type, reference_id, description)
    values (v_partner_profile_id, 'purchase', 'in', v_order.net_amount, v_balance, 'product_order', v_order.id,
      'Venda confirmada (líquido após comissão de ' || v_order.commission_pct || '%)');
  end if;

  select full_name into v_subscriber_name from profiles where id = v_order.subscriber_id;
  perform award_referral_bonuses(v_order.subscriber_id, v_order.total_amount, 'consumption', v_order.payment_id, null);

  insert into notifications (user_id, type, title, message)
  values (v_order.subscriber_id, 'order', 'Compra retirada', 'Sua compra foi retirada com sucesso.');

  return v_order;
end;
$$;

revoke all on function confirm_product_order_delivery(uuid, text) from public, anon;
grant execute on function confirm_product_order_delivery(uuid, text) to authenticated;

-- Leituras organizadas: parceiro (própria loja), assinante (próprias
-- compras) e admin (tudo, agrupável por parceiro no front).
create or replace function get_partner_product_orders(p_partner_id uuid)
returns table (
  order_id uuid, status product_order_status, code text, quantity int, unit_price numeric,
  total_amount numeric, net_amount numeric, promotion_title text, subscriber_name text,
  subscriber_phone text, deadline timestamptz, confirmed_at timestamptz, created_at timestamptz
) language sql stable security definer set search_path = public as $$
  select o.id, o.status, o.code, o.quantity, o.unit_price, o.total_amount, o.net_amount,
         pm.title, pr.full_name, pr.phone, o.deadline, o.confirmed_at, o.created_at
  from product_orders o
  join profiles pr on pr.id = o.subscriber_id
  join promotions pm on pm.id = o.promotion_id
  where o.partner_id = p_partner_id and is_partner_staff(p_partner_id)
  order by o.created_at desc;
$$;

revoke execute on function get_partner_product_orders(uuid) from public;
grant execute on function get_partner_product_orders(uuid) to authenticated;

create or replace function get_my_product_orders()
returns table (
  order_id uuid, status product_order_status, code text, quantity int, unit_price numeric,
  total_amount numeric, promotion_title text, promotion_image_url text, partner_id uuid,
  partner_trade_name text, deadline timestamptz, confirmed_at timestamptz, created_at timestamptz
) language sql stable security definer set search_path = public as $$
  select o.id, o.status, o.code, o.quantity, o.unit_price, o.total_amount,
         pm.title, pm.image_url, o.partner_id, pt.trade_name,
         o.deadline, o.confirmed_at, o.created_at
  from product_orders o
  join promotions pm on pm.id = o.promotion_id
  join partners pt on pt.id = o.partner_id
  where o.subscriber_id = auth.uid()
  order by o.created_at desc;
$$;

revoke execute on function get_my_product_orders() from public, anon;
grant execute on function get_my_product_orders() to authenticated;

create or replace function admin_list_product_orders()
returns table (
  order_id uuid, status product_order_status, code text, quantity int, unit_price numeric,
  total_amount numeric, commission_amount numeric, net_amount numeric,
  promotion_title text, partner_id uuid, partner_trade_name text,
  subscriber_id uuid, subscriber_name text, deadline timestamptz, confirmed_at timestamptz, created_at timestamptz
) language sql stable security definer set search_path = public as $$
  select o.id, o.status, o.code, o.quantity, o.unit_price, o.total_amount, o.commission_amount, o.net_amount,
         pm.title, o.partner_id, pt.trade_name, o.subscriber_id, pr.full_name,
         o.deadline, o.confirmed_at, o.created_at
  from product_orders o
  join promotions pm on pm.id = o.promotion_id
  join partners pt on pt.id = o.partner_id
  join profiles pr on pr.id = o.subscriber_id
  where is_admin()
  order by pt.trade_name, o.created_at desc;
$$;

revoke execute on function admin_list_product_orders() from public, anon;
grant execute on function admin_list_product_orders() to authenticated;
