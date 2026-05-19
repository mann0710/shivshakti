import React, { useState } from 'react';
import { useSeasonalOrders } from '../hooks/useSeasonalOrders';
import { useSeasonalPreorders } from '../hooks/useSeasonalPreorders';
import { useSeasonalOccasions } from '../hooks/useSeasonalOccasions';
import { Page } from '../App';

interface Props { onNavigate: (page: Page) => void; }

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:   { bg: '#FFF3E0', color: '#E65100' },
  confirmed: { bg: '#E3F2FD', color: '#1565C0' },
  delivered: { bg: '#EAF3DE', color: '#3B6D11' },
  cancelled: { bg: '#FEECEC', color: '#C0392B' },
};

const SeasonalDashboard: React.FC<Props> = ({ onNavigate }) => {
  const [year, setYear] = useState(currentYear);
  const { data: orders = [] } = useSeasonalOrders(year);
  const { data: preorders = [] } = useSeasonalPreorders(year);
  const { data: occasions = [] } = useSeasonalOccasions();

  const occMap = Object.fromEntries(occasions.map(o => [o.id, o.name]));

  // Order stats
  const totalSales    = orders.reduce((s, o) => s + o.total_amount, 0);
  const totalPaid     = orders.filter(o => o.is_paid).reduce((s, o) => s + o.total_amount, 0);
  const totalUnpaid   = orders.filter(o => !o.is_paid).reduce((s, o) => s + o.total_amount, 0);

  // Pre-order stats
  const activePreorders   = preorders.filter(p => p.status === 'pending' || p.status === 'confirmed');
  const totalPreorderVal  = activePreorders.reduce((s, p) => s + p.total_amount, 0);
  const totalAdvance      = preorders.reduce((s, p) => s + p.advance_paid, 0);

  // Occasion breakdown
  const occBreakdown = occasions.map(occ => {
    const occOrders   = orders.filter(o => o.occasion_id === occ.id);
    const occPreorders = preorders.filter(p => p.occasion_id === occ.id);
    return {
      id: occ.id,
      name: occ.name,
      orderCount: occOrders.length,
      sales: occOrders.reduce((s, o) => s + o.total_amount, 0),
      preorderCount: occPreorders.filter(p => p.status !== 'delivered' && p.status !== 'cancelled').length,
    };
  }).filter(b => b.orderCount > 0 || b.preorderCount > 0);

  // Recent orders
  const recentOrders = orders.slice(0, 5);
  const recentPreorders = preorders.filter(p => p.status === 'pending' || p.status === 'confirmed').slice(0, 5);

  return (
    <div>
      <div className="page-topbar">
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Sessional Dashboard</div>
          <div style={{ fontSize: 11, color: '#888880', marginTop: 2 }}>Festival &amp; seasonal business overview</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            style={{ border: '0.5px solid #D0D0CC', borderRadius: 7, padding: '5px 10px', fontSize: 13, background: '#fff' }}
            value={year}
            onChange={e => setYear(Number(e.target.value))}
          >
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button style={btnPrimary} onClick={() => onNavigate('seasonal_billing')}>+ New Bill</button>
        </div>
      </div>

      <div className="page-content">
        {/* Sales stats */}
        <div className="g4" style={{ marginBottom: 14 }}>
          <StatCard label="Total Orders" value={String(orders.length)} sub={`${year}`} />
          <StatCard label="Total Sales" value={`₹${totalSales.toLocaleString()}`} sub="All orders" />
          <StatCard label="Collected" value={`₹${totalPaid.toLocaleString()}`} sub={`${orders.filter(o => o.is_paid).length} paid`} subColor="#3B6D11" />
          <StatCard label="Pending Collection" value={`₹${totalUnpaid.toLocaleString()}`} sub={`${orders.filter(o => !o.is_paid).length} unpaid`} subColor={totalUnpaid > 0 ? '#C0392B' : '#3B6D11'} />
        </div>

        {/* Pre-order stats */}
        <div className="g4" style={{ marginBottom: 14 }}>
          <StatCard label="Active Pre-orders" value={String(activePreorders.length)} sub="Pending + Confirmed" subColor="#1565C0" />
          <StatCard label="Pre-order Value" value={`₹${totalPreorderVal.toLocaleString()}`} sub="Open pre-orders" />
          <StatCard label="Advance Collected" value={`₹${totalAdvance.toLocaleString()}`} sub="From pre-orders" subColor="#3B6D11" />
          <StatCard label="Balance (Pre-orders)" value={`₹${Math.max(0, totalPreorderVal - totalAdvance).toLocaleString()}`} sub="Yet to collect" subColor="#E65100" />
        </div>

        <div className="g2" style={{ marginBottom: 14 }}>
          {/* Occasion breakdown */}
          <div style={card}>
            <div style={cardTitle}>
              Sales by Occasion
              <span style={cardLink} onClick={() => onNavigate('seasonal_billing')}>View all →</span>
            </div>
            {occBreakdown.length === 0 ? (
              <div style={{ color: '#888880', fontSize: 12 }}>No data for {year}</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '0.5px solid #F0F0EC' }}>
                    <th style={{ textAlign: 'left', padding: '6px 0', color: '#888880', fontWeight: 600 }}>Occasion</th>
                    <th style={{ textAlign: 'right', padding: '6px 0', color: '#888880', fontWeight: 600 }}>Orders</th>
                    <th style={{ textAlign: 'right', padding: '6px 0', color: '#888880', fontWeight: 600 }}>Sales</th>
                    <th style={{ textAlign: 'right', padding: '6px 0', color: '#888880', fontWeight: 600 }}>Pre-orders</th>
                  </tr>
                </thead>
                <tbody>
                  {occBreakdown.map(b => (
                    <tr key={b.id} style={{ borderBottom: '0.5px solid #F5F5F2' }}>
                      <td style={{ padding: '7px 0', fontWeight: 500 }}>{b.name}</td>
                      <td style={{ padding: '7px 0', textAlign: 'right', color: '#555' }}>{b.orderCount}</td>
                      <td style={{ padding: '7px 0', textAlign: 'right', fontWeight: 600, color: '#1A237E' }}>₹{b.sales.toLocaleString()}</td>
                      <td style={{ padding: '7px 0', textAlign: 'right', color: b.preorderCount > 0 ? '#E65100' : '#AAAAAA' }}>
                        {b.preorderCount > 0 ? b.preorderCount : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Quick actions */}
          <div style={card}>
            <div style={cardTitle}>Quick Actions</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { icon: '🍬', label: 'New Bill',      page: 'seasonal_billing',  bg: '#EEF0FB' },
                { icon: '📋', label: 'Pre-Booking',   page: 'seasonal_billing',  bg: '#FFF3E0' },
                { icon: '🪔', label: 'Manage Items',  page: 'seasonal_items',    bg: '#EAF3DE' },
                { icon: '🎊', label: 'Occasions',     page: 'seasonal_occasions',bg: '#FEECF8' },
              ].map(a => (
                <div key={a.label} onClick={() => onNavigate(a.page as Page)}
                  style={{ background: a.bg, padding: '12px', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18 }}>{a.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{a.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="g2">
          {/* Recent orders */}
          <div style={card}>
            <div style={cardTitle}>
              Recent Orders
              <span style={cardLink} onClick={() => onNavigate('seasonal_billing')}>View all →</span>
            </div>
            {recentOrders.length === 0 ? (
              <div style={{ color: '#888880', fontSize: 12 }}>No orders for {year}</div>
            ) : (
              recentOrders.map(order => (
                <div key={order.id} style={orderRow}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{order.customer_name}</div>
                    <div style={{ fontSize: 11, color: '#888880', marginTop: 1 }}>
                      {order.occasion_id ? occMap[order.occasion_id] || '—' : '—'} · {order.items.length} item(s)
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>₹{order.total_amount.toLocaleString()}</div>
                    <div style={{ fontSize: 11, marginTop: 1, color: order.is_paid ? '#3B6D11' : '#C0392B' }}>
                      {order.is_paid ? 'Paid' : 'Unpaid'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Active pre-orders */}
          <div style={card}>
            <div style={cardTitle}>
              Active Pre-orders
              <span style={cardLink} onClick={() => onNavigate('seasonal_billing')}>View all →</span>
            </div>
            {recentPreorders.length === 0 ? (
              <div style={{ color: '#888880', fontSize: 12 }}>No active pre-orders for {year}</div>
            ) : (
              recentPreorders.map(p => (
                <div key={p.id} style={orderRow}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{p.customer_name}</div>
                    <div style={{ fontSize: 11, color: '#888880', marginTop: 1 }}>
                      {p.occasion_id ? occMap[p.occasion_id] || '—' : '—'}
                      {p.delivery_date ? ` · Deliver: ${new Date(p.delivery_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>₹{p.total_amount.toLocaleString()}</div>
                    <span style={{
                      fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 600,
                      background: STATUS_COLORS[p.status]?.bg || '#F5F5F0',
                      color: STATUS_COLORS[p.status]?.color || '#555',
                    }}>
                      {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string; sub: string; subColor?: string }> = ({ label, value, sub, subColor }) => (
  <div style={{ background: '#FFFFFF', border: '0.5px solid #E5E5E0', borderRadius: 12, padding: '14px 16px' }}>
    <div style={{ fontSize: 11, color: '#888880', marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 600 }}>{value}</div>
    <div style={{ fontSize: 11, color: subColor || '#AAAAAA', marginTop: 3 }}>{sub}</div>
  </div>
);

const btnPrimary: React.CSSProperties = { background: '#1A237E', color: '#fff', border: 'none', padding: '7px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 };
const card: React.CSSProperties = { background: '#FFFFFF', border: '0.5px solid #E5E5E0', borderRadius: 12, padding: 16, marginBottom: 0 };
const cardTitle: React.CSSProperties = { fontSize: 13, fontWeight: 600, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
const cardLink: React.CSSProperties = { fontSize: 12, color: '#378ADD', cursor: 'pointer', fontWeight: 400 };
const orderRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '0.5px solid #F0F0EC' };

export default SeasonalDashboard;
