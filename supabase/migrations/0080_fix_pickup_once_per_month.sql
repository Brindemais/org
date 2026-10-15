-- Bug: choose_pickup_partner só bloqueava reserva nova se já existisse uma
-- com status 'reserved' ou 'ready' no mês. Assim que o parceiro confirmava
-- a retirada (status vira 'withdrawn'), o assinante conseguia escolher um
-- parceiro de novo e reservar outro brinde no mesmo mês. Inclui 'withdrawn'
-- no bloqueio — só libera reserva nova no mês se a anterior foi cancelada
-- ou expirou.
create or replace function choose_pickup_partner(p_subscription_id uuid, p_partner_id uuid)
returns pickups
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_sub subscriptions;
  v_total_stock int;
  v_pickup pickups;
  v_month int; v_year int;
  v_subscriber_name text;
begin
  if not is_active_subscriber() then
    raise exception 'ACCOUNT_SUSPENDED';
  end if;

  select * into v_sub from subscriptions where id = p_subscription_id and subscriber_id = auth.uid();
  if v_sub.id is null or v_sub.status <> 'active' then
    raise exception 'SUBSCRIPTION_NOT_ACTIVE';
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
$$;
