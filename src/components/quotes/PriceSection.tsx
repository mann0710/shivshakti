import React, { useEffect, useState } from 'react';
import type { QuoteForm } from '../../hooks/useQuoteForm';
import { genId, Charge } from '../../lib/quoteLines';
import { parseAmount, range } from '../../lib/quoteSummary';
import { openPicks } from '../../lib/quoteBoard';
import { inr } from '../../lib/money';
import { Tick } from './EventSection';
import type { PackagePrice } from './usePackagePrice';

interface Props { f: QuoteForm; pkg?: PackagePrice }

type Kind = 'transport' | 'discount' | 'extra';
const ADD: [Kind, string][] = [['extra', 'Service staff'], ['extra', 'Counter / live station'], ['extra', 'Decoration'], ['extra', 'Other charge'], ['transport', 'Transport'], ['discount', 'Discount']];

// Amount box that also takes "10%"; settles when you leave it.
const AmountInput: React.FC<{ value: number; base: number; label: string; onChange: (n: number) => void }> = ({ value, base, label, onChange }) => {
  const [text, setText] = useState(value ? String(value) : '');
  useEffect(() => { setText(t => (parseAmount(t, base) === value ? t : value ? String(value) : '')); }, [value, base]);
  return (
    <input className="amt" inputMode="decimal" value={text} placeholder="—" aria-label={label}
      onChange={e => { setText(e.target.value); if (!e.target.value.includes('%')) onChange(parseAmount(e.target.value, base)); }}
      onBlur={() => { const n = parseAmount(text, base); onChange(n); setText(n ? String(n) : ''); }} />
  );
};

// Plate price (from dish prices or your own), then transport, discounts, extras and GST.
const PriceSection: React.FC<Props> = ({ f, pkg }) => {
  const dishMode = f.showPrices && f.autoPrice;
  const r = f.range;
  const picks = openPicks({ is_multi_day: false, event_days: [], items: f.selectedItems }).map(p => p.label.toLowerCase());
  const list: Record<Kind, { rows: Charge[]; set: (fn: (prev: any[]) => any[]) => void; name: string }> = {
    transport: { rows: f.transportationCharges, set: f.setTransportationCharges as any, name: 'Transport' },
    discount: { rows: f.additionalDiscounts, set: f.setAdditionalDiscounts as any, name: 'Discount' },
    extra: { rows: f.extraCharges, set: f.setExtraCharges as any, name: 'Extra charge' },
  };
  const add = (k: Kind, description: string) => list[k].set(prev => [...prev, k === 'discount' ? { id: genId(), description, amount: 0 } : { description, amount: 0 }]);
  const patch = (k: Kind, i: number, change: Partial<Charge>) => list[k].set(prev => prev.map((x, j) => (j === i ? { ...x, ...change } : x)));
  const drop = (k: Kind, i: number) => list[k].set(prev => prev.filter((_, j) => j !== i));
  const base = f.totals.subtotal;
  // Transport and discount always show a row to type into.
  const shown = (k: Kind): (Charge & { blank?: boolean })[] => (list[k].rows.length || k === 'extra' ? list[k].rows : [{ description: list[k].name, amount: 0, blank: true }]);

  const row = (k: Kind, c: Charge & { blank?: boolean }, i: number) => (
    <div key={`${k}${i}`} className="q-extra">
      <input className="lbl" value={c.description} placeholder={list[k].name} aria-label={`${list[k].name} name`}
        onChange={e => (c.blank ? list[k].set(() => [{ ...(k === 'discount' ? { id: genId() } : {}), description: e.target.value, amount: 0 }]) : patch(k, i, { description: e.target.value }))} />
      <AmountInput value={c.amount} base={base} label={`${c.description || list[k].name} amount${k === 'discount' ? ', amount or %' : ''}`}
        onChange={n => (c.blank ? (n > 0 && list[k].set(() => [{ ...(k === 'discount' ? { id: genId() } : {}), description: list[k].name, amount: n }])) : patch(k, i, { amount: n }))} />
      {c.blank ? <span /> : <button type="button" className="x" aria-label={`Remove ${c.description || list[k].name}`} onClick={() => drop(k, i)}>×</button>}
    </div>
  );

  return (
    <section className="q-sec" aria-label="Price">
      <h2><Tick ok={f.totals.final > 0} />Price</h2>
      {!f.isMultiDay && (
        <div className="q-radio2" role="radiogroup" aria-label="Plate price">
          <button type="button" role="radio" aria-checked={dishMode} className={`q-rcard${dishMode ? ' on' : ''}`} onClick={() => { f.setItemPricesPref(true); f.setAutoPrice(true); }}>
            <span className="dot" aria-hidden="true" />
            <span><b>From the dish prices in this quote</b>
              <span>{r.max > 0 ? `${range(r.min, r.max)} a plate${r.max > r.min && picks.length ? ` (the ${picks.join(' and ')} choice makes the range)` : ''}` : 'Tap a dish to give it a price'}</span></span>
          </button>
          <div role="radio" aria-checked={!dishMode} tabIndex={0} className={`q-rcard${!dishMode ? ' on' : ''}`} onClick={() => dishMode && f.typePerPlate(f.perPlate)}
            onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') f.typePerPlate(f.perPlate); }}>
            <span className="dot" aria-hidden="true" />
            <span><b>My own price</b>
              {dishMode ? <span>One price a plate</span> : (
                <span className="q-own">
                  <input type="number" min={0} inputMode="decimal" value={f.perPlate} placeholder="₹ a plate" aria-label="Own price a plate" onChange={e => f.typePerPlate(e.target.value)} />
                  {f.perPlateMax != null && <small>picks make it {range(f.plateLow, f.perPlateMax)}</small>}
                </span>
              )}</span>
          </div>
        </div>
      )}
      {pkg?.hint && (
        <p className="q-hint" role="status">{pkg.hint.follows ? pkg.hint.text : <>
          Package price: {pkg.hint.text} <button type="button" className="q-link" onClick={pkg.use}>Use {inr(pkg.hint.price)}</button></>}</p>
      )}
      <div className="q-extras">
        {(['transport', 'discount', 'extra'] as Kind[]).flatMap(k => shown(k).map((c, i) => row(k, c, i)))}
        {f.gstChecked && (
          <div className="q-extra">
            <span className="lbl">GST {f.dcGstRate}%</span>
            <span className="amt ro">{inr(f.totals.gst)}</span>
            <button type="button" className="x" aria-label="Remove GST" onClick={() => f.setGstChecked(false)}>×</button>
          </div>
        )}
        <div className="q-extra-add">
          {ADD.filter(([k]) => k === 'extra' || list[k].rows.length > 0).map(([k, label]) => (
            <button key={label} type="button" className="q-mini" onClick={() => add(k, label === 'Other charge' ? '' : label)}>+ {label}</button>
          ))}
          {!f.gstChecked && <button type="button" className="q-mini" onClick={() => f.setGstChecked(true)}>+ GST {f.dcGstRate}%</button>}
        </div>
      </div>
    </section>
  );
};

export default PriceSection;
