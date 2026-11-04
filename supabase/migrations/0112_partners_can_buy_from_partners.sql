-- Pedido do dono: no painel do Parceiro (comerciante) também precisa
-- existir a aba "Parceiros", onde ele vê a rede de parceiros e pode
-- comprar produtos de outro parceiro — igual já existe pro assinante em
-- "Produtos e descontos". Reaproveita o mesmo carrinho/checkout
-- (create_product_order_cart, confirm_payment, as mesmas edge functions
-- de Pix/cartão), só ajustando quem pode chamar e dois detalhes de
-- dinheiro específicos de comprador-parceiro:
--  1) Um parceiro não pode comprar do próprio parceiro (sem sentido
--     econômico e vira um jeito de "pagar comissão pra si mesmo" por um
--     produto que já é dele).
--  2) A bonificação de consumo (1% por nível, 4 níveis) que anda pela
--     cadeia de indicação de QUEM COMPROU só faz sentido pra assinante —
--     a cadeia `referred_by` de um parceiro é a de indicação de parceiro
--     (adesão), um contexto totalmente diferente. Então só dispara esse
--     bônus quando quem comprou é mesmo assinante.

create or replace function create_product_order_cart(p_items jsonb, p_payment_method text)
returns payments
language plpgsql
security definer
set search_path to 'public'
as $f$
declare
  v_item record;
  v_promo promotions;
  v_order product_orders;
  v_payment payments;
  v_commission_pct numeric;
  v_has_wallet boolean;
  v_partner_id uuid;
  v_available numeric;
  v_item_total numeric;
  v_grand_total numeric := 0;
  v_order_ids uuid[] := '{}';
  v_item_count int := 0;
  v_caller_role text;
  v_caller_active boolean;
begin
  select role, active into v_caller_role, v_caller_active from profiles where id = auth.uid();

  if v_caller_role = 'subscriber' then
    if not is_active_subscriber() then
      raise exception 'ACCOUNT_SUSPENDED';
    end if;
  elsif v_caller_role = 'partner' then
    if not coalesce(v_caller_active, false) then
      raise exception 'ACCOUNT_SUSPENDED';
    end if;
  else
    raise exception 'NOT_AUTHORIZED';
  end if;

  if p_payment_method not in ('pix', 'credit_card', 'wallet') then
    raise exception 'INVALID_PAYMENT_METHOD';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART';
  end if;

  -- 1ª passada: valida preço/status e descobre o parceiro único do carrinho
  for v_item in select * from jsonb_to_recordset(p_items) as x(promotion_id uuid, quantity int)
  loop
    v_item_count := v_item_count + 1;
    if v_item.promotion_id is null or v_item.quantity is null or v_item.quantity <= 0 then
      raise exception 'INVALID_ITEM';
    end if;

    select * into v_promo from promotions where id = v_item.promotion_id and status = 'approved';
    if v_promo.id is null then
      raise exception 'PRODUCT_NOT_FOUND';
    end if;
    if v_promo.subscriber_price is null or v_promo.subscriber_price <= 0 then
      raise exception 'PRODUCT_HAS_NO_PRICE';
    end if;

    if v_partner_id is null then
      v_partner_id := v_promo.partner_id;
    elsif v_partner_id <> v_promo.partner_id then
      raise exception 'PARTNER_MISMATCH';
    end if;

    v_grand_total := v_grand_total + round(v_promo.subscriber_price * v_item.quantity, 2);
  end loop;

  if v_item_count = 0 then
    raise exception 'EMPTY_CART';
  end if;

  if v_caller_role = 'partner' and is_partner_staff(v_partner_id) then
    raise exception 'CANNOT_BUY_OWN_PARTNER';
  end if;

  select commission_pct, (asaas_wallet_id is not null) into v_commission_pct, v_has_wallet
  from partners where id = v_partner_id;

  if p_payment_method = 'wallet' then
    select available_balance(auth.uid()) into v_available;
    if coalesce(v_available, 0) < v_grand_total then
      raise exception 'INSUFFICIENT_BALANCE';
    end if;
  end if;

  -- 2ª passada: trava estoque de verdade e cria um pedido por item
  for v_item in select * from jsonb_to_recordset(p_items) as x(promotion_id uuid, quantity int)
  loop
    select * into v_promo from promotions where id = v_item.promotion_id and status = 'approved' for update;

    update promotions set quantity = quantity - v_item.quantity where id = v_item.promotion_id and quantity >= v_item.quantity;
    if not found then
      raise exception 'OUT_OF_STOCK';
    end if;

    v_item_total := round(v_promo.subscriber_price * v_item.quantity, 2);

    insert into product_orders (
      subscriber_id, partner_id, promotion_id, quantity, unit_price, total_amount,
      commission_pct, commission_amount, net_amount, status, code, deadline, split_applied
    ) values (
      auth.uid(), v_partner_id, v_promo.id, v_item.quantity, v_promo.subscriber_price, v_item_total,
      v_commission_pct, round(v_item_total * v_commission_pct / 100.0, 2),
      v_item_total - round(v_item_total * v_commission_pct / 100.0, 2),
      case when p_payment_method = 'wallet' then 'ready'::product_order_status else 'pending_payment'::product_order_status end,
      generate_product_order_code(), now() + interval '7 days',
      (p_payment_method <> 'wallet') and coalesce(v_has_wallet, false)
    ) returning * into v_order;

    v_order_ids := array_append(v_order_ids, v_order.id);
  end loop;

  insert into payments (subscriber_id, partner_id, amount, type, payment_method, status, confirmed_at, confirmed_by)
  values (
    auth.uid(), v_partner_id, v_grand_total, 'product_purchase', p_payment_method,
    (case when p_payment_method = 'wallet' then 'confirmed' else 'pending' end)::payment_status,
    case when p_payment_method = 'wallet' then now() else null end,
    case when p_payment_method = 'wallet' then auth.uid() else null end
  ) returning * into v_payment;

  update product_orders set payment_id = v_payment.id where id = any(v_order_ids);

  if p_payment_method = 'wallet' then
    -- débito por pedido (não um débito único do carrinho) — mantém a
    -- granularidade que admin_audit_wallet_payments já espera por pedido.
    for v_order in select * from product_orders where id = any(v_order_ids)
    loop
      insert into wallet_transactions (user_id, type, direction, amount, balance_after, reference_type, reference_id, description)
      values (auth.uid(), 'purchase', 'out', v_order.total_amount, current_wallet_balance(auth.uid()) - v_order.total_amount, 'product_order', v_order.id,
        'Compra de produto com saldo - ' || (select title from promotions where id = v_order.promotion_id));
    end loop;

    insert into notifications (user_id, type, title, message)
    values (auth.uid(), 'order', 'Compra confirmada', 'Pagamento feito com seu saldo. Apresente os códigos ao parceiro para retirar.');
  end if;

  return v_payment;
