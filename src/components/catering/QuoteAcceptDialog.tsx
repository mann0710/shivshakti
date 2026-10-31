import React, { useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import { Quotation } from '../../hooks/useQuotations';
import { useDocSettings } from '../../hooks/useDocSettings';
import { choiceGroups, acceptPatch, pickKey, ChoiceGroup } from '../../lib/quoteChoices';
import { optionTitle, totalText } from '../../lib/quoteOptions';
import { optionLine } from '../../lib/quoteBoard';
import { sumCharges } from '../../lib/quoteMath';
import { scheduleAmounts } from '../../lib/docs/settings';
import { mealTitle } from '../../lib/docs/menu';
import { formatDateIST } from '../../lib/ist';
import { inr } from '../../lib/money';
import { PickCard, Chips, Field, SumRow, firstName } from '../quotes/bits';

interface Props {
  quote: Quotation;
  options: Quotation[];
  busy: boolean;
  picks?: Set<string>;
  onClose: () => void;
  onConfirm: (chosen: Quotation, picked: Set<string>, guests?: number, advance?: { amount: number; mode: string }) => void;
}

interface Block { title?: string; mealId: string; group: ChoiceGroup }

// Groups to decide for one option: single-day groups, or each meal's groups.
const blocksOf = (q: Quotation): Block[] => (q.is_multi_day && q.event_days?.length
  ? q.event_days.flatMap(d => d.meals.flatMap(m => choiceGroups(m.items).map(group => ({ title: mealTitle(m), mealId: m.id, group }))))
  : choiceGroups(q.items).map(group => ({ mealId: '', group })));

const pickedFrom = (q: Quotation) => new Set(blocksOf(q).flatMap(b => b.group.items.filter(i => i.chosen).map(i => pickKey(i.item_id, b.mealId))));
const MODES: [string, string][] = [['none', 'Not yet'], ['cash', 'Cash'], ['upi', 'UPI'], ['bank', 'Bank']];

// Which option and dishes the customer took, final guests and any advance paid now.
const QuoteAcceptDialog: React.FC<Props> = ({ quote, options, busy, picks, onClose, onConfirm }) => {
  const settings = useDocSettings();
  const [chosenId, setChosenId] = useState(quote.id);
  const chosen = options.find(o => o.id === chosenId) ?? quote;
  const [picked, setPicked] = useState<Set<string>>(() => (picks?.size ? picks : pickedFrom(chosen)));
  const [guests, setGuests] = useState(String(chosen.guest_count || ''));
  const [advance, setAdvance] = useState('');
  const [mode, setMode] = useState('none');
  const blocks = useMemo(() => blocksOf(chosen), [chosen]);
  const single = !(chosen.is_multi_day && chosen.event_days?.length);
  const who = firstName(quote);

  const choose = (q: Quotation) => { setChosenId(q.id); setPicked(pickedFrom(q)); setGuests(String(q.guest_count || '')); };
  const countIn = (b: Block, set = picked) => b.group.items.filter(i => set.has(pickKey(i.item_id, b.mealId))).length;
  const need = (b: Block) => Math.min(Math.max(1, b.group.meta.pick), b.group.items.length);
  // "Choose 1" swaps the pick; larger groups stop at their number.
  const withPick = (b: Block, itemId: string) => {
    const next = new Set(picked);
    const k = pickKey(itemId, b.mealId);
    if (need(b) === 1) b.group.items.forEach(i => next.delete(pickKey(i.item_id, b.mealId)));
    if (picked.has(k) && need(b) > 1) next.delete(k); else if (need(b) === 1 || countIn(b) < need(b)) next.add(k);
    return next;
  };
  const complete = blocks.every(b => countIn(b) === need(b));
  const g = parseInt(guests, 10) || 0;
  const finalGuests = single && g > 0 ? g : undefined;
  const preview = acceptPatch(chosen, picked, finalGuests);
  const total = preview.total_amount ?? chosen.total_amount;
  const step = settings.schedule[0];
  const suggested = step ? scheduleAmounts(total, settings.schedule)[0] : 0;
  const paid = mode === 'none' ? 0 : Math.max(0, advance === '' ? suggested : parseFloat(advance) || 0);
  const transport = sumCharges(chosen.transportation_charges) + sumCharges(chosen.extra_charges);
  const date = chosen.booking?.event_date ? formatDateIST(chosen.booking.event_date, 'EEE d MMM') : '';

  return (
    <Modal title={`Accept ${quote.quotation_number}`} onClose={onClose} busy={busy} dirty={advance !== '' || guests !== String(chosen.guest_count || '')} width={560}
      footer={<>
        <button type="button" className="ui-btn" onClick={onClose}>Cancel</button>
        <button type="button" className="ui-btn primary" disabled={!complete || busy}
          onClick={() => onConfirm(chosen, picked, finalGuests, { amount: paid, mode: mode === 'none' ? '' : mode })}>
          {busy ? 'Saving…' : `Accept${options.length > 1 && chosen.option_label ? ` ${chosen.option_label}` : ''} · ${inr(total)}`}
        </button>
      </>}>
      <p className="q-dlg-sub">{[quote.customer?.name, quote.booking?.event_type, date].filter(Boolean).join(' · ')}</p>

      {options.length > 1 && <>
        <div className="q-h">{who} picked one option. The others are marked not chosen.</div>
        <div className="q-cards" role="radiogroup" aria-label="Option">
          {options.map(o => <PickCard key={o.id} on={o.id === chosenId} title={optionTitle(o) || o.quotation_number} line={optionLine(o)} right={totalText(o)} onClick={() => choose(o)} />)}
        </div>
      </>}

      {blocks.map(b => (
        <div key={`${b.mealId}:${b.group.meta.id}`}>
          <div className="q-h">{b.title ? `${b.title} — ` : ''}{b.group.meta.label} · {who} picked {need(b)}{countIn(b) !== need(b) ? ` (${countIn(b)} so far)` : ''}</div>
          <div className="q-cards" role={need(b) === 1 ? 'radiogroup' : 'group'} aria-label={b.group.meta.label}>
            {b.group.items.map(i => {
              const on = picked.has(pickKey(i.item_id, b.mealId));
              const alt = single && need(b) === 1 ? acceptPatch(chosen, withPick(b, i.item_id), finalGuests) : null;
              return (
                <PickCard key={i.item_id} on={on} multi={need(b) > 1} disabled={!on && need(b) > 1 && countIn(b) >= need(b)}
                  title={`${i.item_name}${i.served_with ? ` + ${i.served_with}` : ''}`}
                  line={alt ? `${inr(alt.per_plate_amount ?? 0)} a plate` : !b.group.meta.included && Number(i.amount) > 0 ? `${inr(i.amount)} a plate` : undefined}
                  right={alt ? inr(alt.total_amount ?? 0) : undefined}
                  onClick={() => setPicked(withPick(b, i.item_id))} />
              );
            })}
          </div>
        </div>
      ))}

      <div className="q-fields">
        {single && (
          <Field label="Final guests" hint="Change it if the count moved. The price updates.">
            <input type="number" min={0} inputMode="numeric" value={guests} onChange={e => setGuests(e.target.value)} />
          </Field>
        )}
        <Field label="Advance received now" hint={`${step ? `${step.pct}% of ${inr(total)} · ` : ''}₹0 if not yet`}>
          <input type="number" min={0} inputMode="decimal" value={advance} placeholder={suggested ? String(suggested) : '0'} disabled={mode === 'none'}
            onChange={e => setAdvance(e.target.value)} aria-label="Advance received now" />
        </Field>
        <div className="q-field full">Paid by<Chips label="Paid by" value={mode} options={MODES} onChange={setMode} /></div>
      </div>

      <div className="q-rows">
        <SumRow k={single ? `${inr(preview.per_plate_amount ?? 0)} × ${preview.guest_count ?? g}${transport ? ` + charges ${inr(transport)}` : ''}` : 'Total'} v={inr(total)} tone="total" />
        {paid > 0 && <SumRow k="Advance" v={`− ${inr(paid)}`} />}
        {paid > 0 && <SumRow k="Balance, goes on the invoice" v={inr(Math.max(0, total - paid))} />}
      </div>
      <p className="q-hint">The booking becomes Confirmed{options.length > 1 ? ' and the other options are kept as not chosen' : ''}. {paid > 0 ? 'The advance is saved now and appears on the invoice later.' : 'Pick how it was paid to save an advance now.'}</p>
    </Modal>
  );
};

export default QuoteAcceptDialog;
