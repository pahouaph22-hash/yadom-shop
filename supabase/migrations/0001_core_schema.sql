-- =====================================================================
-- Ya Dom Hom Lao shop — core schema
-- All money is stored in LAK (kip) as whole numbers. THB is display-only
-- via settings.thb_rate.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum ('admin', 'staff', 'customer');
create type public.order_status as enum (
  'received', 'pending_payment', 'paid', 'shipping', 'delivered', 'cancelled', 'refunded'
);
create type public.customer_type as enum ('retail', 'regular', 'wholesale');

-- ---------------------------------------------------------------------
-- Users / roles
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text check (char_length(full_name) <= 120),
  phone text check (char_length(phone) <= 30),
  role public.app_role not null default 'customer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Emails that become admin automatically when they sign up.
create table public.admin_allowlist (
  email text primary key check (email = lower(email))
);

-- ---------------------------------------------------------------------
-- Store settings & contact channels
-- ---------------------------------------------------------------------
create table public.settings (
  key text primary key check (key ~ '^[a-z0-9_]{2,60}$'),
  value jsonb not null,
  is_public boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.contact_channels (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('whatsapp','facebook','tiktok','instagram','phone','email','address','line','other')),
  label text check (char_length(label) <= 80),
  value text not null check (char_length(value) between 1 and 300),
  url text check (url is null or url ~* '^(https?://|tel:|mailto:)'),
  sort integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  phone text check (char_length(phone) <= 30),
  email text check (char_length(email) <= 160),
  subject text check (char_length(subject) <= 160),
  message text not null check (char_length(message) between 1 and 4000),
  status text not null default 'new' check (status in ('new','read','replied','archived')),
  staff_note text check (char_length(staff_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Products & stock
-- ---------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique check (sku ~ '^[A-Za-z0-9_-]{1,40}$'),
  name_lo text not null check (char_length(name_lo) between 1 and 160),
  name_th text check (char_length(name_th) <= 160),
  name_en text check (char_length(name_en) <= 160),
  description_lo text check (char_length(description_lo) <= 5000),
  description_th text check (char_length(description_th) <= 5000),
  description_en text check (char_length(description_en) <= 5000),
  size_label text check (char_length(size_label) <= 60),
  images text[] not null default '{}',
  price_retail numeric(14,0) not null check (price_retail >= 0),
  price_wholesale numeric(14,0) check (price_wholesale >= 0),
  wholesale_min_qty integer not null default 12 check (wholesale_min_qty > 0),
  unit_cost numeric(14,0) not null default 0 check (unit_cost >= 0),
  packaging_cost numeric(14,0) not null default 0 check (packaging_cost >= 0),
  stock integer not null default 0 check (stock >= 0),
  low_stock_threshold integer not null default 10 check (low_stock_threshold >= 0),
  is_active boolean not null default true,
  sort integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stock_movements (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.products (id) on delete restrict,
  change integer not null check (change <> 0),
  stock_after integer not null,
  reason text not null check (reason in ('initial','restock','adjust','damage','order','order_edit','cancel','return')),
  order_id uuid,
  note text check (char_length(note) <= 500),
  actor_id uuid,
  created_at timestamptz not null default now()
);
create index on public.stock_movements (product_id, created_at desc);

-- ---------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  phone text not null check (char_length(phone) <= 30),
  phone_norm text generated always as (regexp_replace(phone, '\D', '', 'g')) stored,
  email text check (char_length(email) <= 160),
  address text check (char_length(address) <= 500),
  province text check (char_length(province) <= 80),
  type public.customer_type not null default 'retail',
  note text check (char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_phone_valid check (char_length(regexp_replace(phone, '\D', '', 'g')) between 6 and 15)
);
create unique index customers_phone_norm_key on public.customers (phone_norm);

-- ---------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------
create sequence public.order_no_seq;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique default (
    'YD' || to_char(now() at time zone 'Asia/Vientiane', 'YYMMDD') || '-' || lpad(nextval('public.order_no_seq')::text, 4, '0')
  ),
  customer_id uuid not null references public.customers (id) on delete restrict,
  user_id uuid references auth.users (id) on delete set null,
  status public.order_status not null default 'received',
  channel text not null default 'web' check (channel in ('web','shop','event','facebook','whatsapp','tiktok','phone','other')),
  is_wholesale boolean not null default false,
  subtotal numeric(14,0) not null default 0 check (subtotal >= 0),
  discount numeric(14,0) not null default 0 check (discount >= 0),
  shipping_fee numeric(14,0) not null default 0 check (shipping_fee >= 0),
  total numeric(14,0) generated always as (subtotal - discount + shipping_fee) stored,
  paid_amount numeric(14,0) not null default 0,
  refunded_amount numeric(14,0) not null default 0,
  ship_name text check (char_length(ship_name) <= 120),
  ship_phone text check (char_length(ship_phone) <= 30),
  ship_address text check (char_length(ship_address) <= 500),
  payment_method_pref text check (char_length(payment_method_pref) <= 40),
  customer_note text check (char_length(customer_note) <= 1000),
  internal_note text check (char_length(internal_note) <= 2000),
  idempotency_key text unique check (char_length(idempotency_key) between 8 and 100),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_discount_le_subtotal check (discount <= subtotal)
);
create index on public.orders (created_at desc);
create index on public.orders (customer_id);
create index on public.orders (status);
create index on public.orders (user_id);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  product_name text not null,
  sku text not null,
  qty integer not null check (qty > 0 and qty <= 100000),
  unit_price numeric(14,0) not null check (unit_price >= 0),
  unit_cost numeric(14,0) not null default 0 check (unit_cost >= 0),
  is_wholesale_price boolean not null default false,
  line_total numeric(14,0) generated always as (qty * unit_price) stored,
  created_at timestamptz not null default now()
);
create index on public.order_items (order_id);
create index on public.order_items (product_id);

-- Human-readable timeline of everything that happened to an order.
create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  event text not null check (event in ('created','status','edit','payment','refund','note')),
  from_status public.order_status,
  to_status public.order_status,
  note text check (char_length(note) <= 1000),
  data jsonb,
  actor_id uuid,
  actor_email text,
  created_at timestamptz not null default now()
);
create index on public.order_events (order_id, created_at);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  kind text not null check (kind in ('payment','refund')),
  amount numeric(14,0) not null check (amount > 0),
  method text not null check (method in ('cash','bank_transfer','bcel_one','ldb','qr','cod','other')),
  reference text check (char_length(reference) <= 120),
  note text check (char_length(note) <= 500),
  paid_at timestamptz not null default now(),
  actor_id uuid,
  created_at timestamptz not null default now()
);
create unique index payments_no_duplicate_ref on public.payments (order_id, kind, reference) where reference is not null;
create index on public.payments (paid_at);
create index on public.payments (order_id);

-- ---------------------------------------------------------------------
-- Expenses
-- ---------------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null default (now() at time zone 'Asia/Vientiane')::date,
  category text not null check (category in ('inventory','packaging','shipping','marketing','rent','salary','utilities','equipment','fees','other')),
  amount numeric(14,0) not null check (amount > 0),
  description text not null check (char_length(description) between 1 and 500),
  supplier text check (char_length(supplier) <= 160),
  reference text check (char_length(reference) <= 120),
  order_id uuid references public.orders (id) on delete set null,
  product_id uuid references public.products (id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.expenses (expense_date);
create index on public.expenses (order_id);
create index on public.expenses (product_id);

-- ---------------------------------------------------------------------
-- Audit log (append-only)
-- ---------------------------------------------------------------------
create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  actor_email text,
  actor_role text,
  action text not null,
  entity text not null,
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  changed_fields text[],
  note text
);
create index on public.audit_log (at desc);
create index on public.audit_log (entity, entity_id);
create index on public.audit_log (actor_id);
