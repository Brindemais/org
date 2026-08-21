-- ============================================================
-- Real notifications for partner staff: a new pickup reservation and a
-- stock transfer from the matrix now insert into `notifications` for
-- every staff member of the partner involved, same as subscribers
-- already get for their own account events. Low-stock alerts stay
-- computed on the fly (partner Dashboard/Notificações pages) instead of
-- stored rows here, since it's a standing condition rather than a
-- one-time event.
-- ============================================================

create or replace function choose_pickup_partner(p_subscription_id uuid, p_partner_id uuid) returns pickups language plpgsql security definer set search_path = public as $$
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
      and status in ('reserved','ready')
  ) then
    raise exception 'PICKUP_ALREADY_CHOSEN';
  end if;

  select coalesce(sum(quantity),0) into v_total_stock from stock_partner where partner_id = p_partner_id;
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

create or replace function transfer_stock_to_partner(p_product_id uuid, p_partner_id uuid, p_quantity int, p_reason text) returns void language plpgsql security definer set search_path = public as $$
declare v_matrix_qty int; v_partner_qty int; v_product_name text;
begin
  if not is_admin() then raise exception 'NOT_AUTHORIZED'; end if;
  select quantity into v_matrix_qty from stock_matrix where product_id = p_product_id for update;
  if v_matrix_qty is null or v_matrix_qty < p_quantity then raise exception 'INSUFFICIENT_MATRIX_STOCK'; end if;

  update stock_matrix set quantity = quantity - p_quantity where product_id = p_product_id;
  insert into stock_movements (product_id, partner_id, type, quantity, prior_balance, new_balance, reason, responsible_id)
  values (p_product_id, p_partner_id, 'transfer_out', -p_quantity, v_matrix_qty, v_matrix_qty - p_quantity, p_reason, auth.uid());

  insert into stock_partner (partner_id, product_id, quantity) values (p_partner_id, p_product_id, p_quantity)
    on conflict (partner_id, product_id) do update set quantity = stock_partner.quantity + p_quantity;

  select quantity into v_partner_qty from stock_partner where partner_id = p_partner_id and product_id = p_product_id;
  insert into stock_movements (product_id, partner_id, type, quantity, prior_balance, new_balance, reason, responsible_id)
  values (p_product_id, p_partner_id, 'transfer_in', p_quantity, v_partner_qty - p_quantity, v_partner_qty, p_reason, auth.uid());

  select name into v_product_name from products where id = p_product_id;
  insert into notifications (user_id, type, title, message)
  select ps.profile_id, 'stock', 'Brindes recebidos da matriz',
    p_quantity || ' unidade' || (case when p_quantity = 1 then '' else 's' end) || ' de ' || coalesce(v_product_name, 'brinde') || ' chegaram ao seu estoque.'
  from partner_staff ps where ps.partner_id = p_partner_id;
end;
$$;
