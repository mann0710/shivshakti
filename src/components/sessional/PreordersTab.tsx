import React, { useMemo, useState } from 'react';
import { SeasonalPreorder } from '../../hooks/useSeasonalPreorders';
import { SeasonalOccasion } from '../../hooks/useSeasonalOccasions';
import { useSeasonalItems } from '../../hooks/useSeasonalItems';
import { usePreorderActions } from '../../hooks/usePreorderActions';
import { useStoredState } from '../../hooks/useStoredState';
import { preorderReceipt, printReceipt, shareReceipt, formatDay } from '../../lib/sessionalReceipts';
import { buildSheet, sheetHtml } from '../../lib/preorderSheet';
import { isOpenPreorder as isOpen, balanceOf, STATUS_LABEL, FULFILLMENT_LABEL, fulfillmentOf } from '../../lib/preorders';
import { printHtml } from '../../lib/receipt';
import { formatLineSize } from '../../lib/units';
import { inr, cleanPhone } from '../../lib/money';
import { todayIST } from '../../lib/ist';
import PrepList from './PrepList';
import PreorderSheet from './PreorderSheet';
import { card, btnSm, inp, empty, pill, segBtn, segWrap, PRE_STATUS, NAVY, DANGER } from '../ui/styles';

interface Props {
  preorders: SeasonalPreorder[];
  occasions: SeasonalOccasion[];
  gst?: string;
  onEdit: (p: SeasonalPreorder) => void;
}

type Show = 'open' | 'due' | 'done' | 'all';
type View = 'sheet' | 'list';
const SHOW_LABEL: Record<Show, string> = { open: 'Open', due: 'Due by tomorrow', done: 'Done', all: 'All' };

