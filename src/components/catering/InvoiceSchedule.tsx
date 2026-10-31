import React from 'react';
import { MealRow } from '../../lib/invoiceEdit';
import { inr } from '../../lib/money';

interface Props { rows: MealRow[]; onEdit: (row: MealRow, patch: { guests?: number; rate?: number }) => void }

const num = (v: string) => Math.max(0, parseInt(v.replace(/\D/g, ''), 10) || 0);

// "What was served · final counts": guests and plate rate per meal, saved as you type.
const InvoiceSchedule: React.FC<Props> = ({ rows, onEdit }) => (
  <section aria-label="Meals" className="iv-sec">
    <h2>What was served · final counts</h2>
    {rows.map(r => (
      <div key={r.key} className={`iv-meal${r.warn ? ' warn' : ''}`}>
        <div className="iv-meal-grid">
          <span className="mx-two-line"><b>{r.name}</b>{r.note && <span className={r.warn ? 'mx-amber' : undefined}>{r.note}</span>}</span>
          {r.rate > 0 ? (
            <>
              <label className="mx-field">Guests
                <input className="iv-num" inputMode="numeric" value={r.guests || ''} aria-label={`${r.name} guests`} onChange={e => onEdit(r, { guests: num(e.target.value) })} />
              </label>
              <label className="mx-field">A plate
                <input className="iv-num" inputMode="numeric" value={`₹${r.rate}`} disabled={!r.rateEditable} aria-label={`${r.name} plate rate`}
                  title={r.rateEditable ? undefined : 'Comes from the quote'} onChange={e => onEdit(r, { rate: num(e.target.value) })} />
              </label>
            </>
          ) : <><span /><span /></>}
          <b className="tot">{inr(r.total)}</b>
        </div>
        {r.dishes.length > 0 && <span className="dishes">{r.dishes.join(' · ')}</span>}
      </div>
    ))}
  </section>
);

export default InvoiceSchedule;
