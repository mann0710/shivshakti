import React from 'react';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { useBookings } from '../hooks/useBookings';
import { useInvoices } from '../hooks/useInvoices';
import { useCustomers } from '../hooks/useCustomers';

const Finance: React.FC = () => {
  const { data: bookings = [] } = useBookings();
  const { data: invoices = [] } = useInvoices();
  const { data: customers = [] } = useCustomers();

  const totalRevenue = invoices.reduce((s, i) => s + i.total_amount, 0);
  const totalCollected = invoices.reduce((s, i) => s + i.advance_paid, 0);
  const totalOutstanding = invoices.reduce((s, i) => s + i.balance_due, 0);
  const totalGST = invoices.reduce((s, i) => s + i.gst_amount, 0);
  const avgBookingValue = invoices.length ? Math.round(totalRevenue / invoices.length) : 0;
  const collectionRate = totalRevenue ? Math.round((totalCollected / totalRevenue) * 100) : 0;

  // Monthly revenue - last 6 months
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return d;
  });

  const monthlyData = months.map(m => {
    const start = startOfMonth(m);
    const end = endOfMonth(m);
    const revenue = invoices
      .filter(i => isWithinInterval(parseISO(i.created_at), { start, end }))
      .reduce((s, i) => s + i.total_amount, 0);
    return { label: format(m, 'MMM'), revenue };
  });
  const maxRevenue = Math.max(...monthlyData.map(m => m.revenue), 1);

  // Revenue by event type
  const eventTypes = ['Wedding', 'Corporate', 'Birthday', 'Anniversary', 'Reception', 'Other'];
  const eventRevenue = eventTypes.map(type => ({
    type,
    revenue: bookings.filter(b => b.event_type === type).reduce((s, b) => s + b.estimated_cost, 0),
  })).filter(e => e.revenue > 0).sort((a, b) => b.revenue - a.revenue);
  const maxEventRev = Math.max(...eventRevenue.map(e => e.revenue), 1);

  // Top customers
  const customerSpend = customers.map(c => ({
    customer: c,
    spend: bookings.filter(b => b.customer_id === c.id).reduce((s, b) => s + b.estimated_cost, 0),
    count: bookings.filter(b => b.customer_id === c.id).length,
  })).sort((a, b) => b.spend - a.spend).slice(0, 5);

  // Overdue invoices
  const overdue = invoices.filter(i => i.balance_due > 0 && i.status !== 'paid');

  const handleExport = () => {
    const rows = [
      ['Invoice #', 'Customer', 'Event Type', 'Event Date', 'Subtotal', 'GST', 'Total', 'Advance Paid', 'Balance Due', 'Status'],
      ...invoices.map(i => [
        i.invoice_number,
        i.booking?.customer?.name || '',
        i.booking?.event_type || '',
        i.booking?.event_date || '',
        i.subtotal,
        i.gst_amount,
        i.total_amount,
        i.advance_paid,
        i.balance_due,
        i.status,
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finance-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const eventColors: Record<string, string> = {
    Wedding: '#E8750A', Corporate: '#378ADD', Birthday: '#639922',
    Anniversary: '#7F77DD', Reception: '#D4537E', Other: '#888880',
  };

  return (
    <div>
      <div className="page-topbar">
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Finance & Analytics</div>
          <div style={{ fontSize: 11, color: '#888880', marginTop: 2 }}>Complete financial overview</div>
        </div>
        <button style={btnGhost} onClick={handleExport}>Export CSV</button>
      </div>
      <div className="page-content">
        {/* KPI Row 1 */}
        <div className="g3">
          <KPI label="Total revenue" value={`₹${(totalRevenue / 100000).toFixed(1)}L`} sub="All time" />
          <KPI label="Amount collected" value={`₹${(totalCollected / 100000).toFixed(1)}L`} sub={`${collectionRate}% collection rate`} subColor="#639922" />
          <KPI label="Outstanding dues" value={`₹${totalOutstanding.toLocaleString()}`} sub={`${overdue.length} invoices`} subColor={totalOutstanding > 0 ? '#E24B4A' : '#639922'} />
        </div>
        {/* KPI Row 2 */}
        <div className="g3" style={{ marginBottom: 20 }}>
          <KPI label="GST collected" value={`₹${totalGST.toLocaleString()}`} sub="@18% all invoices" />
          <KPI label="Avg. booking value" value={`₹${avgBookingValue.toLocaleString()}`} sub="Per invoice" />
          <KPI label="Total bookings" value={bookings.length} sub={`${customers.length} customers`} />
        </div>

        <div className="g2" style={{ marginBottom: 16 }}>
          {/* Monthly revenue */}
          <div style={card}>
            <div style={cardTitle}>Monthly revenue</div>
            {monthlyData.map(m => (
              <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: '#888880', width: 32, textAlign: 'right', flexShrink: 0 }}>{m.label}</span>
                <div style={{ flex: 1, height: 8, background: '#F0F0EC', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.round((m.revenue / maxRevenue) * 100)}%`, background: '#E8750A', borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, width: 60, textAlign: 'right' }}>
                  {m.revenue > 0 ? `₹${Math.round(m.revenue / 1000)}K` : '—'}
                </span>
              </div>
            ))}
          </div>

          {/* Revenue by event type */}
          <div style={card}>
            <div style={cardTitle}>Revenue by event type</div>
            {eventRevenue.length === 0 ? (
              <div style={{ color: '#888880', fontSize: 12 }}>No data yet</div>
            ) : eventRevenue.map(e => (
              <div key={e.type} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: '#888880', width: 80, flexShrink: 0 }}>{e.type}</span>
                <div style={{ flex: 1, height: 8, background: '#F0F0EC', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.round((e.revenue / maxEventRev) * 100)}%`, background: eventColors[e.type] || '#888880', borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 500, width: 72, textAlign: 'right' }}>₹{Math.round(e.revenue / 1000)}K</span>
              </div>
            ))}
          </div>
        </div>

        <div className="g2">
          {/* Top customers */}
          <div style={card}>
            <div style={cardTitle}>Top customers by spend</div>
            {customerSpend.filter(c => c.spend > 0).map((c, i) => {
              const colors = ['#FFF0E0', '#E6F1FB', '#EAF3DE', '#EEEDFE', '#FBEAF0'];
              const tColors = ['#BA7517', '#185FA5', '#3B6D11', '#534AB7', '#993556'];
              const initials = c.customer.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
              return (
                <div key={c.customer.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '0.5px solid #F0F0EC' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: colors[i % 5], color: tColors[i % 5], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>{initials}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{c.customer.name}</div>
                    <div style={{ fontSize: 11, color: '#888880' }}>{c.count} bookings</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>₹{c.spend.toLocaleString()}</div>
                </div>
              );
            })}
            {customerSpend.filter(c => c.spend > 0).length === 0 && <div style={{ color: '#888880', fontSize: 12 }}>No data yet</div>}
          </div>

          {/* Collection status + overdue */}
          <div style={card}>
            <div style={cardTitle}>Payment collection</div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: '#888880' }}>Collected</span>
                <span style={{ fontWeight: 500, color: '#639922' }}>₹{totalCollected.toLocaleString()} ({collectionRate}%)</span>
              </div>
              <div style={{ height: 10, background: '#F0F0EC', borderRadius: 5, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${collectionRate}%`, background: '#639922', borderRadius: 5 }} />
              </div>
            </div>

            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Overdue invoices</div>
            {overdue.length === 0 ? (
              <div style={{ color: '#639922', fontSize: 12, background: '#EAF3DE', padding: '8px 12px', borderRadius: 8 }}>✓ All payments collected</div>
            ) : overdue.map(i => (
              <div key={i.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '0.5px solid #F0F0EC' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{i.booking?.customer?.name}</div>
                  <div style={{ fontSize: 11, color: '#888880' }}>{i.invoice_number}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#A32D2D' }}>₹{i.balance_due.toLocaleString()}</div>
                  <div style={{ fontSize: 10, color: '#A32D2D' }}>overdue</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const KPI: React.FC<{ label: string; value: any; sub: string; subColor?: string }> = ({ label, value, sub, subColor }) => (
  <div style={{ background: '#FFFFFF', border: '0.5px solid #E5E5E0', borderRadius: 12, padding: '14px 16px' }}>
    <div style={{ fontSize: 11, color: '#888880', marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 600 }}>{value}</div>
    <div style={{ fontSize: 11, color: subColor || '#AAAAAA', marginTop: 3 }}>{sub}</div>
  </div>
);

const card: React.CSSProperties = { background: '#FFFFFF', border: '0.5px solid #E5E5E0', borderRadius: 12, padding: 16 };
const cardTitle: React.CSSProperties = { fontSize: 13, fontWeight: 600, marginBottom: 14 };
const btnGhost: React.CSSProperties = { background: 'transparent', border: '0.5px solid #D0D0CC', padding: '6px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#666660' };

export default Finance;
