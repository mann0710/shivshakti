import React from 'react';
import { EventDay } from '../../hooks/useQuotations';
import { getDayNumber } from '../../lib/quoteMath';
import { formatDateIST } from '../../lib/ist';
import { genId } from './QuotationMultiDay';

export interface Charge { description: string; amount: number }
export type Discount = Charge & { id: string };

type Setter<T> = React.Dispatch<React.SetStateAction<T[]>>;

export interface QuotationTotals {
  mealSavings: number;
  discount: number;
  extra: number;
  transport: number;
  gst: number;
  multiDaySubtotal: number;
  perPlate: number;
  subtotal: number;
  final: number;
}

interface Props {
  isMultiDay: boolean;
  eventDays: EventDay[];
  totals: QuotationTotals;
  gstRate: number;
  gstChecked: boolean;
  setGstChecked: (v: boolean) => void;
  discounts: Discount[];
  setDiscounts: Setter<Discount>;
  extraCharges: Charge[];
  setExtraCharges: Setter<Charge>;
  transport: Charge[];
  setTransport: Setter<Charge>;
}

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const rowInp: React.CSSProperties = { border: '1px solid #E5E5E0', borderRadius: 7, padding: '6px 8px', background: '#fff' };

interface RowsProps<T extends Charge> {
  title: string;
  rows: T[];
  setRows: Setter<T>;
  newRow: () => T;
  color: string;
  addLabel: string;
  placeholder: string;
  emptyText: string;
  footer?: React.ReactNode;
}

// Editable description + amount rows (discounts, extra and transport charges).
function ChargeRows<T extends Charge>({ title, rows, setRows, newRow, color, addLabel, placeholder, emptyText, footer }: RowsProps<T>) {
  const patch = (i: number, change: Partial<Charge>) => setRows(prev => prev.map((r, j) => (j === i ? { ...r, ...change } : r)));
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#888880' }}>{title}</span>
        <button onClick={() => setRows(prev => [...prev, newRow()])}
          style={{ fontSize: 11, color, background: 'none', border: `1px solid ${color}`, borderRadius: 5, padding: '2px 8px', cursor: 'pointer' }}>{addLabel}</button>
      </div>
      {rows.length === 0 && <div style={{ fontSize: 11, color: '#AAAAAA' }}>{emptyText}</div>}
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
          <input placeholder={placeholder} value={r.description} onChange={e => patch(i, { description: e.target.value })}
            style={{ ...rowInp, flex: 1, minWidth: 0, fontSize: 12 }} />
          <input type="number" min="0" inputMode="decimal" placeholder="₹ Amount" value={r.amount || ''}
            onChange={e => patch(i, { amount: parseFloat(e.target.value) || 0 })}
            style={{ ...rowInp, width: 110, fontSize: 13, textAlign: 'right' }} />
          <button onClick={() => setRows(prev => prev.filter((_, j) => j !== i))} aria-label="Remove row"
            style={{ background: 'none', border: 'none', color: '#CC4444', fontSize: 18, cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}>×</button>
        </div>
      ))}
      {footer}
    </div>
  );
}

const sumLine = (text: string, color = '#444') => <div style={{ fontSize: 12, color, textAlign: 'right', fontWeight: 600 }}>{text}</div>;

// Discounts, extra/transport charges, GST and the payable amount.
const QuotationCharges: React.FC<Props> = ({
  isMultiDay, eventDays, totals, gstRate, gstChecked, setGstChecked,
  discounts, setDiscounts, extraCharges, setExtraCharges, transport, setTransport,
}) => (
  <div style={{ marginTop: 14, background: '#F9F8F5', borderRadius: 10, padding: '14px 16px', border: '0.5px solid #E5E5E0' }}>
    {isMultiDay && totals.mealSavings > 0 && (
      <div style={{ background: '#F2FBE9', border: '0.5px solid #B8DCA0', borderRadius: 7, padding: '8px 10px', marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#3B6D11', marginBottom: 5, letterSpacing: '0.04em' }}>MEAL OFFER SAVINGS (AUTO)</div>
        {eventDays.map((day, di) => day.meals.map((meal, mi) => {
          const offer = meal.discount_amount || 0;
          if (offer <= 0 || meal.per_plate_amount <= offer) return null;
          const dayNum = getDayNumber(day.date, eventDays);
          return (
            <div key={`${di}-${mi}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 0', color: '#3B6D11' }}>
              <span>{meal.meal_type.charAt(0).toUpperCase() + meal.meal_type.slice(1)} — Day {dayNum}{day.date ? ` · ${formatDateIST(day.date, 'dd-MM')}` : ''}</span>
              <span style={{ fontWeight: 600 }}>-{rupees((meal.per_plate_amount - offer) * meal.guest_count)}</span>
            </div>
          );
        }))}
      </div>
    )}

    <ChargeRows title="DISCOUNTS" rows={discounts} setRows={setDiscounts} color="#3B6D11"
      newRow={() => ({ id: genId(), description: '', amount: 0 })}
      addLabel="+ Add Discount" placeholder="Reason (e.g. Festive Offer)" emptyText="No additional discounts"
      footer={totals.discount > 0 && sumLine(`Total Discount: -${rupees(totals.discount)}`, '#3B6D11')} />

    <ChargeRows title="EXTRA CHARGES" rows={extraCharges} setRows={setExtraCharges} color="#E8750A"
      newRow={() => ({ description: '', amount: 0 })}
      addLabel="+ Add" placeholder="Description" emptyText="No extra charges added"
      footer={totals.extra > 0 && sumLine(`Total: +${rupees(totals.extra)}`)} />

    <ChargeRows title="TRANSPORTATION CHARGES" rows={transport} setRows={setTransport} color="#E8750A"
      newRow={() => ({ description: '', amount: 0 })}
      addLabel="+ Add" placeholder="Description (e.g. Vehicle, Distance)" emptyText="No transportation charges added"
      footer={totals.transport > 0 && sumLine(`Total: +${rupees(totals.transport)}`)} />

    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: 12 }}>
      <input type="checkbox" checked={gstChecked} onChange={e => setGstChecked(e.target.checked)} style={{ accentColor: '#E8750A', width: 15, height: 15 }} />
      <span>Add GST <strong>@{gstRate}%</strong></span>
      {gstChecked && totals.gst > 0 && <span style={{ color: '#666660', fontSize: 12 }}>(+{rupees(totals.gst)})</span>}
    </label>

    <div style={{ borderTop: '0.5px solid #E5E5E0', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      {isMultiDay ? (
        <div style={{ fontSize: 12, color: '#666' }}>
          {eventDays.map((d, i) => (
            <div key={i} style={{ fontSize: 11, color: '#888880' }}>
              Day {getDayNumber(d.date, eventDays)}{d.date ? ` (${formatDateIST(d.date, 'dd-MM-yyyy')})` : ''}: {rupees(d.day_subtotal)}
            </div>
          ))}
          <div style={{ marginTop: 2 }}>Multi-day Subtotal: <strong>{rupees(totals.multiDaySubtotal)}</strong></div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: '#666' }}>
          <div>Per Plate: <strong>{rupees(totals.perPlate)}</strong></div>
          <div style={{ fontSize: 11, color: '#888880', marginTop: 2 }}>Subtotal: {rupees(totals.subtotal)}</div>
        </div>
      )}
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 11, color: '#888880' }}>Payable Amount</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#E8750A' }}>{rupees(totals.final)}</div>
      </div>
    </div>
  </div>
);

export default QuotationCharges;
