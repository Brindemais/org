-- CRÍTICO (auditoria completa antes de ir 100% ao ar):
--
-- 1) product_orders: a policy de INSERT só exigia subscriber_id = auth.uid()
-- (ou admin) — sem checar status, payment_id ou valores. Testado e
-- confirmado: qualquer assinante autenticado conseguia inserir, via API
-- direta (sem passar por create_product_order/_cart), um pedido com
-- status='ready', payment_id=null e net_amount arbitrário (testado com
-- R$999.999,00). Se um parceiro (inclusive em conluio) aceitasse e
-- confirmasse a entrega desse pedido forjado, confirm_product_order_delivery
-- creditava esse valor de verdade na carteira do parceiro — dinheiro
-- fabricado do nada, sacável via Pix real, sem nenhum pagamento ter
-- ocorrido. Todo pedido legítimo é criado via
-- create_product_order/create_product_order_cart (SECURITY DEFINER, que
-- contornam RLS como dono da tabela) — nenhum fluxo do frontend insere
-- direto na tabela, então travar a policy pra admin-only não quebra nada.
drop policy if exists product_orders_insert on product_orders;
create policy product_orders_insert on product_orders for insert with check (is_admin());

-- Defesa em profundidade: mesmo com a policy corrigida, accept_product_order
-- e confirm_product_order_delivery passam a exigir que o pedido tenha um
-- payment_id referenciando um pagamento realmente confirmado antes de
-- aceitar/creditar qualquer coisa — protege contra qualquer outro caminho
-- futuro que venha a criar um product_orders sem passar pelas funções
-- corretas.
create or replace function accept_product_order(p_order_id uuid)
returns product_orders
language plpgsql
security definer
set search_path to 'public'
as $f$
declare
  v_order product_orders;
begin
  select * into v_order from product_orders where id = p_order_id for update;
  if v_order.id is null then raise exception 'ORDER_NOT_FOUND'; end if;
  if not is_partner_staff(v_order.partner_id) then raise exception 'NOT_AUTHORIZED'; end if;
  if v_order.status <> 'ready' then raise exception 'ORDER_NOT_PAYABLE'; end if;
  if v_order.payment_id is null or not exists (select 1 from payments where id = v_order.payment_id and status = 'confirmed') then
    raise exception 'PAYMENT_NOT_CONFIRMED';
  end if;

  update product_orders set status = 'accepted', accepted_at = now()
  where id = p_order_id
  returning * into v_order;

  insert into notifications (user_id, type, title, message)
  values (v_order.subscriber_id, 'order', 'Pedido confirmado pelo parceiro', 'Seu pedido foi aceito. Apresente o código quando for retirar.');

  return v_order;
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

  perform award_referral_bonuses(v_order.subscriber_id, v_order.total_amount, 'consumption', v_order.payment_id, null);

  insert into notifications (user_id, type, title, message)
  values (v_order.subscriber_id, 'order', 'Compra retirada', 'Sua compra foi retirada com sucesso.');

  return v_order;
end;
$f$;

-- 2) partners: a policy de INSERT só restringia status/approved_at,
-- deixando is_advertiser, advertiser_expires_at, requires_fee,
-- asaas_wallet_id, asaas_account_id, asaas_subaccount_status livres pro
-- valor que o próprio cliente mandasse. Testado e confirmado: um usuário
-- comum conseguia inserir um parceiro novo com is_advertiser=true,
-- advertiser_expires_at='2099-01-01' e requires_fee=false direto pela
-- API, pulando a taxa de anunciante por completo. O cadastro real de
-- parceiro (PartnerSignup.tsx) passa inteiro por complete_partner_signup()
-- (SECURITY DEFINER, contorna RLS como dono da tabela) — nenhuma tela
-- insere direto em partners, então travar essa policy pra admin-only não
-- quebra nada.
drop policy if exists partners_insert on partners;
create policy partners_insert on partners for insert with check (is_admin());
