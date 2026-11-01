import React, { useMemo, useState } from 'react';
import { SeasonalPreorder } from '../../hooks/useSeasonalPreorders';
import { formatSize } from '../../lib/units';
import { formatDay } from '../../lib/sessionalReceipts';
import { printHtml } from '../../lib/receipt';
import { downloadDoc } from '../../lib/docs/output';
import { fileSafe, Doc } from '../../lib/docs/quotationDoc';
import { printedNow, spanLabel, sweetSizes, SweetSizes } from '../../lib/preorderPrint';
import { ALL_DATES, DateSpan, inDateSpan } from '../../lib/preorders';
import { page, esc } from '../../lib/docs/theme';
import { slimHeader, sectionHead, docTable } from '../../lib/docs/parts';
import { docContext } from '../../lib/docs/context';
import PickupDates from './PickupDates';
import { card, th, td, empty, NAVY } from '../ui/styles';

// Kitchen prep sheet: how much of each sweet to make for open pre-bookings, by delivery date.
export function prepByDate(preorders: SeasonalPreorder[]) {
  const open = preorders.filter(p => p.status === 'pending' || p.status === 'confirmed'); // packed ones are already made
  const dates = Array.from(new Set(open.map(p => p.delivery_date || ''))).sort((a, b) => (a || '9').localeCompare(b || '9'));
  return dates.map(date => {
    const list = open.filter(p => (p.delivery_date || '') === date);
    return { date, orders: list.length, items: sweetSizes(list.flatMap(p => p.items.map(l => ({ l })))) };
  });
}

// "1 kg × 20", "500 g × 1": pack size times how many, biggest pack first.
export const packSizes = (s: SweetSizes) => s.sizes.map(([w, q]) => `${formatSize(w, s.unit)} × ${q}`);

// Same column widths for every day, so Packs and Total line up down the page.
const WIDTHS = ['36%', '46%', '18%'];
const COL_CSS = `<style>.t { table-layout: fixed; }${WIDTHS.map((w, i) => ` .t th:nth-child(${i + 1}) { width: ${w}; }`).join('')}</style>`;

// Printable prep list in the document style; `dates` is the pickup filter ('' for all).
function prepHtml(days: ReturnType<typeof prepByDate>, dates: string): string {
  const ctx = docContext();
  const body = days.map(d => `<section>${sectionHead(d.date ? formatDay(d.date) : 'No date', `${d.orders} order${d.orders === 1 ? '' : 's'}`)}${
    docTable(['Item', 'Packs', 'Total'], d.items.map(i => [`<b>${esc(i.name)}</b>`, packSizes(i).map(x => `<b>${esc(x)}</b>`).join(' + '), formatSize(i.amount, i.unit)]), undefined, 2)}</section>`).join('');
  return page('Kitchen prep list', ctx.settings.accent, `${slimHeader(ctx, 'Kitchen', 'Prep list', `${dates ? `Pickup ${esc(dates)}` : 'Open pre-bookings'}<br>Printed ${esc(printedNow())}`)}<div class="wrap">${COL_CSS}${body}</div>`);
}

export const prepDoc = (days: ReturnType<typeof prepByDate>, dates: string): Doc => ({
  html: prepHtml(days, dates),
  fileName: `${fileSafe(`Kitchen prep ${dates || 'all dates'}`)}.pdf`,
  footer: `Kitchen prep list${dates ? ` · ${dates}` : ''}`,
});

// Its own pickup-date filter drives the screen, Print and Download PDF.
const PrepList: React.FC<{ preorders: SeasonalPreorder[] }> = ({ preorders }) => {
  const [span, setSpan] = useState<DateSpan>(ALL_DATES);
  const dates = spanLabel(span);
  const all = useMemo(() => prepByDate(preorders), [preorders]);
  const days = useMemo(() => all.filter(d => inDateSpan({ delivery_date: d.date }, span)), [all, span]);
  if (!all.length) return null;

  const make = () => prepDoc(days, dates);
  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>👩‍🍳 Kitchen prep list · {dates || 'all open pre-bookings'}</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <PickupDates label="Kitchen prep dates" value={span} onChange={setSpan} />
          {days.length > 0 && <>
            <button type="button" className="ui-btn primary" onClick={() => downloadDoc(make)}>Download PDF</button>
            <button type="button" className="ui-btn" onClick={() => printHtml(make().html)}>Print</button>
          </>}
        </div>
      </div>
      {!days.length && <div style={empty}>Nothing to make for these dates.</div>}
      {days.map(d => (
        <div key={d.date} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#E65100', marginBottom: 4 }}>
            {d.date ? formatDay(d.date) : 'No delivery date'} · {d.orders} order{d.orders === 1 ? '' : 's'}
          </div>
          <div className="table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
              <colgroup>{WIDTHS.map(w => <col key={w} style={{ width: w }} />)}</colgroup>
              <thead><tr style={{ background: '#F5F5F2' }}><th style={th}>Item</th><th style={th}>Packs</th><th style={th}>Total</th></tr></thead>
              <tbody>
                {d.items.map(i => (
                  <tr key={i.key} style={{ borderBottom: '0.5px solid #F0F0EC' }}>
                    <td style={td}>{i.name}</td>
                    <td style={{ ...td, fontWeight: 700 }}>
                      {packSizes(i).map((x, k) => <React.Fragment key={x}>{k > 0 && <span style={{ fontWeight: 400 }}> + </span>}<span style={{ whiteSpace: 'nowrap' }}>{x}</span></React.Fragment>)}
                    </td>
                    <td style={td}>{formatSize(i.amount, i.unit)}</td>
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
