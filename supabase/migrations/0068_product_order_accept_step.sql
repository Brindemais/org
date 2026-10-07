-- Acompanhamento do pedido estilo "iFood": pedido pago chega como
-- 'ready' ("pedido realizado"), precisa o PARCEIRO confirmar que
-- recebeu (novo status 'accepted', "confirmado pelo parceiro") antes de
-- virar 'delivered' ("concluído") com o código/QR na retirada.
alter table product_orders add column accepted_at timestamptz;
alter type product_order_status add value if not exists 'accepted' after 'ready';

create or replace function accept_product_order(p_order_id uuid)
returns product_orders language plpgsql security definer set search_path = public as $$
declare
  v_order product_orders;
begin
  select * into v_order from product_orders where id = p_order_id for update;
  if v_order.id is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if not is_partner_staff(v_order.partner_id) then raise exception 'NOT_AUTHORIZED'; end if;
  if v_order.status <> 'ready' then raise exception 'ORDER_NOT_PAYABLE'; end if;

  update product_orders set status = 'accepted', accepted_at = now()
  where id = p_order_id
  returning * into v_order;

  insert into notifications (user_id, type, title, message)
  values (v_order.subscriber_id, 'order', 'Pedido confirmado pelo parceiro', 'Seu pedido foi aceito. Apresente o código quando for retirar.');

  return v_order;
end;
$$;

revoke all on function accept_product_order(uuid) from public, anon;
grant execute on function accept_product_order(uuid) to authenticated;

-- confirm_product_order_delivery só finaliza pedidos já 'accepted'.
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

-- Leituras ganham accepted_at pro acompanhamento em etapas.
drop function get_partner_product_orders(uuid);
create function get_partner_product_orders(p_partner_id uuid)
returns table (
  order_id uuid, status product_order_status, code text, quantity int, unit_price numeric,
  total_amount numeric, net_amount numeric, promotion_title text, subscriber_name text,
  subscriber_phone text, deadline timestamptz, accepted_at timestamptz, confirmed_at timestamptz, created_at timestamptz
) language sql stable security definer set search_path = public as $$
  select o.id, o.status, o.code, o.quantity, o.unit_price, o.total_amount, o.net_amount,
         pm.title, pr.full_name, pr.phone, o.deadline, o.accepted_at, o.confirmed_at, o.created_at
  from product_orders o
  join profiles pr on pr.id = o.subscriber_id
  join promotions pm on pm.id = o.promotion_id
  where o.partner_id = p_partner_id and is_partner_staff(p_partner_id)
  order by o.created_at desc;
$$;
revoke execute on function get_partner_product_orders(uuid) from public;
grant execute on function get_partner_product_orders(uuid) to authenticated;

drop function get_my_product_orders();
create function get_my_product_orders()
returns table (
  order_id uuid, status product_order_status, code text, quantity int, unit_price numeric,
  total_amount numeric, promotion_title text, promotion_image_url text, partner_id uuid,
  partner_trade_name text, deadline timestamptz, accepted_at timestamptz, confirmed_at timestamptz, created_at timestamptz
) language sql stable security definer set search_path = public as $$
  select o.id, o.status, o.code, o.quantity, o.unit_price, o.total_amount,
         pm.title, pm.image_url, o.partner_id, pt.trade_name,
         o.deadline, o.accepted_at, o.confirmed_at, o.created_at
  from product_orders o
  join promotions pm on pm.id = o.promotion_id
  join partners pt on pt.id = o.partner_id
  where o.subscriber_id = auth.uid()
  order by o.created_at desc;
$$;
revoke execute on function get_my_product_orders() from public, anon;
grant execute on function get_my_product_orders() to authenticated;

drop function admin_list_product_orders();
create function admin_list_product_orders()
returns table (
  order_id uuid, status product_order_status, code text, quantity int, unit_price numeric,
  total_amount numeric, commission_amount numeric, net_amount numeric,
  promotion_title text, partner_id uuid, partner_trade_name text,
  subscriber_id uuid, subscriber_name text, deadline timestamptz, accepted_at timestamptz, confirmed_at timestamptz, created_at timestamptz
) language sql stable security definer set search_path = public as $$
  select o.id, o.status, o.code, o.quantity, o.unit_price, o.total_amount, o.commission_amount, o.net_amount,
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
