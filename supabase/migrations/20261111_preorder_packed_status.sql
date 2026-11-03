-- Pre-bookings: allow the Packed status ('ready').
-- Tables made before Packed only allowed pending, confirmed, delivered and cancelled, so ticking Packed failed.
-- Safe to run more than once. Back up first, then run in Supabase -> SQL Editor.
do $$
declare c record;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.seasonal_preorders'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) ilike '%status%' loop
    execute format('alter table public.seasonal_preorders drop constraint %I', c.conname);
  end loop;
end $$;

-- Not valid: rows already saved are left as they are; every new save is checked.
alter table public.seasonal_preorders add constraint seasonal_preorders_status_check
  check (status in ('pending', 'confirmed', 'ready', 'delivered', 'cancelled')) not valid;

notify pgrst, 'reload schema';
