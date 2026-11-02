-- Sistema de qualificação mensal VIP / VIP MAIS / ELITE — pedido do dono:
--
--   VIP:      >=10 assinantes ativos diretos (nível 1).
--             Ganha o direito de retirar 1 Brinde no mês (ver 0109, que
--             condiciona choose_pickup_partner a isso a partir da 2ª
--             retirada — a primeira é sempre livre).
--   VIP MAIS: >=10 diretos ativos E >=110 ativos somando nível 1+2.
--             Ganha R$200,00 de bônus, pago automaticamente todo mês.
--   ELITE:    >=100 diretos ativos E >=1.100 ativos somando nível 1+2.
--             Ganha R$1.500,00 de bônus, pago automaticamente todo mês.
--
-- "Assinante ativo" = subscriptions.status='active' e não vencida (mesma
-- regra que já libera benefícios hoje). "Por mês" = mês calendário,
-- reavaliado a cada chamada (contagem sempre "ao vivo", não é um
-- snapshot fixo) — já o pagamento de VIP MAIS/ELITE É um snapshot
-- mensal fixo, gerado automaticamente no dia 1 de cada mês (ver
-- cron em 0109) para o mês que acabou de fechar.
--
-- Funções internas (_subscriber_referral_active_counts, _qualification_tier)
-- não são expostas via RPC (revoke all de anon/authenticated) — só
-- existem pra serem chamadas de dentro de outras funções SECURITY
-- DEFINER (subscriber_qualification_status, choose_pickup_partner,
-- run_monthly_qualification_payouts).

create table if not exists public.qualification_bonus_payouts (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references profiles(id),
  year int not null,
  month int not null,
  tier text not null,
  amount numeric not null,
  direct_active_count int not null,
  l1_l2_active_count int not null,
  created_at timestamptz not null default now(),
  unique (subscriber_id, year, month)
);

alter table public.qualification_bonus_payouts enable row level security;

drop policy if exists qualification_bonus_payouts_select on public.qualification_bonus_payouts;
create policy qualification_bonus_payouts_select on public.qualification_bonus_payouts
  for select using (subscriber_id = auth.uid() or is_admin());

create or replace function public._subscriber_referral_active_counts(p_subscriber_id uuid)
returns table(direct_active int, l1_l2_active int)
language sql
stable
security definer
set search_path to 'public'
as $f$
  with l1 as (
    select p.id from profiles p where p.referred_by = p_subscriber_id
  ),
  l2 as (
    select p.id from profiles p where p.referred_by in (select id from l1)
  ),
  active_ids as (
    select distinct s.subscriber_id from subscriptions s
    where s.status = 'active' and (s.expires_at is null or s.expires_at > now())
  )
  select
    (select count(*)::int from l1 where l1.id in (select subscriber_id from active_ids)),
    (select count(*)::int from (select id from l1 union select id from l2) u where u.id in (select subscriber_id from active_ids));
$f$;

revoke all on function public._subscriber_referral_active_counts(uuid) from public, anon, authenticated;

create or replace function public._qualification_tier(p_direct_active int, p_l1_l2_active int)
returns text
language sql
immutable
as $f$
  select case
    when p_direct_active >= 100 and p_l1_l2_active >= 1100 then 'elite'
    when p_direct_active >= 10 and p_l1_l2_active >= 110 then 'vip_mais'
    when p_direct_active >= 10 then 'vip'
    else 'none'
  end;
$f$;

revoke all on function public._qualification_tier(int, int) from public, anon, authenticated;

create or replace function public.subscriber_qualification_status(p_subscriber_id uuid default auth.uid())
returns table(direct_active int, l1_l2_active int, tier text)
language plpgsql
stable
security definer
set search_path to 'public'
as $f$
declare
  v_direct int;
  v_l1l2 int;
begin
  if not (p_subscriber_id = auth.uid() or is_admin() or auth.role() = 'service_role') then
    raise exception 'NOT_AUTHORIZED';
  end if;

  select c.direct_active, c.l1_l2_active into v_direct, v_l1l2
  from _subscriber_referral_active_counts(p_subscriber_id) c;

  return query select v_direct, v_l1l2, _qualification_tier(v_direct, v_l1l2);
end;
$f$;

revoke all on function public.subscriber_qualification_status(uuid) from public, anon;
grant execute on function public.subscriber_qualification_status(uuid) to authenticated;

create or replace function public.run_monthly_qualification_payouts(p_year int default null, p_month int default null)
returns setof qualification_bonus_payouts
language plpgsql
security definer
set search_path to 'public'
as $f$
declare
  v_year int := coalesce(p_year, extract(year from now() - interval '1 day')::int);
  v_month int := coalesce(p_month, extract(month from now() - interval '1 day')::int);
  v_sub record;
  v_counts record;
  v_tier text;
  v_amount numeric;
  v_balance numeric;
  v_payout qualification_bonus_payouts;
begin
  -- Chamada real vem do pg_cron (roda direto como role de banco, sem JWT
  -- — auth.role() vem null nesse caso) ou de um admin/service_role.
  if not (is_admin() or auth.role() = 'service_role' or auth.role() is null) then
    raise exception 'NOT_AUTHORIZED';
  end if;

  for v_sub in select id from profiles where role = 'subscriber' loop
    select * into v_counts from _subscriber_referral_active_counts(v_sub.id);
    v_tier := _qualification_tier(v_counts.direct_active, v_counts.l1_l2_active);

    if v_tier in ('vip_mais', 'elite') then
      v_amount := case v_tier when 'elite' then 1500.00 else 200.00 end;

      insert into qualification_bonus_payouts (subscriber_id, year, month, tier, amount, direct_active_count, l1_l2_active_count)
      values (v_sub.id, v_year, v_month, v_tier, v_amount, v_counts.direct_active, v_counts.l1_l2_active)
      on conflict (subscriber_id, year, month) do nothing
      returning * into v_payout;

      if v_payout.id is not null then
        select current_wallet_balance(v_sub.id) + v_amount into v_balance;

        insert into wallet_transactions (user_id, type, direction, amount, balance_after, reference_type, reference_id, description)
        values (v_sub.id, 'bonus_qualification', 'in', v_amount, v_balance, 'qualification_payout', v_payout.id,
          'Bônus de qualificação ' || upper(v_tier) || ' - ' || v_month || '/' || v_year);

        insert into notifications (user_id, type, title, message)
        values (v_sub.id, 'bonus', 'Bônus de qualificação!', 'Você atingiu o nível ' || upper(v_tier) || ' e recebeu R$ ' || v_amount || ' de bônus.');

        return next v_payout;
      end if;
    end if;
  end loop;

  return;
end;
$f$;

revoke all on function public.run_monthly_qualification_payouts(int, int) from public, anon, authenticated;
