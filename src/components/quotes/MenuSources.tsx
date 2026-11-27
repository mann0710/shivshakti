import React, { useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import { useMenus } from '../../hooks/useMenus';
import type { Quotation, QuotationLineItem } from '../../hooks/useQuotations';
import { mealTitle } from '../../lib/docs/menu';
import type { PickerItem } from '../../lib/quoteLines';
import { dishCount } from '../../lib/quoteChoices';
import { formatDateIST } from '../../lib/ist';
import { inr } from '../../lib/money';
import { priceAt, rangeAt } from '../../lib/priceTiers';
import type { Menu } from '../../types';
import { PickCard } from './bits';
import { PackageDish, packageDishes } from './packageMenu';

const key = (s: string) => s.trim().toLowerCase();

// "If the menu already has dishes": add to it or start again.
const AddOrReplace: React.FC<{ replace: boolean; onChange: (r: boolean) => void }> = ({ replace, onChange }) => (
  <>
    <div className="q-h">If the menu already has dishes</div>
    <div className="q-cards" role="radiogroup" aria-label="If the menu already has dishes">
      <PickCard on={!replace} title="Add to the menu" line="Keep what is there" onClick={() => onChange(false)} />
      <PickCard on={replace} title="Replace the menu" line="Start again from it" onClick={() => onChange(true)} />
    </div>
  </>
);

interface PackageProps { menuItems: PickerItem[]; hasDishes: boolean; guests: number; onClose: () => void; onApply: (found: PackageDish[], menu: Menu, replace: boolean, missing: string[]) => void }

// "Start from a package": its dishes fill the menu, matched to Menu Builder by name.
export const PackageDialog: React.FC<PackageProps> = ({ menuItems, hasDishes, guests, onClose, onApply }) => {
  const { data: menus = [] } = useMenus();
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState(false);
  const shown = menus.filter(m => !find.trim() || `${m.name} ${m.category} ${(m.items || []).join(' ')}`.toLowerCase().includes(key(find)));
  const [pick, setPick] = useState<string | null>(null);
  const chosen = shown.find(m => m.id === pick) ?? shown[0];
  const apply = () => {
    if (!chosen) return;
    const { found, missing } = packageDishes(chosen.items || [], menuItems);
    onApply(found, chosen, replace, missing);
    onClose();
  };
  return (
    <Modal title="Start from a package" onClose={onClose} width={560}
      footer={<><button type="button" className="ui-btn" onClick={onClose}>Cancel</button>
        <button type="button" className="ui-btn primary" disabled={!chosen} onClick={apply}>{chosen ? `Use ${chosen.name}` : 'Use package'}</button></>}>
      <p className="q-dlg-sub">Its dishes fill the menu. You can still change anything.</p>
      <label className="q-field">Find<input type="search" value={find} onChange={e => setFind(e.target.value)} placeholder="Package name or dish" /></label>
      <div className="q-h">{shown.length} package{shown.length === 1 ? '' : 's'}</div>
      <div className="q-cards q-scroll" role="radiogroup" aria-label="Packages">
        {shown.map(m => (
          <PickCard key={m.id} on={chosen?.id === m.id} title={`${m.name} · ${m.category}`} line={[rangeAt(m, guests), ...(m.items || []).slice(0, 8)].filter(Boolean).join(' · ')}
            right={`${inr(priceAt(m, guests))} a plate`} onClick={() => setPick(m.id)} />
        ))}
        {!shown.length && <p className="q-hint">{menus.length ? 'No package matches.' : 'No packages yet. Make one on the Packages page.'}</p>}
      </div>
      {hasDishes && <AddOrReplace replace={replace} onChange={setReplace} />}
    </Modal>
  );
};

interface CopyProps { quotes: Quotation[]; currentId: string | null; hasDishes: boolean; onClose: () => void; onCopy: (items: QuotationLineItem[], replace: boolean) => void }

interface Source { key: string; title: string; line: string; items: QuotationLineItem[] }

// Every menu that can be copied: a one-meal quote, or each meal of a several-meal quote.
const sourcesOf = (quotes: Quotation[], currentId: string | null): Source[] => quotes.filter(q => q.id !== currentId).flatMap(q => {
  const who = `${q.customer?.name ?? 'Customer'} · ${q.booking?.event_type ?? 'Event'}`;
  const tag = `${q.quotation_number}${q.option_label ? ` · Option ${q.option_label}` : ''}`;
  if (!q.is_multi_day) return (q.items ?? []).length ? [{ key: q.id, title: who, line: `${tag} · ${dishCount(q.items)} dishes · ${formatDateIST(q.created_at, 'd MMM yyyy')}`, items: q.items }] : [];
  return (q.event_days ?? []).flatMap(d => d.meals.filter(m => (m.items ?? []).length).map(m => ({
    key: `${q.id}:${m.id}`, title: `${who} · ${mealTitle(m)}`, line: `${tag}${d.date ? ` · ${formatDateIST(d.date, 'EEE d MMM')}` : ''} · ${dishCount(m.items)} dishes`, items: m.items,
  })));
});

// "Copy from another quote": its dishes, prices, notes and choices (a whole one-meal menu or one meal).
export const CopyDialog: React.FC<CopyProps> = ({ quotes, currentId, hasDishes, onClose, onCopy }) => {
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState(false);
  const shown = useMemo(() => sourcesOf(quotes, currentId)
    .filter(x => !find.trim() || `${x.title} ${x.line}`.toLowerCase().includes(key(find)))
    .slice(0, 40), [quotes, currentId, find]);
  const [pick, setPick] = useState<string | null>(null);
  const chosen = shown.find(x => x.key === pick) ?? shown[0];
  return (
    <Modal title="Copy from another quote" onClose={onClose} width={560}
      footer={<><button type="button" className="ui-btn" onClick={onClose}>Cancel</button>
        <button type="button" className="ui-btn primary" disabled={!chosen} onClick={() => { if (chosen) { onCopy(chosen.items.map(i => ({ ...i, chosen: undefined })), replace); onClose(); } }}>
          {chosen ? `Copy ${dishCount(chosen.items)} dishes` : 'Copy'}</button></>}>
      <p className="q-dlg-sub">Its dishes come over with their prices, notes and choices.</p>
      <label className="q-field">Find<input type="search" value={find} onChange={e => setFind(e.target.value)} placeholder="Name, event, meal or QTN number" /></label>
      <div className="q-cards q-scroll" role="radiogroup" aria-label="Quotes">
        {shown.map(x => <PickCard key={x.key} on={chosen?.key === x.key} title={x.title} line={x.line} onClick={() => setPick(x.key)} />)}
        {!shown.length && <p className="q-hint">No other quote with a menu yet.</p>}
      </div>
      {hasDishes && <AddOrReplace replace={replace} onChange={setReplace} />}
    </Modal>
  );
};
