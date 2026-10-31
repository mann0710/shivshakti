-- Booking food style, advance taken when a quote is accepted (before any invoice exists), and season dates for occasions.
-- Additive and safe to run more than once.

alter table public.bookings
  add column if not exists food_type text,
  add column if not exists advance_received numeric(12,2) not null default 0,
  add column if not exists advance_mode text,
  add column if not exists advance_date date;

alter table public.seasonal_occasions
  add column if not exists start_date date,
  add column if not exists end_date date;

-- PostgREST picks up the new columns straight away.
notify pgrst, 'reload schema';
