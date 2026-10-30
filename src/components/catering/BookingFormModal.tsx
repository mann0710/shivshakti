import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import BookingVenueInput from './BookingVenueInput';
import { StatusSelect } from './BookingActions';
import { Booking } from '../../types';
import { useCreateBooking, useUpdateBooking } from '../../hooks/useBookings';
import { useCustomers } from '../../hooks/useCustomers';
import { useResolveCustomer } from '../../hooks/useResolveCustomer';
import { useMenus } from '../../hooks/useMenus';
import { useEventTypes, useCreateEventType, DEFAULT_EVENTS } from '../../hooks/useDataCenter';
import { inr } from '../../lib/money';

const blank = {
  customer_id: '', newCustomerName: '', newCustomerPhone: '', customerEmail: '',
  event_type: '', other: false, event_date: '', multiDay: false, end_date: '', event_time: '',
  venue: '', guest_count: '', menu_id: '', special_instructions: '', status: 'inquiry' as Booking['status'],
};
type Form = typeof blank;

const fromBooking = (b: Booking): Form => ({
  ...blank, customer_id: b.customer_id, event_type: b.event_type,
  event_date: b.event_date, multiDay: !!(b.end_date && b.end_date !== b.event_date), end_date: b.end_date || '',
  event_time: b.event_time?.slice(0, 5) || '', venue: b.venue || '', guest_count: String(b.guest_count ?? ''),
  menu_id: b.menu_id || '', special_instructions: b.special_instructions || '', status: b.status,
});

interface Props {
  booking: Booking | null; // null = new booking
  presetCustomerId?: string;
  presetDate?: string;     // "+ New booking on 25 Nov" from the calendar
  onClose: () => void;
  onSaved: (b: Booking, confirmedNow: boolean) => void;
}

