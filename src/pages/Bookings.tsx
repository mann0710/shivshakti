import React, { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useBookings, useCreateBooking, useUpdateBooking } from '../hooks/useBookings';
import { useCustomers, useCreateCustomer } from '../hooks/useCustomers';
import { useMenus } from '../hooks/useMenus';
import { useTeamMembers, useEventTypes, DEFAULT_EVENTS } from '../hooks/useDataCenter';
import StatusPill from '../components/StatusPill';
import { Booking } from '../types';
import { formatDateIST } from '../lib/ist';

type StatusFilter = 'all' | 'inquiry' | 'followup' | 'confirmed' | 'completed' | 'cancelled';
const BOOKING_STATUSES = ['inquiry', 'followup', 'confirmed', 'completed', 'cancelled'];

// Google Maps venue autocomplete
const VenueInput: React.FC<{ value: string; onChange: (v: string) => void; style: React.CSSProperties }> = ({ value, onChange, style }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const apiKey = process.env.REACT_APP_GOOGLE_MAPS_KEY;
  const [gmReady, setGmReady] = useState(false);

  useEffect(() => {
    if (!apiKey || !inputRef.current) return;
    const gm = (window as any).google;
    if (gm?.maps?.places) { initAC(); setGmReady(true); return; }
    const existing = document.querySelector('script[data-gm="1"]') as HTMLScriptElement | null;
    const onLoad = () => { initAC(); setGmReady(true); };
    if (existing) { existing.addEventListener('load', onLoad); return; }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.setAttribute('data-gm', '1');
    script.async = true;
    script.onload = onLoad;
    document.head.appendChild(script);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  const initAC = () => {
    if (!inputRef.current) return;
    const gm = (window as any).google;
    if (!gm?.maps?.places) return;
    const ac = new gm.maps.places.Autocomplete(inputRef.current, { componentRestrictions: { country: 'in' } });
    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      onChange(place.formatted_address || place.name || '');
    });
  };

  return (
    <div style={{ position: 'relative' }}>
      <input ref={inputRef} style={style} value={value} onChange={e => onChange(e.target.value)}
        placeholder={apiKey ? 'Start typing to search on Google Maps…' : 'Hall name, area'} />
      {gmReady && <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, pointerEvents: 'none' }}>📍</span>}
    </div>
  );
};

