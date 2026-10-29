import React, { useMemo } from 'react';
import { SeasonalPreorder } from '../../hooks/useSeasonalPreorders';
import { totalsByItem } from '../../lib/cart';
import { nameKey } from '../../lib/itemCatalog';
import { formatSize } from '../../lib/units';
import { formatDay } from '../../lib/sessionalReceipts';
import { printHtml } from '../../lib/receipt';
import { SHOP } from '../../lib/shop';
import { card, btnSm, th, td, NAVY } from '../ui/styles';

// Kitchen prep sheet: how much of each sweet to make for open pre-bookings, by delivery date.
export function prepByDate(preorders: SeasonalPreorder[]) {
  const open = preorders.filter(p => p.status === 'pending' || p.status === 'confirmed');
  const dates = Array.from(new Set(open.map(p => p.delivery_date || ''))).sort((a, b) => (a || '9').localeCompare(b || '9'));
  return dates.map(date => {
    const list = open.filter(p => (p.delivery_date || '') === date);
    return { date, orders: list.length, items: totalsByItem(list.flatMap(p => p.items), l => nameKey(l.item_name)) };
  });
}

const PrepList: React.FC<{ preorders: SeasonalPreorder[] }> = ({ preorders }) => {
  const days = useMemo(() => prepByDate(preorders), [preorders]);
  if (!days.length) return null;

  const print = () => printHtml(`<!doctype html><html><head><meta charset="utf-8"><title>Prep list</title>
<style>body{font:13px Arial;margin:16px} h1{font-size:18px} h2{font-size:14px;margin:16px 0 6px} table{border-collapse:collapse;width:100%} td,th{border:1px solid #999;padding:5px 8px;text-align:left}</style></head><body>
<h1>${SHOP.name} — Kitchen prep list</h1>
${days.map(d => `<h2>${d.date ? formatDay(d.date) : 'No date'} (${d.orders} orders)</h2><table><tr><th>Item</th><th>Total</th><th>Packs</th></tr>
${d.items.map(i => `<tr><td>${i.name}</td><td>${formatSize(i.amount, i.unit)}</td><td>${i.packs}</td></tr>`).join('')}</table>`).join('')}
</body></html>`);

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>👩‍🍳 Kitchen prep list (open pre-bookings)</div>
        <button style={btnSm} onClick={print}>🖨 Print</button>
      </div>
      {days.map(d => (
        <div key={d.date} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#E65100', marginBottom: 4 }}>
            {d.date ? formatDay(d.date) : 'No delivery date'} · {d.orders} order{d.orders === 1 ? '' : 's'}
          </div>
          <div className="table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: '#F5F5F2' }}><th style={th}>Item</th><th style={th}>Make</th><th style={th}>Packs</th></tr></thead>
              <tbody>
                {d.items.map(i => (
                  <tr key={i.key} style={{ borderBottom: '0.5px solid #F0F0EC' }}>
                    <td style={td}>{i.name}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{formatSize(i.amount, i.unit)}</td>
                    <td style={td}>{i.packs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};

export default PrepList;
