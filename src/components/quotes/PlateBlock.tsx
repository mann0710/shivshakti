import React, { useEffect, useState } from 'react';
import { inr } from '../../lib/money';
import { range } from '../../lib/quoteSummary';

export interface PlateModel {
  id: string;
  menuValue: number;                       // dish total as listed, or the list price
  listPrice: boolean;                      // menu value is a typed list price
  typed: number;                           // your price as typed
  follows: boolean;                        // the price moves with the dishes (box shows empty)
  onPrice: (v: number | null) => void;     // null = follow the menu value again
  low: number; high: number | null;        // what they pay a plate (range while picks move it)
  guests: number;
  gap: { min: number; max: number } | null; // dish range the picks make; null when picks never move the price
  onePrice: boolean;
  onOnePrice: (on: boolean) => void;
  off: number;                             // rupees off a plate
  discount?: { on: boolean; set: (on: boolean) => void };
  dishPrices?: { on: boolean; can: boolean; set: (on: boolean) => void };
  onUseDishPrices?: () => void;            // switch on dish prices when none are set yet
  children?: React.ReactNode;              // e.g. the package price hint
}

const num = (v: string) => parseFloat(v.replace(/[^\d.]/g, '')) || 0;

// "Price a plate" for one meal: menu value, your price, the discount it makes, the pick rule and the PDF ticks.
const PlateBlock: React.FC<{ p: PlateModel }> = ({ p }) => {
  const { follows } = p;
  const [text, setText] = useState(follows || !p.typed ? '' : String(p.typed));
  // Outside changes (dishes, packages, one price) show in the box; your own typing stays as typed.
  useEffect(() => { setText(t => (num(t) === p.typed && t ? t : follows || !p.typed ? '' : String(p.typed))); }, [p.typed, follows]);
  const above = p.typed > p.menuValue && p.menuValue > 0 ? p.typed - p.menuValue : 0;
  const total = range(p.low * p.guests, p.high != null ? p.high * p.guests : null);
  const priceId = `${p.id}-price`;

  return (
    <div className="q-plate" role="group" aria-label="Price a plate">
      <span className="q-plate-h">Price a plate</span>
      <div className="q-plate-grid">
        <span className="k">Menu value</span>
        <span>{p.menuValue > 0 ? <><b>{p.gap ? range(p.gap.min, p.gap.max) : inr(p.menuValue)}</b> <small>{p.listPrice ? '· your list price' : '· what these dishes add up to'}</small></>
          : <small>Dishes have no prices · type your price{p.onUseDishPrices && <> or <button type="button" className="q-link" onClick={p.onUseDishPrices}>price each dish</button></>}</small>}</span>
        <label className="k" htmlFor={priceId}>Your price</label>
        <span className="q-plate-in">
          <input id={priceId} type="number" min={0} inputMode="decimal" value={text} placeholder={p.menuValue > 0 ? `₹${p.menuValue}` : '₹ a plate'}
            onChange={e => { setText(e.target.value); p.onPrice(e.target.value ? num(e.target.value) : null); }}
            onBlur={() => { if (!text) p.onPrice(null); }} />
          {!follows && p.menuValue > 0 && !p.listPrice && <button type="button" className="q-mini" onClick={() => { setText(''); p.onPrice(null); }}>Use {inr(p.menuValue)}</button>}
        </span>
        {p.off > 0 && <><span className="k">Plate discount</span><span className="good">{inr(p.off)} off a plate · {inr(p.off * p.guests)} off this meal</span></>}
        {above > 0 && <><span className="k">Difference</span><span className="warn">{inr(above)} above the dishes</span></>}
      </div>
      {p.gap && (
        <div className="q-radio2 q-plate-pick" role="radiogroup" aria-label="When the customer picks">
          <label className={`q-rcard${!p.onePrice ? ' on' : ''}`}><input type="radio" checked={!p.onePrice} onChange={() => p.onOnePrice(false)} />
            <span><b>Price follows the pick</b><span>{range(p.low, p.high)} a plate, final once they choose</span></span></label>
          <label className={`q-rcard${p.onePrice ? ' on' : ''}`}><input type="radio" checked={p.onePrice} onChange={() => p.onOnePrice(true)} />
            <span><b>One price for any pick</b><span>{p.onePrice ? `${inr(p.low)} a plate · change it in Your price` : `${inr(p.high ?? p.low)} a plate, the dearest pick`}</span></span></label>
        </div>
      )}
      {(p.off > 0 && p.discount) || (p.dishPrices && p.dishPrices.can) ? (
        <div className="q-plate-pdf">
          <span className="k">On the PDF</span>
          {p.off > 0 && p.discount && (
            <label className="q-check"><input type="checkbox" checked={p.discount.on} onChange={e => p.discount!.set(e.target.checked)} />
              <span className="t"><b>Show the discount</b><small>{p.discount.on ? `${inr(p.menuValue)} struck through, then ${inr(p.typed)} a plate, and what they save` : `Off: ${inr(p.typed)} a plate prints with no discount`}</small></span></label>
          )}
          {p.dishPrices && p.dishPrices.can && (
            <label className="q-check"><input type="checkbox" checked={p.dishPrices.on} onChange={e => p.dishPrices!.set(e.target.checked)} />
              <span className="t"><b>Show each dish's price</b><small>{p.dishPrices.on ? (above > 0 ? 'They add up to less than your price' : 'Each dish shows its price') : 'Off: only the plate price prints'}</small></span></label>
          )}
        </div>
      ) : null}
      {p.children}
      <div className="q-plate-foot"><span>{p.guests} guests × {range(p.low, p.high)}</span><b>{total}</b></div>
    </div>
  );
};

export default PlateBlock;
