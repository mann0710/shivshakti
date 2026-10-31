-- Money: spends (money going out), so Money can show profit per event and per month.
-- Additive and safe to run more than once; the app shows "Add a spend" only after it is run.

create table if not exists public.spends (
  id uuid primary key default gen_random_uuid(),
  spent_on date not null default current_date,
  amount numeric(12,2) not null check (amount > 0),
  kind text not null default 'Other',
  -- event: tagged to a booking · sweets: the sweets counter · shop: rent, bills and the like
  scope text not null default 'shop' check (scope in ('event', 'sweets', 'shop')),
  booking_id uuid references public.bookings(id) on delete set null,
  mode text not null default 'cash' check (mode in ('cash', 'upi', 'bank')),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists spends_spent_on_idx on public.spends (spent_on desc);
create index if not exists spends_booking_idx on public.spends (booking_id) where booking_id is not null;

-- Staff only, like every other table (20261031_security_rls.sql).
alter table public.spends enable row level security;
drop policy if exists allow_all on public.spends;
drop policy if exists staff_all on public.spends;
create policy staff_all on public.spends for all to authenticated
  using (private.is_staff()) with check (private.is_staff());

notify pgrst, 'reload schema';
