import React, { useMemo, useState } from 'react';
import { SeasonalPreorder } from '../../hooks/useSeasonalPreorders';
import { SeasonalOccasion } from '../../hooks/useSeasonalOccasions';
import { useSeasonalItems } from '../../hooks/useSeasonalItems';
import { usePreorderActions } from '../../hooks/usePreorderActions';
import { useStoredState } from '../../hooks/useStoredState';
import { preorderReceipt, printReceipt, shareReceipt, formatDay } from '../../lib/sessionalReceipts';
import { buildSheet, sheetHtml } from '../../lib/preorderSheet';
import { isOpenPreorder as isOpen, isPacked, balanceOf, STATUS_LABEL, FULFILLMENT_LABEL, fulfillmentOf } from '../../lib/preorders';
import { printHtml } from '../../lib/receipt';
import { formatLineSize } from '../../lib/units';
import { inr, cleanPhone } from '../../lib/money';
import { todayIST } from '../../lib/ist';
import PrepList from './PrepList';
import PreorderSheet from './PreorderSheet';
import PreorderDetail from './PreorderDetail';
import { card, inp, empty, pill, segBtn, segWrap, PRE_STATUS, NAVY, NAVY_SOFT, DANGER } from '../ui/styles';

interface Props {
  preorders: SeasonalPreorder[];
  occasions: SeasonalOccasion[];
  gst?: string;
  onEdit: (p: SeasonalPreorder) => void;
}

type Show = 'open' | 'due' | 'done' | 'all';
type View = 'sheet' | 'list';
const SHOW_LABEL: Record<Show, string> = { open: 'Open', due: 'Due by tomorrow', done: 'Done', all: 'All' };
const dueBy = (p: SeasonalPreorder, day: string) => isOpen(p) && !!p.delivery_date && p.delivery_date <= day;

