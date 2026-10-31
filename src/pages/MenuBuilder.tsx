import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useConfirm } from '../components/ui/ConfirmDialog';
import {
  useMenuCategories, useCreateCategory, useUpdateCategory, useDeleteCategory,
  useMenuSubcategories, useCreateSubcategory, useUpdateSubcategory, useDeleteSubcategory,
  useMenuItemsFull, useCreateMenuItem, useUpdateMenuItem, useDeleteMenuItem,
} from '../hooks/useMenuBuilder';
import { useHasPriceColumns, useHasTeamBin } from '../hooks/useSchemaStatus';
import { buildTree, copyName, Dish, filterDishes, plural, withoutPrice } from '../lib/menuCatalog';
import { inr } from '../lib/money';
import { undoToast } from '../components/pos/undoToast';
import MenuTree from '../components/settings/MenuTree';
import DishTable, { DishActions, Group } from '../components/settings/DishTable';
import NameDialog from '../components/settings/NameDialog';
import SheetEdit from '../components/menu/SheetEdit';
import { useSheetGuard } from '../components/menu/useSheetGuard';
import ImportScreen from '../components/data/ImportScreen';
import PasteDishesDialog from '../components/data/PasteDishesDialog';
import '../styles/settings.css';

type Dlg = { kind: 'newCat' } | { kind: 'newSub'; catId: string } | { kind: 'newDish' } | { kind: 'rename'; g: Group } | { kind: 'edit'; d: Dish } | { kind: 'move'; d: Dish };

const fail = (e: any) => toast.error(e?.message || 'Could not save');

