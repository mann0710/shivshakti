import React, { useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import type { QuotationLineItem, ChoiceMeta } from '../../hooks/useQuotations';
import type { Course } from '../../lib/menuOrder';
import { newChoiceId, tidyGroups } from '../../lib/quoteChoices';
import type { PickerItem } from '../../lib/quoteLines';
import { inr } from '../../lib/money';
import AddDish from './AddDish';
import { Chips, SumRow } from './bits';

interface Props {
  course: Course;
  items: QuotationLineItem[];
  menu: PickerItem[];
  who: string;
  toLine: (it: PickerItem) => QuotationLineItem;
  preview: (next: QuotationLineItem[]) => string;
  onChange: (next: QuotationLineItem[]) => void;
  onClose: () => void;
}

// "Let Kavit choose": which dishes of a course are offered, how many they pick and how the price moves.
const ChoiceDialog: React.FC<Props> = ({ course, items, menu, who, toLine, preview, onChange, onClose }) => {
  const group = course.entries.find(e => e.choice)?.choice;
  const [extra, setExtra] = useState<QuotationLineItem[]>([]);
  const offered = useMemo(() => [
    ...course.entries.flatMap(e => (e.choice ? (e.choice.meta.id === group?.meta.id ? e.choice.items : []) : [e.item!])), ...extra,
  ], [course, group, extra]);
  const [ticked, setTicked] = useState<Set<string>>(() => new Set(group?.items.map(i => i.item_id) ?? []));
  const [pick, setPick] = useState(Math.max(1, group?.meta.pick ?? 1));
  const [same, setSame] = useState(!!group?.meta.included);
  const max = Math.max(1, ticked.size - 1);
  const n = Math.min(pick, max);
  const toggle = (id: string) => setTicked(t => { const s = new Set(t); if (s.has(id)) s.delete(id); else s.add(id); return s; });

  // Ticked dishes form the group; unticked ones go back to always served.
  const build = (): QuotationLineItem[] => {
    const meta: ChoiceMeta = { id: group?.meta.id ?? newChoiceId(), label: group?.meta.label ?? course.name, pick: n, included: same || undefined };
    const all = [...items, ...extra.filter(x => !items.some(i => i.item_id === x.item_id))];
    return tidyGroups(all.map(i => {
      if (ticked.has(i.item_id)) return { ...i, choice: meta, chosen: undefined };
      return i.choice?.id === meta.id ? { ...i, choice: undefined, chosen: undefined } : i;
    }));
  };
  const ready = ticked.size >= 2;

  return (
    <Modal title={`Let ${who} choose`} onClose={onClose} width={560}
      footer={<>
        {group && <button type="button" className="q-link danger" onClick={() => { onChange(tidyGroups(items.map(i => (i.choice?.id === group.meta.id ? { ...i, choice: undefined, chosen: undefined } : i)))); onClose(); }}>Remove the choice</button>}
        <button type="button" className="ui-btn" onClick={onClose}>Cancel</button>
        <button type="button" className="ui-btn primary" disabled={!ready} onClick={() => { onChange(build()); onClose(); }}>{group ? 'Save the choice' : 'Add the choice'}</button>
      </>}>
      <p className="q-dlg-sub">{course.name} · the PDF shows these as "choose {n}".</p>
      <div className="q-h">Dishes to offer</div>
      <div className="q-checklist">
        {offered.map(i => (
          <label key={i.item_id} className="q-check row">
            <input type="checkbox" checked={ticked.has(i.item_id)} onChange={() => toggle(i.item_id)} />
            <span className="t">{i.item_name}{i.served_with && <small>served with {i.served_with}</small>}</span>
            {Number(i.amount) > 0 && <span className="r">{inr(i.amount)}</span>}
          </label>
        ))}
      </div>
      <AddDish menu={menu} skip={new Set(offered.map(i => i.item_id))} placeholder="Offer another dish — type a name"
        onPick={it => { const line = toLine(it); setExtra(x => [...x, line]); setTicked(t => new Set(t).add(line.item_id)); }} />
      {!ready && <p className="q-hint">Tick at least two dishes.</p>}
      <div className="q-fields">
        <div className="q-field">They pick<Chips label="They pick" value={n} options={Array.from({ length: Math.min(max, 4) }, (_, k) => [k + 1, String(k + 1)] as [number, string])} onChange={setPick} /></div>
        <div className="q-field">Price<Chips label="Price" value={same ? 'same' : 'dish'} options={[['dish', 'Follows the dish'], ['same', 'Same for all']]} onChange={v => setSame(v === 'same')} /></div>
      </div>
      {ready && <div className="q-rows"><SumRow k="Plate price on the quote" v={preview(build())} tone="total" /></div>}
    </Modal>
  );
};

export default ChoiceDialog;
