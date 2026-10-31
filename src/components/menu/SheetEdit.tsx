import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useConfirm } from '../ui/ConfirmDialog';
import { useBulkUpdateMenuItems } from '../../hooks/useMenuBuilder';
import { recordImportUndo } from '../../hooks/useRecycleBin';
import { CatNode, Dish, filterDishes, plural } from '../../lib/menuCatalog';
import {
  COLS, Edits, Field, SheetRow, applyStyles, cellErrors, changesOf, merged, pasteGrid, pctPrice, planSave, readPrice, rowOf, setCell, setMany, summary,
} from '../../lib/menuSheet';
import type { UndoStep } from '../../lib/recycleBin';
import NameDialog from '../settings/NameDialog';
import PanelHead, { Mode } from './PanelHead';
import SheetGrid, { At, OnCell } from './SheetGrid';
import SheetToolbar, { SheetAction } from './SheetToolbar';
import SheetReview from './SheetReview';
import { PctAsk, PriceAsk, StylesAsk } from './SheetAsk';
import '../../styles/menu-sheet.css';

interface Props {
  crumb: string;
  title: string;
  subId: string;
  dishes: Dish[];
  tree: CatNode[];
  hasPrice: boolean;
  // food_styles and deleted_items exist: the Food style column and an undo copy.
  hasBin: boolean;
  mode: Mode;
  onDirty: (n: number) => void;
  onSaved: () => void;
}

type Ask = 'price' | 'pct' | 'move' | 'styles' | 'review' | null;

