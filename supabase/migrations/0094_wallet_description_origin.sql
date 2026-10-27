-- Acrescenta a origem do dinheiro na descrição do extrato (bônus de
-- indicação e repasse de venda pro parceiro): saldo interno, Pix, cartão
-- ou ativação manual — antes a descrição não dizia de onde veio, dificultando
-- o controle de quem pagou como.
create or replace function award_referral_bonuses(
  p_source_subscriber_id uuid, p_base_amount numeric, p_type text,
  p_origin_payment_id uuid, p_origin_pickup_id uuid default null
) returns void language plpgsql security definer set search_path = public as $f$
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
  v_tx_type wallet_tx_type;
  v_origin_suffix text := '';
  v_payment_method text;
begin
  if p_base_amount <= 0 then
    return;
  end if;

  select referred_by into v_current from profiles where id = p_source_subscriber_id;
  select full_name into v_source_name from profiles where id = p_source_subscriber_id;

  if p_origin_payment_id is not null then
    select payment_method into v_payment_method from payments where id = p_origin_payment_id;
    v_origin_suffix := case v_payment_method
      when 'wallet' then ' (saldo interno)'
      when 'pix' then ' (Pix)'
      when 'credit_card' then ' (cartão)'
      when 'manual' then ' (ativação manual)'
      else ''
    end;
  end if;

  v_ref_type := case when p_origin_pickup_id is not null then 'pickup' else 'payment' end;
  v_ref_id := coalesce(p_origin_pickup_id, p_origin_payment_id);
  v_label := case p_type when 'subscription' then 'assinatura' when 'partner_fee' then 'indicação de parceiro' else 'consumo' end;
  v_tx_type := case p_type when 'subscription' then 'bonus_subscription'::wallet_tx_type when 'partner_fee' then 'bonus_partner_fee'::wallet_tx_type else 'bonus_consumption'::wallet_tx_type end;

  while v_current is not null and v_level <= 4 loop
    if p_type = 'subscription' or p_type = 'partner_fee' then
      v_pct := case when v_level <= 2 then 10.0 else 1.0 end;
    else
      v_pct := 1.0;
    end if;

    v_amount := round(p_base_amount * v_pct / 100.0, 2);

    if v_amount > 0 then
      insert into bonuses (beneficiary_id, source_subscriber_id, type, level, percent, amount, origin_payment_id, origin_pickup_id)
      values (v_current, p_source_subscriber_id, p_type, v_level, v_pct, v_amount, p_origin_payment_id, p_origin_pickup_id);

      select current_wallet_balance(v_current) + v_amount into v_balance;

      insert into wallet_transactions (user_id, type, direction, amount, balance_after, reference_type, reference_id, description)
      values (
        v_current, v_tx_type,
        'in', v_amount, v_balance, v_ref_type, v_ref_id,
        'Nível ' || v_level || ' (' || v_pct || '%) · ' || v_label || ' de ' || coalesce(v_source_name, 'alguém da sua rede') || v_origin_suffix
      );

      insert into notifications (user_id, type, title, message)
      values (v_current, 'bonus', 'Nova bonificação recebida', 'Você recebeu R$ ' || v_amount || ' de bonificação (nível ' || v_level || ').');
    end if;

    select referred_by into v_current from profiles where id = v_current;
    v_level := v_level + 1;
  end loop;
end;
$f$;

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
  v_payment_method text;
  v_origin_suffix text := '';
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
      select payment_method into v_payment_method from payments where id = v_order.payment_id;
      v_origin_suffix := case v_payment_method
        when 'wallet' then ' · saldo interno'
        when 'pix' then ' · Pix'
        when 'credit_card' then ' · cartão'
        when 'manual' then ' · ativação manual'
        else ''
      end;

      select current_wallet_balance(v_partner_profile_id) + v_order.net_amount into v_balance;
      insert into wallet_transactions (user_id, type, direction, amount, balance_after, reference_type, reference_id, description)
      values (v_partner_profile_id, 'purchase', 'in', v_order.net_amount, v_balance, 'product_order', v_order.id,
        coalesce(v_promo_title, 'Produto') || ' · ' || coalesce(v_subscriber_name, 'assinante') ||
        ' (líquido após comissão de ' || v_order.commission_pct || '%)' || v_origin_suffix);
    end if;
  end if;

  perform award_referral_bonuses(v_order.subscriber_id, v_order.total_amount, 'consumption', v_order.payment_id, null);

  insert into notifications (user_id, type, title, message)
  values (v_order.subscriber_id, 'order', 'Compra retirada', 'Sua compra foi retirada com sucesso.');

  return v_order;
end;
$f$;
