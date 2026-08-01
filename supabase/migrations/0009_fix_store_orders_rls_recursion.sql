-- 0008's store_orders_partner_select queries store_order_items, whose own
-- select policy queries store_orders back — infinite recursion. Route the
-- check through a SECURITY DEFINER function (same pattern as is_partner_staff)
-- so it bypasses RLS internally instead of re-entering it.
drop policy if exists store_orders_partner_select on store_orders;

create or replace function is_partner_order(p_order_id uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from store_order_items i where i.order_id = p_order_id and is_partner_staff(i.partner_id));
$$;

create policy store_orders_partner_select on store_orders for select using (is_partner_order(id));
