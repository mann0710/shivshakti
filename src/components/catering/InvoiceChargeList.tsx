import React from 'react';

export interface ChargeRow { id?: string; description: string; amount: number }

interface Props {
  extras: ChargeRow[];
  transport: ChargeRow[];
  onExtras: (rows: ChargeRow[]) => void;
  onTransport: (rows: ChargeRow[]) => void;
  discount: string;
  onDiscount: (text: string) => void;
  gstRate: number;
  gstRates: number[];
  gstNote: string;
  onGst: (rate: number) => void;
}

const money = (v: string) => Math.max(0, Number(v.replace(/[^\d.]/g, '')) || 0);

// Editable "what + amount" rows for one list of charges.
const Rows: React.FC<{ rows: ChargeRow[]; onChange: (rows: ChargeRow[]) => void; what: string }> = ({ rows, onChange, what }) => {
  const patch = (i: number, p: Partial<ChargeRow>) => onChange(rows.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (
    <>
      {rows.map((r, i) => (
        <div key={r.id ?? `${what}-${i}`} className="iv-extra">
          <input className="lbl" value={r.description} placeholder={what} aria-label={`${what} name`} onChange={e => patch(i, { description: e.target.value })} />
          <input className="iv-num" inputMode="decimal" value={r.amount ? `₹${r.amount.toLocaleString('en-IN')}` : ''} placeholder="₹0" aria-label={`${r.description || what} amount`}
            onChange={e => patch(i, { amount: money(e.target.value) })} />
          <button type="button" className="iv-x" aria-label={`Remove ${r.description || what}`} onClick={() => onChange(rows.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
    </>
  );
};

// "Extras, discount, GST" on the invoice; every change saves by itself.
const InvoiceChargeList: React.FC<Props> = ({ extras, transport, onExtras, onTransport, discount, onDiscount, gstRate, gstRates, gstNote, onGst }) => (
  <section aria-label="Extras" className="iv-sec">
    <div className="iv-sec-head">
      <h2>Extras, discount, GST</h2>
      <button type="button" className="mx-link" onClick={() => onExtras([...extras, { description: '', amount: 0 }])}>+ Add an extra</button>
    </div>
    <Rows rows={extras} onChange={onExtras} what="Extra" />
    <Rows rows={transport} onChange={onTransport} what="Transport" />
    <div className="iv-extra">
      <label className="fixed" htmlFor="iv-discount">Discount <small>· amount or %</small></label>
      <input id="iv-discount" className="iv-num" value={discount} placeholder="—" onChange={e => onDiscount(e.target.value.replace(/[^\d.%]/g, ''))} />
      <span />
    </div>
    <div className="iv-extra">
      <label className="fixed" htmlFor="iv-gst">GST <small>· {gstNote}</small></label>
      <select id="iv-gst" className="iv-num" value={gstRate} disabled={gstRates.length < 2} onChange={e => onGst(Number(e.target.value))}>
        {gstRates.map(r => <option key={r} value={r}>{r ? `${r}%` : 'Not added'}</option>)}
      </select>
      <span />
    </div>
  </section>
);

export default InvoiceChargeList;