// One subcategory's dishes as a sheet: edits stay here until Review & save, which keeps an undo copy.
const SheetEdit: React.FC<Props> = ({ crumb, title, subId, dishes, tree, hasPrice, hasBin, mode, onDirty, onSaved }) => {
  const { confirm, dialog: confirmDialog } = useConfirm();
  const bulk = useBulkUpdateMenuItems();
  const wrap = useRef<HTMLDivElement>(null);
  const [edits, setEdits] = useState<Edits>({});
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [ask, setAsk] = useState<Ask>(null);

  // Hidden dishes too: the On quotes column is where they come back.
  const mine = useMemo(() => filterDishes(dishes, { subId, showHidden: true }), [dishes, subId]);
  const rows = useMemo(() => mine.map(rowOf), [mine]);
  const cols = useMemo(() => COLS.filter(c => (hasPrice || c !== 'price') && (hasBin || c !== 'styles')), [hasPrice, hasBin]);
  const subNames = useMemo(() => new Map(tree.flatMap(c => c.subs.map(s => [s.sub.id, s.sub.name] as const))), [tree]);
  const subName = useCallback((id: string) => subNames.get(id) ?? 'another subcategory', [subNames]);
  const changes = useMemo(() => changesOf(rows, edits, subName), [rows, edits, subName]);
  const errors = useMemo(() => cellErrors(rows, edits, dishes), [rows, edits, dishes]);
  const bad = Object.values(errors).reduce((t, e) => t + Object.keys(e).length, 0);
  const picked = rows.filter(r => selected.has(r.id));
  const now = picked.map(r => merged(r, edits));
  const allShown = now.every(r => r.shown);
  const n = changes.length;

  useEffect(() => { onDirty(n); }, [n, onDirty]);
  useEffect(() => () => onDirty(0), [onDirty]);

  const onCell = useCallback<OnCell>((base, field, value) => setEdits(e => setCell(e, base, field, value)), []);
  const onSelect = useCallback((ids: string[], on: boolean) => setSelected(s => {
    const next = new Set(s);
    ids.forEach(id => (on ? next.add(id) : next.delete(id)));
    return next;
  }), []);
  const bulkSet = <F extends Field>(field: F, valueOf: (cur: SheetRow) => SheetRow[F] | undefined) => setEdits(e => setMany(e, picked, field, valueOf));

  const onPaste = (at: At, grid: string[][]) => {
    const r = pasteGrid(edits, rows, at, grid, cols);
    if (!r.cells) { toast.error('Nothing to paste there'); return; }
    setEdits(r.edits);
    toast.success(`Pasted ${plural(r.cells, 'cell')}${r.extra ? ` · ${plural(r.extra, 'line')} past the last dish left out` : ''}`);
  };

  const changePct = (pct: number) => {
    const empty = now.filter(r => !readPrice(r.price).value).length;
    bulkSet('price', cur => { const p = readPrice(cur.price).value; return p ? String(pctPrice(p, pct)) : undefined; });
    if (empty) toast(`${plural(empty, 'dish', 'dishes')} without a price left as is`);
  };

  const discard = async () => {
    if (!(await confirm({ title: `Throw away ${plural(n, 'change')}?`, message: 'The sheet goes back to what is saved.', confirmLabel: 'Throw away', cancelLabel: 'Keep editing', danger: true }))) return;
    setEdits({}); setSelected(new Set());
  };

  // Errors first: jump to the first red cell instead of opening the review.
  const review = () => {
    const r = rows.findIndex(x => errors[x.id]);
    if (r < 0) { setAsk('review'); return; }
    const c = cols.indexOf(errors[rows[r].id].name ? 'name' : 'price');
    wrap.current?.querySelector<HTMLElement>(`[data-cell="${r}:${c}"]`)?.focus();
    toast.error(`Fix ${plural(bad, 'cell')} in red first`);
  };

  const keepUndo = async (steps: UndoStep[], count: number) => {
    if (hasBin) await recordImportUndo(`Menu sheet · ${plural(count, 'change')} in ${title}`, steps).catch(() => toast.error('Saved, but the undo copy could not be kept'));
  };

  // A failed batch keeps its changes in the sheet; what did save still gets its undo copy.
  const save = async (progress: (done: number) => void) => {
    const { items, undo } = planSave(mine, edits);
    try {
      await bulk.mutateAsync({ items, onProgress: progress });
    } catch (e: any) {
      const saved = new Set<string>(e?.saved ?? []);
      if (saved.size) {
        await keepUndo(undo.filter(s => saved.has(s.id)), changes.filter(c => saved.has(c.id)).length);
        setEdits(cur => Object.fromEntries(Object.entries(cur).filter(([id]) => !saved.has(id))));
      }
      throw e;
    }
    await keepUndo(undo, n);
    toast.success(`${plural(n, 'change')} saved in ${title}.${hasBin ? ' Undo from Settings › Data › Recycle bin.' : ''}`);
    onSaved();
  };

  const actions: SheetAction[] = [
    ...(hasPrice ? [{ label: 'Set price…', onClick: () => setAsk('price') }, { label: 'Change by %…', onClick: () => setAsk('pct') }] : []),
    { label: 'Move to…', onClick: () => setAsk('move') },
    ...(hasBin ? [{ label: 'Food style…', onClick: () => setAsk('styles') }] : []),
    { label: allShown ? 'Hide from quotes' : 'Show on quotes', onClick: () => bulkSet('shown', () => !allShown) },
  ];

  const close = () => setAsk(null);
  const dialog = (() => {
    switch (ask) {
      case 'price': return <PriceAsk count={picked.length} onClose={close} onApply={p => bulkSet('price', () => p)} />;
      case 'pct': return <PctAsk count={picked.length} prices={now.map(r => readPrice(r.price).value ?? 0).filter(p => p > 0)} onClose={close} onApply={changePct} />;
      case 'styles': return <StylesAsk count={picked.length} styles={now.map(r => r.styles)} onClose={close} onApply={c => bulkSet('styles', cur => applyStyles(cur.styles, c))} />;
      case 'move': return <NameDialog title={`Move ${plural(picked.length, 'dish', 'dishes')}`} sub="Pick the subcategory they belong in. Nothing is saved until Review & save."
        hideName tree={tree} subId={subId} primary="Move" onClose={close} onSave={async r => bulkSet('sub', () => r.subId)} />;
      case 'review': return <SheetReview changes={changes} title={title} canUndo={hasBin} onClose={close} onSave={save} />;
      default: return null;
    }
  })();

  return (
    <div ref={wrap} className="ms-wrap">
      <section className="mb-panel" aria-label={`${title} sheet`}>
        <PanelHead crumb={crumb} title={title} count={rows.length} mode={mode} />
        {picked.length > 0 && <SheetToolbar count={picked.length} actions={actions} onClear={() => setSelected(new Set())} />}
        {rows.length
          ? <SheetGrid rows={rows} edits={edits} errors={errors} cols={cols} selected={selected} subName={subName} onCell={onCell} onSelect={onSelect} onPaste={onPaste} />
          : <div className="mb-empty">No dishes here yet. Switch to View to add one.</div>}
      </section>
      <p className="ms-hint">Type straight into a cell · Tab moves right · Enter moves down · Ctrl+V pastes a column from Excel</p>
      {n > 0 && (
        <div className="ms-bar">
          <span><b>{plural(n, 'unsaved change')}</b> · {summary(changes)}{bad > 0 && <em> · {plural(bad, 'cell')} to fix</em>}</span>
          <div>
            <button type="button" className="ui-btn" onClick={discard}>Discard</button>
            <button type="button" className="ui-btn primary" onClick={review}>Review &amp; save {n}</button>
          </div>
        </div>
      )}
      {dialog}
      {confirmDialog}
    </div>
  );
};

export default SheetEdit;
