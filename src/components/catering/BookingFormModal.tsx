import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import BookingVenueInput from './BookingVenueInput';
import { Booking, Customer } from '../../types';
import { useBookings, useCreateBooking, useUpdateBooking } from '../../hooks/useBookings';
import { useCustomers } from '../../hooks/useCustomers';
import { useInvoices } from '../../hooks/useInvoices';
import { useResolveCustomer } from '../../hooks/useResolveCustomer';
import { useEventTypes, useCreateEventType, DEFAULT_EVENTS } from '../../hooks/useDataCenter';
import { formatDateIST } from '../../lib/ist';
import CustomerPicker from '../bookings/CustomerPicker';
import EventTypePicker from '../bookings/EventTypePicker';
import { Chips, DialogFoot, Field, Group, inputClass } from '../bookings/FormBits';
import { BookingForm, FOOD_STYLES, blankForm, bookingFields, dayHint, formErrors, formFromBooking } from '../bookings/bookingForm';

interface Props {
  booking: Booking | null; // null = new booking
  presetCustomerId?: string;
  presetDate?: string;     // "+ New booking on 25 Nov" from the calendar
  onClose: () => void;
  onSaved: (b: Booking) => void;
}

// New and edit booking: who, what and when, where and how many, notes. New bookings start as an inquiry.
const BookingFormModal: React.FC<Props> = ({ booking, presetCustomerId, presetDate, onClose, onSaved }) => {
  const id = useId();
  const { data: customers = [] } = useCustomers();
  const { data: bookings = [] } = useBookings();
  const { data: invoices = [] } = useInvoices();
  const { data: eventTypesList = [] } = useEventTypes();
  const createBooking = useCreateBooking();
  const updateBooking = useUpdateBooking();
  const resolveCustomer = useResolveCustomer();
  const createEventType = useCreateEventType();

  const [start, setStart] = useState<BookingForm>(() => (booking ? formFromBooking(booking) : blankForm(presetDate)));
  const [form, setForm] = useState(start);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<BookingForm>) => setForm(f => ({ ...f, ...patch }));

  // Most used event types first, so the chips show what this business books.
  const types = useMemo(() => {
    const names = (eventTypesList.length ? eventTypesList.map(e => e.name) : DEFAULT_EVENTS).filter(t => t !== 'Other');
    const used = (t: string) => bookings.filter(b => b.event_type === t).length;
    return names.map((t, i) => ({ t, i, n: used(t) })).sort((a, b) => b.n - a.n || a.i - b.i).map(x => x.t);
  }, [eventTypesList, bookings]);
  const custom = form.other || (!!form.event_type && !types.includes(form.event_type));
  const eventType = (custom ? form.event_type : form.event_type || types[0] || 'Wedding').trim();
  const errors = tried ? formErrors(form, eventType, !booking) : {};
  const hint = dayHint(bookings, form.event_date, form.multiDay ? form.end_date : '', booking?.id);

  const owed = useMemo(() => {
    const m = new Map<string, number>();
    invoices.forEach(i => { const c = i.booking?.customer_id; if (c && Number(i.balance_due) > 0) m.set(c, (m.get(c) ?? 0) + Number(i.balance_due)); });
    return m;
  }, [invoices]);
  const lastEvent = useMemo(() => {
    const m = new Map<string, Booking>();
    bookings.forEach(b => { const p = m.get(b.customer_id); if (!p || b.event_date > p.event_date) m.set(b.customer_id, b); });
    return m;
  }, [bookings]);
  const note = (c: Customer) => { const b = lastEvent.get(c.id); return b ? `${b.event_type} ${formatDateIST(b.event_date, 'd MMM yy')}` : ''; };

  // A customer handed over from another page is picked once the list has it.
  const presetDone = useRef(false);
  useEffect(() => {
    if (booking || presetDone.current || !presetCustomerId || !customers.some(c => c.id === presetCustomerId)) return;
    presetDone.current = true;
    setStart(s => ({ ...s, customer_id: presetCustomerId }));
    setForm(f => ({ ...f, customer_id: presetCustomerId }));
  }, [booking, customers, presetCustomerId]);

  const save = async () => {
    setTried(true);
    if (Object.keys(formErrors(form, eventType, !booking)).length) return;
    setSaving(true);
    try {
      const fields = bookingFields(form, eventType);
      let saved: Booking;
      if (booking) {
        saved = await updateBooking.mutateAsync({ id: booking.id, ...fields });
      } else {
        const customerId = await resolveCustomer({ customerId: form.customer_id, name: form.newName, phone: form.newPhone });
        if (!customerId) return;
        // Kept so a failed save does not add the customer twice.
        set({ customer_id: customerId });
        saved = await createBooking.mutateAsync({ customer_id: customerId, ...fields, status: 'inquiry' });
      }
      if (custom && !types.includes(eventType)) createEventType.mutateAsync(eventType).catch(() => {});
      toast.success(booking ? 'Booking updated' : 'Booking created');
      onSaved(saved);
    } catch (e: any) {
      toast.error(e?.message || 'Could not save the booking');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={booking ? 'Edit booking' : 'New booking'} onClose={onClose} footer={<DialogFoot label={booking ? 'Save changes' : 'Create booking'} busy={saving} onSave={save} />} width={560}
      dirty={JSON.stringify(form) !== JSON.stringify(start)} busy={saving}>
      <div className="bkf">
        <p className="bkf-sub">{booking ? 'Change the details here. Change the status from the ⋯ menu.' : 'Saved as an inquiry. You can confirm it later from the quote.'}</p>
        <Group title="Who">
          {booking ? (
            <Field label="Customer" full>
              <div className="bkf-input strong" style={{ background: '#F7F5F0' }}>{booking.customer?.name ?? '—'}{booking.customer?.phone ? ` · ${booking.customer.phone}` : ''}</div>
            </Field>
          ) : (
            <CustomerPicker customers={customers} pickedId={form.customer_id} newName={form.newName} newPhone={form.newPhone} error={errors.customer}
              onPick={cid => set({ customer_id: cid, newName: '', newPhone: '' })} onNew={(name, phone) => set({ customer_id: '', newName: name, newPhone: phone })}
              note={note} owes={c => owed.get(c.id) ?? 0} />
          )}
        </Group>

        <Group title="What and when">
          <EventTypePicker types={types} value={eventType} custom={custom} error={errors.event}
            onPick={t => set({ event_type: t, other: false })} onCustom={name => set({ event_type: name, other: true })} />
          <Field label="Date" htmlFor={`${id}-date`} hint={hint?.text} warn={hint?.busy} error={errors.date}>
            <input id={`${id}-date`} type="date" className={inputClass(errors.date)} value={form.event_date} onChange={e => set({ event_date: e.target.value })} />
          </Field>
          <Field label="Time" htmlFor={`${id}-time`}>
            <input id={`${id}-time`} type="time" className="bkf-input" value={form.event_time} onChange={e => set({ event_time: e.target.value })} />
          </Field>
          <label className="bkf-check bkf-full">
            <input type="checkbox" checked={form.multiDay} onChange={e => set({ multiDay: e.target.checked, end_date: e.target.checked ? form.end_date : '' })} />
            Lasts more than one day
          </label>
          {form.multiDay && (
            <Field label="Last day" htmlFor={`${id}-end`} error={errors.end}>
              <input id={`${id}-end`} type="date" className={inputClass(errors.end)} value={form.end_date} min={form.event_date || undefined} onChange={e => set({ end_date: e.target.value })} />
            </Field>
          )}
        </Group>

        <Group title="Where and how many">
          <Field label="Venue" htmlFor={`${id}-venue`} full>
            <BookingVenueInput id={`${id}-venue`} className="bkf-input" value={form.venue} onChange={v => set({ venue: v })} />
          </Field>
          <Field label="Guests" htmlFor={`${id}-guests`} hint="A rough number is fine" phoneFull>
            <input id={`${id}-guests`} type="number" inputMode="numeric" min={0} className="bkf-input" placeholder="e.g. 200" value={form.guest_count} onChange={e => set({ guest_count: e.target.value })} />
          </Field>
          <Chips label="Food style" options={FOOD_STYLES} value={form.food} onPick={food => set({ food })} phoneFull />
          <Field label="Notes for the team" htmlFor={`${id}-notes`} full>
            <textarea id={`${id}-notes`} rows={3} className="bkf-input" placeholder="Anything special: allergies, timing, stage counter…"
              value={form.notes} onChange={e => set({ notes: e.target.value })} />
          </Field>
        </Group>
      </div>
    </Modal>
  );
};

export default BookingFormModal;
