import React, { useState } from 'react';
import Modal from '../ui/Modal';
import { FOOD_STYLES, FoodStyle } from '../../lib/foodStyles';
import { plural } from '../../lib/menuCatalog';
import { pctPrice, readPrice } from '../../lib/menuSheet';
import { inr } from '../../lib/money';
import '../../styles/settings.css';
import '../../styles/menu-sheet.css';

interface AskProps { title: string; sub: string; primary: string; dirty: boolean; error?: string; onClose: () => void; onApply: () => boolean; children: React.ReactNode }

// Small form for a sheet bulk action; `onApply` returns false to stay open.
const Ask: React.FC<AskProps> = ({ title, sub, primary, dirty, error, onClose, onApply, children }) => (
  <Modal title={title} onClose={onClose} width={420} dirty={dirty} footer={<>
    <button type="button" className="ui-btn" onClick={onClose}>Cancel</button>
    <button type="submit" form="sheet-ask" className="ui-btn primary">{primary}</button>
  </>}>
    <p className="st-sub">{sub}</p>
    <form id="sheet-ask" className="ms-ask" noValidate onSubmit={e => { e.preventDefault(); if (onApply()) onClose(); }}>
      {children}
      {error && <small className="ms-note err" role="alert">{error}</small>}
    </form>
  </Modal>
);

interface BaseProps { count: number; onClose: () => void }
const dishes = (n: number) => plural(n, 'dish', 'dishes');

export const PriceAsk: React.FC<BaseProps & { onApply: (price: string) => void }> = ({ count, onClose, onApply }) => {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const apply = () => {
    const p = readPrice(text);
    if (!p.ok) { setError(p.error ?? 'Numbers only'); return false; }
    onApply(p.value ? String(p.value) : '');
    return true;
  };
  return (
    <Ask title={`Set price for ${dishes(count)}`} sub="Leave it empty to clear their prices. Nothing is saved until Review & save."
      primary="Set price" dirty={!!text} error={error} onClose={onClose} onApply={apply}>
      <label className="st-field"><span>Price per plate</span>
        <input autoFocus inputMode="decimal" placeholder="₹" value={text} aria-invalid={!!error} onChange={e => { setText(e.target.value.replace(/[^\d.]/g, '')); setError(''); }} />
      </label>
    </Ask>
  );
};

// Raise or lower by a percent, rounded to the rupee; dishes without a price stay empty.
export const PctAsk: React.FC<BaseProps & { prices: number[]; onApply: (pct: number) => void }> = ({ count, prices, onClose, onApply }) => {
  const [up, setUp] = useState(true);
  const [text, setText] = useState('');
  const n = Number(text);
  const pct = up ? n : -n;
  const ok = n > 0 && (up ? n <= 500 : n < 100);
  const left = count - prices.length;
  const apply = () => { if (ok) onApply(pct); return ok; };
  return (
    <Ask title={`Change ${dishes(count)} by %`} sub="Rounded to the rupee. Nothing is saved until Review & save."
      primary={up ? 'Raise prices' : 'Lower prices'} dirty={!!text} error={text && !ok ? (up ? 'Up to 500%' : 'Less than 100%') : ''} onClose={onClose} onApply={apply}>
      <div role="group" aria-label="Raise or lower" className="ms-seg">
        <button type="button" aria-pressed={up} onClick={() => setUp(true)}>Raise</button>
        <button type="button" aria-pressed={!up} onClick={() => setUp(false)}>Lower</button>
      </div>
      <label className="st-field"><span>By how many percent</span>
        <input autoFocus inputMode="decimal" placeholder="10" value={text} onChange={e => setText(e.target.value.replace(/[^\d.]/g, ''))} />
      </label>
      <small className="ms-ask-hint">
        {ok && prices.length ? `For example ${inr(prices[0])} becomes ${inr(pctPrice(prices[0], pct))}. ` : ''}
        {left ? `${dishes(left)} without a price ${left === 1 ? 'stays' : 'stay'} empty.` : ''}
      </small>
    </Ask>
  );
};

type Choice = Partial<Record<FoodStyle, boolean>>;
const stateText = (v?: boolean) => (v === true ? 'Add to all' : v === false ? 'Remove from all' : 'Leave as is');

// Each style: add to all, remove from all, or (when only some have it) leave as is.
export const StylesAsk: React.FC<BaseProps & { styles: FoodStyle[][]; onApply: (c: Choice) => void }> = ({ count, styles, onClose, onApply }) => {
  const start = (s: FoodStyle) => (styles.every(x => x.includes(s)) ? true : styles.some(x => x.includes(s)) ? undefined : false);
  const [first] = useState<Choice>(() => Object.fromEntries(FOOD_STYLES.map(s => [s.id, start(s.id)])));
  const [choice, setChoice] = useState<Choice>(first);
  const next = (s: FoodStyle) => {
    const v = choice[s];
    setChoice({ ...choice, [s]: v === undefined ? true : v ? false : first[s] === undefined ? undefined : true });
  };
  return (
    <Ask title={`Food style for ${dishes(count)}`} sub="Tap a style to add it to all or remove it from all. Nothing is saved until Review & save."
      primary="Apply" dirty={JSON.stringify(choice) !== JSON.stringify(first)} onClose={onClose} onApply={() => { onApply(choice); return true; }}>
      <div className="ms-tri">
        {FOOD_STYLES.map(s => (
          <button key={s.id} type="button" className={`ms-chip ${s.cls}`} aria-pressed={choice[s.id] === undefined ? 'mixed' : choice[s.id]} onClick={() => next(s.id)}>
            <span>{s.label}</span><small>{stateText(choice[s.id])}</small>
          </button>
        ))}
      </div>
    </Ask>
  );
};
