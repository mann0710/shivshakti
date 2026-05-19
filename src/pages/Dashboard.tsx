import React, { useState } from 'react';
import { format, isWithinInterval, addDays, parseISO } from 'date-fns';
import { useBookings } from '../hooks/useBookings';
import { useInvoices, useAllPayments } from '../hooks/useInvoices';
import { useSeasonalOrders } from '../hooks/useSeasonalOrders';
import StatusPill from '../components/StatusPill';
import { Page } from '../App';
import { getISTGreeting, formatDateIST } from '../lib/ist';

interface Props { onNavigate: (page: Page) => void; }

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

const Dashboard: React.FC<Props> = ({ onNavigate }) => {
  const { data: bookings = [] } = useBookings();
  const { data: invoices = [] } = useInvoices();
  const { data: allPayments = [] } = useAllPayments();
  const [seasonalYear, setSeasonalYear] = useState(currentYear);
  const { data: seasonalOrders = [] } = useSeasonalOrders(seasonalYear);
  const today = new Date();

  const activeBookings = bookings.filter(b => b.status !== 'cancelled' && b.status !== 'completed');
  const thisMonthEvents = bookings.filter(b => {
    const d = parseISO(b.event_date);
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  });
  const upcoming = bookings
    .filter(b => b.status !== 'cancelled' && parseISO(b.event_date) >= today)
    .slice(0, 5);
  const nextEvent = upcoming[0];
  const urgentBookings = bookings.filter(b => {
    const d = parseISO(b.event_date);
    return isWithinInterval(d, { start: today, end: addDays(today, 3) }) && b.status === 'confirmed';
  });
  const overdueInvoices = invoices.filter(i => i.balance_due > 0 && i.status !== 'paid');

  // Seasonal stats
  const seasonalTotal = seasonalOrders.reduce((s, o) => s + o.total_amount, 0);
  const seasonalPaid = seasonalOrders.filter(o => o.is_paid).reduce((s, o) => s + o.total_amount, 0);
  const seasonalUnpaid = seasonalOrders.filter(o => !o.is_paid).reduce((s, o) => s + o.total_amount, 0);

  // Payment stats
  const advanceTotal = allPayments.filter(p => p.payment_type === 'advance').reduce((s, p) => s + p.amount, 0);
  const partialTotal = allPayments.filter(p => p.payment_type === 'partial').reduce((s, p) => s + p.amount, 0);
  const remainingDue = invoices.reduce((s, i) => s + i.balance_due, 0);
  const fullyPaidTotal = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total_amount, 0);

  return (
    <div>
      <div className="page-topbar">
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{getISTGreeting()} 👋</div>
          <div style={{ fontSize: 11, color: '#888880', marginTop: 2 }}>{format(today, 'EEEE, dd-MM-yyyy')}</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={btnGhost} onClick={() => onNavigate('bookings')}>
            🔔 {activeBookings.length} active
          </button>
          <button style={btnPrimary} onClick={() => onNavigate('bookings')}>+ New Booking</button>
        </div>
      </div>

      <div className="page-content">
        {urgentBookings.map(b => (
          <div key={b.id} style={alertWarn}>
            ⚠️ <strong>{b.customer?.name}</strong> — {b.event_type} on {formatDateIST(b.event_date, 'dd-MM')} is in less than 3 days!
          </div>
        ))}
        {overdueInvoices.slice(0, 1).map(i => (
          <div key={i.id} style={alertDanger}>
            🔴 Balance due ₹{i.balance_due.toLocaleString()} from {i.booking?.customer?.name} — <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => onNavigate('billing')}>View invoice</span>
          </div>
        ))}

        {/* Booking stats */}
        <div className="g4">
          <StatCard label="Active bookings" value={activeBookings.length} sub={`${bookings.filter(b => b.status === 'inquiry' || b.status === 'pending').length} inquiries pending`} />
          <StatCard label="Events this month" value={thisMonthEvents.length} sub="This calendar month" />
          <StatCard label="Next event" value={nextEvent ? formatDateIST(nextEvent.event_date, 'dd-MM') : '—'} sub={nextEvent ? `${nextEvent.customer?.name} · ${nextEvent.guest_count} guests` : 'No upcoming events'} />
          <StatCard label="Outstanding invoices" value={overdueInvoices.length} sub={`₹${overdueInvoices.reduce((s, i) => s + i.balance_due, 0).toLocaleString()} total due`} subColor="#E24B4A" />
        </div>

        {/* Payment stats */}
        <div className="g4" style={{ marginBottom: 16 }}>
          <StatCard label="Advance received" value={`₹${advanceTotal.toLocaleString()}`} sub="Total advance payments" subColor="#3B6D11" />
          <StatCard label="Partial received" value={`₹${partialTotal.toLocaleString()}`} sub="Total partial payments" subColor="#378ADD" />
          <StatCard label="Balance due" value={`₹${remainingDue.toLocaleString()}`} sub="Remaining to collect" subColor={remainingDue > 0 ? '#E24B4A' : '#3B6D11'} />
          <StatCard label="Fully collected" value={`₹${fullyPaidTotal.toLocaleString()}`} sub={`${invoices.filter(i => i.status === 'paid').length} invoices paid`} subColor="#3B6D11" />
        </div>

        <div className="g2" style={{ marginBottom: 16 }}>
          <div style={card}>
            <div style={cardTitle}>
              Upcoming bookings
              <span style={cardLink} onClick={() => onNavigate('bookings')}>View all →</span>
            </div>
            {upcoming.length === 0 && <div style={{ color: '#888880', fontSize: 12 }}>No upcoming bookings</div>}
            {upcoming.map(b => (
              <div key={b.id} style={bookingRow}>
                <Avatar name={b.customer?.name || '?'} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{b.customer?.name} — {b.event_type}</div>
                  <div style={{ fontSize: 11, color: '#888880', marginTop: 1 }}>
                    {formatDateIST(b.event_date, 'dd-MM')} · {b.venue} · {b.guest_count} guests
                  </div>
                </div>
                <StatusPill status={b.status} />
              </div>
            ))}
          </div>

          <div style={card}>
            <div style={cardTitle}>Quick actions</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { icon: '📋', label: 'New booking',    page: 'bookings',    bg: '#FFF0E0' },
                { icon: '👤', label: 'Add customer',   page: 'customers',   bg: '#E6F1FB' },
                { icon: '🧾', label: 'Create invoice', page: 'billing',     bg: '#EAF3DE' },
                { icon: '🍽',  label: 'Manage menus',   page: 'menus',       bg: '#EEEDFE' },
                { icon: '📅', label: 'Open calendar',  page: 'calendar',    bg: '#FBEAF0' },
                { icon: '⚙️', label: 'Data Center',    page: 'datacenter',  bg: '#F5F5F0' },
              ].map(a => (
                <div key={a.label} onClick={() => onNavigate(a.page as Page)}
                  style={{ background: a.bg, padding: '10px 12px', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>{a.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{a.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Seasonal stats */}
        <div style={card}>
          <div style={cardTitle}>
            Sessional Business
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <select
                value={seasonalYear}
                onChange={e => setSeasonalYear(Number(e.target.value))}
                style={{ border: '0.5px solid #D0D0CC', borderRadius: 6, padding: '3px 8px', fontSize: 12, background: '#fff' }}
              >
                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <span style={cardLink} onClick={() => onNavigate('seasonal_dashboard')}>View →</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            <div style={seasonalStatBox}>
              <div style={{ fontSize: 11, color: '#888880' }}>Total Sales</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>₹{seasonalTotal.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: '#AAAAAA', marginTop: 2 }}>{seasonalOrders.length} orders</div>
            </div>
            <div style={seasonalStatBox}>
              <div style={{ fontSize: 11, color: '#888880' }}>Collected</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: '#3B6D11' }}>₹{seasonalPaid.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: '#AAAAAA', marginTop: 2 }}>{seasonalOrders.filter(o => o.is_paid).length} paid</div>
            </div>
            <div style={seasonalStatBox}>
              <div style={{ fontSize: 11, color: '#888880' }}>Pending</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: seasonalUnpaid > 0 ? '#C0392B' : '#3B6D11' }}>₹{seasonalUnpaid.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: '#AAAAAA', marginTop: 2 }}>{seasonalOrders.filter(o => !o.is_paid).length} unpaid</div>
            </div>
          </div>
        </div>

        <div style={card}>
          <div style={cardTitle}>Event pipeline</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {upcoming.map((b, i) => {
              const colors = ['#E8750A', '#378ADD', '#639922', '#7F77DD', '#D4537E'];
              const color = colors[i % colors.length];
              const daysLeft = Math.ceil((parseISO(b.event_date).getTime() - today.getTime()) / 86400000);
              const readiness = Math.max(10, Math.min(95, 100 - daysLeft * 3));
              return (
                <div key={b.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: 500 }}>{b.customer?.name} — {b.event_type}</span>
                    <span style={{ fontSize: 11, color: '#888880' }}>{formatDateIST(b.event_date, 'dd-MM')}</span>
                  </div>
                  <div style={{ height: 6, background: '#EBEBEB', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${readiness}%`, background: color, borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
            {upcoming.length === 0 && <div style={{ color: '#888880', fontSize: 12 }}>No upcoming events</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: any; sub: string; subColor?: string }> = ({ label, value, sub, subColor }) => (
  <div style={{ background: '#FFFFFF', border: '0.5px solid #E5E5E0', borderRadius: 12, padding: '14px 16px' }}>
    <div style={{ fontSize: 11, color: '#888880', marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 600 }}>{value}</div>
    <div style={{ fontSize: 11, color: subColor || '#AAAAAA', marginTop: 3 }}>{sub}</div>
  </div>
);

const Avatar: React.FC<{ name: string }> = ({ name }) => {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['#FFF0E0', '#E6F1FB', '#EAF3DE', '#EEEDFE'];
  const textColors = ['#BA7517', '#185FA5', '#3B6D11', '#534AB7'];
  const idx = name.charCodeAt(0) % 4;
  return (
    <div style={{ width: 32, height: 32, borderRadius: '50%', background: colors[idx], color: textColors[idx], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
      {initials}
    </div>
  );
};

const card: React.CSSProperties = { background: '#FFFFFF', border: '0.5px solid #E5E5E0', borderRadius: 12, padding: 16 };
const seasonalStatBox: React.CSSProperties = { background: '#F9F8F5', border: '0.5px solid #E5E5E0', borderRadius: 10, padding: '12px 14px' };
const cardTitle: React.CSSProperties = { fontSize: 13, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
const cardLink: React.CSSProperties = { fontSize: 12, color: '#378ADD', cursor: 'pointer', fontWeight: 400 };
const bookingRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '0.5px solid #F0F0EC' };
const alertWarn: React.CSSProperties = { background: '#FFF8EE', border: '0.5px solid #FAC775', borderRadius: 8, padding: '10px 14px', marginBottom: 10, fontSize: 12, color: '#854F0B' };
const alertDanger: React.CSSProperties = { background: '#FCEBEB', border: '0.5px solid #F7C1C1', borderRadius: 8, padding: '10px 14px', marginBottom: 10, fontSize: 12, color: '#A32D2D' };
const btnPrimary: React.CSSProperties = { background: '#E8750A', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 };
const btnGhost: React.CSSProperties = { background: 'transparent', border: '0.5px solid #D0D0CC', padding: '6px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#666660' };

export default Dashboard;
