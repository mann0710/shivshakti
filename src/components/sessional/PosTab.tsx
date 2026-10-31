import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import ProductGrid from '../pos/ProductGrid';
import TicketPanel from '../pos/TicketPanel';
import PackPicker from '../pos/PackPicker';
import SaleDone from '../pos/SaleDone';
import HeldBills from '../pos/HeldBills';
import { undoToast } from '../pos/undoToast';
import { useSessionRank } from '../pos/useSessionRank';
import { useSeasonalItems, usePackDefaults, SeasonalItem } from '../../hooks/useSeasonalItems';
import { useSeasonalOrders, useCreateSeasonalOrder, useUpdateSeasonalOrder, SeasonalOrder } from '../../hooks/useSeasonalOrders';
import { useSeasonalPreorders, useCreateSeasonalPreorder, useUpdateSeasonalPreorder, SeasonalPreorder } from '../../hooks/useSeasonalPreorders';
import { useSeasonalCustomers, useCreateSeasonalCustomer } from '../../hooks/useSeasonalCustomers';
import { SeasonalOccasion } from '../../hooks/useSeasonalOccasions';
import { useStoredState } from '../../hooks/useStoredState';
import { addLine, makeLine, packsByItem } from '../../lib/cart';
import { itemPacks } from '../../lib/itemCatalog';
import { Pack } from '../../lib/units';
import { inr, isValidPhone, cleanPhone } from '../../lib/money';
import { billPayments, preorderPayments } from '../../lib/payments';
import { owedBy } from '../../lib/dues';
import { HeldBill, holdBill, takeHeld, dropHeld } from '../../lib/heldBills';
import { SweetReceipt } from '../../lib/thermalSlips';
import { orderReceipt, preorderReceipt } from '../../lib/sessionalReceipts';
import {
  PosForm, PosMode, emptyForm, formFromOrder, formFromPreorder, totalsOf, validate, toOrderPayload, toPreorderPayload, WALK_IN,
} from '../../lib/posForm';
import type { PosStart } from '../../lib/posIntent';
import { inp } from '../ui/styles';

export type EditTarget = { kind: 'bill'; order: SeasonalOrder } | { kind: 'preorder'; preorder: SeasonalPreorder };

interface Props {
  occasions: SeasonalOccasion[];
  edit?: EditTarget | null;
  gst?: string;
  onEditDone: (kind: 'bill' | 'preorder') => void;
  start?: PosStart;
}

const DRAFT_KEY = 'sessional-pos-draft';
const HELD_KEY = 'sessional-pos-held';
const thisYear = new Date().getFullYear();

const initialForm = (edit?: EditTarget | null): PosForm =>
  !edit ? emptyForm() : edit.kind === 'bill' ? formFromOrder(edit.order) : formFromPreorder(edit.preorder);

// Switching to a pre-booking gives it a delivery date.
const withMode = (f: PosForm, mode: PosMode): PosForm =>
  ({ ...f, mode, delivery_date: mode === 'preorder' && !f.delivery_date ? emptyForm('preorder').delivery_date : f.delivery_date });

