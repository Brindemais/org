alter table profiles enable row level security;
alter table partners enable row level security;
alter table partner_staff enable row level security;
alter table partner_change_requests enable row level security;
alter table subscriptions enable row level security;
alter table payments enable row level security;
alter table products enable row level security;
alter table stock_matrix enable row level security;
alter table stock_partner enable row level security;
alter table stock_movements enable row level security;
alter table authorized_persons enable row level security;
alter table pickups enable row level security;
alter table referrals enable row level security;
alter table bonuses enable row level security;
alter table wallet_transactions enable row level security;
alter table withdrawals enable row level security;
alter table promotions enable row level security;
alter table store_orders enable row level security;
alter table store_order_items enable row level security;
alter table support_tickets enable row level security;
alter table support_messages enable row level security;
alter table notifications enable row level security;
alter table audit_logs enable row level security;

-- PROFILES
create policy profiles_select_own on profiles for select using (id = auth.uid() or is_admin());
create policy profiles_update_own on profiles for update using (id = auth.uid() or is_admin());
create policy profiles_insert_self on profiles for insert with check (id = auth.uid());

-- limited view for partners to see subscriber name/phone tied to their pickups only
create view partner_pickup_view with (security_invoker = true) as
  select p.id as pickup_id, p.partner_id, p.status, p.code, p.cycle_month, p.cycle_year, p.deadline,
         p.product_id, p.confirmed_at, p.created_at,
         pr.full_name as subscriber_name, pr.phone as subscriber_phone,
         ap.full_name as authorized_name, ap.cpf as authorized_cpf
  from pickups p
  join profiles pr on pr.id = p.subscriber_id
  left join authorized_persons ap on ap.id = p.authorized_person_id
  where is_partner_staff(p.partner_id);

-- PARTNERS (public can browse approved/active partners; staff & admin manage)
create policy partners_public_read on partners for select using (status in ('approved','active') or is_partner_staff(id));
create policy partners_admin_write on partners for insert with check (is_admin());
create policy partners_update on partners for update using (is_admin() or is_partner_staff(id));

create policy partner_staff_select on partner_staff for select using (profile_id = auth.uid() or is_admin());
create policy partner_staff_admin_write on partner_staff for insert with check (is_admin());
create policy partner_staff_admin_delete on partner_staff for delete using (is_admin());

create policy pcr_select on partner_change_requests for select using (is_partner_staff(partner_id));
create policy pcr_insert on partner_change_requests for insert with check (is_partner_staff(partner_id));
create policy pcr_admin_update on partner_change_requests for update using (is_admin());

-- SUBSCRIPTIONS
create policy subscriptions_select on subscriptions for select using (subscriber_id = auth.uid() or is_admin());
create policy subscriptions_insert on subscriptions for insert with check (subscriber_id = auth.uid() or is_admin());

-- PAYMENTS (client can create a pending payment for itself; only functions confirm)
create policy payments_select on payments for select using (subscriber_id = auth.uid() or is_admin());
create policy payments_insert on payments for insert with check (subscriber_id = auth.uid() or is_admin());

-- PRODUCTS (public catalog read; partner manages own; admin manages matrix + all)
create policy products_public_read on products for select using (active = true or is_admin() or (partner_id is not null and is_partner_staff(partner_id)));
create policy products_admin_insert on products for insert with check (is_admin() or (partner_id is not null and is_partner_staff(partner_id)));
create policy products_update on products for update using (is_admin() or (partner_id is not null and is_partner_staff(partner_id)));

-- STOCK
create policy stock_matrix_admin on stock_matrix for select using (is_admin());
create policy stock_partner_select on stock_partner for select using (is_partner_staff(partner_id) or is_admin());
create policy stock_partner_public_avail on stock_partner for select using (quantity > 0);
create policy stock_movements_select on stock_movements for select using (is_admin() or (partner_id is not null and is_partner_staff(partner_id)));

-- AUTHORIZED PERSONS
create policy authorized_persons_owner on authorized_persons for all using (subscriber_id = auth.uid() or is_admin())
  with check (subscriber_id = auth.uid() or is_admin());

-- PICKUPS
create policy pickups_select on pickups for select using (subscriber_id = auth.uid() or is_admin() or is_partner_staff(partner_id));
create policy pickups_insert on pickups for insert with check (subscriber_id = auth.uid() or is_admin());

-- REFERRALS
create policy referrals_select on referrals for select using (referrer_id = auth.uid() or referred_id = auth.uid() or is_admin());

-- BONUSES
create policy bonuses_select on bonuses for select using (beneficiary_id = auth.uid() or is_admin());

-- WALLET
create policy wallet_select on wallet_transactions for select using (user_id = auth.uid() or is_admin());

-- WITHDRAWALS
create policy withdrawals_select on withdrawals for select using (user_id = auth.uid() or is_admin());

-- PROMOTIONS (public sees approved; partner manages own; admin all)
create policy promotions_public_read on promotions for select using (status = 'approved' or is_admin() or is_partner_staff(partner_id));
create policy promotions_partner_insert on promotions for insert with check (is_partner_staff(partner_id));
create policy promotions_update on promotions for update using (is_admin() or is_partner_staff(partner_id));

-- STORE ORDERS
create policy store_orders_select on store_orders for select using (subscriber_id = auth.uid() or is_admin());
create policy store_orders_insert on store_orders for insert with check (subscriber_id = auth.uid());
create policy store_order_items_select on store_order_items for select using (
  exists(select 1 from store_orders o where o.id = order_id and (o.subscriber_id = auth.uid() or is_admin()))
  or (partner_id is not null and is_partner_staff(partner_id))
);
create policy store_order_items_insert on store_order_items for insert with check (
  exists(select 1 from store_orders o where o.id = order_id and o.subscriber_id = auth.uid())
);

-- SUPPORT
create policy tickets_select on support_tickets for select using (user_id = auth.uid() or is_admin());
create policy tickets_insert on support_tickets for insert with check (user_id = auth.uid());
create policy tickets_update on support_tickets for update using (user_id = auth.uid() or is_admin());
create policy messages_select on support_messages for select using (
  exists(select 1 from support_tickets t where t.id = ticket_id and (t.user_id = auth.uid() or is_admin()))
);
create policy messages_insert on support_messages for insert with check (
  sender_id = auth.uid() and exists(select 1 from support_tickets t where t.id = ticket_id and (t.user_id = auth.uid() or is_admin()))
);

-- NOTIFICATIONS
create policy notifications_select on notifications for select using (user_id = auth.uid());
create policy notifications_update on notifications for update using (user_id = auth.uid());

-- AUDIT LOGS
create policy audit_select on audit_logs for select using (is_admin());
