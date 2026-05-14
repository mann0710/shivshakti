import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { useBookings, useCreateBooking, useUpdateBooking } from '../hooks/useBookings';
import { useCustomers, useCreateCustomer } from '../hooks/useCustomers';
import { useMenus } from '../hooks/useMenus';
import StatusPill from '../components/StatusPill';
import { Booking } from '../types';

type StatusFilter = 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled';

const Bookings: React.FC = () => {
  const { data: bookings = [], isLoading } = useBookings();
  const { data: customers = [] } = useCustomers();
  const { data: menus = [] } = useMenus();
  const createBooking = useCreateBooking();
  const updateBooking = useUpdateBooking();
  const createCustomer = useCreateCustomer();

  const [filter, setFilter] = useState<StatusFilter>('all');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    customer_id: '', newCustomerName: '', newCustomerPhone: '',
    event_type: 'Wedding', event_date: '', event_time: '',
    venue: '', guest_count: '', menu_id: '', special_instructions: '', status: 'pending'
  });

  const filtered = bookings.filter(b => filter === 'all' || b.status === filter);
  const selectedMenu = menus.find(m => m.id === form.menu_id);
  const estimatedCost = selectedMenu && form.guest_count
    ? selectedMenu.price_per_plate * parseInt(form.guest_count)
    : 0;

  const handleSubmit = async () => {
    if (!form.event_date || !form.venue) { toast.error('Please fill event date and venue'); return; }
    try {
      let customerId = form.customer_id;
      if (!customerId && form.newCustomerName) {
        const c = await createCustomer.mutateAsync({ name: form.newCustomerName, phone: form.newCustomerPhone });
        customerId = c.id;
      }
      if (!customerId) { toast.error('Please select or add a customer'); return; }
      await createBooking.mutateAsync({
        customer_id: customerId,
        event_type: form.event_type,
        event_date: form.event_date,
        event_time: form.event_time || undefined,
        venue: form.venue,
        guest_count: parseInt(form.guest_count) || 0,
        menu_id: form.menu_id || undefined,
        special_instructions: form.special_instructions,
        status: 'pending',
        estimated_cost: estimatedCost,
      });
      toast.success('Booking created!');
      setShowForm(false);
      setForm({ customer_id: '', newCustomerName: '', newCustomerPhone: '', event_type: 'Wedding', event_date: '', event_time: '', venue: '', guest_count: '', menu_id: '', special_instructions: '', status: 'pending' });
    } catch (e: any) {
      toast.error(e.message || 'Failed to create booking');
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    await updateBooking.mutateAsync({ id, status: status as Booking['status'] });
    toast.success('Status updated');
  };

  return (
    <div>
      <div className="page-topbar">
        <div style={{ fontSize: 16, fontWeight: 600 }}>Bookings</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={btnGhost}>Filter</button>
          <button style={btnPrimary} onClick={() => setShowForm(!showForm)}>+ New Booking</button>
        </div>
      </div>
      <div className="page-content">
        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {(['all', 'pending', 'confirmed', 'completed', 'cancelled'] as StatusFilter[]).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              style={{ padding: '4px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: '0.5px solid',
                background: filter === s ? '#E8750A' : 'transparent',
                color: filter === s ? '#fff' : '#666660',
                borderColor: filter === s ? '#E8750A' : '#D0D0CC' }}>
              {s.charAt(0).toUpperCase() + s.slice(1)} ({s === 'all' ? bookings.length : bookings.filter(b => b.status === s).length})
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
                  {['Customer', 'Event type', 'Date', 'Venue', 'Guests', 'Est. Amount', 'Status', 'Actions'].map(h => (
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
                    <td style={{ padding: '10px 12px', color: '#666660' }}>{format(parseISO(b.event_date), 'MMM d, yyyy')}</td>
                    <td style={{ padding: '10px 12px', color: '#666660' }}>{b.venue}</td>
                    <td style={{ padding: '10px 12px' }}>{b.guest_count}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 500 }}>₹{b.estimated_cost.toLocaleString()}</td>
                    <td style={{ padding: '10px 12px' }}><StatusPill status={b.status} /></td>
                    <td style={{ padding: '10px 12px' }}>
                      <select value={b.status} onChange={e => handleStatusChange(b.id, e.target.value)}
                        style={{ fontSize: 11, padding: '2px 6px', borderRadius: 6, border: '0.5px solid #D0D0CC', background: '#fff', cursor: 'pointer' }}>
                        {['pending', 'confirmed', 'completed', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
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
                <label style={label}>Existing customer</label>
                <select style={input} value={form.customer_id} onChange={e => setForm({ ...form, customer_id: e.target.value })}>
                  <option value="">-- Select customer --</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                </select>
              </div>
              <div>
                <label style={label}>Or new customer name</label>
                <input style={input} placeholder="Full name" value={form.newCustomerName} onChange={e => setForm({ ...form, newCustomerName: e.target.value })} />
              </div>
              <div>
                <label style={label}>New customer phone</label>
                <input style={input} placeholder="+91 98765 43210" value={form.newCustomerPhone} onChange={e => setForm({ ...form, newCustomerPhone: e.target.value })} />
              </div>
              <div>
                <label style={label}>Event type</label>
                <select style={input} value={form.event_type} onChange={e => setForm({ ...form, event_type: e.target.value })}>
                  {['Wedding', 'Birthday', 'Corporate', 'Anniversary', 'Reception', 'Engagement', 'Other'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={label}>Event date *</label>
                <input type="date" style={input} value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })} />
              </div>
              <div>
                <label style={label}>Event time</label>
                <input type="time" style={input} value={form.event_time} onChange={e => setForm({ ...form, event_time: e.target.value })} />
              </div>
              <div>
                <label style={label}>Venue / Location *</label>
                <input style={input} placeholder="Hall name, area" value={form.venue} onChange={e => setForm({ ...form, venue: e.target.value })} />
              </div>
              <div>
                <label style={label}>Guest count</label>
                <input type="number" style={input} placeholder="e.g. 200" value={form.guest_count} onChange={e => setForm({ ...form, guest_count: e.target.value })} />
              </div>
              <div>
                <label style={label}>Menu / Package</label>
                <select style={input} value={form.menu_id} onChange={e => setForm({ ...form, menu_id: e.target.value })}>
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
              <label style={label}>Special instructions (Jain food, no onion/garlic, etc.)</label>
              <textarea style={{ ...input, height: 70, resize: 'vertical' } as any} placeholder="e.g. Jain food for 50 guests, extra sweet counter..." value={form.special_instructions} onChange={e => setForm({ ...form, special_instructions: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={btnGhost} onClick={() => setShowForm(false)}>Cancel</button>
              <button style={btnPrimary} onClick={handleSubmit} disabled={createBooking.isPending}>
                {createBooking.isPending ? 'Saving...' : 'Confirm Booking'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const topbar: React.CSSProperties = { background: '#FFFFFF', borderBottom: '0.5px solid #E5E5E0', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
const card: React.CSSProperties = { background: '#FFFFFF', border: '0.5px solid #E5E5E0', borderRadius: 12, padding: 16 };
const btnPrimary: React.CSSProperties = { background: '#E8750A', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 };
const btnGhost: React.CSSProperties = { background: 'transparent', border: '0.5px solid #D0D0CC', padding: '6px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#666660' };
const label: React.CSSProperties = { fontSize: 11, color: '#888880', display: 'block', marginBottom: 4 };
const input: React.CSSProperties = { width: '100%', padding: '7px 10px', borderRadius: 7, border: '0.5px solid #D0D0CC', fontSize: 13, background: '#FFFFFF', color: '#1A1A18' };

export default Bookings;
