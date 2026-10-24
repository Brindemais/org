-- Auditoria de pagamentos feitos com saldo (carteira interna): compara o
-- débito do assinante e o crédito do comerciante contra o valor esperado de
-- cada pedido, pra detectar inconsistências (débito errado, crédito
-- faltando, crédito duplicado em pedido com split na Asaas, etc).
create or replace function admin_audit_wallet_payments()
returns table(
  order_id uuid,
  created_at timestamptz,
  promotion_title text,
  subscriber_name text,
  partner_trade_name text,
  status text,
  total_amount numeric,
  net_amount numeric,
  split_applied boolean,
  subscriber_debit numeric,
  partner_credit numeric,
  issue text
)
language plpgsql
stable
security definer
set search_path to 'public'
as $f$
begin
  if not is_admin() then
    raise exception 'NOT_AUTHORIZED';
  end if;

  return query
  with debits as (
    select wt.reference_id as oid, sum(wt.amount) as amt
    from wallet_transactions wt
    where wt.reference_type = 'product_order' and wt.type = 'purchase' and wt.direction = 'out' and wt.status = 'confirmed'
    group by wt.reference_id
  ), credits as (
    select wt.reference_id as oid, sum(wt.amount) as amt
    from wallet_transactions wt
    where wt.reference_type = 'product_order' and wt.type = 'purchase' and wt.direction = 'in' and wt.status = 'confirmed'
    group by wt.reference_id
  )
  select
    po.id,
    po.created_at,
    pm.title,
    pr.full_name,
    pt.trade_name,
    po.status::text,
    po.total_amount,
    po.net_amount,
    po.split_applied,
    coalesce(d.amt, 0),
    coalesce(c.amt, 0),
    case
      when coalesce(d.amt, 0) <> po.total_amount then
        'Débito do assinante (' || coalesce(d.amt,0)::text || ') não bate com o valor do pedido (' || po.total_amount::text || ')'
      when po.status = 'delivered' and not po.split_applied and coalesce(c.amt, 0) <> po.net_amount then
        'Parceiro não recebeu o valor líquido esperado (recebeu ' || coalesce(c.amt,0)::text || ', esperado ' || po.net_amount::text || ')'
      when po.status = 'delivered' and po.split_applied and coalesce(c.amt, 0) <> 0 then
        'Pedido com split na Asaas, mas também creditou a carteira interna (duplicado)'
      when po.status in ('pending_payment','accepted') and coalesce(c.amt, 0) <> 0 then
        'Parceiro já recebeu crédito antes da confirmação de entrega'
      else null
    end as issue
  from product_orders po
  join payments pay on pay.id = po.payment_id
  join promotions pm on pm.id = po.promotion_id
  join profiles pr on pr.id = po.subscriber_id
  join partners pt on pt.id = po.partner_id
  left join debits d on d.oid = po.id
  left join credits c on c.oid = po.id
  where pay.payment_method = 'wallet'
  order by po.created_at desc;
end;
$f$;

revoke all on function admin_audit_wallet_payments() from public;
revoke all on function admin_audit_wallet_payments() from anon;
grant execute on function admin_audit_wallet_payments() to authenticated;

-- Lista parceiros com saldo disponível pra repasse semanal (segunda-feira).
-- Usa available_bonus_balance (mesma regra do saque manual de parceiro:
-- bonus_subscription é imediato, bonus_consumption/bonus_partner_fee/purchase
-- só após 30 dias), menos saques já pendentes.
create or replace function admin_list_partner_payouts(p_minimum numeric default 10)
returns table(
  partner_id uuid,
  profile_id uuid,
  trade_name text,
  full_name text,
  pix_key text,
  amount numeric
)
language plpgsql
stable
security definer
set search_path to 'public'
as $f$
begin
  if not is_admin() then
    raise exception 'NOT_AUTHORIZED';
  end if;

  return query
  select
    pt.id,
    ps.staff_profile_id,
    pt.trade_name,
    pr.full_name,
    pr.pix_key,
    available_bonus_balance(ps.staff_profile_id) as amount
  from partners pt
  join lateral (
    select partner_staff.profile_id as staff_profile_id from partner_staff where partner_staff.partner_id = pt.id order by partner_staff.created_at asc limit 1
  ) ps on true
  join profiles pr on pr.id = ps.staff_profile_id
  where available_bonus_balance(ps.staff_profile_id) >= p_minimum
  order by pt.trade_name;
end;
$f$;

revoke all on function admin_list_partner_payouts(numeric) from public;
revoke all on function admin_list_partner_payouts(numeric) from anon;
grant execute on function admin_list_partner_payouts(numeric) to authenticated;

-- Registra a baixa de um repasse semanal JÁ TRANSFERIDO via Asaas (chamada
-- pela edge function admin-payout-partners depois que o Pix real foi
-- confirmado na Asaas) — mesma lógica de bookkeeping do process_withdrawal,
-- mas sem depender de uma linha pré-existente em `withdrawals`, e com
-- p_actor_id explícito porque quem chama é a service_role (sem JWT de
-- usuário, auth.uid() viria null).
create or replace function admin_execute_partner_payout(
  p_profile_id uuid,
  p_amount numeric,
  p_pix_key text,
  p_asaas_transfer_id text,
  p_actor_id uuid default auth.uid()
)
returns withdrawals
language plpgsql
security definer
set search_path to 'public'
as $f$
declare
  v_w withdrawals;
  v_balance numeric;
begin
  if not (is_admin() or auth.role() = 'service_role') then
    raise exception 'NOT_AUTHORIZED';
  end if;

  insert into withdrawals (user_id, amount, pix_key, status, processed_by, processed_at, notes)
  values (p_profile_id, p_amount, p_pix_key, 'paid', p_actor_id, now(),
    'Repasse semanal automático — transferência Asaas ' || p_asaas_transfer_id)
  returning * into v_w;

  select current_wallet_balance(p_profile_id) - p_amount into v_balance;
  insert into wallet_transactions (user_id, type, direction, amount, balance_after, reference_type, reference_id, description)
  values (p_profile_id, 'withdrawal', 'out', p_amount, v_balance, 'withdrawal', v_w.id,
    'Repasse semanal (Pix Asaas ' || p_asaas_transfer_id || ')');

  insert into audit_logs (actor_id, action, entity, entity_id, after)
  values (p_actor_id, 'partner_payout', 'withdrawals', v_w.id,
    jsonb_build_object('amount', p_amount, 'pix_key', p_pix_key, 'asaas_transfer_id', p_asaas_transfer_id));

  insert into notifications (user_id, type, title, message)
  values (p_profile_id, 'withdrawal', 'Repasse semanal recebido',
    'Você recebeu um repasse de R$ ' || p_amount || ' via Pix.');

  return v_w;
end;
$f$;

revoke all on function admin_execute_partner_payout(uuid, numeric, text, text, uuid) from public;
revoke all on function admin_execute_partner_payout(uuid, numeric, text, text, uuid) from anon;
grant execute on function admin_execute_partner_payout(uuid, numeric, text, text, uuid) to authenticated, service_role;