// Grid on the left, bill on the right; one screen for counter bills, pre-bookings and edits.
const PosTab: React.FC<Props> = ({ occasions, edit, gst, onEditDone, start }) => {
  const { data: allItems = [], isLoading } = useSeasonalItems();
  const { data: orders = [], isFetched: ordersFetched } = useSeasonalOrders(thisYear);
  const { data: preorders = [] } = useSeasonalPreorders(thisYear);
  const { data: customers = [] } = useSeasonalCustomers();
  const defaults = usePackDefaults();
  const createOrder = useCreateSeasonalOrder();
  const updateOrder = useUpdateSeasonalOrder();
  const createPre = useCreateSeasonalPreorder();
  const updatePre = useUpdateSeasonalPreorder();
  const createCustomer = useCreateSeasonalCustomer();

  // The bill on the counter survives a refresh; held bills sit beside it.
  const [form, setForm] = useStoredState<PosForm>(edit ? null : DRAFT_KEY, () => initialForm(edit));
  const [held, setHeld] = useStoredState<{ list: HeldBill[] }>(HELD_KEY, () => ({ list: [] }));
  const [picking, setPicking] = useState<{ item: SeasonalItem; loose: boolean } | null>(null);
  const [showHeld, setShowHeld] = useState(false);
  const [done, setDone] = useState<{ receipt: SweetReceipt; change: number } | null>(null);
  const [formKey, setFormKey] = useState(0);
  const set = useCallback((patch: Partial<PosForm>) => setForm(f => ({ ...f, ...patch })), [setForm]);

  const occName = (id?: string | null) => occasions.find(o => o.id === id)?.name;
  const items = useMemo(
    () => allItems.filter(i => i.is_active && (!form.occasion_id || !i.occasion_id || i.occasion_id === form.occasion_id)),
    [allItems, form.occasion_id],
  );
  const popularity = useSessionRank(orders, ordersFetched);
  const inCart = useMemo(() => packsByItem(form.lines), [form.lines]);
  const editId = edit ? (edit.kind === 'bill' ? edit.order.id : edit.preorder.id) : undefined;
  const owed = useMemo(() => owedBy(form.phone, orders, preorders, editId), [form.phone, orders, preorders, editId]);
  const totals = totalsOf(form);
  const busy = createOrder.isPending || updateOrder.isPending || createPre.isPending || updatePre.isPending;

  const addPack = useCallback((item: SeasonalItem, pack: Pack, qty = 1) => {
    setDone(null);
    setForm(f => ({ ...f, lines: addLine(f.lines, makeLine(item, pack.size, pack.price, qty)) }));
  }, [setForm]);
  const openPicker = useCallback((item: SeasonalItem) => setPicking({ item, loose: false }), []);
  const openLoose = useCallback((item: SeasonalItem) => setPicking({ item, loose: true }), []);

  const replaceForm = (next: PosForm) => { setForm(next); setFormKey(k => k + 1); };
  const reset = (mode: PosMode = form.mode) => replaceForm(emptyForm(mode, form.occasion_id));

  // A link from another screen picks bill or pre-booking and the customer; someone else's open bill is held first.
  const started = useRef(false);
  useEffect(() => {
    if (started.current || edit || !start?.mode) return;
    started.current = true;
    const other = !!start.who && form.lines.length > 0 && cleanPhone(form.phone) !== cleanPhone(start.who.phone);
    if (other) { setHeld(h => ({ list: holdBill(h.list, form) })); toast('The open bill was held'); }
    const base = other ? emptyForm(start.mode, form.occasion_id) : form;
    replaceForm({ ...withMode(base, start.mode), ...(start.who ? { customer_name: start.who.name, phone: start.who.phone } : {}) });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const clear = () => { const prev = form; reset(); undoToast('Bill cleared', () => replaceForm(prev)); };
  const hold = () => {
    if (!form.lines.length) return;
    setHeld(h => ({ list: holdBill(h.list, form) }));
    reset();
    toast.success('Bill held');
  };
  const restore = (id: string) => {
    const out = takeHeld(held.list, id, form);
    if (!out.form) return;
    setHeld({ list: out.list });
    replaceForm(out.form);
    setDone(null);
    setShowHeld(false);
  };
  const drop = (id: string) => {
    const prev = held.list;
    setHeld({ list: dropHeld(prev, id) });
    undoToast('Held bill removed', () => setHeld({ list: prev }));
  };

  // New customers with a valid phone are saved automatically for next time.
  const rememberCustomer = async () => {
    const name = form.customer_name.trim();
    if (!name || name === WALK_IN || !isValidPhone(form.phone)) return;
    if (customers.some(c => cleanPhone(c.phone ?? '') === cleanPhone(form.phone))) return;
    try { await createCustomer.mutateAsync({ name, phone: cleanPhone(form.phone), address: form.address.trim() || undefined }); } catch { /* optional */ }
  };

  const charge = async () => {
    const problem = validate(form, totals);
    if (problem) { toast.error(problem); return; }
    try {
      if (edit?.kind === 'bill') {
        await updateOrder.mutateAsync({ id: edit.order.id, ...toOrderPayload(form, totals, edit.order.year, billPayments(edit.order)) });
        toast.success(totals.refund > 0 ? `Bill updated · give back ${inr(totals.refund)}` : 'Bill updated');
        onEditDone('bill');
      } else if (edit?.kind === 'preorder') {
        const { status, ...rest } = toPreorderPayload(form, totals, edit.preorder.year, preorderPayments(edit.preorder));
        await updatePre.mutateAsync({ id: edit.preorder.id, ...rest });
        toast.success('Pre-booking updated');
        onEditDone('preorder');
      } else if (form.mode === 'preorder') {
        const saved = await createPre.mutateAsync(toPreorderPayload(form, totals, thisYear));
        setDone({ receipt: preorderReceipt(saved, occName(saved.occasion_id), gst), change: 0 });
        await rememberCustomer();
        reset('preorder');
      } else {
        const saved = await createOrder.mutateAsync(toOrderPayload(form, totals, thisYear));
        setDone({ receipt: orderReceipt(saved, occName(saved.occasion_id), gst), change: totals.change });
        await rememberCustomer();
        reset('bill');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Could not save');
    }
  };

  const onMode = (mode: PosMode) => setForm(f => withMode(f, mode));
  const count = form.lines.reduce((s, l) => s + l.qty, 0);

  const occasionSelect = (
    <select style={{ ...inp, width: 'auto', height: 44 }} value={form.occasion_id} aria-label="Occasion"
      onChange={e => set({ occasion_id: e.target.value })}>
      <option value="">All occasions</option>
      {occasions.filter(o => o.is_active).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  );

  return (
    <div className="pos-page">
      <div className="pos-layout">
        {isLoading || !ordersFetched ? <div className="pos-panel" style={{ color: '#6B6B66' }}>Loading items…</div> : (
          <ProductGrid items={items} defaults={defaults} popularity={popularity} inCart={inCart}
            onAdd={addPack} onOpen={openPicker} onLoose={openLoose} toolbar={occasionSelect} />
        )}
        {done && !form.lines.length ? (
          <section className="pos-panel pos-ticket" id="pos-ticket">
            <SaleDone receipt={done.receipt} change={done.change} next={form.mode === 'preorder' ? 'New pre-booking' : 'New bill'} onNext={() => setDone(null)} />
          </section>
        ) : (
          <TicketPanel form={form} totals={totals} customers={customers} owed={owed} busy={busy} held={held.list.length} set={set} onMode={onMode}
            onCharge={charge} onClear={clear} onHold={hold} onShowHeld={() => setShowHeld(true)} formKey={formKey}
            editingLabel={edit ? (edit.kind === 'bill' ? `bill of ${edit.order.customer_name}` : `pre-booking of ${edit.preorder.customer_name}`) : undefined}
            onCancelEdit={() => onEditDone(edit?.kind ?? 'bill')} />
        )}
      </div>

      {count > 0 && (
        <div className="pos-paybar">
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: '#5A5A55' }}>{count} item{count === 1 ? '' : 's'}</div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{inr(totals.total)}</div>
          </div>
          <button type="button" className="pos-charge" style={{ width: 'auto', height: 48, padding: '0 22px', fontSize: 15 }}
            onClick={() => document.getElementById('pos-ticket')?.scrollIntoView({ behavior: 'smooth' })}>
            View bill →
          </button>
        </div>
      )}

      {picking && (
        <PackPicker item={picking.item} loose={picking.loose} packs={itemPacks(picking.item, defaults)} onClose={() => setPicking(null)}
          onAdd={(size, price, qty) => addPack(picking.item, { size, price, label: '', manual: false }, qty)} />
      )}
      {showHeld && <HeldBills list={held.list} onRestore={restore} onDrop={drop} onClose={() => setShowHeld(false)} />}
    </div>
  );
};

export default PosTab;
