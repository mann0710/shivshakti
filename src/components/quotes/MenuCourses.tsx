import React, { useMemo, useState } from 'react';
import type { QuotationLineItem } from '../../hooks/useQuotations';
import type { Course } from '../../lib/menuOrder';
import { coursesOf } from '../../lib/quoteSummary';
import { tidyGroups } from '../../lib/quoteChoices';
import { moveLine, PickerItem } from '../../lib/quoteLines';
import { inr } from '../../lib/money';
import AddDish from './AddDish';
import DishEditor from './DishEditor';
import ChoiceDialog from './ChoiceDialog';

interface Props {
  items: QuotationLineItem[];
  menu: PickerItem[];
  showPrices: boolean;
  who: string;
  toLine: (it: PickerItem) => QuotationLineItem;
  preview: (next: QuotationLineItem[]) => string;
  onChange: (next: QuotationLineItem[]) => void;
  compact?: boolean;
}

const pickOf = (c: Course) => c.entries.find(e => e.choice)?.choice;

// The menu as courses of dish chips; "choose" courses are highlighted. Tap a dish to edit it.
const MenuCourses: React.FC<Props> = ({ items, menu, showPrices, who, toLine, preview, onChange, compact }) => {
  const courses = useMemo(() => coursesOf(items), [items]);
  const [edit, setEdit] = useState<{ id: string; el: HTMLElement } | null>(null);
  const [choose, setChoose] = useState<string | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const skip = useMemo(() => new Set(items.map(i => i.item_id)), [items]);
  const index = (id: string) => items.findIndex(i => i.item_id === id);
  const add = (it: PickerItem) => onChange([...items, toLine(it)]);

  const chip = (i: QuotationLineItem) => {
    const at = index(i.item_id);
    return (
      <span key={i.item_id} className={`q-dish${i.choice ? ' alt' : ''}${drag === at ? ' drag' : ''}${over === at && drag !== at ? ' over' : ''}`} draggable
        onDragStart={e => { setDrag(at); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => { setDrag(null); setOver(null); }}
        onDragOver={e => { e.preventDefault(); setOver(at); }}
        onDrop={e => { e.preventDefault(); if (drag != null && drag !== at) onChange(moveLine(items, drag, at)); setDrag(null); setOver(null); }}>
        <button type="button" className="name" onClick={e => setEdit({ id: i.item_id, el: e.currentTarget })} aria-label={`Edit ${i.item_name}`}>
          {i.item_name}
          {i.served_with && <span className="with">+ {i.served_with}</span>}
          {showPrices && Number(i.amount) > 0 && <span className="pr">{inr(i.amount)}</span>}
          {i.instruction && <span className="note" title={i.instruction}>· note</span>}
        </button>
        <button type="button" className="x" aria-label={`Remove ${i.item_name}`} onClick={() => onChange(tidyGroups(items.filter(x => x.item_id !== i.item_id)))}>×</button>
      </span>
    );
  };

  const right = (c: Course) => {
    const g = pickOf(c);
    if (g && !g.meta.included && showPrices) return 'changes the plate price';
    return showPrices && c.sum > 0 ? `${inr(c.sum)} a plate` : 'in plate price';
  };
  const editing = edit && items.find(i => i.item_id === edit.id);
  const course = choose != null ? courses.find(c => c.name === choose) : undefined;

  return (
    <div className={`q-courses${compact ? ' compact' : ''}`}>
      {!compact && <AddDish menu={menu} skip={skip} onPick={add} showPrices={showPrices} />}
      {courses.map(c => {
        const g = pickOf(c);
        const dishes = c.entries.flatMap(e => (e.choice ? e.choice.items : [e.item!]));
        return (
          <div key={c.name} className={`q-course${g ? ' choice' : ''}`}>
            <div className="q-course-head">
              <span><b>{c.name}</b> <span className="n">{g ? `· customer picks ${Math.min(Math.max(1, g.meta.pick), g.items.length)} of ${g.items.length}` : dishes.length > 1 ? `· ${dishes.length}` : ''}</span></span>
              <span className="q-course-acts">
                {!compact && <span className="r">{right(c)}</span>}
                {(dishes.length > 1 || g) && <button type="button" className="q-mini" onClick={() => setChoose(c.name)}>{g ? 'Edit the choice' : `Let ${who} choose`}</button>}
              </span>
            </div>
            <div className="q-chips">{dishes.map(chip)}</div>
          </div>
        );
      })}
      {!items.length && !compact && <p className="q-hint">No dishes yet. Type a dish above, or start from a package.</p>}
      {compact && (adding
        ? <AddDish menu={menu} skip={skip} onPick={add} showPrices={showPrices} autoFocus placeholder="Type a dish name" onBlurEmpty={() => setAdding(false)} />
        : <div className="q-chips"><button type="button" className="q-mini" onClick={() => setAdding(true)}>+ Dish</button></div>)}
      {editing && <DishEditor anchor={edit!.el} item={editing} items={items} menu={menu} toLine={toLine} onChange={onChange} onClose={() => setEdit(null)} />}
      {course && <ChoiceDialog course={course} items={items} menu={menu} who={who} toLine={toLine} preview={preview} onChange={onChange} onClose={() => setChoose(null)} />}
    </div>
  );
};

export default MenuCourses;
