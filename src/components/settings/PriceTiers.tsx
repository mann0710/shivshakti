import React, { useId } from 'react';
import { TierRow, Sample, PRICE_MISSING, addRange, dropRange, rowFrom, rowLabel, checkTiers, tierIndex, sampleBadge, sampleWho } from '../../lib/priceTiers';
import { inr } from '../../lib/money';
import '../../styles/settings.css';

export type PriceMode = 'one' | 'guests';
export interface PriceErrors { price?: string; rows?: string[]; tiers?: string }

interface Props {
  // False until the database update for price by guest count is run.
  canTier: boolean;
  mode: PriceMode;
  price: string;
  rows: TierRow[];
  sample: Sample;
  errors: PriceErrors;
  onMode: (m: PriceMode) => void;
  onPrice: (price: string) => void;
  onRows: (rows: TierRow[]) => void;
}

const MODES: [PriceMode, string][] = [['one', 'One price'], ['guests', 'By number of guests']];
const amount = (s: string) => s.replace(/[^\d.]/g, '');

// "Price per plate": one price, or a price for each range of guests with a worked example.
const PriceTiers: React.FC<Props> = ({ canTier, mode, price, rows, sample, errors, onMode, onPrice, onRows }) => {
  const id = useId();
  const check = checkTiers(rows);
  const at = check.error ? -1 : tierIndex(check.tiers, sample.guests);
  const plate = at < 0 ? 0 : check.tiers[at].price;
  const who = sampleWho(sample);
  const set = (i: number, patch: Partial<TierRow>) => onRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  // Arrow keys move between the two choices, like any radio group.
  const keys = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const next = mode === 'one' ? 'guests' : 'one';
    onMode(next);
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-mode="${next}"]`)?.focus();
  };

  return (
    <div className="pt-block">
      <div className="pt-head">
        <h2 id={`${id}h`}>Price per plate</h2>
        {canTier && (
          <div className="pt-seg" role="radiogroup" aria-labelledby={`${id}h`} onKeyDown={keys}>
            {MODES.map(([m, text]) => (
              <button key={m} type="button" role="radio" data-mode={m} aria-checked={mode === m} tabIndex={mode === m ? 0 : -1} onClick={() => onMode(m)}>{text}</button>
            ))}
          </div>
        )}
      </div>

      {mode === 'one' ? (
        <label className="st-field pt-one">
          <input value={price ? `₹${price}` : ''} inputMode="decimal" placeholder="₹" aria-label="Price per plate" aria-invalid={!!errors.price}
            className={errors.price ? 'bad' : ''} onChange={e => onPrice(amount(e.target.value))} />
          {errors.price && <small className="bad">{errors.price}</small>}
          {!canTier && <small>Price by number of guests turns on after the database update in Settings › Data.</small>}
        </label>
      ) : (
        <>
          <div className="pk-table">
            <div className="pt-tr th"><span>Guests</span><span>Price per plate</span><span /></div>
            {rows.map((r, i) => {
              const last = i === rows.length - 1;
              const err = errors.rows?.[i] ?? '';
              const badPrice = err === PRICE_MISSING;
              const errId = err ? `${id}e${i}` : undefined;
              const label = rowLabel(rows, i);
              return (
                <div key={i} className={`pt-tr${i === at ? ' on' : ''}`}>
                  <span className="pt-range">
                    {last ? `${rowFrom(rows, i) ?? '…'} guests and more` : <>
                      {i ? `${rowFrom(rows, i) ?? '…'} –` : 'Up to'}
                      <input className="pt-upto" inputMode="numeric" value={r.upto} aria-label={`Last guest count of range ${i + 1}`}
                        aria-invalid={!!err && !badPrice} aria-describedby={badPrice ? undefined : errId} onChange={e => set(i, { upto: e.target.value.replace(/\D/g, '') })} />
                      guests</>}
                    {i === at && <b className="pt-badge">{sampleBadge(sample)}</b>}
                  </span>
                  <label className={`pt-price${badPrice ? ' bad' : ''}`}><span aria-hidden="true">₹</span>
                    <input inputMode="decimal" value={r.price} aria-label={`Price per plate for ${label}`} aria-invalid={badPrice}
                      aria-describedby={badPrice ? errId : undefined} onChange={e => set(i, { price: amount(e.target.value) })} />
                  </label>
                  <button type="button" className="st-x" aria-label={`Remove ${label}`} disabled={rows.length <= 2} onClick={() => onRows(dropRange(rows, i))}>×</button>
                  {err && <small id={errId} className="pt-bad pt-err">{err}</small>}
                </div>
              );
            })}
            <div className="pt-add"><button type="button" onClick={() => onRows(addRange(rows))}>+ Add a guest range</button></div>
          </div>
          {errors.tiers && !errors.rows?.some(Boolean) && <small className="pt-bad" role="alert">{errors.tiers}</small>}
          {at >= 0 && (
            <p className="pt-example">For <b>{sample.guests} guests</b>{who && ` ${who}`} this package is <b>{inr(plate)} × {sample.guests} = {inr(plate * sample.guests)}</b>.</p>
          )}
          <p className="pt-note">On a quotation the right price fills in from the guest count, and changes by itself if the guest count changes.</p>
        </>
      )}
    </div>
  );
};

export default PriceTiers;
