-- choose_pickup_partner(): a primeira retirada de cada assinante continua
-- livre (sem exigir nada além de assinatura ativa — mesmo comportamento
-- de sempre); a partir da segunda retirada em diante, exige estar
-- qualificado no mínimo VIP (ver 0108) no momento da escolha.
--
-- available_balance()/available_bonus_balance(): bonus_qualification
-- entra no mesmo grupo de disponibilidade imediata que os outros bônus
-- de indicação — não tem pagamento de origem pra estornar (é crédito
-- direto da plataforma por volume de rede), então não faz sentido reter.
--
-- Agenda o pagamento automático mensal via pg_cron: todo dia 1 às 03:05
-- UTC, fecha o mês anterior e credita VIP MAIS/ELITE pra quem qualificou.
create or replace function public.choose_pickup_partner(p_subscription_id uuid, p_partner_id uuid)
returns pickups
language plpgsql
security definer
set search_path to 'public'
as $f$
declare
  v_sub subscriptions;
  v_total_stock int;
  v_pickup pickups;
  v_month int; v_year int;
  v_subscriber_name text;
  v_counts record;
  v_tier text;
begin
  if not is_active_subscriber() then
    raise exception 'ACCOUNT_SUSPENDED';
  end if;

  select * into v_sub from subscriptions where id = p_subscription_id and subscriber_id = auth.uid();
  if v_sub.id is null or v_sub.status <> 'active' then
    raise exception 'SUBSCRIPTION_NOT_ACTIVE';
  end if;

  if exists (select 1 from pickups where subscriber_id = auth.uid()) then
    select * into v_counts from _subscriber_referral_active_counts(auth.uid());
    v_tier := _qualification_tier(v_counts.direct_active, v_counts.l1_l2_active);
    if v_tier = 'none' then
      raise exception 'NOT_QUALIFIED_VIP';
    end if;
  end if;

  v_month := extract(month from now())::int;
  v_year := extract(year from now())::int;

  if exists (
    select 1 from pickups where subscriber_id = auth.uid() and cycle_month = v_month and cycle_year = v_year
      and status in ('reserved','ready','withdrawn')
  ) then
    raise exception 'PICKUP_ALREADY_CHOSEN';
  end if;

  select coalesce(sum(sp.quantity),0) into v_total_stock
  from stock_partner sp
  join products pr on pr.id = sp.product_id
  where sp.partner_id = p_partner_id and pr.is_gift = true and pr.approved = true and pr.active = true;
  if v_total_stock <= 0 then
    raise exception 'PARTNER_OUT_OF_STOCK';
  end if;

  insert into pickups (subscriber_id, subscription_id, partner_id, status, code, cycle_month, cycle_year, deadline)
  values (auth.uid(), p_subscription_id, p_partner_id, 'ready', generate_pickup_code(), v_month, v_year, now() + interval '30 days')
  returning * into v_pickup;

  insert into notifications (user_id, type, title, message)
  values (auth.uid(), 'pickup', 'Ponto de retirada escolhido', 'Retire seu brinde em até 30 dias.');

  select full_name into v_subscriber_name from profiles where id = auth.uid();
  insert into notifications (user_id, type, title, message)
  select ps.profile_id, 'pickup', 'Nova retirada reservada',
    coalesce(v_subscriber_name, 'Um assinante') || ' escolheu seu estabelecimento para retirar o brinde do mês.'
  from partner_staff ps where ps.partner_id = p_partner_id;

  return v_pickup;
end;
$f$;

create or replace function public.available_balance(p_user_id uuid)
 returns numeric
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(sum(case
    when direction = 'in' and type in ('bonus_subscription', 'adjustment', 'bonus_consumption', 'bonus_partner_fee', 'bonus_qualification') then amount
    when direction = 'in' and type not in ('bonus_subscription', 'adjustment', 'bonus_consumption', 'bonus_partner_fee', 'bonus_qualification') and created_at <= now() - interval '7 days' then amount
    when direction = 'out' then -amount
    else 0
  end), 0) - pending_withdrawals_total(p_user_id)
  from wallet_transactions where user_id = p_user_id and status = 'confirmed'
    and (p_user_id = auth.uid() or is_admin() or auth.role() = 'service_role');
$function$;

create or replace function public.available_bonus_balance(p_user_id uuid)
 returns numeric
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(sum(case
    when direction = 'in' and type in ('bonus_subscription', 'bonus_consumption', 'bonus_partner_fee', 'bonus_qualification') then amount
    when direction = 'in' and type = 'purchase' and (
      created_at <= now() - interval '7 days'
      or exists (
        select 1 from product_orders po
        join payments pm on pm.id = po.payment_id
        where po.id = wallet_transactions.reference_id and pm.payment_method <> 'wallet'
      )
    ) then amount
    when direction = 'out' then -amount
    else 0
  end), 0) - pending_withdrawals_total(p_user_id)
  from wallet_transactions where user_id = p_user_id and status = 'confirmed'
    and (p_user_id = auth.uid() or is_admin() or auth.role() = 'service_role');
$function$;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'monthly-qualification-payouts') then
    perform cron.unschedule('monthly-qualification-payouts');
  end if;
end $$;

select cron.schedule('monthly-qualification-payouts', '5 3 1 * *', $cron$select public.run_monthly_qualification_payouts();$cron$);
