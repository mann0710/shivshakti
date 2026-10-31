-- Sweets POS: payment history on bills and pre-bookings, cancelled bills, and the day close.
-- Additive and safe to run more than once; the app skips these fields until it is run.

-- Bills: every payment as { amount, mode, at, kind, tendered? }, with the running total and last payment time.
alter table public.seasonal_orders add column if not exists payments jsonb not null default '[]'::jsonb;
alter table public.seasonal_orders add column if not exists paid_amount numeric(12,2) not null default 0;
alter table public.seasonal_orders add column if not exists paid_at timestamptz;
-- Cancelled bills keep their number.
alter table public.seasonal_orders add column if not exists cancelled_at timestamptz;
alter table public.seasonal_orders add column if not exists cancel_reason text;

-- Pre-bookings: advance, hand-over and later collections, each with its own time.
alter table public.seasonal_preorders add column if not exists payments jsonb not null default '[]'::jsonb;
-- From 20261104 (no-ops when it was run).
alter table public.seasonal_preorders add column if not exists delivered_at timestamptz;
alter table public.seasonal_preorders add column if not exists balance_paid numeric(12,2) not null default 0;
alter table public.seasonal_preorders add column if not exists balance_mode text;

-- Paid bills: one payment of the full total, received when the bill was made.
update public.seasonal_orders
set payments = jsonb_build_array(jsonb_build_object(
      'amount', total_amount, 'mode', coalesce(payment_mode, 'cash'), 'at', created_at, 'kind', 'sale')),
    paid_amount = total_amount,
    paid_at = created_at
where is_paid and total_amount > 0 and payments = '[]'::jsonb;

-- Pre-bookings: the advance at booking time, then anything collected at hand-over.
update public.seasonal_preorders
set payments =
  case when advance_paid - balance_paid > 0 then jsonb_build_array(jsonb_build_object(
    'amount', advance_paid - balance_paid, 'mode', coalesce(payment_mode, 'cash'), 'at', created_at, 'kind', 'advance'))
  else '[]'::jsonb end
  ||
  case when balance_paid > 0 then jsonb_build_array(jsonb_build_object(
    'amount', balance_paid, 'mode', coalesce(balance_mode, payment_mode, 'cash'),
    'at', coalesce(delivered_at, delivery_date::timestamptz, created_at), 'kind', 'handover'))
  else '[]'::jsonb end
where advance_paid > 0 and payments = '[]'::jsonb;

-- One row per closed day; reopening keeps the row and stamps reopened_at.
create table if not exists public.seasonal_day_closes (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  from_at timestamptz,
  closed_at timestamptz not null default now(),
  opening_cash numeric(12,2) not null default 0,
  cash_bills numeric(12,2) not null default 0,
  cash_advances numeric(12,2) not null default 0,
  cash_handover numeric(12,2) not null default 0,
  cash_dues numeric(12,2) not null default 0,
  cash_out numeric(12,2) not null default 0,
  cash_out_note text,
  expected_cash numeric(12,2) not null default 0,
  counted_cash numeric(12,2) not null default 0,
  note_counts jsonb not null default '{}'::jsonb,
  keep_cash numeric(12,2) not null default 0,
  upi_total numeric(12,2) not null default 0,
  sales_total numeric(12,2) not null default 0,
  bills_count integer not null default 0,
  unpaid_total numeric(12,2) not null default 0,
  note text,
  reopened_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists seasonal_day_closes_closed_idx on public.seasonal_day_closes (closed_at desc);

-- Staff only, like every other table (20261031_security_rls.sql).
alter table public.seasonal_day_closes enable row level security;
drop policy if exists allow_all on public.seasonal_day_closes;
drop policy if exists staff_all on public.seasonal_day_closes;
create policy staff_all on public.seasonal_day_closes for all to authenticated
  using (private.is_staff()) with check (private.is_staff());

notify pgrst, 'reload schema';
