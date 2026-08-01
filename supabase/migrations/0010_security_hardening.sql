-- ============================================================
-- SECURITY AUDIT FIXES
-- ============================================================

-- 1) partner_pickup_view: security_invoker=true made the profiles RLS
-- (owner-only) apply to the JOIN, so partners got zero rows for their own
-- pickups (total breakage, not a leak — but still a broken access control).
-- The view's own WHERE (is_partner_staff) and its minimal column list
-- (name/phone only, never CPF/address/pix_key) already provide the real
-- row- and column-level control, so it's safe to run as the view owner.
drop view if exists partner_pickup_view;
create view partner_pickup_view as
  select p.id as pickup_id, p.partner_id, p.status, p.code, p.cycle_month, p.cycle_year, p.deadline,
         p.product_id, p.confirmed_at, p.created_at,
         pr.full_name as subscriber_name, pr.phone as subscriber_phone,
         ap.full_name as authorized_name, ap.cpf as authorized_cpf
  from pickups p
  join profiles pr on pr.id = p.subscriber_id
  left join authorized_persons ap on ap.id = p.authorized_person_id
  where is_partner_staff(p.partner_id);

-- 2) Admin "suspend subscriber" (admin_set_subscriber_active) flips
-- profiles.active but nothing actually checked it — a suspended account
-- could keep reserving pickups, requesting withdrawals, and creating new
-- payments/orders same as before. Define the check first so the policies
-- below (and the RPCs further down) can reference it.
create or replace function is_active_subscriber() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select active from profiles where id = auth.uid()), false);
$$;

-- 3) Direct-insert RLS holes: subscriptions/pickups are only ever created
-- server-side by confirm_payment()/choose_pickup_partner() (SECURITY
-- DEFINER, with their own paid/stock/eligibility checks). The old INSERT
-- policies still let a subscriber write these tables directly over the
-- REST API — e.g. POST /rest/v1/subscriptions {status:'active', ...} grants
-- a full active subscription with zero payment. Only the RPCs (which bypass
-- RLS as definer) need to create these rows, so drop client self-insert.
drop policy if exists subscriptions_insert on subscriptions;
create policy subscriptions_insert on subscriptions for insert with check (is_admin());

drop policy if exists pickups_insert on pickups;
create policy pickups_insert on pickups for insert with check (is_admin());

-- 4) payments/store_orders ARE inserted directly by the client (that's the
-- real "I intend to pay via Pix" flow), but nothing constrained the status
-- column — a client could insert with status='confirmed'/'paid' directly,
-- skipping admin review. Pin self-inserts to the initial unconfirmed state;
-- only confirm_payment()/admin can move them forward.
drop policy if exists payments_insert on payments;
create policy payments_insert on payments for insert with check (
  is_admin() or (subscriber_id = auth.uid() and status = 'pending' and is_active_subscriber())
);

drop policy if exists store_orders_insert on store_orders;
create policy store_orders_insert on store_orders for insert with check (
  is_admin() or (subscriber_id = auth.uid() and status = 'pending_payment' and is_active_subscriber())
);

create or replace function choose_pickup_partner(p_subscription_id uuid, p_partner_id uuid) returns pickups language plpgsql security definer set search_path = public as $$
declare
  v_sub subscriptions;
  v_total_stock int;
  v_pickup pickups;
  v_month int; v_year int;
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

  return v_pickup;
end;
$$;

create or replace function request_withdrawal(p_amount numeric, p_pix_key text) returns withdrawals language plpgsql security definer set search_path = public as $$
declare
  v_avail numeric;
  v_w withdrawals;
begin
  if not is_active_subscriber() then
    raise exception 'ACCOUNT_SUSPENDED';
  end if;
  if p_amount < 100 then raise exception 'MINIMUM_WITHDRAWAL_100'; end if;
  select available_balance(auth.uid()) into v_avail;
  if v_avail < p_amount then raise exception 'INSUFFICIENT_BALANCE'; end if;

  insert into withdrawals (user_id, amount, pix_key) values (auth.uid(), p_amount, p_pix_key)
  returning * into v_w;

  insert into notifications (user_id, type, title, message)
  values (auth.uid(), 'withdrawal', 'Saque solicitado', 'Seu saque de R$ ' || p_amount || ' está em análise.');

  return v_w;
end;
$$;

-- 5) Storage: any authenticated user could overwrite (UPDATE) ANY file in
-- the public-images bucket, not just their own uploads — a logged-in
-- subscriber could deface any partner logo or product image site-wide.
-- Scope to the uploader (storage sets owner_id automatically) or admin.
drop policy if exists public_images_update on storage.objects;
create policy public_images_update on storage.objects for update using (
  bucket_id = 'public-images' and (owner_id = auth.uid()::text or is_admin())
);

-- Public bucket already serves files by direct URL regardless of RLS (that
-- doesn't need a SELECT policy); the SELECT policy only gates the list/API
-- read path, which was open to anyone unauthenticated to enumerate every
-- uploaded file. Restrict listing to signed-in users.
drop policy if exists public_images_read on storage.objects;
create policy public_images_read on storage.objects for select using (
  bucket_id = 'public-images' and auth.role() = 'authenticated'
);