// One form for both "New Booking" and "Edit Booking".
const BookingFormModal: React.FC<Props> = ({ booking, presetCustomerId, presetDate, onClose, onSaved }) => {
  const { data: customers = [] } = useCustomers();
  const { data: menus = [] } = useMenus();
  const { data: eventTypesList = [] } = useEventTypes();
  const createBooking = useCreateBooking();
  const updateBooking = useUpdateBooking();
  const resolveDraft = useResolveCustomer();
  const createEventType = useCreateEventType();

  const [form, setForm] = useState<Form>(() => (booking ? fromBooking(booking) : { ...blank, event_date: presetDate || '' }));
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }));

  const eventTypes = (eventTypesList.length ? eventTypesList.map(e => e.name) : DEFAULT_EVENTS).filter(t => t !== 'Other');
  // Unlisted types (custom ones) show as "Other" + free text.
  const isOther = form.other || (!!form.event_type && !eventTypes.includes(form.event_type));
  const eventType = (isOther ? form.event_type : form.event_type || eventTypes[0] || 'Wedding').trim();

  const menu = menus.find(m => m.id === form.menu_id);
  const estimate = menu ? menu.price_per_plate * (parseInt(form.guest_count) || 0) : 0;

  // Preselect a customer handed over from another page, once the list has it.
  const presetDone = useRef(false);
  useEffect(() => {
    if (booking || presetDone.current || !presetCustomerId) return;
    if (customers.some(c => c.id === presetCustomerId)) {
      presetDone.current = true;
      setForm(f => ({ ...f, customer_id: presetCustomerId }));
    }
  }, [booking, customers, presetCustomerId]);

  const resolveCustomer = async (): Promise<string | null> => {
    const id = await resolveDraft({ customerId: form.customer_id, name: form.newCustomerName, phone: form.newCustomerPhone, email: form.customerEmail });
    // Keep the id so a failed booking retry doesn't create the customer twice.
    if (id) setForm(f => ({ ...f, customer_id: id }));
    return id;
  };

  const save = async () => {
    if (!form.event_date) { toast.error('Event date is required'); return; }
    if (form.multiDay && !form.end_date) { toast.error('Pick the end date of the multi-day event'); return; }
    if (form.multiDay && form.end_date < form.event_date) { toast.error('End date is before the event date'); return; }
    if (!eventType) { toast.error('Please enter a custom event name'); return; }
    // null (not undefined) so clearing a field on edit really clears it.
    const fields = {
      event_type: eventType, event_date: form.event_date, event_time: form.event_time || null,
      end_date: form.multiDay && form.end_date ? form.end_date : null,
      venue: form.venue.trim(), guest_count: parseInt(form.guest_count) || 0,
      menu_id: form.menu_id || null, special_instructions: form.special_instructions, status: form.status,
    };
    setSaving(true);
    try {
      let saved: Booking;
      if (booking) {
        saved = await updateBooking.mutateAsync({ id: booking.id, ...fields, estimated_cost: estimate || booking.estimated_cost });
      } else {
        const customerId = await resolveCustomer();
        if (!customerId) return;
        saved = await createBooking.mutateAsync({ customer_id: customerId, ...fields, estimated_cost: estimate });
      }
      if (isOther && !eventTypes.includes(eventType)) createEventType.mutateAsync(eventType).catch(() => {});
      toast.success(booking ? 'Booking updated!' : 'Booking created!');
      onSaved(saved, saved.status === 'confirmed' && booking?.status !== 'confirmed');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save booking');
    } finally {
      setSaving(false);
    }
  };

  const close = () => { if (!saving) onClose(); };
  const footer = (
    <>
      <button type="button" style={btnGhost} onClick={close}>Cancel</button>
      <button type="button" style={btnPrimary} onClick={save} disabled={saving}>
        {saving ? 'Saving...' : booking ? 'Save Changes' : 'Create Booking'}
      </button>
    </>
  );

  return (
    <Modal title={booking ? 'Edit Booking' : 'New Booking'} onClose={close} footer={footer} width={600}>
      <div style={grid}>
        {booking ? (
          <Field label="Customer" full>
            <div style={{ fontSize: 14, fontWeight: 500 }}>
              {booking.customer?.name ?? '—'} <span style={{ color: '#888880', fontWeight: 400, fontSize: 12 }}>{booking.customer?.phone}</span>
            </div>
          </Field>
        ) : (
          <>
            <Field label="Customer" full>
              <select style={inp} value={form.customer_id} onChange={e => set('customer_id', e.target.value)}>
                <option value="">+ New customer</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` (${c.phone})` : ''}</option>)}
              </select>
            </Field>
            {!form.customer_id && (
              <>
                <Field label="New customer name *">
                  <input style={inp} placeholder="Full name" value={form.newCustomerName} onChange={e => set('newCustomerName', e.target.value)} />
                </Field>
                <Field label="Phone">
                  <input type="tel" inputMode="tel" style={inp} placeholder="98765 43210" value={form.newCustomerPhone} onChange={e => set('newCustomerPhone', e.target.value)} />
                </Field>
                <Field label="Email (optional)" full>
                  <input type="email" style={inp} placeholder="customer@example.com" value={form.customerEmail} onChange={e => set('customerEmail', e.target.value)} />
                </Field>
              </>
            )}
          </>
        )}
        <Field label="Event type">
          <select style={inp} value={isOther ? 'Other' : eventType}
            onChange={e => setForm(f => (e.target.value === 'Other'
              ? { ...f, other: true, event_type: '' } : { ...f, other: false, event_type: e.target.value }))}>
            {eventTypes.map(t => <option key={t}>{t}</option>)}
            <option value="Other">Other</option>
          </select>
          {isOther && (
            <input style={{ ...inp, marginTop: 6 }} placeholder="Enter custom event name" value={form.event_type}
              onChange={e => setForm(f => ({ ...f, other: true, event_type: e.target.value }))} />
          )}
        </Field>
        <Field label="Status">
          <StatusSelect value={form.status} onChange={s => set('status', s)} style={inp} />
        </Field>
        <Field label="Event date *">
          <input type="date" style={inp} value={form.event_date} onChange={e => set('event_date', e.target.value)} />
        </Field>
        <Field label="Event time">
          <input type="time" style={inp} value={form.event_time} onChange={e => set('event_time', e.target.value)} />
        </Field>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={form.multiDay} style={{ accentColor: '#E8750A', width: 16, height: 16 }}
              onChange={e => setForm(f => ({ ...f, multiDay: e.target.checked, end_date: e.target.checked ? f.end_date : '' }))} />
            <span style={{ fontWeight: 500 }}>Multi-day event</span>
            <span style={{ fontSize: 11, color: '#888880' }}>(spans more than one day)</span>
          </label>
        </div>
        {form.multiDay && (
          <Field label="End date *">
            <input type="date" style={inp} value={form.end_date} min={form.event_date || undefined} onChange={e => set('end_date', e.target.value)} />
          </Field>
        )}
        <Field label="Venue / Location" full>
          <BookingVenueInput style={inp} value={form.venue} onChange={v => set('venue', v)} />
        </Field>
        <Field label="Guest count">
          <input type="number" inputMode="numeric" min={0} style={inp} placeholder="e.g. 200" value={form.guest_count} onChange={e => set('guest_count', e.target.value)} />
        </Field>
        <Field label="Menu / Package">
          <select style={inp} value={form.menu_id} onChange={e => set('menu_id', e.target.value)}>
            <option value="">-- Select menu --</option>
            {menus.map(m => <option key={m.id} value={m.id}>{m.name} ({inr(m.price_per_plate)}/plate)</option>)}
          </select>
        </Field>
        {estimate > 0 && (
          <div style={{ gridColumn: '1 / -1', background: '#EAF3DE', padding: '10px 14px', borderRadius: 8 }}>
            <div style={{ fontSize: 11, color: '#3B6D11' }}>Estimated total</div>
            <div style={{ fontWeight: 600, color: '#3B6D11', fontSize: 16 }}>{inr(estimate)}</div>
          </div>
        )}
        <Field label="Special instructions" full>
          <textarea style={{ ...inp, height: 70, resize: 'vertical' }} placeholder="e.g. Jain food for 50 guests..."
            value={form.special_instructions} onChange={e => set('special_instructions', e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
};

const Field: React.FC<{ label: string; full?: boolean; children: React.ReactNode }> = ({ label, full, children }) => (
  <label style={{ display: 'block', minWidth: 0, gridColumn: full ? '1 / -1' : undefined }}>
    <span style={lbl}>{label}</span>
    {children}
  </label>
);

const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 };
const btnPrimary: React.CSSProperties = { background: '#E8750A', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 };
const btnGhost: React.CSSProperties = { background: 'transparent', border: '0.5px solid #D0D0CC', padding: '8px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#666660' };
const lbl: React.CSSProperties = { fontSize: 11, color: '#888880', display: 'block', marginBottom: 4 };
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 7, border: '0.5px solid #D0D0CC', fontSize: 13, background: '#FFFFFF', color: '#1A1A18', boxSizing: 'border-box' };

export default BookingFormModal;
