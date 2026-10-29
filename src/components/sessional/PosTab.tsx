import React, { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import ProductGrid from '../pos/ProductGrid';
import TicketPanel from '../pos/TicketPanel';
import PackPicker from '../pos/PackPicker';
import SaleDone from '../pos/SaleDone';
import { useSeasonalItems, usePackDefaults, SeasonalItem } from '../../hooks/useSeasonalItems';
import { useSeasonalOrders, useCreateSeasonalOrder, useUpdateSeasonalOrder, SeasonalOrder } from '../../hooks/useSeasonalOrders';
import { useCreateSeasonalPreorder, useUpdateSeasonalPreorder, SeasonalPreorder } from '../../hooks/useSeasonalPreorders';
import { useSeasonalCustomers, useCreateSeasonalCustomer } from '../../hooks/useSeasonalCustomers';
import { SeasonalOccasion } from '../../hooks/useSeasonalOccasions';
import { useStoredState } from '../../hooks/useStoredState';
import { addLine, makeLine, packsByItem } from '../../lib/cart';
import { itemPacks } from '../../lib/itemCatalog';
import { Pack } from '../../lib/units';
import { inr, isValidPhone, cleanPhone } from '../../lib/money';
import { ReceiptData } from '../../lib/receipt';
import { orderReceipt, preorderReceipt } from '../../lib/sessionalReceipts';
import {
  PosForm, PosMode, emptyForm, formFromOrder, formFromPreorder, totalsOf, validate, toOrderPayload, toPreorderPayload, WALK_IN,
} from '../../lib/posForm';
import { inp } from '../ui/styles';

export type EditTarget = { kind: 'bill'; order: SeasonalOrder } | { kind: 'preorder'; preorder: SeasonalPreorder };

interface Props {
  occasions: SeasonalOccasion[];
  edit?: EditTarget | null;
  gst?: string;
  onEditDone: (kind: 'bill' | 'preorder') => void;
}

const DRAFT_KEY = 'sessional-pos-draft';
const thisYear = new Date().getFullYear();

const initialForm = (edit?: EditTarget | null): PosForm =>
  !edit ? emptyForm() : edit.kind === 'bill' ? formFromOrder(edit.order) : formFromPreorder(edit.preorder);

// Grid on the left, bill on the right; one screen for counter bills, pre-bookings and edits.
const PosTab: React.FC<Props> = ({ occasions, edit, gst, onEditDone }) => {
  const { data: allItems = [], isLoading } = useSeasonalItems();
  const { data: orders = [] } = useSeasonalOrders(thisYear);
  const { data: customers = [] } = useSeasonalCustomers();
  const defaults = usePackDefaults();
  const createOrder = useCreateSeasonalOrder();
  const updateOrder = useUpdateSeasonalOrder();
  const createPre = useCreateSeasonalPreorder();
  const updatePre = useUpdateSeasonalPreorder();
  const createCustomer = useCreateSeasonalCustomer();

  const [form, setForm] = useStoredState<PosForm>(edit ? null : DRAFT_KEY, () => initialForm(edit));
  const [picking, setPicking] = useState<SeasonalItem | null>(null);
  const [done, setDone] = useState<{ receipt: ReceiptData; change: number } | null>(null);
  const [formKey, setFormKey] = useState(0);
  const set = useCallback((patch: Partial<PosForm>) => setForm(f => ({ ...f, ...patch })), [setForm]);

  const occName = (id?: string | null) => occasions.find(o => o.id === id)?.name;
  const items = useMemo(
    () => allItems.filter(i => i.is_active && (!form.occasion_id || !i.occasion_id || i.occasion_id === form.occasion_id)),
    [allItems, form.occasion_id],
  );
  const popularity = useMemo(() => packsByItem(orders.flatMap(o => o.items)), [orders]);
  const inCart = useMemo(() => packsByItem(form.lines), [form.lines]);
  const totals = totalsOf(form);
  const busy = createOrder.isPending || updateOrder.isPending || createPre.isPending || updatePre.isPending;

  const addPack = useCallback((item: SeasonalItem, pack: Pack, qty = 1) => {
    setDone(null);
    setForm(f => ({ ...f, lines: addLine(f.lines, makeLine(item, pack.size, pack.price, qty)) }));
  }, [setForm]);

  const reset = (mode: PosMode = form.mode) => {
    setForm(emptyForm(mode, form.occasion_id));
    setFormKey(k => k + 1);
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
        await updateOrder.mutateAsync({ id: edit.order.id, ...toOrderPayload(form, totals, edit.order.year) });
        toast.success('Bill updated');
        onEditDone('bill');
      } else if (edit?.kind === 'preorder') {
        const { status, ...rest } = toPreorderPayload(form, totals, edit.preorder.year);
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

  const onMode = (mode: PosMode) => set({ mode, delivery_date: mode === 'preorder' && !form.delivery_date ? emptyForm('preorder').delivery_date : form.delivery_date });
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
        {isLoading ? <div className="pos-panel" style={{ color: '#888880' }}>Loading items…</div> : (
          <ProductGrid items={items} defaults={defaults} popularity={popularity} inCart={inCart}
            onAdd={addPack} onOpen={setPicking} toolbar={occasionSelect} />
        )}
        {done && !form.lines.length ? (
          <section className="pos-panel pos-ticket" id="pos-ticket">
            <SaleDone receipt={done.receipt} change={done.change} onNext={() => setDone(null)} />
          </section>
        ) : (
          <TicketPanel form={form} totals={totals} customers={customers} busy={busy} set={set} onMode={onMode}
            onCharge={charge} onClear={() => reset()} formKey={formKey}
            editingLabel={edit ? (edit.kind === 'bill' ? `bill of ${edit.order.customer_name}` : `pre-booking of ${edit.preorder.customer_name}`) : undefined}
            onCancelEdit={() => onEditDone(edit?.kind ?? 'bill')} />
        )}
      </div>

      {count > 0 && (
        <div className="pos-paybar">
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#888880' }}>{count} item{count === 1 ? '' : 's'}</div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{inr(totals.total)}</div>
          </div>
          <button type="button" className="pos-charge" style={{ width: 'auto', height: 44, padding: '0 22px', fontSize: 15 }}
            onClick={() => document.getElementById('pos-ticket')?.scrollIntoView({ behavior: 'smooth' })}>
            View bill →
          </button>
        </div>
      )}

      {picking && (
        <PackPicker item={picking} packs={itemPacks(picking, defaults)} onClose={() => setPicking(null)}
          onAdd={(size, price, qty) => addPack(picking, { size, price, label: '', manual: false }, qty)} />
      )}
    </div>
  );
};

export default PosTab;