// Pre-bookings as a register (to-do sheet) or cards: Booked → Packed → Handed over; a name opens the booking.
const PreordersTab: React.FC<Props> = ({ preorders, occasions, gst, onEdit }) => {
  const { data: items = [] } = useSeasonalItems();
  const actions = usePreorderActions();
  const [prefs, setPrefs] = useStoredState<{ view: View }>('shivshakti.preorderView', () => ({ view: 'sheet' }));
  const view = prefs.view;
  const [show, setShow] = useState<Show>('open');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const today = todayIST();
  const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const occName = (id?: string) => occasions.find(o => o.id === id)?.name;

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const digits = cleanPhone(q);
    return preorders
      .filter(p => (show === 'all' ? true : show === 'done' ? !isOpen(p) : show === 'due' ? dueBy(p, tomorrow) : isOpen(p)))
      .filter(p => !term || p.customer_name.toLowerCase().includes(term) || (digits.length >= 3 && (p.phone ?? '').includes(digits)))
      .sort((a, b) => (a.delivery_date || '9').localeCompare(b.delivery_date || '9'));
  }, [preorders, show, q, tomorrow]);

  const dueCount = preorders.filter(p => dueBy(p, tomorrow)).length;
  const receipt = (p: SeasonalPreorder) => preorderReceipt(p, occName(p.occasion_id), gst);
  const printSheet = () => printHtml(sheetHtml(buildSheet(shown, items), `Pre-booking register · ${SHOW_LABEL[show]}`));
  const opened = openId ? preorders.find(p => p.id === openId) : undefined;

  return (
    <div>
      <PrepList preorders={preorders} />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ ...segWrap, minWidth: 300 }}>
          {([['open', SHOW_LABEL.open], ['due', `${SHOW_LABEL.due} (${dueCount})`], ['done', SHOW_LABEL.done], ['all', SHOW_LABEL.all]] as [Show, string][]).map(([k, label]) => (
            <button key={k} type="button" style={{ ...segBtn(show === k), minHeight: 44 }} aria-pressed={show === k} onClick={() => setShow(k)}>{label}</button>
          ))}
        </div>
        <input style={{ ...inp, flex: '1 1 200px', width: 'auto', minHeight: 44 }} value={q} onChange={e => setQ(e.target.value)} placeholder="Search name or mobile" />
        <div style={segWrap} role="group" aria-label="View">
          {([['sheet', 'Sheet'], ['list', 'List']] as [View, string][]).map(([k, label]) => (
            <button key={k} type="button" style={{ ...segBtn(view === k), minHeight: 44 }} aria-pressed={view === k} onClick={() => setPrefs({ view: k })}>{label}</button>
          ))}
        </div>
        {view === 'sheet' && shown.length > 0 && <button type="button" className="ui-btn" onClick={printSheet}>Print sheet</button>}
      </div>

      {view === 'sheet' ? (
        <PreorderSheet preorders={shown} items={items} onPacked={actions.togglePacked} onHandover={actions.startHandover} onOpen={p => setOpenId(p.id)} />
      ) : shown.length === 0 ? <div style={empty}>No pre-bookings here.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {shown.map(p => {
            const late = isOpen(p) && !!p.delivery_date && p.delivery_date < today;
            const due = balanceOf(p);
            return (
              <div key={p.id} style={{ ...card, padding: 14, marginBottom: 0, borderColor: late ? '#F5B7B1' : '#E5E5E0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <div>
                    <button type="button" className="sheet-name" style={{ fontSize: 14, minHeight: 44 }} onClick={() => setOpenId(p.id)}>{p.customer_name}</button>
                    <div style={{ fontSize: 12, color: '#5A5A55' }}>{[p.phone, p.address].filter(Boolean).join(' · ')}</div>
                    {p.delivery_date && (
                      <div style={{ fontSize: 12, fontWeight: 600, marginTop: 3, color: late ? DANGER : '#B45309' }}>
                        {late ? 'Overdue · ' : ''}{p.delivery_date === today ? 'Today' : p.delivery_date === tomorrow ? 'Tomorrow' : formatDay(p.delivery_date)} · {FULFILLMENT_LABEL[fulfillmentOf(p)]}
                      </div>
                    )}
                    {occName(p.occasion_id) && <span style={{ ...pill(NAVY_SOFT, NAVY), marginTop: 4 }}>{occName(p.occasion_id)}</span>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: NAVY }}>{inr(p.total_amount)}</div>
                    {p.advance_paid > 0 && <div style={{ fontSize: 12, color: '#3B6D11' }}>Paid {inr(p.advance_paid)}</div>}
                    {due > 0 && p.status !== 'cancelled' && <div style={{ fontSize: 12, color: '#B45309' }}>Balance {inr(due)}</div>}
                    <span style={{ ...pill(PRE_STATUS[p.status]?.bg ?? '#F5F5F0', PRE_STATUS[p.status]?.color ?? '#555'), marginTop: 4 }}>{STATUS_LABEL[p.status]}</span>
                  </div>
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: '#4A4A45', lineHeight: 1.6 }}>
                  {p.items.map((it, i) => <span key={i} style={{ marginRight: 10 }}>{it.item_name} ({formatLineSize(it.weight, it.weight_unit)}) ×{it.qty}</span>)}
                </div>
                {p.notes && <div style={{ fontSize: 12, color: '#5A5A55', marginTop: 4 }}>Note: {p.notes}</div>}
                <div className="pos-tools" style={{ marginTop: 10 }}>
                  {isOpen(p) && <button type="button" className="ui-btn primary" onClick={() => actions.startHandover(p)}>Hand over</button>}
                  {isOpen(p) && <button type="button" className="ui-btn" onClick={() => actions.togglePacked(p)}>{isPacked(p) ? 'Not packed yet' : 'Mark packed'}</button>}
                  {p.status === 'delivered' && due > 0 && <button type="button" className="ui-btn primary" onClick={() => actions.startCollect(p)}>Collect {inr(due)}</button>}
                  <button type="button" className="ui-btn" onClick={() => setOpenId(p.id)}>Open</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {opened && (
        <PreorderDetail p={opened} occasion={occName(opened.occasion_id)} actions={actions} onClose={() => setOpenId(null)}
          onEdit={() => onEdit(opened)} onPrint={() => printReceipt(receipt(opened))} onShare={() => shareReceipt(receipt(opened))} />
      )}
      {actions.ui}
    </div>
  );
};

export default PreordersTab;