// Categories on the left, the picked subcategory's dishes on the right; prices and "on quotes" change in place.
const MenuBuilder: React.FC = () => {
  const { confirm, dialog: confirmDialog } = useConfirm();
  const hasPrice = useHasPriceColumns();
  // Food styles and the recycle bin come with the same migration.
  const hasBin = useHasTeamBin();
  const { data: cats = [] } = useMenuCategories();
  const { data: subs = [] } = useMenuSubcategories();
  const { data: dishes = [] } = useMenuItemsFull();
  const createCat = useCreateCategory(); const updateCat = useUpdateCategory(); const deleteCat = useDeleteCategory();
  const createSub = useCreateSubcategory(); const updateSub = useUpdateSubcategory(); const deleteSub = useDeleteSubcategory();
  const createItem = useCreateMenuItem(); const updateItem = useUpdateMenuItem(); const deleteItem = useDeleteMenuItem();

  const [query, setQuery] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [noPrice, setNoPrice] = useState(false);
  const [openCat, setOpenCat] = useState<string | null>(null);
  // undefined: the open category's first subcategory; null: the whole category.
  const [subId, setSubId] = useState<string | null | undefined>(undefined);
  const [fresh, setFresh] = useState<string | null>(null);
  const [dlg, setDlg] = useState<Dlg | null>(null);
  const [importing, setImporting] = useState(false);
  const [pasting, setPasting] = useState(false);

  const tree = useMemo(() => buildTree(cats, subs, dishes, showHidden), [cats, subs, dishes, showHidden]);
  // A hidden or deleted pick falls back to the first category, or to the whole category.
  const catNode = tree.find(t => t.cat.id === openCat) ?? tree[0];
  const cat = catNode?.cat.id ?? null;
  const subNode = subId === undefined ? catNode?.subs[0] : catNode?.subs.find(s => s.sub.id === subId);
  const sub = subNode?.sub.id ?? null;
  const active = dishes.filter(d => d.is_active).length;
  const missing = hasPrice ? withoutPrice(dishes) : 0;
  const searching = query.trim().length > 0;
  const shown = useMemo(() => filterDishes(dishes, { catId: cat, subId: sub, query, showHidden, noPrice }), [dishes, cat, sub, query, showHidden, noPrice]);
  // Edit as sheet works on one subcategory; moving away with unsaved cells asks first.
  const { sheet, dirty, setDirty, toggle: setSheet, done: closeSheet, guard } = useSheetGuard(confirm, !searching && !noPrice && !!subNode);
  // After adding something, jump to it unless that would drop unsaved sheet cells.
  const jump = (fn: () => void) => { if (!dirty) fn(); };

  const reveal = (id: string, subcategory_id: string) => jump(() => {
    const c = subs.find(s => s.id === subcategory_id)?.category_id ?? null;
    setOpenCat(c); setSubId(subcategory_id); setQuery(''); setNoPrice(false); setFresh(id);
    setTimeout(() => document.getElementById(`dish-${id}`)?.scrollIntoView({ block: 'nearest' }), 300);
  });
  const toggle = (d: Dish, patch: Partial<Dish>, back: Partial<Dish>, message: string) =>
    updateItem.mutateAsync({ id: d.id, ...patch }).then(() => undoToast(message, () => updateItem.mutate({ id: d.id, ...back }))).catch(fail);

  const act: DishActions = {
    price: (d, p) => toggle(d, { default_price: p }, { default_price: d.default_price ?? null }, `${d.name}: ${p ? `${inr(p)} a plate` : 'price cleared'}`),
    shown: (d, on) => toggle(d, { is_active: on }, { is_active: !on }, on ? `${d.name} shown on quotes` : `${d.name} hidden from quotes`),
    edit: d => setDlg({ kind: 'edit', d }),
    move: d => setDlg({ kind: 'move', d }),
    duplicate: d => {
      const taken = dishes.filter(x => x.subcategory_id === d.subcategory_id).map(x => x.name);
      createItem.mutateAsync({ name: copyName(d.name, taken), subcategory_id: d.subcategory_id, default_price: d.default_price ?? null })
        .then((r: Dish) => { toast.success(`${r.name} added`); reveal(r.id, r.subcategory_id); }).catch(fail);
    },
    remove: async d => {
      if (!(await confirm({ title: `Delete ${d.name}?`, message: 'Old quotations keep their copy. Hide it from quotes instead if you may use it again.', confirmLabel: 'Delete', danger: true }))) return;
      deleteItem.mutateAsync(d.id).then(() => toast.success(`${d.name} deleted`)).catch(fail);
    },
    add: async (name, price) => {
      if (!sub) return;
      try { const r: Dish = await createItem.mutateAsync({ name, subcategory_id: sub, default_price: hasPrice ? price : null }); setFresh(r.id); }
      catch (e) { fail(e); }
    },
    renameGroup: g => setDlg({ kind: 'rename', g }),
    shownGroup: g => {
      const run = (is_active: boolean) => (g.kind === 'cat' ? updateCat : updateSub).mutateAsync({ id: g.id, is_active });
      run(!g.is_active).then(() => undoToast(g.is_active ? `${g.name} hidden from quotes` : `${g.name} shown on quotes`, () => { run(g.is_active).catch(fail); })).catch(fail);
    },
    removeGroup: async g => {
      const what = g.kind === 'cat' ? 'category, its subcategories and their dishes' : 'subcategory and its dishes';
      if (!(await confirm({ title: `Delete ${g.name}?`, message: `This deletes the ${what}. Old quotations keep their copy. You can restore it from Settings › Data › Recycle bin for 30 days.`, confirmLabel: 'Delete', danger: true }))) return;
      try {
        await (g.kind === 'cat' ? deleteCat : deleteSub).mutateAsync(g.id);
        toast.success(`${g.name} deleted`);
        if (g.kind === 'cat') setOpenCat(null);
        setSubId(undefined);
      } catch (e) { fail(e); }
    },
  };

  const view = searching
    ? { crumb: '', title: `Search "${query.trim()}"`, group: null, addTo: null }
    : noPrice ? { crumb: '', title: 'Dishes without a price', group: null, addTo: null }
    : subNode && catNode ? { crumb: catNode.cat.name, title: subNode.sub.name, group: { kind: 'sub' as const, ...subNode.sub }, addTo: subNode.sub.name }
    : catNode ? { crumb: '', title: catNode.cat.name, group: { kind: 'cat' as const, ...catNode.cat }, addTo: null }
    : null;

  const onCat = (id: string) => guard(() => {
    setQuery(''); setNoPrice(false);
    if (id === cat) { setSubId(null); return; }
    setOpenCat(id); setSubId(undefined);
  });

  const dialogEl = (() => {
    if (!dlg) return null;
    const close = () => setDlg(null);
    switch (dlg.kind) {
      case 'newCat': return <NameDialog title="New category" sub="For example Sweet, Farsan or Chinese Cuisine." primary="Add category" onClose={close}
        onSave={r => createCat.mutateAsync(r.name).then((c: { id: string }) => { jump(() => { setOpenCat(c.id); setSubId(undefined); }); toast.success(`${r.name} added`); })} />;
      case 'newSub': return <NameDialog title="New subcategory" sub={`Inside ${cats.find(c => c.id === dlg.catId)?.name ?? 'this category'}.`} primary="Add subcategory" onClose={close}
        onSave={r => createSub.mutateAsync({ name: r.name, category_id: dlg.catId }).then((s: { id: string }) => { jump(() => { setOpenCat(dlg.catId); setSubId(s.id); }); toast.success(`${r.name} added`); })} />;
      case 'newDish': return <NameDialog title="New dish" sub="It shows in quotations straight away." label="Dish name" tree={tree} subId={sub ?? ''} withPrice={hasPrice} primary="Add dish" onClose={close}
        onSave={r => createItem.mutateAsync({ name: r.name, subcategory_id: r.subId, default_price: r.price }).then((d: Dish) => { reveal(d.id, d.subcategory_id); toast.success(`${r.name} added`); })} />;
      case 'rename': return <NameDialog title={`Rename ${dlg.g.name}`} sub="Old quotations keep the old name." name={dlg.g.name} onClose={close}
        onSave={r => (dlg.g.kind === 'cat' ? updateCat : updateSub).mutateAsync({ id: dlg.g.id, name: r.name })} />;
      case 'edit': return <NameDialog title={`Edit ${dlg.d.name}`} sub="Old quotations keep their copy." label="Dish name" name={dlg.d.name} tree={tree} subId={dlg.d.subcategory_id}
        withPrice={hasPrice} price={dlg.d.default_price} onClose={close}
        onSave={r => updateItem.mutateAsync({ id: dlg.d.id, name: r.name, subcategory_id: r.subId, ...(hasPrice ? { default_price: r.price } : {}) }).then(() => reveal(dlg.d.id, r.subId))} />;
      case 'move': return <NameDialog title={`Move ${dlg.d.name}`} sub="Pick the subcategory it belongs in." hideName tree={tree} subId={dlg.d.subcategory_id} primary="Move" onClose={close}
        onSave={r => updateItem.mutateAsync({ id: dlg.d.id, subcategory_id: r.subId }).then(() => reveal(dlg.d.id, r.subId))} />;
      default: return null;
    }
  })();

  if (importing) return <ImportScreen kind="dishes" onClose={() => setImporting(false)} />;

  return (
    <div className="mb-page">
      <div className="mb-head">
        <div>
          <h1>Menu Builder</h1>
          <p>{plural(active, 'dish', 'dishes')} in {plural(tree.length, 'category', 'categories')} · picked from here when you make a quotation</p>
        </div>
        <div className="mb-head-acts">
          <button type="button" className="ui-btn" onClick={() => guard(() => setImporting(true))}>Import from Excel</button>
          <button type="button" className="ui-btn" onClick={() => setDlg({ kind: 'newCat' })}>+ New category</button>
          <button type="button" className="ui-btn primary" onClick={() => setDlg({ kind: 'newDish' })}>+ New dish</button>
        </div>
      </div>

      <label className="mb-search">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B6B66" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        <span className="st-sr">Search dishes</span>
        <input type="search" value={query} placeholder={`Search all ${plural(active, 'dish', 'dishes')}, subcategories and categories`} onChange={e => { const v = e.target.value; guard(() => setQuery(v)); }} />
      </label>

      {missing > 0 && (
        <div className="mb-banner">
          <span>{missing === active
            ? <><b>No dish has a price yet; today prices are typed into each quote.</b> Add a per-plate price and it fills in by itself when the dish is added to a quotation.</>
            : <><b>{plural(missing, 'dish', 'dishes')} still {missing === 1 ? 'has' : 'have'} no price.</b> A per-plate price fills in by itself when the dish is added to a quotation.</>}</span>
          <button type="button" className="ui-btn" onClick={() => guard(() => { setNoPrice(!noPrice); setQuery(''); })}>{noPrice ? 'Back to categories' : 'Show dishes without a price'}</button>
        </div>
      )}

      <div className="mb-layout">
        <MenuTree tree={tree} openCat={cat} subId={sub} showHidden={showHidden} onCat={onCat}
          onSub={(c, s) => guard(() => { setOpenCat(c); setSubId(s); setQuery(''); setNoPrice(false); })}
          onAddSub={c => setDlg({ kind: 'newSub', catId: c })} onShowHidden={setShowHidden} />
        {sheet && catNode && subNode ? (
          <SheetEdit key={subNode.sub.id} crumb={catNode.cat.name} title={subNode.sub.name} subId={subNode.sub.id} dishes={dishes} tree={tree} hasPrice={hasPrice} hasBin={hasBin}
            mode={{ sheet, onChange: setSheet }} onDirty={setDirty} onSaved={closeSheet} />
        ) : view ? (
          <DishTable {...view} dishes={shown} showPlace={searching || noPrice} hasPrice={hasPrice} fresh={fresh} act={act}
            mode={view.group?.kind === 'sub' ? { sheet, onChange: setSheet } : undefined} onPaste={subNode ? () => setPasting(true) : undefined} />
        ) : (
          <div className="mb-panel"><div className="mb-empty">Add a category to start, for example Sweet or Farsan.</div></div>
        )}
      </div>
      {dialogEl}
      {pasting && subNode && <PasteDishesDialog sub={subNode.sub} dishes={dishes} onClose={() => setPasting(false)} />}
      {confirmDialog}
    </div>
  );
};

export default MenuBuilder;
