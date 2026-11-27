-- Quote revisions and one-step Confirm booking. Additive and safe to run more than once; no rows change.

-- What an accepted quote looked like before each change, oldest first.
alter table public.quotations add column if not exists revisions jsonb not null default '[]';

-- Confirm booking, all or nothing: lock the chosen quote and its picks, mark the other options not chosen,
-- save final guests, record the advance (its id makes a retry harmless) and confirm the booking.
-- Returns 'confirmed' when the booking's status moved, else null.
create or replace function public.confirm_booking(
  p_booking uuid,
  p_quote uuid default null,
  p_patch jsonb default '{}'::jsonb,
  p_siblings uuid[] default '{}',
  p_guests int default null,
  p_payment jsonb default null,
  p_any_status boolean default false
) returns text language plpgsql security invoker set search_path = public as $$
declare moved text;
begin
  if p_quote is not null then
    update quotations set
      items = coalesce(p_patch->'items', items),
      event_days = coalesce(p_patch->'event_days', event_days),
      per_plate_amount = coalesce((p_patch->>'per_plate_amount')::numeric, per_plate_amount),
      guest_count = coalesce((p_patch->>'guest_count')::int, guest_count),
      subtotal = coalesce((p_patch->>'subtotal')::numeric, subtotal),
      discount_amount = coalesce((p_patch->>'discount_amount')::numeric, discount_amount),
      gst_amount = coalesce((p_patch->>'gst_amount')::numeric, gst_amount),
      total_amount = coalesce((p_patch->>'total_amount')::numeric, total_amount),
      full_price = case when p_patch ? 'full_price' then (p_patch->>'full_price')::numeric else full_price end,
      per_plate_max = null, total_max = null, status = 'accepted'
    where id = p_quote;
    update quotations set status = 'rejected' where id = any(p_siblings) and id <> p_quote and status <> 'rejected';
  end if;
  if coalesce(p_guests, 0) > 0 then
    update bookings set guest_count = p_guests where id = p_booking;
  end if;
  if p_payment is not null and coalesce((p_payment->>'amount')::numeric, 0) <> 0 then
    insert into payments (id, booking_id, amount, payment_type, payment_mode, notes, payment_date)
    values ((p_payment->>'id')::uuid, p_booking, (p_payment->>'amount')::numeric, p_payment->>'payment_type', p_payment->>'payment_mode',
            nullif(p_payment->>'notes', ''), coalesce((p_payment->>'payment_date')::date, (now() at time zone 'Asia/Kolkata')::date))
    on conflict (id) do nothing;
  end if;
  update bookings set status = 'confirmed'
    where id = p_booking and (status in ('inquiry', 'followup', 'pending') or (p_any_status and status <> 'confirmed'))
    returning status into moved;
  return moved;
end $$;

grant execute on function public.confirm_booking(uuid, uuid, jsonb, uuid[], int, jsonb, boolean) to authenticated;

notify pgrst, 'reload schema';
