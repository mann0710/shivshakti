-- Baseline schema inferred from the app code (the live Supabase project is the source of truth).
-- Used for local development; production only needs the files in supabase/migrations/.
create extension if not exists pgcrypto;

create table if not exists customers (id uuid primary key default gen_random_uuid(), name text not null, phone text default '',
  email text, address text, notes text, created_at timestamptz not null default now());
create table if not exists menus (id uuid primary key default gen_random_uuid(), name text not null, description text,
  price_per_plate numeric(12,2) not null, category text not null default 'Gujarati', items text[] not null default '{}',
  is_active boolean not null default true, created_at timestamptz not null default now());
create table if not exists bookings (id uuid primary key default gen_random_uuid(), customer_id uuid not null references customers(id) on delete restrict,
  event_type text not null, event_date date not null, end_date date, event_time text, venue text not null default '',
  guest_count int not null default 0, menu_id uuid references menus(id) on delete set null, special_instructions text,
  status text not null default 'inquiry' check (status in ('inquiry','followup','confirmed','completed','cancelled','pending')),
  estimated_cost numeric(12,2) not null default 0, created_at timestamptz not null default now());
create table if not exists quotations (id uuid primary key default gen_random_uuid(), quotation_number text not null unique,
  customer_id uuid not null references customers(id), booking_id uuid references bookings(id) on delete set null,
  items jsonb not null default '[]', per_plate_amount numeric(12,2) not null default 0, guest_count int not null default 0,
  subtotal numeric(12,2) not null default 0, discount_amount numeric(12,2) not null default 0,
  discount_type text not null default 'amount', gst_rate numeric(5,2) not null default 0, gst_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0, extra_charges jsonb not null default '[]', transportation_charges jsonb not null default '[]',
  additional_discounts jsonb not null default '[]', notes text, food_type text, status text not null default 'draft',
  issue_date date not null default current_date, is_multi_day boolean not null default false, event_days jsonb not null default '[]',
  created_at timestamptz not null default now(),
  option_group uuid, option_label text, option_name text, per_plate_max numeric(12,2), total_max numeric(12,2));
create table if not exists invoices (id uuid primary key default gen_random_uuid(), invoice_number text not null unique,
  booking_id uuid not null references bookings(id) on delete restrict, quotation_id uuid references quotations(id) on delete set null,
  subtotal numeric(12,2) not null default 0, discount_amount numeric(12,2) not null default 0, discount_type text not null default 'amount',
  gst_rate numeric(5,2) not null default 0, gst_amount numeric(12,2) not null default 0, transportation_charge numeric(12,2) not null default 0,
  transportation_charges jsonb default '[]', extra_charges jsonb default '[]', additional_discounts jsonb default '[]',
  total_amount numeric(12,2) not null default 0, advance_paid numeric(12,2) not null default 0, balance_due numeric(12,2) not null default 0,
  status text not null default 'draft', issue_date date not null default current_date,
  line_items jsonb default '[]', is_multi_day boolean default false, event_days jsonb default '[]',
  created_at timestamptz not null default now());
create table if not exists payments (id uuid primary key default gen_random_uuid(), invoice_id uuid not null references invoices(id) on delete cascade,
  amount numeric(12,2) not null, payment_date date not null default current_date, payment_type text not null,
  payment_mode text not null, notes text, created_at timestamptz not null default now());
create table if not exists data_center (id uuid primary key default gen_random_uuid(), gst_number text, gst_rate numeric(5,2) default 18,
  fssai_certificate_url text, updated_at timestamptz, created_at timestamptz not null default now(), doc_settings jsonb);
create table if not exists team_members (id uuid primary key default gen_random_uuid(), name text not null, mobile text, email text,
  created_at timestamptz not null default now());
create table if not exists event_types (id uuid primary key default gen_random_uuid(), name text not null unique, created_at timestamptz not null default now());
create table if not exists menu_categories (id uuid primary key default gen_random_uuid(), name text not null, is_active boolean not null default true,
  created_at timestamptz not null default now());
create table if not exists menu_subcategories (id uuid primary key default gen_random_uuid(), category_id uuid not null references menu_categories(id) on delete cascade,
  name text not null, is_active boolean not null default true, created_at timestamptz not null default now());
create table if not exists menu_items (id uuid primary key default gen_random_uuid(), subcategory_id uuid not null references menu_subcategories(id) on delete cascade,
  name text not null, is_active boolean not null default true, created_at timestamptz not null default now());

-- Sessional (sweet shop)
create table if not exists seasonal_occasions (id uuid primary key default gen_random_uuid(), name text not null,
  is_active boolean not null default true, created_at timestamptz not null default now());
create table if not exists seasonal_items (id uuid primary key default gen_random_uuid(), name text not null,
  weight int not null default 1000, weight_unit text not null default 'gm', price numeric(12,2) not null,
  is_active boolean not null default true, occasion_id uuid references seasonal_occasions(id) on delete set null,
  created_at timestamptz not null default now());
create table if not exists seasonal_customers (id uuid primary key default gen_random_uuid(), name text not null, phone text,
  address text, notes text, created_at timestamptz not null default now());
create table if not exists seasonal_orders (id uuid primary key default gen_random_uuid(), occasion_id uuid references seasonal_occasions(id) on delete set null,
  customer_name text not null, phone text not null default '', address text, items jsonb not null default '[]',
  subtotal numeric(12,2) not null default 0, discount_amount numeric(12,2) not null default 0, discount_type text not null default 'amount',
  total_amount numeric(12,2) not null default 0, is_paid boolean not null default true, payment_mode text, year int not null,
  notes text, created_at timestamptz not null default now());
create table if not exists seasonal_preorders (id uuid primary key default gen_random_uuid(), occasion_id uuid references seasonal_occasions(id) on delete set null,
  customer_name text not null, phone text not null default '', address text, items jsonb not null default '[]',
  subtotal numeric(12,2) not null default 0, discount_amount numeric(12,2) not null default 0, discount_type text not null default 'amount',
  total_amount numeric(12,2) not null default 0, advance_paid numeric(12,2) not null default 0, payment_mode text,
  delivery_date date, status text not null default 'pending', year int not null, notes text, created_at timestamptz not null default now(),
  fulfillment text not null default 'pickup', delivered_at timestamptz, balance_paid numeric(12,2) not null default 0, balance_mode text);
