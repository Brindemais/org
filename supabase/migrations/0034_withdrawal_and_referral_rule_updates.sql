-- ============================================================
-- Três ajustes de regra pedidos:
--
-- 1) Saque mínimo: R$100 -> R$50.
-- 2) Liberação de saldo pra saque deixa de ser um prazo único de 7 dias
--    pra todo tipo de bonificação: bônus de assinatura ("adesão") libera
--    na hora, bônus de produto/consumo (rede de consumo) passa a ficar
--    bloqueado 30 dias.
-- 3) Rede de indicação cai de 7 para 4 níveis, tanto pra bonificação de
--    assinatura (10%/10%/1%/1%) quanto de produto/consumo (1% flat nos
--    4 níveis) — a tabela de percentual por nível já dava exatamente
--    esses números pros 4 primeiros níveis, só precisa parar de pagar/
--    contar a partir do 5º. Isso também encurta o comissionamento fixo
--    da regra de precificação de fornecedor de 7% (7 níveis x 1%) pra
--    4% (4 níveis x 1%).
-- ============================================================

alter table withdrawals drop constraint withdrawals_amount_check;
alter table withdrawals add constraint withdrawals_amount_check check (amount >= 50);

create or replace function available_balance(p_user_id uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(case
    when direction = 'in' and type = 'bonus_subscription' then amount
    when direction = 'in' and type <> 'bonus_subscription' and created_at <= now() - interval '30 days' then amount
    when direction = 'out' then -amount
    else 0
  end), 0) - pending_withdrawals_total(p_user_id)
  from wallet_transactions where user_id = p_user_id and status = 'confirmed';
$$;

create or replace function request_withdrawal(p_amount numeric, p_pix_key text) returns withdrawals language plpgsql security definer set search_path = public as $$
declare
  v_avail numeric;
  v_recent_total numeric;
  v_w withdrawals;
begin
  if not is_active_subscriber() then
    raise exception 'ACCOUNT_SUSPENDED';
  end if;
  if p_amount < 50 then raise exception 'MINIMUM_WITHDRAWAL_50'; end if;

  select available_balance(auth.uid()) into v_avail;
  if v_avail < p_amount then raise exception 'INSUFFICIENT_BALANCE'; end if;

  select coalesce(sum(amount), 0) into v_recent_total
  from withdrawals
  where user_id = auth.uid() and status <> 'rejected' and requested_at >= now() - interval '30 days';
  if v_recent_total + p_amount > 1000 then raise exception 'MONTHLY_LIMIT_EXCEEDED'; end if;

  insert into withdrawals (user_id, amount, pix_key) values (auth.uid(), p_amount, p_pix_key)
  returning * into v_w;

  insert into notifications (user_id, type, title, message)
  values (auth.uid(), 'withdrawal', 'Saque solicitado', 'Seu saque de R$ ' || p_amount || ' está em análise.');

  return v_w;
end;
$$;

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

  while v_current is not null and v_level <= 4 loop
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

create or replace function get_referral_tree(p_root uuid)
returns table (id uuid, display_name text, level int, has_active_subscription boolean, referred_by uuid)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() <> p_root and not is_admin() then
    raise exception 'NOT_AUTHORIZED';
  end if;

  return query
    with recursive tree as (
      select p.id, p.full_name, p.referred_by, 1 as level
      from profiles p where p.referred_by = p_root
      union all
      select p.id, p.full_name, p.referred_by, t.level + 1
      from profiles p
      join tree t on p.referred_by = t.id
      where t.level < 4
    )
    select
      tree.id,
      trim(
        split_part(tree.full_name, ' ', 1) || ' ' ||
        case when split_part(tree.full_name, ' ', 2) <> '' then left(split_part(tree.full_name, ' ', 2), 1) || '.' else '' end
      ) as display_name,
      tree.level,
      exists(select 1 from subscriptions s where s.subscriber_id = tree.id and s.status = 'active') as has_active_subscription,
      tree.referred_by
    from tree
    order by tree.level, tree.full_name;
end;
$$;

-- Regra de precificação de fornecedor (0029): a comissão fixa da rede de
-- consumo era 7% (7 níveis x 1%), agora cai pra 4% (4 níveis x 1%).
alter table products drop constraint products_commission_pool_check;
alter table products add constraint products_commission_pool_check check (
  discount_pct = 0 or subscriber_discount_pct + 4 <= discount_pct
);
