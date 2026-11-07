-- Sweets: cancel a pre-booking at any stage with a reason, and keep deleted counter bills in the recycle bin.
-- Additive and safe to run more than once; the app works without it (the reason then goes into the note).

-- When and why a pre-booking was cancelled (money given back is a 'refund' entry in payments).
alter table public.seasonal_preorders add column if not exists cancelled_at timestamptz;
alter table public.seasonal_preorders add column if not exists cancel_reason text;

-- Deleted counter bills go to the 30-day recycle bin like pre-bookings (needs 20261110_team_bin_tiers.sql).
do $$
begin
  if to_regprocedure('private.keep_deleted()') is not null then
    drop trigger if exists keep_deleted on public.seasonal_orders;
    create trigger keep_deleted before delete on public.seasonal_orders for each row execute function private.keep_deleted();
  end if;
end $$;

notify pgrst, 'reload schema';
