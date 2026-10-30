-- Pre-bookings: pickup or delivery, when it was handed over, and the balance collected at hand-over.
-- Additive only; the app keeps working without it (these fields are skipped until it is run).
alter table seasonal_preorders add column if not exists fulfillment text not null default 'pickup';
alter table seasonal_preorders add column if not exists delivered_at timestamptz;
alter table seasonal_preorders add column if not exists balance_paid numeric(12,2) not null default 0;
alter table seasonal_preorders add column if not exists balance_mode text;

-- Bookings with an address were home deliveries.
update seasonal_preorders set fulfillment = 'delivery' where coalesce(trim(address), '') <> '';
-- Already handed over: count it on its due date.
update seasonal_preorders set delivered_at = coalesce(delivery_date::timestamptz, created_at)
  where status = 'delivered' and delivered_at is null;
