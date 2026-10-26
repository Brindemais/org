-- Carrinho: permite comprar vários produtos do MESMO parceiro num único
-- pagamento. Cria um product_orders por item (mantém código de retirada,
-- aceite e confirmação de entrega individuais, sem mudar nada dessas telas)
-- e UM único payments compartilhado entre eles via product_orders.payment_id
-- (não há constraint 1:1 nisso — payments.product_order_id só fica null
-- pra carrinho com mais de um item, e confirm_payment/os edge functions de
-- cobrança foram ajustados pra olhar payment_id em vez de product_order_id).
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
begin
  if not is_active_subscriber() then
    raise exception 'ACCOUNT_SUSPENDED';
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

-- confirm_payment: pra pedido de produto, usa payment_id (1:N) em vez de
-- payments.product_order_id (que fica null quando o carrinho tem mais de
-- um item) — funciona igual pra pedido único, já que o payment_id também
-- é setado nesse caso.
create or replace function confirm_payment(p_payment_id uuid, p_confirmed_by uuid default null, p_award_bonus boolean default true)
returns payments
language plpgsql
security definer
set search_path to 'public'
as $f$
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
    update product_orders set status = 'ready' where payment_id = v_payment.id;
    insert into notifications (user_id, type, title, message)
    values (v_payment.subscriber_id, 'order', 'Compra confirmada', 'Seu pagamento foi confirmado. Apresente o(s) código(s) ao parceiro para retirar.');

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
$f$;
