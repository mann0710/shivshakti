-- Team roles and invites, dish food styles, package price by guest count, and a 30-day recycle bin.
-- Additive and safe to run more than once. Back up first (schema copy) like backup_20261101.

-- Team: name, mobile, role and whether they may sign in. Everyone already on the list stays an owner.
alter table public.staff add column if not exists name text;
alter table public.staff add column if not exists mobile text;
alter table public.staff add column if not exists role text not null default 'owner';
alter table public.staff add column if not exists can_sign_in boolean not null default true;
alter table public.staff add column if not exists invited_at timestamptz;
do $$ begin
  alter table public.staff add constraint staff_role_check check (role in ('owner', 'counter', 'kitchen'));
exception when duplicate_object then null; end $$;

-- Switched-off logins lose access at once.
create or replace function private.is_staff()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.staff s
    where lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', '')) and s.can_sign_in
  );
$$;

create or replace function private.staff_role()
returns text language sql stable security definer set search_path = ''
as $$
  select s.role from public.staff s
  where lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', '')) and s.can_sign_in
  limit 1;
$$;

create or replace function private.is_owner()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce(private.staff_role() = 'owner', false); $$;

revoke all on function private.staff_role() from public, anon;
revoke all on function private.is_owner() from public, anon;
grant execute on function private.staff_role() to authenticated;
grant execute on function private.is_owner() to authenticated;

-- The signed-in person's role for the app; null when not on the team.
create or replace function public.my_role()
returns text language sql stable security invoker set search_path = ''
as $$ select private.staff_role(); $$;
revoke all on function public.my_role() from public, anon;
grant execute on function public.my_role() to authenticated;

-- Staff read the team; only owners add, change or remove people.
grant select, insert, update, delete on public.staff to authenticated;
alter table public.staff enable row level security;
drop policy if exists staff_read on public.staff;
drop policy if exists owner_insert on public.staff;
drop policy if exists owner_update on public.staff;
drop policy if exists owner_delete on public.staff;
create policy staff_read on public.staff for select to authenticated using (private.is_staff());
create policy owner_insert on public.staff for insert to authenticated with check (private.is_owner());
create policy owner_update on public.staff for update to authenticated using (private.is_owner()) with check (private.is_owner());
create policy owner_delete on public.staff for delete to authenticated using (private.is_owner());

-- Never leave the shop without an owner who can sign in.
create or replace function private.keep_an_owner()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.staff where role = 'owner' and can_sign_in) then
    raise exception 'Keep at least one owner who can sign in';
  end if;
  return null;
end $$;
drop trigger if exists staff_keep_owner on public.staff;
create trigger staff_keep_owner after update or delete on public.staff
  for each statement execute function private.keep_an_owner();

-- Settings (UPI ID, GST, names) are read by all staff and changed only by owners.
drop policy if exists staff_all on public.data_center;
drop policy if exists staff_read on public.data_center;
drop policy if exists owner_write on public.data_center;
create policy staff_read on public.data_center for select to authenticated using (private.is_staff());
create policy owner_write on public.data_center for all to authenticated using (private.is_owner()) with check (private.is_owner());

-- Food styles a dish suits: jain, swaminarayan, onion_garlic.
alter table public.menu_items add column if not exists food_styles text[] not null default '{}';

-- Package price by guest count: [{ "upto": 150, "price": 270 }, …, { "upto": null, "price": 230 }]; empty = one price.
alter table public.menus add column if not exists price_tiers jsonb not null default '[]'::jsonb;

-- Recycle bin: a copy of each deleted row for 30 days, and undo copies of Excel imports ("import") for 7 days.
create table if not exists public.deleted_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  row_id uuid,
  label text not null default '',
  data jsonb not null,
  deleted_at timestamptz not null default now(),
  deleted_by text
);
create index if not exists deleted_items_at_idx on public.deleted_items (deleted_at desc);
create index if not exists deleted_items_row_idx on public.deleted_items (kind, row_id);

alter table public.deleted_items enable row level security;
drop policy if exists allow_all on public.deleted_items;
drop policy if exists staff_all on public.deleted_items;
create policy staff_all on public.deleted_items for all to authenticated
  using (private.is_staff()) with check (private.is_staff());

create or replace function private.keep_deleted()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare r jsonb := to_jsonb(old);
begin
  insert into public.deleted_items (kind, row_id, label, data, deleted_by)
  values (tg_table_name, (r ->> 'id')::uuid,
          coalesce(r ->> 'name', r ->> 'quotation_number', r ->> 'customer_name', r ->> 'event_type', ''),
          r, auth.jwt() ->> 'email');
  return old;
end $$;

do $$
declare t text;
begin
  foreach t in array array['customers', 'seasonal_customers', 'bookings', 'quotations', 'menus', 'menu_categories',
                           'menu_subcategories', 'menu_items', 'seasonal_items', 'seasonal_preorders'] loop
    execute format('drop trigger if exists keep_deleted on public.%I', t);
    execute format('create trigger keep_deleted before delete on public.%I for each row execute function private.keep_deleted()', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
