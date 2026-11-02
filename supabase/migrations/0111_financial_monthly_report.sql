-- Pedido do dono: relatório financeiro total mensal (mockup "RELATÓRIO
-- TOTAL: Balanço financeiro"), com dois sub-relatórios:
--  - Entrada de Assinantes: 100% do valor bruto é receita da Brinde Mais,
--    então comissões+premiações+brindes+impostos+lucro líquido somam o
--    valor bruto inteiro.
--  - Entrada de Venda de Produtos: só o "repasse" (commission_amount, a
--    taxa que a Brinde Mais já cobra do parceiro via commission_pct) é
--    receita da Brinde Mais — o resto (net_amount) vai direto pro
--    parceiro e fica fora deste balanço. Aqui comissões+premiações+
--    impostos+lucro líquido somam o repasse, não o valor bruto da venda.
-- Brindes e impostos não têm rastreio de custo real por produto, então
-- são percentuais fixos configuráveis pelo admin (financial_report_settings).
-- Premiações (qualification_bonus_payouts) é rateada proporcionalmente
-- entre os dois relatórios pelo valor bruto de cada um no mês.

create table if not exists public.financial_report_settings (
  id boolean primary key default true,
  brindes_pct numeric not null default 0,
  impostos_pct_assinaturas numeric not null default 0,
  impostos_pct_produtos numeric not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id),
  constraint financial_report_settings_singleton check (id)
);

insert into financial_report_settings (id, brindes_pct, impostos_pct_assinaturas, impostos_pct_produtos)
values (true, 33.4, 12, 6)
on conflict (id) do nothing;

alter table public.financial_report_settings enable row level security;

drop policy if exists financial_report_settings_select on public.financial_report_settings;
create policy financial_report_settings_select on public.financial_report_settings
  for select using (is_admin());

create or replace function public.admin_set_financial_report_settings(
  p_brindes_pct numeric, p_impostos_pct_assinaturas numeric, p_impostos_pct_produtos numeric
)
returns financial_report_settings
language plpgsql security definer set search_path to 'public'
as $f$
declare v_row financial_report_settings;
begin
  if not is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  update financial_report_settings set
    brindes_pct = p_brindes_pct,
    impostos_pct_assinaturas = p_impostos_pct_assinaturas,
    impostos_pct_produtos = p_impostos_pct_produtos,
    updated_at = now(), updated_by = auth.uid()
  where id = true
  returning * into v_row;
  return v_row;
end;
$f$;

revoke all on function public.admin_set_financial_report_settings(numeric, numeric, numeric) from public, anon;
grant execute on function public.admin_set_financial_report_settings(numeric, numeric, numeric) to authenticated;

create or replace function public.admin_financial_monthly_report(p_year int default null, p_month int default null)
returns table(
  ano int, mes int,
  assinantes_valor_bruto numeric, assinantes_comissoes numeric, assinantes_premiacoes numeric,
  assinantes_brindes numeric, assinantes_impostos numeric, assinantes_lucro_liquido numeric,
  produtos_valor_bruto numeric, produtos_repasse numeric, produtos_comissoes numeric,
  produtos_premiacoes numeric, produtos_impostos numeric, produtos_lucro_liquido numeric
)
language plpgsql stable security definer set search_path to 'public'
as $f$
declare
  v_year int := coalesce(p_year, extract(year from now())::int);
  v_month int := coalesce(p_month, extract(month from now())::int);
  v_settings financial_report_settings;
  v_sub_bruto numeric; v_sub_comissoes numeric;
  v_prod_bruto numeric; v_prod_repasse numeric; v_prod_comissoes numeric;
  v_premiacoes_total numeric; v_premiacoes_sub numeric; v_premiacoes_prod numeric;
  v_sub_brindes numeric; v_sub_impostos numeric; v_prod_impostos numeric;
begin
  if not is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  select * into v_settings from financial_report_settings where id = true;

  select coalesce(sum(amount), 0) into v_sub_bruto from payments
    where type = 'subscription' and status = 'confirmed'
      and extract(year from confirmed_at) = v_year and extract(month from confirmed_at) = v_month;

  select coalesce(sum(amount), 0) into v_sub_comissoes from wallet_transactions
    where type = 'bonus_subscription' and direction = 'in' and status = 'confirmed'
      and extract(year from created_at) = v_year and extract(month from created_at) = v_month;

  select coalesce(sum(amount), 0) into v_prod_bruto from payments
    where type = 'product_purchase' and status = 'confirmed'
      and extract(year from confirmed_at) = v_year and extract(month from confirmed_at) = v_month;

  select coalesce(sum(po.commission_amount), 0) into v_prod_repasse
    from product_orders po join payments pm on pm.id = po.payment_id
    where pm.status = 'confirmed'
      and extract(year from pm.confirmed_at) = v_year and extract(month from pm.confirmed_at) = v_month;

  select coalesce(sum(amount), 0) into v_prod_comissoes from wallet_transactions
    where type = 'bonus_consumption' and direction = 'in' and status = 'confirmed'
      and extract(year from created_at) = v_year and extract(month from created_at) = v_month;

  select coalesce(sum(amount), 0) into v_premiacoes_total from qualification_bonus_payouts
    where year = v_year and month = v_month;

  if (v_sub_bruto + v_prod_bruto) > 0 then
    v_premiacoes_sub := round(v_premiacoes_total * v_sub_bruto / (v_sub_bruto + v_prod_bruto), 2);
  else
    v_premiacoes_sub := 0;
  end if;
  v_premiacoes_prod := v_premiacoes_total - v_premiacoes_sub;

  v_sub_brindes := round(v_sub_bruto * coalesce(v_settings.brindes_pct, 0) / 100.0, 2);
  v_sub_impostos := round(v_sub_bruto * coalesce(v_settings.impostos_pct_assinaturas, 0) / 100.0, 2);
  v_prod_impostos := round(v_prod_bruto * coalesce(v_settings.impostos_pct_produtos, 0) / 100.0, 2);

  return query select
    v_year, v_month,
    v_sub_bruto, v_sub_comissoes, v_premiacoes_sub, v_sub_brindes, v_sub_impostos,
    v_sub_bruto - v_sub_comissoes - v_premiacoes_sub - v_sub_brindes - v_sub_impostos,
    v_prod_bruto, v_prod_repasse, v_prod_comissoes, v_premiacoes_prod, v_prod_impostos,
    v_prod_repasse - v_prod_comissoes - v_premiacoes_prod - v_prod_impostos;
end;
$f$;

revoke all on function public.admin_financial_monthly_report(int, int) from public, anon;
grant execute on function public.admin_financial_monthly_report(int, int) to authenticated;
