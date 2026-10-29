import React, { useMemo } from 'react';
import { SeasonalOrder } from '../../hooks/useSeasonalOrders';
import { SeasonalPreorder } from '../../hooks/useSeasonalPreorders';
import { SeasonalOccasion } from '../../hooks/useSeasonalOccasions';
import { totalsByItem } from '../../lib/cart';
import { nameKey } from '../../lib/itemCatalog';
import { formatSize } from '../../lib/units';
import { inr } from '../../lib/money';
import { salesReportPdf, unpaidReportPdf, itemSalesPdf } from '../../lib/sessionalReportPdf';
import { Stat } from './OrdersTab';
import { card, cardTitle, btnPrimary, th, td, empty, DANGER, SUCCESS } from '../ui/styles';

interface Props {
  year: number;
  orders: SeasonalOrder[];
  preorders: SeasonalPreorder[];
  occasions: SeasonalOccasion[];
}

// Year summary, money still to collect and item-wise sales, each downloadable as PDF.
const ReportsTab: React.FC<Props> = ({ year, orders, preorders, occasions }) => {
  const occName = (id?: string) => occasions.find(o => o.id === id)?.name;
  const sum = (l: { total_amount: number }[]) => l.reduce((s, o) => s + o.total_amount, 0);
  const paid = orders.filter(o => o.is_paid);
  const unpaid = orders.filter(o => !o.is_paid);
  const due = preorders.filter(p => p.status !== 'cancelled' && p.advance_paid < p.total_amount);
  const dueBalance = due.reduce((s, p) => s + p.total_amount - p.advance_paid, 0);
  const sold = useMemo(() => {
    const live = preorders.filter(p => p.status !== 'cancelled');
    return totalsByItem([...orders, ...live].flatMap(o => o.items), l => nameKey(l.item_name));
  }, [orders, preorders]);
  const byOcc = occasions
    .map(o => ({ name: o.name, total: sum(orders.filter(x => x.occasion_id === o.id)), bills: orders.filter(x => x.occasion_id === o.id).length }))
    .filter(o => o.bills > 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Summary for {year}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={btnPrimary} onClick={() => salesReportPdf(year, orders, occName)}>↓ Sales report</button>
          <button style={{ ...btnPrimary, background: '#A32D2D' }} onClick={() => unpaidReportPdf(year, orders, preorders)}>↓ Unpaid report</button>
          <button style={{ ...btnPrimary, background: '#0F6E56' }} onClick={() => itemSalesPdf(year, sold, orders.length, preorders.length)}>↓ Item sales</button>
        </div>
      </div>

      <div className="g4" style={{ marginBottom: 16 }}>
        <Stat label="Total sales" value={inr(sum(orders))} sub={`${orders.length} bills`} />
        <Stat label="Collected" value={inr(sum(paid))} sub={`${paid.length} paid`} color={SUCCESS} />
        <Stat label="Unpaid bills" value={inr(sum(unpaid))} sub={`${unpaid.length} unpaid`} color={unpaid.length ? DANGER : SUCCESS} />
        <Stat label="Pre-booking balance" value={inr(dueBalance)} sub={`${due.length} bookings`} color={dueBalance ? DANGER : SUCCESS} />
      </div>

      {byOcc.length > 0 && (
        <div style={card}>
          <div style={cardTitle}>Sales by occasion</div>
          {byOcc.map(o => (
            <div key={o.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '0.5px solid #F5F5F0' }}>
              <span>{o.name} <span style={{ color: '#888880' }}>· {o.bills} bills</span></span><b>{inr(o.total)}</b>
            </div>
          ))}
        </div>
      )}

      {unpaid.length > 0 && (
        <div style={card}>
          <div style={{ ...cardTitle, color: DANGER }}>Unpaid bills ({unpaid.length})</div>
          {unpaid.map(o => (
            <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '0.5px solid #F5F5F0', fontSize: 13 }}>
              <span>{o.customer_name} {o.phone && <span style={{ fontSize: 11, color: '#888880' }}>{o.phone}</span>}</span>
              <b style={{ color: DANGER }}>{inr(o.total_amount)}</b>
            </div>
          ))}
        </div>
      )}

      <div style={card}>
        <div style={{ ...cardTitle, color: '#0F6E56' }}>Item sales (bills + pre-bookings)</div>
        {sold.length === 0 ? <div style={empty}>No sales yet for {year}.</div> : (
          <div className="table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: '#EAF5EF' }}>
                <th style={th}>Item</th><th style={th}>Packs</th><th style={th}>Quantity</th><th style={th}>Revenue</th>
              </tr></thead>
              <tbody>
                {sold.map(s => (
                  <tr key={s.key} style={{ borderBottom: '0.5px solid #F0F0EC' }}>
                    <td style={{ ...td, fontWeight: 500 }}>{s.name}</td>
                    <td style={td}>{s.packs}</td>
                    <td style={{ ...td, fontWeight: 600, color: '#0F6E56' }}>{formatSize(s.amount, s.unit)}</td>
                    <td style={td}>{inr(s.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsTab;
