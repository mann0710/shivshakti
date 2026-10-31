import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FoodStyle, stylesText } from '../../lib/foodStyles';
import { CellErrors, Col, Edits, FIELD_LABEL, Field, RowEdit, SheetRow, changedFields, merged, parseClip, toggleStyle, wasText } from '../../lib/menuSheet';
import StylePicker from './StylePicker';
import '../../styles/menu-sheet.css';

export type OnCell = <F extends Field>(base: SheetRow, field: F, value: SheetRow[F]) => void;
export type At = { r: number; c: number };

interface Props {
  rows: SheetRow[];
  edits: Edits;
  errors: CellErrors;
  cols: readonly Col[];
  selected: Set<string>;
  subName: (id: string) => string;
  onCell: OnCell;
  onSelect: (ids: string[], on: boolean) => void;
  onPaste: (at: At, grid: string[][]) => void;
}

const WIDTH: Record<Col, string> = { name: 'minmax(180px, 1.6fr)', price: '150px', styles: 'minmax(150px, 1fr)', shown: '110px' };
// Typing j, s or o on a food style cell flips that style.
const STYLE_KEYS: Record<string, FoodStyle> = { j: 'jain', s: 'swaminarayan', o: 'onion_garlic' };

const cellOf = (el: EventTarget | null): At | null => {
  const m = (el as HTMLElement | null)?.dataset?.cell?.split(':');
  return m ? { r: Number(m[0]), c: Number(m[1]) } : null;
};
const isText = (el: EventTarget | null): el is HTMLInputElement => el instanceof HTMLInputElement && el.type === 'text';

interface LineProps {
  base: SheetRow;
  edit?: RowEdit;
  r: number;
  cols: readonly Col[];
  picked: boolean;
  nameErr?: string;
  priceErr?: string;
  subName: (id: string) => string;
  onCell: OnCell;
  onSelect: (ids: string[], on: boolean) => void;
  onPick: (r: number, el: HTMLElement) => void;
}

// One dish row; memoised so typing in one cell does not redraw the whole sheet.
const Line = React.memo(function Line({ base, edit, r, cols, picked, nameErr, priceErr, subName, onCell, onSelect, onPick }: LineProps) {
  const cur = { ...base, ...edit };
  const changed = new Set(changedFields(base, edit));
  const err: Partial<Record<Col, string>> = { name: nameErr, price: priceErr };
  const noteId = (f: Col) => `ms-${base.id}-${f}`;
  const note = (f: Col) => err[f] ? <small id={noteId(f)} className="ms-note err">{err[f]}</small>
    : changed.has(f) ? <small id={noteId(f)} className="ms-note">{wasText(f, base[f], subName)}</small> : null;
  const text = (f: 'name' | 'price', c: number, props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input data-cell={`${r}:${c}`} value={cur[f]} aria-label={`${FIELD_LABEL[f]}, ${base.name}`} aria-invalid={!!err[f]}
      aria-describedby={err[f] || changed.has(f) ? noteId(f) : undefined} {...props} />
  );

  const body: Record<Col, (c: number) => React.ReactNode> = {
    name: c => <>
      {text('name', c, { onChange: e => onCell(base, 'name', e.target.value) })}
      {changed.has('sub') && <small className="ms-note">Moves to {subName(cur.sub)}</small>}
    </>,
    price: c => <span className="ms-in">
      {cur.price && <i aria-hidden="true">₹</i>}
      {text('price', c, { inputMode: 'decimal', placeholder: 'Set price', onChange: e => onCell(base, 'price', e.target.value.replace(/[^\d.]/g, '')) })}
    </span>,
    styles: c => (
      <button type="button" data-cell={`${r}:${c}`} aria-haspopup="dialog" aria-label={`${FIELD_LABEL.styles}, ${base.name}: ${stylesText(cur.styles) || 'none'}`}
        onClick={e => onPick(r, e.currentTarget)}>{stylesText(cur.styles) || <span className="ms-add">+ style</span>}</button>
    ),
    shown: c => (
      <button type="button" role="switch" data-cell={`${r}:${c}`} aria-checked={cur.shown} aria-label={`${FIELD_LABEL.shown}, ${base.name}`}
        className={cur.shown ? 'ms-on' : 'ms-off'} onClick={() => onCell(base, 'shown', !cur.shown)}>{cur.shown ? 'Shown' : 'Hidden'}</button>
    ),
  };

  return (
    <div role="row" aria-selected={picked} className={`ms-row${picked ? ' picked' : ''}`}>
      <span role="gridcell" className="ms-pick">
        <input type="checkbox" checked={picked} aria-label={`Select ${base.name}`} onChange={e => onSelect([base.id], e.target.checked)} />
      </span>
      {cols.map((f, c) => (
        <span key={f} role="gridcell" className={`ms-cell${changed.has(f) ? ' edited' : ''}${err[f] ? ' bad' : ''}`}>{body[f](c)}{note(f)}</span>
      ))}
    </div>
  );
});

