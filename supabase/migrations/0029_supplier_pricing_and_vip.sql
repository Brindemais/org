-- ============================================================
-- Regra de precificação de fornecedor para brindes/produtos
-- retirados em ponto de retirada (parceiro):
--
--   Valor do produto (normal_price)          -> já existia
--   Desconto Brinde Mais (até 50%)           -> discount_pct: pool total
--     negociado com o fornecedor sobre o valor do produto.
--   Valor de venda para o assinante          -> subscriber_discount_pct:
--     fatia (%) desse pool repassada ao assinante como desconto real de
--     preço. subscriber_price continua sendo o R$ resultante, calculado
--     no app (normal_price * (1 - subscriber_discount_pct/100)).
--   Comissionamento Rede de consumo em 7 níveis (1% por nível) -> fixo
--     em 7%, já é exatamente o que award_referral_bonuses paga para
--     type <> 'subscription' (1% por nível, 7 níveis). Não precisa de
--     coluna própria.
--   Lucro líquido Brinde Mais                -> resto do pool:
--     discount_pct - subscriber_discount_pct - 7. Calculado no app,
--     mas protegido aqui por uma constraint para nunca ficar negativo.
--
-- discount_pct = 0 (padrão) significa "este produto não usa a regra do
-- fornecedor" — não dispara comissão de consumo na retirada, preservando
-- o comportamento atual para produtos já cadastrados e para os itens de
-- matriz do admin.
-- ============================================================

alter table products
  add column if not exists discount_pct numeric(5,2) not null default 0,
  add column if not exists subscriber_discount_pct numeric(5,2) not null default 0;

alter table products
  add constraint products_discount_pct_range check (discount_pct >= 0 and discount_pct <= 50),
  add constraint products_subscriber_discount_pct_range check (subscriber_discount_pct >= 0),
  add constraint products_commission_pool_check check (discount_pct = 0 or subscriber_discount_pct + 7 <= discount_pct);

-- Produtos cadastrados por parceiro deviam nascer pendentes de aprovação
-- (é isso que a tela do parceiro já promete e a fila do admin já espera),
-- mas a coluna "approved" tinha default true — todo produto novo entrava
-- aprovado direto. Corrige o default; os inserts do parceiro/admin também
-- passam a mandar o valor explicitamente.
alter table products alter column approved set default false;

-- ------------------------------------------------------------
-- Comissão de consumo (rede de 7 níveis) também na retirada de um
-- brinde de fornecedor, não só nas compras da loja (hoje sem uso).
-- ------------------------------------------------------------
alter table bonuses add column if not exists origin_pickup_id uuid references pickups(id);
create index if not exists bonuses_origin_pickup_idx on bonuses(origin_pickup_id);

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
begin
  select referred_by into v_current from profiles where id = p_source_subscriber_id;

  v_ref_type := case when p_origin_pickup_id is not null then 'pickup' else 'payment' end;
  v_ref_id := coalesce(p_origin_pickup_id, p_origin_payment_id);

  while v_current is not null and v_level <= 7 loop
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
      'Bonificação nível ' || v_level || ' (' || v_pct || '%) - ' || case when p_type='subscription' then 'assinatura' else 'consumo' end
    );

    insert into notifications (user_id, type, title, message)
    values (v_current, 'bonus', 'Nova bonificação recebida', 'Você recebeu R$ ' || v_amount || ' de bonificação (nível ' || v_level || ').');

    select referred_by into v_current from profiles where id = v_current;
    v_level := v_level + 1;
  end loop;
end;
$$;

-- Same signature the frontend already calls (Pickups.tsx): pickup id,
-- product id, pickup code, optional authorized-person id.
create or replace function confirm_pickup_delivery(
  p_pickup_id uuid, p_product_id uuid, p_code text, p_authorized_person_id uuid default null
) returns pickups language plpgsql security definer set search_path = public as $$
declare
  v_pickup pickups;
  v_product products;
  v_qty int;
  v_withdrawn_by text;
  v_ok boolean;
begin
  select * into v_pickup from pickups where id = p_pickup_id;
  if v_pickup.id is null then raise exception 'PICKUP_NOT_FOUND'; end if;
  if not is_partner_staff(v_pickup.partner_id) then raise exception 'NOT_AUTHORIZED'; end if;
  if v_pickup.status <> 'ready' then raise exception 'PICKUP_NOT_READY'; end if;
  if p_code is null or upper(trim(p_code)) <> upper(v_pickup.code) then
    raise exception 'CODE_MISMATCH';
  end if;

  select * into v_product from products where id = p_product_id;
  if v_product.id is null then raise exception 'PRODUCT_NOT_FOUND'; end if;
  if not (v_product.active and v_product.approved) then raise exception 'PRODUCT_NOT_APPROVED'; end if;

  if p_authorized_person_id is not null then
    select exists(
      select 1 from authorized_persons
      where id = p_authorized_person_id and subscriber_id = v_pickup.subscriber_id and active = true
    ) into v_ok;
    if not v_ok then raise exception 'INVALID_AUTHORIZED_PERSON'; end if;
    select full_name into v_withdrawn_by from authorized_persons where id = p_authorized_person_id;
  else
    select full_name into v_withdrawn_by from profiles where id = v_pickup.subscriber_id;
  end if;

  select quantity into v_qty from stock_partner where partner_id = v_pickup.partner_id and product_id = p_product_id for update;
  if v_qty is null or v_qty <= 0 then raise exception 'NO_STOCK'; end if;

  update stock_partner set quantity = quantity - 1 where partner_id = v_pickup.partner_id and product_id = p_product_id;

  insert into stock_movements (product_id, partner_id, type, quantity, prior_balance, new_balance, reason, responsible_id, reference_id)
  values (p_product_id, v_pickup.partner_id, 'delivery', -1, v_qty, v_qty - 1, 'Retirada confirmada', auth.uid(), p_pickup_id);

  update pickups set status = 'withdrawn', product_id = p_product_id, confirmed_by = auth.uid(),
    confirmed_at = now(), authorized_person_id = p_authorized_person_id,
    actually_withdrawn_by = coalesce(v_withdrawn_by, 'Assinante')
  where id = p_pickup_id
  returning * into v_pickup;

  insert into notifications (user_id, type, title, message)
  values (v_pickup.subscriber_id, 'pickup', 'Retirada confirmada', 'Seu brinde foi entregue com sucesso. Aproveite!');

  -- Só dispara a comissão de consumo (7 níveis, 1% cada) para brindes de
  -- fornecedor que de fato usam a regra de desconto Brinde Mais.
  if v_product.discount_pct > 0 and v_product.normal_price > 0 then
    perform award_referral_bonuses(v_pickup.subscriber_id, v_product.normal_price, 'consumption', null, p_pickup_id);
  end if;

  return v_pickup;
end;
$$;
