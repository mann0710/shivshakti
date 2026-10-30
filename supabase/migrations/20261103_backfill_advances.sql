-- Older invoices kept the advance only in invoices.advance_paid with no payment row.
-- Gives each one a payment row so payment history shows it and recalculation never drops it. Safe to run more than once.

insert into public.payments (invoice_id, amount, payment_type, payment_mode, notes, payment_date)
select i.id, i.advance_paid, 'advance', 'cash', 'Advance recorded before payment history', i.issue_date
from public.invoices i
where i.advance_paid > 0
  and not exists (select 1 from public.payments p where p.invoice_id = i.id);

select count(*) as invoices_without_payment_rows
from public.invoices i
where i.advance_paid > 0 and not exists (select 1 from public.payments p where p.invoice_id = i.id);