const Bookings: React.FC = () => {
  const { data: bookings = [], isLoading } = useBookings();
  const { data: customers = [] } = useCustomers();
  const { data: menus = [] } = useMenus();
  const { data: teamMembers = [] } = useTeamMembers();
  const { data: eventTypesList = [] } = useEventTypes();
  const createBooking = useCreateBooking();
  const updateBooking = useUpdateBooking();
  const createCustomer = useCreateCustomer();

  const eventTypes = eventTypesList.length > 0 ? eventTypesList.map(e => e.name) : DEFAULT_EVENTS;

  const [filter, setFilter] = useState<StatusFilter>('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    customer_id: '', newCustomerName: '', newCustomerPhone: '', customerEmail: '',
    event_type: eventTypes[0] || 'Wedding', event_date: '', event_time: '',
    venue: '', guest_count: '', menu_id: '', special_instructions: '',
  });

  // Keep default event_type in sync with loaded types
  useEffect(() => {
    if (eventTypes.length > 0 && !form.event_type) {
      setForm(f => ({ ...f, event_type: eventTypes[0] }));
    }
  }, [eventTypes]); // eslint-disable-line

  const filtered = bookings.filter(b => {
    if (filter === 'all') return true;
    if (filter === 'inquiry') return b.status === 'inquiry' || b.status === 'pending';
    return b.status === filter;
  });

  const selectedMenu = menus.find(m => m.id === form.menu_id);
  const estimatedCost = selectedMenu && form.guest_count
    ? selectedMenu.price_per_plate * parseInt(form.guest_count) : 0;

  const filterCount = (s: StatusFilter) => {
    if (s === 'all') return bookings.length;
    if (s === 'inquiry') return bookings.filter(b => b.status === 'inquiry' || b.status === 'pending').length;
    return bookings.filter(b => b.status === s).length;
  };

  const openGoogleCalendar = (booking: Booking) => {
    const customer = booking.customer;
    if (!customer) return;
    const emails: string[] = [];
    if (customer.email) emails.push(customer.email);
    teamMembers.forEach(t => { if (t.email) emails.push(t.email); });
    const dateStr = booking.event_date.replace(/-/g, '');
    const title = encodeURIComponent(`${booking.event_type} – ${customer.name}`);
    const details = encodeURIComponent(
      `Event: ${booking.event_type}\nCustomer: ${customer.name}\nAddress: ${customer.address || ''}\nVenue: ${booking.venue}\nGuests: ${booking.guest_count}`
    );
    const guestParam = emails.length ? `&add=${emails.map(e => encodeURIComponent(e)).join(',')}` : '';
    window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dateStr}/${dateStr}&details=${details}${guestParam}`, '_blank');
    toast.success('Google Calendar opened — save the event!');
  };

  const handleSubmit = async () => {
    if (!form.event_date || !form.venue) { toast.error('Event date and venue are required'); return; }
    if (form.customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customerEmail)) {
      toast.error('Enter a valid email address'); return;
    }
    try {
      let customerId = form.customer_id;
      if (!customerId && form.newCustomerName) {
        const c = await createCustomer.mutateAsync({ name: form.newCustomerName, phone: form.newCustomerPhone, email: form.customerEmail || undefined });
        customerId = c.id;
      }
      if (!customerId) { toast.error('Select or add a customer'); return; }
      await createBooking.mutateAsync({
        customer_id: customerId, event_type: form.event_type,
        event_date: form.event_date, event_time: form.event_time || undefined,
        venue: form.venue, guest_count: parseInt(form.guest_count) || 0,
        menu_id: form.menu_id || undefined, special_instructions: form.special_instructions,
        status: 'inquiry', estimated_cost: estimatedCost,
      });
      toast.success('Booking created!');
      setShowForm(false);
      setForm({ customer_id: '', newCustomerName: '', newCustomerPhone: '', customerEmail: '', event_type: eventTypes[0] || 'Wedding', event_date: '', event_time: '', venue: '', guest_count: '', menu_id: '', special_instructions: '' });
    } catch (e: any) { toast.error(e.message || 'Failed to create booking'); }
  };

  const handleStatusChange = async (id: string, newStatus: string, booking: Booking) => {
    await updateBooking.mutateAsync({ id, status: newStatus as Booking['status'] });
    toast.success('Status updated');
    if (newStatus === 'confirmed') openGoogleCalendar({ ...booking, status: 'confirmed' });
  };

  return (
    <div>
      <div className="page-topbar">
        <div style={{ fontSize: 16, fontWeight: 600 }}>Bookings</div>
        <button style={btnPrimary} onClick={() => setShowForm(!showForm)}>+ New Booking</button>
      </div>
      <div className="page-content">
        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {(['all', 'inquiry', 'followup', 'confirmed', 'completed', 'cancelled'] as StatusFilter[]).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              style={{ padding: '4px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: '0.5px solid',
                background: filter === s ? '#E8750A' : 'transparent',
                color: filter === s ? '#fff' : '#666660',
                borderColor: filter === s ? '#E8750A' : '#D0D0CC' }}>
              {s.charAt(0).toUpperCase() + s.slice(1)} ({filterCount(s)})
            </button>
          ))}
        </div>

        {/* Table */}
        <div style={{ ...card, padding: 0, overflow: 'hidden', marginBottom: 20 }} className="table-wrap">
          {isLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#888880' }}>Loading bookings...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#888880' }}>No bookings found</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#FAFAF8', borderBottom: '0.5px solid #E5E5E0' }}>
                  {['Customer', 'Event', 'Date', 'Venue', 'Guests', 'Amount', 'Status', 'Action'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 500, color: '#888880', fontSize: 12 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => (
                  <tr key={b.id} style={{ borderBottom: '0.5px solid #F0F0EC' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 500 }}>{b.customer?.name}</div>
                      <div style={{ fontSize: 11, color: '#888880' }}>{b.customer?.phone}</div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>{b.event_type}</td>
                    <td style={{ padding: '10px 12px', color: '#666660' }}>{formatDateIST(b.event_date, 'MMM d, yyyy')}</td>
                    <td style={{ padding: '10px 12px', color: '#666660', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.venue}</td>
                    <td style={{ padding: '10px 12px' }}>{b.guest_count}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>₹{b.estimated_cost.toLocaleString()}</td>
                    <td style={{ padding: '10px 12px' }}><StatusPill status={b.status} /></td>
                    <td style={{ padding: '10px 12px' }}>
                      <select value={b.status} onChange={e => handleStatusChange(b.id, e.target.value, b)}
                        style={{ fontSize: 11, padding: '2px 6px', borderRadius: 6, border: '0.5px solid #D0D0CC', background: '#fff', cursor: 'pointer' }}>
                        {BOOKING_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* New Booking Form */}
        {showForm && (
          <div style={card}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>New Booking</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={lbl}>Existing customer</label>
                <select style={inp} value={form.customer_id} onChange={e => {
                  const cust = customers.find(c => c.id === e.target.value);
                  setForm({ ...form, customer_id: e.target.value, customerEmail: cust?.email || '' });
                }}>
                  <option value="">-- Select customer --</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Or new customer name</label>
                <input style={inp} placeholder="Full name" value={form.newCustomerName} onChange={e => setForm({ ...form, newCustomerName: e.target.value })} />
              </div>
              <div>
                <label style={lbl}>New customer phone</label>
                <input style={inp} placeholder="+91 98765 43210" value={form.newCustomerPhone} onChange={e => setForm({ ...form, newCustomerPhone: e.target.value })} />
              </div>
              <div>
                <label style={lbl}>Customer email (optional)</label>
                <input type="email" style={inp} placeholder="customer@example.com"
                  value={form.customerEmail} onChange={e => setForm({ ...form, customerEmail: e.target.value })} />
              </div>
              <div>
                <label style={lbl}>Event type</label>
                <select style={inp} value={form.event_type} onChange={e => setForm({ ...form, event_type: e.target.value })}>
                  {eventTypes.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Event date *</label>
                <input type="date" style={inp} value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })} />
              </div>
              <div>
                <label style={lbl}>Event time</label>
                <input type="time" style={inp} value={form.event_time} onChange={e => setForm({ ...form, event_time: e.target.value })} />
              </div>
              <div>
                <label style={lbl}>Venue / Location *</label>
                <VenueInput style={inp} value={form.venue} onChange={v => setForm({ ...form, venue: v })} />
              </div>
              <div>
                <label style={lbl}>Guest count</label>
                <input type="number" style={inp} placeholder="e.g. 200" value={form.guest_count} onChange={e => setForm({ ...form, guest_count: e.target.value })} />
              </div>
              <div>
                <label style={lbl}>Menu / Package</label>
                <select style={inp} value={form.menu_id} onChange={e => setForm({ ...form, menu_id: e.target.value })}>
                  <option value="">-- Select menu --</option>
                  {menus.map(m => <option key={m.id} value={m.id}>{m.name} (₹{m.price_per_plate}/plate)</option>)}
                </select>
              </div>
              {estimatedCost > 0 && (
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <div style={{ background: '#EAF3DE', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
                    <div style={{ fontSize: 11, color: '#3B6D11' }}>Estimated total</div>
                    <div style={{ fontWeight: 600, color: '#3B6D11', fontSize: 16 }}>₹{estimatedCost.toLocaleString()}</div>
                  </div>
                </div>
              )}
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Special instructions</label>
              <textarea style={{ ...inp, height: 70, resize: 'vertical' } as any} placeholder="e.g. Jain food for 50 guests..." value={form.special_instructions} onChange={e => setForm({ ...form, special_instructions: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={btnGhost} onClick={() => setShowForm(false)}>Cancel</button>
              <button style={btnPrimary} onClick={handleSubmit} disabled={createBooking.isPending}>
                {createBooking.isPending ? 'Saving...' : 'Create Booking'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const card: React.CSSProperties = { background: '#FFFFFF', border: '0.5px solid #E5E5E0', borderRadius: 12, padding: 16 };
const btnPrimary: React.CSSProperties = { background: '#E8750A', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 };
const btnGhost: React.CSSProperties = { background: 'transparent', border: '0.5px solid #D0D0CC', padding: '6px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#666660' };
const lbl: React.CSSProperties = { fontSize: 11, color: '#888880', display: 'block', marginBottom: 4 };
const inp: React.CSSProperties = { width: '100%', padding: '7px 10px', borderRadius: 7, border: '0.5px solid #D0D0CC', fontSize: 13, background: '#FFFFFF', color: '#1A1A18', boxSizing: 'border-box' };

export default Bookings;
