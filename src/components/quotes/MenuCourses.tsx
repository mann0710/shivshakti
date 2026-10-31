import React, { useMemo, useRef, useState } from 'react';
import type { QuotationLineItem } from '../../hooks/useQuotations';
import type { Course } from '../../lib/menuOrder';
import { coursesOf } from '../../lib/quoteSummary';
import { tidyGroups } from '../../lib/quoteChoices';
import type { PickerItem } from '../../lib/quoteLines';
import { dropDish, moveCourse, renameCourse, setCourse } from '../../lib/quoteCourses';
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

type Drag = { id: string; course?: undefined } | { course: string; id?: undefined };

// The menu as courses of dish chips; "choose" courses are highlighted. Tap a dish to edit it,
// drag a dish to any spot or course, drag a course by its grip, click a course name to rename it.
const MenuCourses: React.FC<Props> = ({ items, menu, showPrices, who, toLine, preview, onChange, compact }) => {
  const courses = useMemo(() => coursesOf(items), [items]);
  const [edit, setEdit] = useState<{ id: string; el: HTMLElement } | null>(null);
  const [choose, setChoose] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [naming, setNaming] = useState<{ from: string; text: string } | null>(null);
  const cancelled = useRef(false);
  const [adding, setAdding] = useState(false);
  const skip = useMemo(() => new Set(items.map(i => i.item_id)), [items]);
  const add = (it: PickerItem) => onChange([...items, toLine(it)]);
  const names = courses.map(c => c.name);
  const courseOf = (id: string) => courses.find(c => c.entries.some(e => (e.choice ? e.choice.items : [e.item!]).some(i => i.item_id === id)))?.name ?? '';
  const end = () => { setDrag(null); setOver(null); };
  const start = (e: React.DragEvent, d: Drag, ghost?: Element | null) => {
    setDrag(d);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', d.id ?? d.course);
    if (ghost) e.dataTransfer.setDragImage(ghost, 16, 16);
  };
  // A dish dropped on a dish lands before it; on a course, at its end. A course lands before or after.
  const dropOn = (e: React.DragEvent, course: string, beforeId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (drag?.id) onChange(dropDish(items, drag.id, { course, beforeId }));
    else if (drag?.course) onChange(moveCourse(items, drag.course, course, names.indexOf(drag.course) < names.indexOf(course)));
    end();
  };
  const overOn = (e: React.DragEvent, key: string) => { if (!drag) return; e.preventDefault(); e.stopPropagation(); setOver(key); };
  // Esc unmounts the box and fires blur; that blur must not save.
  const rename = () => { if (naming && !cancelled.current) onChange(renameCourse(items, naming.from, naming.text)); cancelled.current = false; setNaming(null); };

  const chip = (i: QuotationLineItem, course: string) => {
    return (
      <span key={i.item_id} className={`q-dish${i.choice ? ' alt' : ''}${drag?.id === i.item_id ? ' drag' : ''}${over === `d:${i.item_id}` && drag?.id && drag.id !== i.item_id ? ' over' : ''}`} draggable
        onDragStart={e => start(e, { id: i.item_id })} onDragEnd={end}
        onDragOver={e => (drag?.id ? overOn(e, `d:${i.item_id}`) : undefined)}
        onDrop={e => (drag?.id ? dropOn(e, course, i.item_id) : undefined)}>
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
          <div key={c.name} className={`q-course${g ? ' choice' : ''}${drag?.course === c.name ? ' drag' : ''}${over === `c:${c.name}` && drag?.course !== c.name ? ' drop' : ''}`}
            onDragOver={e => overOn(e, `c:${c.name}`)} onDrop={e => dropOn(e, c.name)}>
            <div className="q-course-head">
              <span className="q-course-title">
                <span className="q-grip" draggable title="Drag to move this course" aria-hidden="true"
                  onDragStart={e => start(e, { course: c.name }, e.currentTarget.closest('.q-course'))} onDragEnd={end}>⠿</span>
                {naming?.from === c.name
                  ? <input className="q-cname-in" autoFocus aria-label={`New name for ${c.name}`} value={naming.text} onChange={e => setNaming({ from: c.name, text: e.target.value })}
                      onBlur={rename} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { cancelled.current = true; setNaming(null); } }} />
                  : <button type="button" className="q-cname" title="Rename this course in this quote" onClick={() => setNaming({ from: c.name, text: c.name })}>{c.name}</button>}
                <span className="n">{g ? `· customer picks ${Math.min(Math.max(1, g.meta.pick), g.items.length)} of ${g.items.length}` : dishes.length > 1 ? `· ${dishes.length}` : ''}</span></span>
              <span className="q-course-acts">
                {!compact && <span className="r">{right(c)}</span>}
                {(dishes.length > 1 || g) && <button type="button" className="q-mini" onClick={() => setChoose(c.name)}>{g ? 'Edit the choice' : `Let ${who} choose`}</button>}
              </span>
            </div>
            <div className="q-chips">{dishes.map(i => chip(i, c.name))}</div>
          </div>
        );
      })}
      {!items.length && !compact && <p className="q-hint">No dishes yet. Type a dish above, or start from a package.</p>}
      {compact && (adding
        ? <AddDish menu={menu} skip={skip} onPick={add} showPrices={showPrices} autoFocus placeholder="Type a dish name" onBlurEmpty={() => setAdding(false)} />
        : <div className="q-chips"><button type="button" className="q-mini" onClick={() => setAdding(true)}>+ Dish</button></div>)}
      {editing && <DishEditor anchor={edit!.el} item={editing} items={items} menu={menu} toLine={toLine} onChange={onChange} onClose={() => setEdit(null)}
        courses={names} course={courseOf(editing.item_id)} onCourse={name => onChange(setCourse(items, editing.item_id, name))} />}
      {course && <ChoiceDialog course={course} items={items} menu={menu} who={who} toLine={toLine} preview={preview} onChange={onChange} onClose={() => setChoose(null)} />}
    </div>
  );
};

export default MenuCourses;
