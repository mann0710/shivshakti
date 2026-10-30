-- Invoice and quotation numbers are assigned by the database, so two phones saving at once never get the same number.
-- Continues from the highest existing number (INV-0007 -> INV-0008). Safe to run more than once.

create schema if not exists private;

create or replace function private.assign_doc_number()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  col    text := tg_argv[0];
  prefix text := tg_argv[1];
  cur    text;
  n      int;
begin
  execute format('select ($1).%I', col) into cur using new;
  if coalesce(cur, '') <> '' then return new; end if;
  -- One writer per table at a time until this transaction ends
  perform pg_advisory_xact_lock(hashtext('doc_number:' || tg_table_name));
  execute format(
    'select coalesce(max(nullif(regexp_replace(%I, ''\D'', '''', ''g''), '''')::int), 0) + 1 from public.%I',
    col, tg_table_name) into n;
  new := jsonb_populate_record(new, jsonb_build_object(col, prefix || lpad(n::text, 4, '0')));
  return new;
end $$;

revoke all on function private.assign_doc_number() from public, anon;

drop trigger if exists invoices_number on public.invoices;
create trigger invoices_number before insert on public.invoices
  for each row execute function private.assign_doc_number('invoice_number', 'INV-');

drop trigger if exists quotations_number on public.quotations;
create trigger quotations_number before insert on public.quotations
  for each row execute function private.assign_doc_number('quotation_number', 'QTN-');
