-- Comissão da plataforma sobre venda de produto deixa de ser fixa em 10%
-- pra virar configurável por parceiro (admin define, com piso de 15%).
alter table partners add column commission_pct numeric(5,2) not null default 15.0 check (commission_pct >= 15);

revoke all on function create_product_order(uuid, int, text) from public, anon;

create or replace function create_product_order(
  p_promotion_id uuid, p_quantity int, p_payment_method text
) returns payments language plpgsql security definer set search_path = public as $$
declare
  v_promo promotions;
  v_order product_orders;
  v_payment payments;
  v_commission_pct numeric;
  v_total numeric;
  v_commission numeric;
  v_net numeric;
  v_has_wallet boolean;
  v_available numeric;
begin
  if not is_active_subscriber() then
    raise exception 'ACCOUNT_SUSPENDED';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'INVALID_QUANTITY';
  end if;
  if p_payment_method not in ('pix', 'credit_card', 'wallet') then
    raise exception 'INVALID_PAYMENT_METHOD';
  end if;

  select * into v_promo from promotions where id = p_promotion_id and status = 'approved' for update;
  if v_promo.id is null then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;
  if v_promo.subscriber_price is null or v_promo.subscriber_price <= 0 then
    raise exception 'PRODUCT_HAS_NO_PRICE';
  end if;

  select commission_pct, (asaas_wallet_id is not null) into v_commission_pct, v_has_wallet
  from partners where id = v_promo.partner_id;

  v_total := round(v_promo.subscriber_price * p_quantity, 2);
  v_commission := round(v_total * v_commission_pct / 100.0, 2);
  v_net := v_total - v_commission;

  if p_payment_method = 'wallet' then
    select available_balance(auth.uid()) into v_available;
    if coalesce(v_available, 0) < v_total then
      raise exception 'INSUFFICIENT_BALANCE';
    end if;
  end if;

  update promotions set quantity = quantity - p_quantity where id = p_promotion_id and quantity >= p_quantity;
  if not found then
    raise exception 'OUT_OF_STOCK';
  end if;

  insert into product_orders (
    subscriber_id, partner_id, promotion_id, quantity, unit_price, total_amount,
    commission_pct, commission_amount, net_amount, status, code, deadline, split_applied
  ) values (
    auth.uid(), v_promo.partner_id, v_promo.id, p_quantity, v_promo.subscriber_price, v_total,
    v_commission_pct, v_commission, v_net,
    case when p_payment_method = 'wallet' then 'ready'::product_order_status else 'pending_payment'::product_order_status end,
    generate_product_order_code(), now() + interval '7 days', coalesce(v_has_wallet, false)
  ) returning * into v_order;

  if p_payment_method = 'wallet' then
    insert into payments (subscriber_id, partner_id, amount, type, payment_method, product_order_id, status, confirmed_at, confirmed_by)
    values (auth.uid(), v_promo.partner_id, v_total, 'product_purchase', 'wallet', v_order.id, 'confirmed', now(), auth.uid())
    returning * into v_payment;

    insert into wallet_transactions (user_id, type, direction, amount, balance_after, reference_type, reference_id, description)
    values (auth.uid(), 'purchase', 'out', v_total, current_wallet_balance(auth.uid()) - v_total, 'product_order', v_order.id,
      'Compra de produto com saldo - ' || v_promo.title);

    insert into notifications (user_id, type, title, message)
    values (auth.uid(), 'order', 'Compra confirmada', 'Pagamento feito com seu saldo. Apresente o código ao parceiro para retirar.');
  else
    insert into payments (subscriber_id, partner_id, amount, type, payment_method, product_order_id)
    values (auth.uid(), v_promo.partner_id, v_total, 'product_purchase', p_payment_method, v_order.id)
    returning * into v_payment;
  end if;

  update product_orders set payment_id = v_payment.id where id = v_order.id;

  return v_payment;
end;
$$;

grant execute on function create_product_order(uuid, int, text) to authenticated;