// Pre-bookings as a register (to-do sheet) or cards, with hand-over, balance collection and a prep list.
const PreordersTab: React.FC<Props> = ({ preorders, occasions, gst, onEdit }) => {
  const { data: items = [] } = useSeasonalItems();
  const actions = usePreorderActions();
  const [prefs, setPrefs] = useStoredState<{ view: View }>('shivshakti.preorderView', () => ({ view: 'sheet' }));
  const view = prefs.view;
  const setView = (v: View) => setPrefs({ view: v });
  const [show, setShow] = useState<Show>('open');
  const [q, setQ] = useState('');
  const today = todayIST();
  const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const occName = (id?: string) => occasions.find(o => o.id === id)?.name;

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const digits = cleanPhone(q);
    return preorders
      .filter(p => show === 'all' ? true : show === 'done' ? !isOpen(p)
        : show === 'due' ? isOpen(p) && !!p.delivery_date && p.delivery_date <= tomorrow : isOpen(p))
      .filter(p => !term || p.customer_name.toLowerCase().includes(term) || (digits.length >= 3 && (p.phone ?? '').includes(digits)))
      .sort((a, b) => (a.delivery_date || '9').localeCompare(b.delivery_date || '9'));
  }, [preorders, show, q, tomorrow]);

  const dueCount = preorders.filter(p => isOpen(p) && p.delivery_date && p.delivery_date <= tomorrow).length;
  const receipt = (p: SeasonalPreorder) => preorderReceipt(p, occName(p.occasion_id), gst);
  const printSheet = () => printHtml(sheetHtml(buildSheet(shown, items), `Pre-booking register · ${SHOW_LABEL[show]}`));

  const { changeStatus, remove } = actions;

  return (
    <div>
      <PrepList preorders={preorders} />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ ...segWrap, minWidth: 300 }}>
          {([['open', SHOW_LABEL.open], ['due', `${SHOW_LABEL.due} (${dueCount})`], ['done', SHOW_LABEL.done], ['all', SHOW_LABEL.all]] as [Show, string][]).map(([k, label]) => (
            <button key={k} type="button" style={segBtn(show === k)} onClick={() => setShow(k)}>{label}</button>
          ))}
        </div>
        <input style={{ ...inp, flex: '1 1 200px', width: 'auto' }} value={q} onChange={e => setQ(e.target.value)} placeholder="Search name or mobile" />
        <div style={segWrap} role="group" aria-label="View">
          {([['sheet', '▦ Sheet'], ['list', '☰ List']] as [View, string][]).map(([k, label]) => (
            <button key={k} type="button" style={segBtn(view === k)} aria-pressed={view === k} onClick={() => setView(k)}>{label}</button>
          ))}
        </div>
        {view === 'sheet' && shown.length > 0 && <button style={btnSm} onClick={printSheet}>🖨 Print sheet</button>}
      </div>

      {view === 'sheet' ? (
        <PreorderSheet preorders={shown} items={items} onPacked={actions.togglePacked} onHandover={actions.startHandover}
          onOpen={p => (isOpen(p) ? onEdit(p) : printReceipt(receipt(p)))} />
      ) : shown.length === 0 ? <div style={empty}>No pre-bookings here.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {shown.map(p => {
            const late = isOpen(p) && p.delivery_date && p.delivery_date < today;
            return (
              <div key={p.id} style={{ ...card, padding: 14, marginBottom: 0, borderColor: late ? '#F5B7B1' : '#E5E5E0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{p.customer_name}</div>
                    <div style={{ fontSize: 11, color: '#888880' }}>{[p.phone, p.address].filter(Boolean).join(' · ')}</div>
                    {p.delivery_date && (
                      <div style={{ fontSize: 12, fontWeight: 600, marginTop: 3, color: late ? DANGER : '#E65100' }}>
                        {late ? '⚠ Overdue · ' : fulfillmentOf(p) === 'pickup' ? '🏪 ' : '🚚 '}{p.delivery_date === today ? 'Today' : p.delivery_date === tomorrow ? 'Tomorrow' : formatDay(p.delivery_date)}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: '#888880' }}>{FULFILLMENT_LABEL[fulfillmentOf(p)]}</div>
                    {occName(p.occasion_id) && <span style={{ ...pill('#EEF0FB', NAVY), marginTop: 4 }}>{occName(p.occasion_id)}</span>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>{inr(p.total_amount)}</div>
                    {p.advance_paid > 0 && <div style={{ fontSize: 11, color: '#3B6D11' }}>Advance {inr(p.advance_paid)}</div>}
                    {balanceOf(p) > 0 && <div style={{ fontSize: 11, color: '#E65100' }}>Balance {inr(balanceOf(p))}</div>}
                    <span style={{ ...pill(PRE_STATUS[p.status]?.bg ?? '#F5F5F0', PRE_STATUS[p.status]?.color ?? '#555'), marginTop: 4, }}>{STATUS_LABEL[p.status]}</span>
                  </div>
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: '#555', lineHeight: 1.6 }}>
                  {p.items.map((it, i) => <span key={i} style={{ marginRight: 10 }}>{it.item_name} ({formatLineSize(it.weight, it.weight_unit)}) ×{it.qty}</span>)}
                </div>
                {p.notes && <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>📝 {p.notes}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  {p.status === 'pending' && <button style={{ ...btnSm, color: '#1565C0' }} onClick={() => changeStatus(p, 'confirmed')}>Confirm</button>}
                  {p.status === 'confirmed' && <button style={{ ...btnSm, color: '#1565C0' }} onClick={() => actions.togglePacked(p)}>Mark packed</button>}
                  {isOpen(p) && <button style={{ ...btnSm, color: '#2E7D32', background: '#E8F5E9' }} onClick={() => actions.startHandover(p)}>Hand over & collect</button>}
                  <button style={btnSm} onClick={() => printReceipt(receipt(p))}>🖨 Print</button>
                  {p.phone && <button style={{ ...btnSm, color: '#128C7E' }} onClick={() => shareReceipt(receipt(p))}>WhatsApp</button>}
                  {isOpen(p) && <button style={btnSm} onClick={() => onEdit(p)}>Edit</button>}
                  {isOpen(p) && <button style={{ ...btnSm, color: '#888880' }} onClick={() => changeStatus(p, 'cancelled')}>Cancel</button>}
                  <button style={{ ...btnSm, color: DANGER }} onClick={() => remove(p)}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {actions.ui}
    </div>
  );
};

export default PreordersTab;