end;
$f$;

revoke all on function create_product_order_cart(jsonb, text) from public;
revoke all on function create_product_order_cart(jsonb, text) from anon;
grant execute on function create_product_order_cart(jsonb, text) to authenticated;

create or replace function confirm_product_order_delivery(p_order_id uuid, p_code text)
returns product_orders
language plpgsql
security definer
set search_path to 'public'
as $f$
declare
  v_order product_orders;
  v_balance numeric;
  v_subscriber_name text;
  v_promo_title text;
  v_partner_profile_id uuid;
  v_buyer_role text;
begin
  select * into v_order from product_orders where id = p_order_id for update;
  if v_order.id is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if not is_partner_staff(v_order.partner_id) then raise exception 'NOT_AUTHORIZED'; end if;
  if v_order.status <> 'accepted' then raise exception 'ORDER_NOT_ACCEPTED'; end if;
  if p_code is null or upper(trim(p_code)) <> upper(v_order.code) then
    raise exception 'CODE_MISMATCH';
  end if;
  if v_order.payment_id is null or not exists (select 1 from payments where id = v_order.payment_id and status = 'confirmed') then
    raise exception 'PAYMENT_NOT_CONFIRMED';
  end if;

  update product_orders set status = 'delivered', confirmed_by = auth.uid(), confirmed_at = now()
  where id = p_order_id
  returning * into v_order;

  select full_name into v_subscriber_name from profiles where id = v_order.subscriber_id;
  select title into v_promo_title from promotions where id = v_order.promotion_id;

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

  select role into v_buyer_role from profiles where id = v_order.subscriber_id;
  if v_buyer_role = 'subscriber' then
    perform award_referral_bonuses(v_order.subscriber_id, v_order.total_amount, 'consumption', v_order.payment_id, null);
  end if;

  insert into notifications (user_id, type, title, message)
  values (v_order.subscriber_id, 'order', 'Compra retirada', 'Sua compra foi retirada com sucesso.');

  return v_order;
end;
$f$;
