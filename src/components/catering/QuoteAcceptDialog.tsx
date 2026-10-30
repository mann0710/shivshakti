import React, { useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import { Quotation } from '../../hooks/useQuotations';
import { choiceGroups, acceptPatch, pickKey, ChoiceGroup } from '../../lib/quoteChoices';
import { optionTitle, plateText, totalText } from '../../lib/quoteOptions';
import { mealTitle } from '../../lib/docs/menu';
import { inr } from '../../lib/money';
import { ORANGE, btnGhost, btnPrimary } from './CustomerUi';

interface Props {
  quote: Quotation;
  options: Quotation[];
  busy: boolean;
  onClose: () => void;
  onConfirm: (chosen: Quotation, picked: Set<string>, guests?: number) => void;
}

interface Block { title?: string; mealId: string; group: ChoiceGroup }

// Groups to decide for one option: single-day groups, or each meal's groups.
const blocksOf = (q: Quotation): Block[] => (q.is_multi_day && q.event_days?.length
  ? q.event_days.flatMap(d => d.meals.flatMap(m => choiceGroups(m.items).map(group => ({ title: mealTitle(m), mealId: m.id, group }))))
  : choiceGroups(q.items).map(group => ({ mealId: '', group })));

const pickedFrom = (q: Quotation) => new Set(blocksOf(q).flatMap(b => b.group.items.filter(i => i.chosen).map(i => pickKey(i.item_id, b.mealId))));

// Which option the customer took and which dishes they picked; previews the final price.
const QuoteAcceptDialog: React.FC<Props> = ({ quote, options, busy, onClose, onConfirm }) => {
  const [chosenId, setChosenId] = useState(quote.id);
  const chosen = options.find(o => o.id === chosenId) ?? quote;
  const [picked, setPicked] = useState<Set<string>>(() => pickedFrom(chosen));
  const [guests, setGuests] = useState(String(chosen.guest_count || ''));
  const blocks = useMemo(() => blocksOf(chosen), [chosen]);
  const single = !(chosen.is_multi_day && chosen.event_days?.length);

  const choose = (q: Quotation) => { setChosenId(q.id); setPicked(pickedFrom(q)); setGuests(String(q.guest_count || '')); };
  const countIn = (b: Block) => b.group.items.filter(i => picked.has(pickKey(i.item_id, b.mealId))).length;
  const need = (b: Block) => Math.min(Math.max(1, b.group.meta.pick), b.group.items.length);
  const toggle = (b: Block, itemId: string) => setPicked(prev => {
    const next = new Set(prev);
    const k = pickKey(itemId, b.mealId);
    if (next.has(k)) next.delete(k); else if (countIn(b) < need(b)) next.add(k);
    return next;
  });
  const complete = blocks.every(b => countIn(b) === need(b));
  const g = parseInt(guests, 10) || 0;
  const preview = acceptPatch(chosen, picked, single ? g : undefined);

  return (
    <Modal title={`Mark ${quote.quotation_number} accepted`} onClose={onClose} width={600}
      footer={<>
        <button type="button" style={btnGhost} onClick={onClose}>Cancel</button>
        <button type="button" style={{ ...btnPrimary, opacity: complete && !busy ? 1 : 0.5 }} disabled={!complete || busy}
          onClick={() => onConfirm(chosen, picked, single ? g : undefined)}>
          {busy ? 'Saving…' : `Accept${chosen.option_label ? ` option ${chosen.option_label}` : ''} · ${inr(preview.total_amount ?? chosen.total_amount)}`}
        </button>
      </>}>
      <div style={{ fontSize: 12, color: '#6B6B66', marginBottom: 12 }}>
        {[quote.customer?.name, quote.booking?.event_type, quote.booking?.event_date].filter(Boolean).join(' · ')}
      </div>

      {options.length > 1 && (
        <fieldset style={fs}>
          <legend style={legend}>Which option did the customer choose?</legend>
          {options.map(o => (
            <label key={o.id} style={{ ...card, borderColor: o.id === chosenId ? ORANGE : '#E5E5E0', background: o.id === chosenId ? '#FFF8F0' : '#fff' }}>
              <input type="radio" name="option" checked={o.id === chosenId} onChange={() => choose(o)} style={{ accentColor: ORANGE, width: 18, height: 18 }} />
              <span style={{ flex: 1 }}><b>{optionTitle(o) || o.quotation_number}</b><br /><span style={{ fontSize: 12, color: '#6B6B66' }}>{o.quotation_number} · {o.is_multi_day ? 'multi-day' : `${plateText(o)} / plate`}</span></span>
              <b style={{ fontSize: 13 }}>{totalText(o)}</b>
            </label>
          ))}
        </fieldset>
      )}

      {blocks.map(b => (
        <fieldset key={`${b.mealId}:${b.group.meta.id}`} style={fs}>
          <legend style={legend}>{b.title ? `${b.title} — ` : ''}{b.group.meta.label}: which {need(b)} did they pick?</legend>
          <span style={{ alignSelf: 'flex-start', fontSize: 11.5, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: countIn(b) === need(b) ? '#EBF4E1' : '#FFF1E3', color: countIn(b) === need(b) ? '#2F5A0E' : '#A84F00' }}>
            {countIn(b)} of {need(b)} picked
          </span>
          {b.group.items.map(i => {
            const on = picked.has(pickKey(i.item_id, b.mealId));
            const full = !on && countIn(b) >= need(b);
            return (
              <label key={i.item_id} style={{ ...card, padding: '8px 12px', opacity: full ? 0.55 : 1, borderColor: on ? '#9CC27A' : '#E5E5E0', background: on ? '#F4F9EE' : '#fff' }}>
                <input type="checkbox" checked={on} disabled={full} onChange={() => toggle(b, i.item_id)} style={{ accentColor: ORANGE, width: 18, height: 18 }} />
                <span style={{ flex: 1 }}>{i.item_name}</span>
                {!b.group.meta.included && Number(i.amount) > 0 && <b>{inr(i.amount)}</b>}
              </label>
            );
          })}
        </fieldset>
      ))}

      <div style={{ display: 'grid', gridTemplateColumns: single ? '140px 1fr' : '1fr', gap: 12, alignItems: 'end' }}>
        {single && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6B6B66' }}>Final guests</span>
            <input type="number" min={0} value={guests} onChange={e => setGuests(e.target.value)} style={{ height: 40, border: '1px solid #E5E5E0', borderRadius: 8, padding: '0 10px', fontSize: 14 }} />
          </label>
        )}
        <div style={{ background: '#F9F8F5', borderRadius: 10, padding: '10px 12px', fontSize: 13 }}>
          {single && <div style={{ color: '#555550' }}>{inr(preview.per_plate_amount ?? 0)} per plate × {g} guests</div>}
          <b style={{ fontSize: 15 }}>Total {inr(preview.total_amount ?? 0)}</b>
        </div>
      </div>
      <p style={{ fontSize: 12, color: '#555550', lineHeight: 1.5, margin: '12px 0 0' }}>
        {options.length > 1 ? 'The other options are kept as Not chosen. ' : ''}The booking becomes Confirmed and the invoice uses this menu and price.
      </p>
    </Modal>
  );
};

const fs: React.CSSProperties = { border: 'none', margin: '0 0 14px', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 };
const legend: React.CSSProperties = { fontSize: 13, fontWeight: 600, marginBottom: 6, padding: 0 };
const card: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: '1px solid #E5E5E0', borderRadius: 10, fontSize: 13, cursor: 'pointer' };

export default QuoteAcceptDialog;
