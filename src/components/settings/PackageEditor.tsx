import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Menu } from '../../types';
import { useCreateMenu, useUpdateMenu } from '../../hooks/useMenus';
import { setNavIntent } from '../../hooks/useNavIntent';
import { useHasTeamBin } from '../../hooks/useSchemaStatus';
import { GroupRef, addDish, copyName, plateRow, withCount } from '../../lib/menuCatalog';
import { Sample, TierRow, checkTiers, cleanTiers, startRows, toRows } from '../../lib/priceTiers';
import { undoToast } from '../pos/undoToast';
import PriceTiers, { PriceErrors, PriceMode } from './PriceTiers';
import '../../styles/settings.css';

export const CUISINES = ['Gujarati', 'Punjabi', 'South Indian', 'Continental', 'Jain', 'Package'];

interface Props {
  menu?: Menu;
  places: Map<string, string>;
  groups: GroupRef[];
  suggestions: string[];
  takenNames: string[];
  sample: Sample;
  onSaved: (id: string) => void;
  onDirty: (dirty: boolean) => void;
}

type Draft = { name: string; price: string; category: string; items: string[]; mode: PriceMode; tiers: TierRow[] };
const toDraft = (m?: Menu): Draft => {
  const tiers = cleanTiers(m?.price_tiers);
  return { name: m?.name ?? '', price: m ? String(m.price_per_plate) : '', category: m?.category ?? 'Gujarati', items: m?.items ?? [], mode: tiers.length ? 'guests' : 'one', tiers: toRows(tiers) };
};
// What Save would write: the price of the mode not in use does not count as a change.
const shape = (d: Draft) => JSON.stringify({ ...d, price: d.mode === 'one' ? d.price : '', tiers: d.mode === 'guests' ? d.tiers : [] });

