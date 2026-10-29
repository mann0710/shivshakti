-- Locks the database to signed-in staff. Fixes the Security Advisor errors
-- "RLS Disabled in Public" / "Policy Exists RLS Disabled" and the warning "Public Bucket Allows Listing".
--
-- BEFORE running: create your login in Supabase -> Authentication -> Users -> Add user (auto-confirm),
-- and put that email (plus any staff emails) in the INSERT below. Safe to run more than once.

-- Who may use the app
create table if not exists public.staff (
  email text primary key,
  created_at timestamptz not null default now()
);

insert into public.staff (email) values
  ('owner@example.com')          -- <- replace with the login email(s)
on conflict (email) do nothing;

-- True when the signed-in user's email is on the staff list.
-- The privileged check lives in a schema the API doesn't expose; public.is_staff() is a plain wrapper for the app.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.staff s
    where lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function private.is_staff() from public, anon;
grant execute on function private.is_staff() to authenticated;

create or replace function public.is_staff()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$ select private.is_staff(); $$;

revoke all on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated;

-- Every table in public: RLS on, old open policies removed, staff-only access
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
    execute format('drop policy if exists allow_all on public.%I', t.tablename);
    execute format('drop policy if exists staff_all on public.%I', t.tablename);
    if t.tablename <> 'staff' then
      execute format(
        'create policy staff_all on public.%I for all to authenticated using (private.is_staff()) with check (private.is_staff())',
        t.tablename);
    end if;
  end loop;
end $$;

-- The staff list itself is managed only from the dashboard / SQL editor
revoke all on public.staff from anon, authenticated;

-- documents bucket: files stay viewable by direct link, but only staff can list, upload, replace or delete
drop policy if exists "Allow public select" on storage.objects;
drop policy if exists "Allow public insert" on storage.objects;
drop policy if exists "Allow public update" on storage.objects;
drop policy if exists "Allow public delete" on storage.objects;
drop policy if exists "Staff manage documents" on storage.objects;
create policy "Staff manage documents" on storage.objects for all to authenticated
  using (bucket_id = 'documents' and private.is_staff())
  with check (bucket_id = 'documents' and private.is_staff());

notify pgrst, 'reload schema';
