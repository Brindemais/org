-- Bug: create_product_order marcava split_applied = true sempre que o
-- PARCEIRO tinha subconta Asaas vinculada, sem checar o método de
-- pagamento. Pagamento com saldo (wallet) nunca passa pela Asaas — não
-- existe cobrança nem split nenhum — mas como a flag ficava true,
-- confirm_product_order_delivery pulava o crédito na carteira interna do
-- parceiro achando que o dinheiro já tinha caído direto na Asaas dele.
-- Resultado: parceiro vendia e nunca recebia o valor da venda paga com
-- saldo. split_applied só pode ser true pra pix/cartão.
create or replace function create_product_order(p_promotion_id uuid, p_quantity int, p_payment_method text)
returns payments
language plpgsql
security definer
set search_path to 'public'
as $$
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
    generate_product_order_code(), now() + interval '7 days',
    (p_payment_method <> 'wallet') and coalesce(v_has_wallet, false)
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

-- Corrige os dois pedidos pagos com saldo que já existem com
-- split_applied errado (true), antes da correção acima — sem isso, mesmo
-- confirmando a retirada agora, o parceiro continuaria sem receber.
update product_orders
set split_applied = false
where payment_id in (select id from payments where payment_method = 'wallet' and type = 'product_purchase')
  and split_applied = true;

-- Lançamento da venda na carteira do parceiro não trazia nome do produto
-- nem do assinante que comprou — só "Venda confirmada (líquido após
-- comissão de X%)". Mostra produto + quem comprou, igual foi pedido.
create or replace function confirm_product_order_delivery(p_order_id uuid, p_code text)
returns product_orders
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_order product_orders;
  v_balance numeric;
  v_subscriber_name text;
  v_promo_title text;
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

  select full_name into v_subscriber_name from profiles where id = v_order.subscriber_id;
  select title into v_promo_title from promotions where id = v_order.promotion_id;

  -- Se o pagamento já foi feito com split (pix/cartão com partner tinha
  -- subconta Asaas na hora da compra), a Asaas já transferiu o líquido
  -- direto pra conta dele — não credita de novo na carteira interna.
  if not v_order.split_applied then
    select profile_id into v_partner_profile_id from partner_staff where partner_id = v_order.partner_id limit 1;
    if v_partner_profile_id is not null then
      select current_wallet_balance(v_partner_profile_id) + v_order.net_amount into v_balance;
      insert into wallet_transactions (user_id, type, direction, amount, balance_after, reference_type, reference_id, description)
      values (v_partner_profile_id, 'purchase', 'in', v_order.net_amount, v_balance, 'product_order', v_order.id,
        coalesce(v_promo_title, 'Produto') || ' · ' || coalesce(v_subscriber_name, 'assinante') ||
        ' (líquido após comissão de ' || v_order.commission_pct || '%)');
    end if;
  end if;

  perform award_referral_bonuses(v_order.subscriber_id, v_order.total_amount, 'consumption', v_order.payment_id, null);

  insert into notifications (user_id, type, title, message)
  values (v_order.subscriber_id, 'order', 'Compra retirada', 'Sua compra foi retirada com sucesso.');

  return v_order;
end;
$$;
