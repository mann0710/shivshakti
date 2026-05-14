import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { useCustomers, useCreateCustomer } from '../hooks/useCustomers';
import { useBookings } from '../hooks/useBookings';
import StatusPill from '../components/StatusPill';
import { Page } from '../App';

interface Props { onNavigate: (page: Page) => void; }

const Customers: React.FC<Props> = ({ onNavigate }) => {
  const { data: customers = [], isLoading } = useCustomers();
  const { data: bookings = [] } = useBookings();
  const createCustomer = useCreateCustomer();

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', address: '', notes: '' });

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  );

  const selectedCustomer = customers.find(c => c.id === selected) || filtered[0];
  const customerBookings = bookings.filter(b => b.customer_id === selectedCustomer?.id);
  const totalSpend = customerBookings.reduce((s, b) => s + (b.estimated_cost || 0), 0);

  const handleAdd = async () => {
    if (!form.name) { toast.error('Name is required'); return; }
    try {
      await createCustomer.mutateAsync(form);
      toast.success('Customer added!');
      setShowForm(false);
      setForm({ name: '', phone: '', address: '', notes: '' });
    } catch { toast.error('Failed to add customer'); }
  };

  const initials = (name: string) => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const avatarColors = ['#FFF0E0', '#E6F1FB', '#EAF3DE', '#EEEDFE'];
  const textColors = ['#BA7517', '#185FA5', '#3B6D11', '#534AB7'];

  return (
    <div>
      <div className="page-topbar">
        <div style={{ fontSize: 16, fontWeight: 600 }}>Customers</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input style={{ padding: '6px 12px', borderRadius: 8, border: '0.5px solid #D0D0CC', fontSize: 13, width: 200 }}
            placeholder="Search by name or phone..." value={search} onChange={e => setSearch(e.target.value)} />
          <button style={btnPrimary} onClick={() => setShowForm(!showForm)}>+ Add Customer</button>
        </div>
      </div>
      <div className="page-content">
        {showForm && (
          <div style={{ ...card, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>New Customer</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div><label style={label}>Full name *</label><input style={input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Rajesh Patel" /></div>
              <div><label style={label}>Phone</label><input style={input} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" /></div>
              <div><label style={label}>Address</label><input style={input} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Area, City" /></div>
            </div>
            <div style={{ marginBottom: 12 }}><label style={label}>Notes</label><input style={input} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Any notes about this customer" /></div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={btnGhost} onClick={() => setShowForm(false)}>Cancel</button>
              <button style={btnPrimary} onClick={handleAdd}>Save Customer</button>
            </div>
          </div>
        )}

        <div className="g-customer">
          {/* Customer list */}
          <div>
            <div style={{ fontSize: 11, color: '#888880', marginBottom: 8, fontWeight: 500 }}>{filtered.length} customers</div>
            {isLoading && <div style={{ color: '#888880', fontSize: 12 }}>Loading...</div>}
            {filtered.map((c, i) => {
              const idx = i % 4;
              return (
                <div key={c.id} onClick={() => setSelected(c.id)}
                  style={{ ...card, padding: '10px 12px', marginBottom: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                    borderColor: selectedCustomer?.id === c.id ? '#E8750A' : '#E5E5E0' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: avatarColors[idx], color: textColors[idx], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                    {initials(c.name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: '#888880' }}>{bookings.filter(b => b.customer_id === c.id).length} bookings</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Customer detail */}
          {selectedCustomer ? (
            <div>
              <div style={{ ...card, marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#FFF0E0', color: '#BA7517', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 600 }}>
                    {initials(selectedCustomer.name)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 17, fontWeight: 600 }}>{selectedCustomer.name}</div>
                    <div style={{ fontSize: 12, color: '#888880', marginTop: 2 }}>
                      {selectedCustomer.phone} {selectedCustomer.address && `· ${selectedCustomer.address}`}
                    </div>
                  </div>
                  <button style={btnPrimary} onClick={() => { toast.success(`Creating booking for ${selectedCustomer.name}`); onNavigate('bookings'); }}>Repeat Booking</button>
                </div>
                <div className="g3">
                  <div style={statCard}><div style={statLabel}>Total bookings</div><div style={statVal}>{customerBookings.length}</div></div>
                  <div style={statCard}><div style={statLabel}>Total spend</div><div style={statVal}>₹{(totalSpend / 100000).toFixed(1)}L</div></div>
                  <div style={statCard}><div style={statLabel}>Last event</div><div style={statVal}>{customerBookings[0] ? format(parseISO(customerBookings[0].event_date), 'MMM d') : '—'}</div></div>
                </div>
                {selectedCustomer.notes && <div style={{ marginTop: 12, fontSize: 12, color: '#888880', background: '#FAFAF8', padding: '8px 12px', borderRadius: 8 }}>📝 {selectedCustomer.notes}</div>}
              </div>

              <div style={{ ...card, padding: 0, overflow: 'hidden' }} className="table-wrap">
                <div style={{ padding: '12px 14px', borderBottom: '0.5px solid #E5E5E0', fontSize: 13, fontWeight: 600 }}>Booking history</div>
                {customerBookings.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: '#888880', fontSize: 12 }}>No bookings yet for this customer</div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <tbody>
                      {customerBookings.map(b => (
                        <tr key={b.id} style={{ borderBottom: '0.5px solid #F0F0EC' }}>
                          <td style={{ padding: '9px 14px', fontWeight: 500 }}>{b.event_type}</td>
                          <td style={{ padding: '9px 8px', color: '#888880' }}>{format(parseISO(b.event_date), 'MMM d, yyyy')}</td>
                          <td style={{ padding: '9px 8px' }}>{b.venue}</td>
                          <td style={{ padding: '9px 8px' }}>{b.guest_count} guests</td>
                          <td style={{ padding: '9px 8px', fontWeight: 500 }}>₹{b.estimated_cost.toLocaleString()}</td>
                          <td style={{ padding: '9px 14px' }}><StatusPill status={b.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : (
            <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888880', fontSize: 13 }}>
              Select a customer to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const card: React.CSSProperties = { background: '#FFFFFF', border: '0.5px solid #E5E5E0', borderRadius: 12, padding: 16 };
const btnPrimary: React.CSSProperties = { background: '#E8750A', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 };
const btnGhost: React.CSSProperties = { background: 'transparent', border: '0.5px solid #D0D0CC', padding: '6px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#666660' };
const label: React.CSSProperties = { fontSize: 11, color: '#888880', display: 'block', marginBottom: 4 };
const input: React.CSSProperties = { width: '100%', padding: '7px 10px', borderRadius: 7, border: '0.5px solid #D0D0CC', fontSize: 13, background: '#FFFFFF', color: '#1A1A18' };
const statCard: React.CSSProperties = { background: '#FAFAF8', borderRadius: 8, padding: '10px 12px' };
const statLabel: React.CSSProperties = { fontSize: 11, color: '#888880', marginBottom: 4 };
const statVal: React.CSSProperties = { fontSize: 18, fontWeight: 600 };

export default Customers;
