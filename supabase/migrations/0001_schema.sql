-- ============================================================
-- BRINDE MAIS - Core schema
-- ============================================================
create extension if not exists pgcrypto;

create type user_role as enum ('subscriber','partner','admin','operator');
create type subscription_status as enum ('pending','active','overdue','suspended','cancelled');
create type payment_status as enum ('pending','confirmed','failed','duplicate','cancelled','refunded');
create type partner_status as enum ('interested','pending_docs','analyzing','approved','active','suspended','rejected','closed');
create type pickup_status as enum ('reserved','ready','withdrawn','cancelled','expired');
create type stock_movement_type as enum ('entry','exit','transfer_out','transfer_in','adjustment','loss','damage','reservation','delivery','return');
create type wallet_tx_type as enum ('bonus_subscription','bonus_consumption','cashback','withdrawal','adjustment','reversal','purchase');
create type withdrawal_status as enum ('requested','analyzing','approved','rejected','paid');
create type promotion_status as enum ('draft','pending_approval','approved','rejected','suspended','expired');
create type order_status as enum ('pending_payment','paid','ready','completed','cancelled');
create type ticket_status as enum ('open','in_progress','resolved','closed');
create type approval_status as enum ('pending','approved','rejected');

-- ---------------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'subscriber',
  full_name text not null,
  cpf text unique,
  birth_date date,
  phone text,
  email text,
  cep text,
  address text,
  neighborhood text,
  city text,
  state text,
  pix_key text,
  referral_code text unique not null,
  referred_by uuid references profiles(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index profiles_referred_by_idx on profiles(referred_by);
create index profiles_role_idx on profiles(role);

-- ---------------------------------------------------------------
-- PARTNERS
-- ---------------------------------------------------------------
create table partners (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  trade_name text not null,
  cnpj_cpf text,
  responsible_name text,
  phone text,
  whatsapp text,
  email text,
  cep text,
  address text,
  neighborhood text,
  city text default 'Rio de Janeiro',
  state text default 'RJ',
  category text not null default 'outros',
  opening_hours text,
  logo_url text,
  images text[] default '{}',
  pix_key text,
  status partner_status not null default 'interested',
  rating numeric(2,1) default 5.0,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);
create index partners_status_idx on partners(status);
create index partners_city_idx on partners(city);

create table partner_staff (
  partner_id uuid not null references partners(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (partner_id, profile_id)
);

create table partner_change_requests (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  requested_by uuid references profiles(id),
  changes jsonb not null,
  status approval_status not null default 'pending',
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- SUBSCRIPTIONS & PAYMENTS
-- ---------------------------------------------------------------
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references profiles(id) on delete cascade,
  status subscription_status not null default 'pending',
  amount numeric(10,2) not null default 79.00,
  activated_at timestamptz,
  expires_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);
create index subscriptions_subscriber_idx on subscriptions(subscriber_id);
create index subscriptions_status_idx on subscriptions(status);

create table payments (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references profiles(id),
  subscription_id uuid references subscriptions(id),
  order_id uuid,
  amount numeric(10,2) not null,
  type text not null default 'subscription',
  status payment_status not null default 'pending',
  pix_code text,
  external_reference text unique not null default encode(gen_random_bytes(12),'hex'),
  confirmed_at timestamptz,
  confirmed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index payments_subscriber_idx on payments(subscriber_id);
create index payments_status_idx on payments(status);

-- ---------------------------------------------------------------
-- PRODUCTS & STOCK
-- ---------------------------------------------------------------
create table products (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references partners(id) on delete cascade,
  name text not null,
  description text,
  image_url text,
  category text default 'brinde',
  normal_price numeric(10,2) not null default 0,
  subscriber_price numeric(10,2) not null default 0,
  is_gift boolean not null default true,
  store_visible boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index products_partner_idx on products(partner_id);

create table stock_matrix (
  product_id uuid primary key references products(id) on delete cascade,
  quantity integer not null default 0 check (quantity >= 0)
);

create table stock_partner (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  quantity integer not null default 0 check (quantity >= 0),
  unique (partner_id, product_id)
);

create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  partner_id uuid references partners(id),
  type stock_movement_type not null,
  quantity integer not null,
  prior_balance integer not null,
  new_balance integer not null,
  reason text,
  responsible_id uuid references profiles(id),
  reference_id uuid,
  created_at timestamptz not null default now()
);
create index stock_movements_product_idx on stock_movements(product_id);
create index stock_movements_partner_idx on stock_movements(partner_id);

-- ---------------------------------------------------------------
-- PICKUPS (retiradas do brinde mensal)
-- ---------------------------------------------------------------
create table authorized_persons (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references profiles(id) on delete cascade,
  full_name text not null,
  cpf text not null,
  phone text,
  relationship text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table pickups (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references profiles(id),
  subscription_id uuid not null references subscriptions(id),
  partner_id uuid not null references partners(id),
  product_id uuid references products(id),
  status pickup_status not null default 'reserved',
  code text unique not null,
  cycle_month int not null,
  cycle_year int not null,
  authorized_person_id uuid references authorized_persons(id),
  actually_withdrawn_by text,
  confirmed_by uuid references profiles(id),
  confirmed_at timestamptz,
  cancelled_reason text,
  deadline timestamptz not null,
  created_at timestamptz not null default now(),
  unique (subscriber_id, cycle_month, cycle_year, status) deferrable initially deferred
);
create index pickups_subscriber_idx on pickups(subscriber_id);
create index pickups_partner_idx on pickups(partner_id);
create index pickups_status_idx on pickups(status);

-- ---------------------------------------------------------------
-- REFERRALS, BONUSES, WALLET
-- ---------------------------------------------------------------
create table referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references profiles(id),
  referred_id uuid not null unique references profiles(id),
  created_at timestamptz not null default now()
);
create index referrals_referrer_idx on referrals(referrer_id);

create table bonuses (
  id uuid primary key default gen_random_uuid(),
  beneficiary_id uuid not null references profiles(id),
  source_subscriber_id uuid not null references profiles(id),
  type text not null,
  level int not null,
  percent numeric(5,2) not null,
  amount numeric(10,2) not null,
  origin_payment_id uuid references payments(id),
  status text not null default 'confirmed',
  created_at timestamptz not null default now()
);
create index bonuses_beneficiary_idx on bonuses(beneficiary_id);
create index bonuses_origin_idx on bonuses(origin_payment_id);

create table wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  type wallet_tx_type not null,
  direction text not null check (direction in ('in','out')),
  amount numeric(10,2) not null check (amount > 0),
  balance_after numeric(10,2) not null,
  status text not null default 'confirmed',
  reference_type text,
  reference_id uuid,
  description text not null,
  created_at timestamptz not null default now()
);
create index wallet_tx_user_idx on wallet_transactions(user_id);

create table withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  amount numeric(10,2) not null check (amount >= 100),
  pix_key text not null,
  status withdrawal_status not null default 'requested',
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid references profiles(id),
  receipt_url text,
  notes text,
  created_at timestamptz not null default now()
);
create index withdrawals_user_idx on withdrawals(user_id);
create index withdrawals_status_idx on withdrawals(status);

-- ---------------------------------------------------------------
-- PROMOTIONS / STORE
-- ---------------------------------------------------------------
create table promotions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references partners(id) on delete cascade,
  title text not null,
  description text,
  normal_price numeric(10,2),
  subscriber_price numeric(10,2),
  discount_pct numeric(5,2),
  valid_from date not null default current_date,
  valid_until date not null,
  status promotion_status not null default 'pending_approval',
  created_at timestamptz not null default now()
);
create index promotions_partner_idx on promotions(partner_id);
create index promotions_status_idx on promotions(status);

create table store_orders (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references profiles(id),
  status order_status not null default 'pending_payment',
  total numeric(10,2) not null default 0,
  payment_id uuid,
  created_at timestamptz not null default now()
);

create table store_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references store_orders(id) on delete cascade,
  product_id uuid not null references products(id),
  partner_id uuid references partners(id),
  quantity int not null default 1,
  unit_price numeric(10,2) not null
);

alter table payments add constraint payments_order_fk foreign key (order_id) references store_orders(id);
alter table store_orders add constraint store_orders_payment_fk foreign key (payment_id) references payments(id);

-- ---------------------------------------------------------------
-- SUPPORT / NOTIFICATIONS / AUDIT
-- ---------------------------------------------------------------
create table support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  category text not null,
  subject text not null,
  status ticket_status not null default 'open',
  created_at timestamptz not null default now()
);

create table support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references support_tickets(id) on delete cascade,
  sender_id uuid not null references profiles(id),
  message text not null,
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on notifications(user_id, read);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  action text not null,
  entity text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
