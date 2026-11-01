import React, { useMemo } from 'react';
import { SeasonalPreorder } from '../../hooks/useSeasonalPreorders';
import { totalsByItem } from '../../lib/cart';
import { nameKey } from '../../lib/itemCatalog';
import { formatSize } from '../../lib/units';
import { formatDay } from '../../lib/sessionalReceipts';
import { printHtml } from '../../lib/receipt';
import { downloadDoc } from '../../lib/docs/output';
import { fileSafe, Doc } from '../../lib/docs/quotationDoc';
import { printedNow } from '../../lib/preorderPrint';
import { page, esc } from '../../lib/docs/theme';
import { slimHeader, sectionHead, docTable } from '../../lib/docs/parts';
import { docContext } from '../../lib/docs/context';
import { card, th, td, NAVY } from '../ui/styles';

// Kitchen prep sheet: how much of each sweet to make for open pre-bookings, by delivery date.
export function prepByDate(preorders: SeasonalPreorder[]) {
  const open = preorders.filter(p => p.status === 'pending' || p.status === 'confirmed'); // packed ones are already made
  const dates = Array.from(new Set(open.map(p => p.delivery_date || ''))).sort((a, b) => (a || '9').localeCompare(b || '9'));
  return dates.map(date => {
    const list = open.filter(p => (p.delivery_date || '') === date);
    return { date, orders: list.length, items: totalsByItem(list.flatMap(p => p.items), l => nameKey(l.item_name)) };
  });
}

// Printable prep list in the document style; `dates` is the pickup filter ('' for all).
function prepHtml(days: ReturnType<typeof prepByDate>, dates: string): string {
  const ctx = docContext();
  const body = days.map(d => `<section>${sectionHead(d.date ? formatDay(d.date) : 'No date', `${d.orders} order${d.orders === 1 ? '' : 's'}`)}${
    docTable(['Item', 'Make', 'Packs'], d.items.map(i => [`<b>${esc(i.name)}</b>`, `<b>${formatSize(i.amount, i.unit)}</b>`, String(i.packs)]), undefined, 2)}</section>`).join('');
  return page('Kitchen prep list', ctx.settings.accent, `${slimHeader(ctx, 'Kitchen', 'Prep list', `${dates ? `Pickup ${esc(dates)}` : 'Open pre-bookings'}<br>Printed ${esc(printedNow())}`)}<div class="wrap">${body}</div>`);
}

export const prepDoc = (days: ReturnType<typeof prepByDate>, dates: string): Doc => ({
  html: prepHtml(days, dates),
  fileName: `${fileSafe(`Kitchen prep ${dates || 'all dates'}`)}.pdf`,
  footer: `Kitchen prep list${dates ? ` · ${dates}` : ''}`,
});

// `preorders` come already filtered to the pickup dates; `dates` names them.
const PrepList: React.FC<{ preorders: SeasonalPreorder[]; dates: string }> = ({ preorders, dates }) => {
  const days = useMemo(() => prepByDate(preorders), [preorders]);
  if (!days.length) return null;

  const make = () => prepDoc(days, dates);
  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>👩‍🍳 Kitchen prep list · {dates || 'all open pre-bookings'}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="ui-btn primary" onClick={() => downloadDoc(make)}>Download PDF</button>
          <button type="button" className="ui-btn" onClick={() => printHtml(make().html)}>Print</button>
        </div>
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
