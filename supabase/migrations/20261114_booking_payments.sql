-- Catering: payments belong to a booking, so an advance (token) can be taken before the invoice,
-- in as many payments as needed. Additive and safe to run more than once.

-- A payment may come before the invoice exists.
alter table public.payments alter column invoice_id drop not null;
alter table public.payments add column if not exists booking_id uuid references public.bookings(id) on delete restrict;
create index if not exists payments_booking_idx on public.payments(booking_id);

-- Deleting an invoice keeps its payments on the booking.
alter table public.payments drop constraint if exists payments_invoice_id_fkey;
alter table public.payments add constraint payments_invoice_id_fkey
  foreign key (invoice_id) references public.invoices(id) on delete set null;

-- Existing payments: their booking comes from the invoice.
update public.payments p set booking_id = i.booking_id
  from public.invoices i where p.invoice_id = i.id and p.booking_id is null;

-- An advance kept as one number on the booking becomes its first payment.
insert into public.payments (booking_id, amount, payment_date, payment_type, payment_mode, notes)
select b.id, b.advance_received, coalesce(b.advance_date, (b.created_at at time zone 'Asia/Kolkata')::date), 'advance',
       case b.advance_mode when 'upi' then 'upi' when 'cheque' then 'cheque' when 'bank' then 'bank_transfer' when 'bank_transfer' then 'bank_transfer' else 'cash' end,
       'Advance recorded on the booking'
from public.bookings b
where coalesce(b.advance_received, 0) > 0 and not exists (select 1 from public.payments p where p.booking_id = b.id);

-- That number is now in payments; clear it so nothing counts twice.
update public.bookings b set advance_received = 0
where coalesce(b.advance_received, 0) > 0 and exists (select 1 from public.payments p where p.booking_id = b.id);

notify pgrst, 'reload schema';
