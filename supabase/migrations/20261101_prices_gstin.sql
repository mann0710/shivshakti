-- Default price per menu item (auto-filled into quotations) and customer GSTIN (printed on tax invoices).
-- Safe to run more than once. Run in Supabase -> SQL Editor.

alter table menu_items add column if not exists default_price numeric(12,2);
alter table customers add column if not exists gstin text;

notify pgrst, 'reload schema';