// One package: name, plate price, cuisine and the dishes on the plate, saved with Save.
const PackageEditor: React.FC<Props> = ({ menu, places, groups, suggestions, takenNames, sample, onSaved, onDirty }) => {
  const create = useCreateMenu();
  const update = useUpdateMenu();
  // price_tiers is only written once the database has the column.
  const tiersOn = useHasTeamBin();
  const start = useMemo(() => toDraft(menu), [menu]);
  const [d, setD] = useState<Draft>(start);
  const [dish, setDish] = useState('');
  const [errors, setErrors] = useState<PriceErrors & { name?: string }>({});
  const busy = create.isPending || update.isPending;
  const dirty = shape(d) !== shape(start);

  useEffect(() => { setD(start); setErrors({}); }, [start]);
  useEffect(() => { onDirty(dirty); }, [dirty]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch: Partial<Draft>) => { setD(x => ({ ...x, ...patch })); setErrors({}); };
  const add = () => { set({ items: addDish(d.items, dish) }); setDish(''); };
  const recount = (i: number, n: number) => set({ items: d.items.map((x, j) => (j === i ? withCount(plateRow(x, places, groups), n) : x)) });
  // By guests starts from the one price; the first range's price comes back when switching back.
  const setMode = (mode: PriceMode) => set(mode === 'guests'
    ? { mode, tiers: d.tiers.length ? d.tiers : startRows(d.price) }
    : { mode, price: d.price || d.tiers[0]?.price || '' });

  const save = async () => {
    const tiered = tiersOn && d.mode === 'guests';
    const check = checkTiers(d.tiers);
    // The first range's price stays in price_per_plate so screens without tiers still show one.
    const price = tiered ? check.tiers[0]?.price ?? 0 : parseFloat(d.price.replace(/[^\d.]/g, ''));
    const e: typeof errors = { name: d.name.trim() ? undefined : 'Type a name' };
    if (tiered && check.error) Object.assign(e, { rows: check.errors, tiers: check.error });
    if (!tiered && !(price > 0)) e.price = 'Type the price per plate';
    if (e.name || e.price || e.tiers) { setErrors(e); return; }
    const row = { name: d.name.trim(), price_per_plate: price, ...(tiersOn ? { price_tiers: tiered ? check.tiers : [] } : {}), category: d.category, items: d.items };
    try {
      const saved: Menu = menu ? await update.mutateAsync({ id: menu.id, ...row }) : await create.mutateAsync({ ...row, description: '', is_active: true });
      toast.success(menu ? 'Package saved' : `${row.name} added`);
      onSaved(saved.id);
    } catch (err: any) { toast.error(err?.message || 'Could not save'); }
  };

  const duplicate = async () => {
    if (!menu) return;
    try {
      const copy: Menu = await create.mutateAsync({ name: copyName(menu.name, takenNames), description: menu.description ?? '', price_per_plate: menu.price_per_plate, ...(tiersOn ? { price_tiers: cleanTiers(menu.price_tiers) } : {}), category: menu.category, items: menu.items, is_active: true });
      toast.success(`${copy.name} made`);
      onSaved(copy.id);
    } catch (err: any) { toast.error(err?.message || 'Could not duplicate'); }
  };

  const setShown = async (is_active: boolean) => {
    if (!menu) return;
    try {
      await update.mutateAsync({ id: menu.id, is_active });
      onSaved(menu.id);
      undoToast(is_active ? `${menu.name} is back on quotes` : `${menu.name} hidden from quotes and bookings`, () => update.mutate({ id: menu.id, is_active: !is_active }));
    } catch (err: any) { toast.error(err?.message || 'Could not change it'); }
  };

  const startQuote = () => { setNavIntent('quotations', { action: 'new' }); window.location.hash = 'quotations'; };

  return (
    <section className="pk-editor" aria-label={menu ? menu.name : 'New package'}>
      <div className="pk-fields two">
        <label className="st-field"><span>Package name</span>
          <input value={d.name} placeholder="e.g. Gujarati Thali" className={errors.name ? 'bad' : ''} onChange={e => set({ name: e.target.value })} autoFocus={!menu} />
          {errors.name && <small className="bad">{errors.name}</small>}
        </label>
        <label className="st-field"><span>Cuisine</span>
          <select value={d.category} onChange={e => set({ category: e.target.value })}>
            {Array.from(new Set([...CUISINES, d.category])).map(c => <option key={c}>{c}</option>)}
          </select>
        </label>
      </div>
      <PriceTiers canTier={tiersOn} mode={tiersOn ? d.mode : 'one'} price={d.price} rows={d.tiers} sample={sample} errors={errors}
        onMode={setMode} onPrice={price => set({ price })} onRows={tiers => set({ tiers })} />

      <div className="pk-plate">
        <h2>What the plate has</h2>
        <p>A course like "Sabji 2" means pick any 2. Dishes found in Menu Builder go onto a quotation by themselves with this plate price.</p>
      </div>
      <div className="pk-table">
        <div className="pk-tr th"><span>Course or dish</span><span>How many</span><span>Picked from</span><span /></div>
        {!d.items.length && <div className="mb-empty">Nothing on the plate yet. Add a course or a dish below.</div>}
        {d.items.map((text, i) => {
          const r = plateRow(text, places, groups);
          return (
            <div key={text} className="pk-tr">
              <b>{r.name}{r.extra && <small> {r.extra}</small>}</b>
              {r.count === null ? <span className="pk-fixed">1</span> : (
                <span className="pk-step">
                  <button type="button" aria-label={`Fewer ${r.name}`} disabled={r.count <= 1} onClick={() => recount(i, r.count! - 1)}>−</button>
                  <output aria-live="polite">{r.count}</output>
                  <button type="button" aria-label={`More ${r.name}`} disabled={r.count >= 20} onClick={() => recount(i, r.count! + 1)}>+</button>
                </span>
              )}
              <span className={r.place || r.group ? '' : 'muted'}>{r.place ? `${r.place} · fixed` : r.group ? `${r.group}${r.count && r.count > 1 ? ` · pick any ${r.count}` : ''}` : 'Typed course · not matched to Menu Builder'}</span>
              <button type="button" className="st-x" aria-label={`Remove ${r.name}`} onClick={() => set({ items: d.items.filter((_, j) => j !== i) })}>×</button>
            </div>
          );
        })}
        <div className="pk-add">
          <input list="pk-dishes" value={dish} placeholder="+ Add a course (Sabji 2) or a dish" aria-label="Add a course or a dish"
            onChange={e => setDish(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
          <datalist id="pk-dishes">{suggestions.map(n => <option key={n} value={n} />)}</datalist>
          <button type="button" className="ui-btn" onClick={add} disabled={!dish.trim()}>Add</button>
        </div>
      </div>

      <div className="pk-foot">
        {menu && <button type="button" className="ui-btn" onClick={duplicate} disabled={busy}>Duplicate</button>}
        {menu && <button type="button" className="ui-btn" onClick={() => setShown(!menu.is_active)} disabled={busy}>{menu.is_active ? 'Hide package' : 'Show package'}</button>}
        <span className="grow" />
        {menu && <button type="button" className="ui-btn st-outline" onClick={startQuote}>Start a quotation</button>}
        <button type="button" className="ui-btn primary" onClick={save} disabled={busy || (!!menu && !dirty)}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </section>
  );
};

export default PackageEditor;