// The sheet itself: type into cells, Tab / Enter / arrows move, Ctrl+V pastes a block from Excel.
const SheetGrid: React.FC<Props> = ({ rows, edits, errors, cols, selected, subName, onCell, onSelect, onPaste }) => {
  const box = useRef<HTMLDivElement>(null);
  const all = useRef<HTMLInputElement>(null);
  const [pick, setPick] = useState<{ r: number; el: HTMLElement } | null>(null);
  const some = rows.some(r => selected.has(r.id));
  const every = rows.length > 0 && rows.every(r => selected.has(r.id));
  useEffect(() => { if (all.current) all.current.indeterminate = some && !every; }, [some, every]);
  const onPick = useCallback((r: number, el: HTMLElement) => setPick({ r, el }), []);

  const focusCell = (r: number, c: number) => {
    const el = box.current?.querySelector<HTMLElement>(`[data-cell="${r}:${c}"]`);
    if (!el) return false;
    el.focus();
    if (isText(el)) el.select();
    return true;
  };

  const onKey = (e: React.KeyboardEvent) => {
    const at = cellOf(e.target);
    if (!at || e.altKey || e.ctrlKey || e.metaKey) return;
    const { r, c } = at;
    const last = cols.length - 1;
    const input = isText(e.target) ? e.target : null;
    if (!input && cols[c] === 'styles') {
      const cur = merged(rows[r], edits).styles;
      const s = STYLE_KEYS[e.key.toLowerCase()];
      if (s) { e.preventDefault(); onCell(rows[r], 'styles', toggleStyle(cur, s)); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); onCell(rows[r], 'styles', []); return; }
    }
    let to: [number, number];
    switch (e.key) {
      case 'Tab': to = e.shiftKey ? (c > 0 ? [r, c - 1] : [r - 1, last]) : (c < last ? [r, c + 1] : [r + 1, 0]); break;
      case 'Enter': e.preventDefault(); to = [r + (e.shiftKey ? -1 : 1), c]; break;
      case 'ArrowDown': to = [r + 1, c]; break;
      case 'ArrowUp': to = [r - 1, c]; break;
      // In a text box the arrows walk the text first, then leave at its ends.
      case 'ArrowLeft': if (input && (input.selectionStart !== 0 || input.selectionEnd !== 0)) return; to = [r, c - 1]; break;
      case 'ArrowRight': if (input && input.selectionStart !== input.value.length) return; to = [r, c + 1]; break;
      default: return;
    }
    if (focusCell(...to)) e.preventDefault();
  };

  // One value into a text box pastes as usual; a column or block from Excel fills the cells below and right.
  const paste = (e: React.ClipboardEvent) => {
    const at = cellOf(e.target);
    if (!at) return;
    const grid = parseClip(e.clipboardData.getData('text/plain'));
    if (grid.length === 1 && grid[0].length === 1 && isText(e.target)) return;
    e.preventDefault();
    onPaste(at, grid);
  };

  const pickRow = pick ? rows[pick.r] : undefined;
  const closePick = () => { pick?.el.focus(); setPick(null); };

  return (
    <div className="ms-scroll">
      <div ref={box} role="grid" aria-label="Dishes" aria-rowcount={rows.length + 1} className="ms-grid"
        style={{ '--ms-cols': `40px ${cols.map(c => WIDTH[c]).join(' ')}` } as React.CSSProperties} onKeyDown={onKey} onPaste={paste}>
        <div role="row" className="ms-row th">
          <span role="columnheader" className="ms-pick">
            <input ref={all} type="checkbox" checked={every} aria-label="Select all" onChange={e => onSelect(rows.map(r => r.id), e.target.checked)} />
          </span>
          {cols.map(c => <span key={c} role="columnheader">{FIELD_LABEL[c]}</span>)}
        </div>
        {rows.map((b, r) => (
          <Line key={b.id} base={b} edit={edits[b.id]} r={r} cols={cols} picked={selected.has(b.id)} nameErr={errors[b.id]?.name} priceErr={errors[b.id]?.price}
            subName={subName} onCell={onCell} onSelect={onSelect} onPick={onPick} />
        ))}
      </div>
      {pick && pickRow && (
        <StylePicker anchor={pick.el} value={merged(pickRow, edits).styles} label={`${FIELD_LABEL.styles} for ${pickRow.name}`}
          onToggle={s => onCell(pickRow, 'styles', toggleStyle(merged(pickRow, edits).styles, s))} onClose={closePick} />
      )}
    </div>
  );
};

export default SheetGrid;
