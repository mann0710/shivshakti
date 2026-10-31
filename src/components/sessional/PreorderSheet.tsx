import React, { useMemo } from 'react';
import { SeasonalPreorder } from '../../hooks/useSeasonalPreorders';
import { SeasonalItem } from '../../lib/itemCatalog';
import { buildSheet, columnTotal, dueLabel } from '../../lib/preorderSheet';
import { balanceOf, isOpenPreorder, isPacked, STATUS_LABEL } from '../../lib/preorders';
import { inr } from '../../lib/money';
import { todayIST } from '../../lib/ist';
import { PRE_STATUS, NAVY, DANGER, SUCCESS, MUTED } from '../ui/styles';

interface Props {
  preorders: SeasonalPreorder[];
  items: SeasonalItem[];
  onPacked: (p: SeasonalPreorder) => void;
  onHandover: (p: SeasonalPreorder) => void;
  onOpen: (p: SeasonalPreorder) => void;
}

// The paper register as a to-do list: tick Packed, tick Given (collects the balance), tap a name to open the booking.
const PreorderSheet: React.FC<Props> = ({ preorders, items, onPacked, onHandover, onOpen }) => {
  const sheet = useMemo(() => buildSheet(preorders, items), [preorders, items]);
  const today = todayIST();
  const live = preorders.filter(p => p.status !== 'cancelled');
  const packed = live.filter(isPacked).length;
  const given = live.filter(p => p.status === 'delivered').length;

  if (!sheet.rows.length) return <div style={{ color: MUTED, fontSize: 13, textAlign: 'center', padding: 32 }}>No pre-bookings here.</div>;

  return (
    <div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10, fontSize: 12 }}>
        <Progress label="Packed" done={packed} of={live.length} color="#1565C0" />
        <Progress label="Given" done={given} of={live.length} color={SUCCESS} />
        <span style={{ color: '#E65100', fontWeight: 600 }}>Balance to collect {inr(sheet.balance)}</span>
      </div>
      <div className="table-wrap sheet-wrap">
        <table className="pre-sheet">
          <thead>
            <tr>
              <th className="stick s0">Packed</th><th className="stick s1">Given</th><th className="stick s2">Customer</th><th>Date</th>
              {sheet.columns.map(c => <th key={c.key}>{c.name}<small>{c.rate}</small></th>)}
              <th className="r">Total</th><th className="r">Paid</th><th className="r">Balance</th>
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map(({ p, cells }) => {
              const open = isOpenPreorder(p);
              const late = open && !!p.delivery_date && p.delivery_date < today;
              const tone = PRE_STATUS[p.status];
              return (
                <tr key={p.id} className={p.status === 'cancelled' ? 'x' : p.status === 'delivered' ? 'done' : ''}>
                  <td className="stick s0 c">
                    <input type="checkbox" aria-label={`Packed for ${p.customer_name}`} checked={isPacked(p)}
                      disabled={!open} onChange={() => onPacked(p)} />
                  </td>
                  <td className="stick s1 c">
                    <input type="checkbox" aria-label={`Given to ${p.customer_name}`} checked={p.status === 'delivered'}
                      disabled={!open} onChange={() => onHandover(p)} />
                  </td>
                  <td className="stick s2">
                    <button type="button" className="sheet-name" onClick={() => onOpen(p)}>{p.customer_name}</button>
                    <div style={{ color: MUTED, fontSize: 12 }}>{p.phone}</div>
                  </td>
                  <td style={{ whiteSpace: 'nowrap', color: late ? DANGER : undefined }}>
                    {late && '⚠ '}{dueLabel(p)}
                    <div><span style={{ fontSize: 12, padding: '1px 6px', borderRadius: 10, background: tone?.bg, color: tone?.color, fontWeight: 600 }}>{STATUS_LABEL[p.status]}</span></div>
                  </td>
                  {sheet.columns.map(c => <td key={c.key} className="q">{cells[c.key] ?? ''}</td>)}
                  <td className="r">{inr(p.total_amount)}</td>
                  <td className="r" style={{ color: SUCCESS }}>{inr(p.advance_paid)}</td>
                  <td className="r" style={{ fontWeight: 700, color: balanceOf(p) ? '#E65100' : SUCCESS }}>{p.status === 'cancelled' ? '—' : inr(balanceOf(p))}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td className="stick s0" /><td className="stick s1" /><td className="stick s2">Total quantity</td><td />
              {sheet.columns.map(c => <td key={c.key} className="q">{columnTotal(c)}</td>)}
              <td className="r">{inr(sheet.total)}</td><td className="r">{inr(sheet.paid)}</td><td className="r">{inr(sheet.balance)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

const Progress: React.FC<{ label: string; done: number; of: number; color: string }> = ({ label, done, of, color }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
    <b style={{ color: NAVY }}>{label} {done}/{of}</b>
    <span style={{ width: 80, height: 6, background: '#EEE', borderRadius: 3, overflow: 'hidden' }}>
      <span style={{ display: 'block', height: '100%', width: `${of ? (done / of) * 100 : 0}%`, background: color }} />
    </span>
  </span>
);

export default PreorderSheet;
