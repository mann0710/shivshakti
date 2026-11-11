-- Credit (pay later): per-customer credit settings, old balances from the paper register, and follow-ups.
-- Additive and safe to run more than once; until it is run the Credit tab works from bills alone.

-- Pay-by date on credit bills.
alter table public.seasonal_orders add column if not exists due_date date;

-- One row per customer (10-digit mobile): limit, no-credit flag, dispute, reminder language.
create table if not exists public.credit_accounts (
  phone text primary key check (phone ~ '^[0-9]{10}$'),
  name text not null default '',
  credit_limit numeric(12,2),                       -- null: shop default
  no_credit boolean not null default false,
  disputed boolean not null default false,
  lang text not null default 'en' check (lang in ('en', 'hi')),
  note text,
  updated_at timestamptz not null default now()
);

-- Ledger and follow-up events. 'opening' rows (old balances) are debts with their own payments ledger.
create table if not exists public.credit_entries (
  id uuid primary key default gen_random_uuid(),
  phone text not null check (phone ~ '^[0-9]{10}$'),
  name text not null default '',
  kind text not null check (kind in ('opening', 'receipt', 'writeoff', 'promise', 'reminder', 'call', 'note', 'override')),
  amount numeric(12,2) not null default 0,
  mode text check (mode in ('cash', 'upi')),
  payments jsonb not null default '[]'::jsonb,      -- opening only: money received against it
  links jsonb not null default '[]'::jsonb,         -- receipt / writeoff: [{ type, id, amount }]
  due_date date,                                    -- opening: pay by
  promise_date date,                                -- promise: pay by
  outcome text,                                     -- call: no_answer / will_pay / later / disputed / paid_elsewhere
  note text,
  by_email text,
  at timestamptz not null default now(),            -- when it happened (old balance: owed since)
  created_at timestamptz not null default now(),
  voided_at timestamptz
);
create index if not exists credit_entries_phone_idx on public.credit_entries (phone, at desc);

-- Staff only, like every other table (20261031_security_rls.sql).
alter table public.credit_accounts enable row level security;
alter table public.credit_entries enable row level security;
drop policy if exists staff_all on public.credit_accounts;
drop policy if exists staff_all on public.credit_entries;
create policy staff_all on public.credit_accounts for all to authenticated
  using (private.is_staff()) with check (private.is_staff());
create policy staff_all on public.credit_entries for all to authenticated
  using (private.is_staff()) with check (private.is_staff());

notify pgrst, 'reload schema';
