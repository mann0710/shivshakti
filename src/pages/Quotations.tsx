import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useQuoteForm } from '../hooks/useQuoteForm';
import { useAcceptFlow } from '../hooks/useAcceptFlow';
import { useStoredState } from '../hooks/useStoredState';
import { useHasQuoteOptions } from '../hooks/useSchemaStatus';
import { useDeleteQuotation, Quotation } from '../hooks/useQuotations';
import { Navigate, useNavIntent } from '../hooks/useNavIntent';
import { downloadDoc } from '../lib/docs/output';
import { quotationDoc } from '../lib/docs/quotationDoc';
import { siblingsOf, nextLabel, quoteCopy, sameDayNote } from '../lib/quoteOptions';
import { useConfirm } from '../components/ui/ConfirmDialog';
import QuotationPackagePicker from '../components/catering/QuotationPackagePicker';
import QuotationList from '../components/catering/QuotationList';
import QuotationCalendar from '../components/catering/QuotationCalendar';
import QuotationOptionsBar from '../components/catering/QuotationOptionsBar';
import QuotationItemPanels, { ItemTextField } from '../components/catering/QuotationItemPanels';
import QuotationMultiDay from '../components/catering/QuotationMultiDay';
import QuotationCharges from '../components/catering/QuotationCharges';
import QuotationEventFields from '../components/catering/QuotationEventFields';

interface Props { onNavigate?: Navigate }
type View = 'list' | 'calendar';

const Quotations: React.FC<Props> = ({ onNavigate }) => {
  const f = useQuoteForm();
  const flow = useAcceptFlow(onNavigate);
  const deleteQuotation = useDeleteQuotation();
  const hasOptions = useHasQuoteOptions();
  const { confirm, dialog } = useConfirm();
  const intent = useNavIntent('quotations');
  const intentHandled = useRef(false);
  const formRef = useRef<HTMLDivElement>(null);
  const [pdfWithPrices, setPdfWithPrices] = useState(true);
  const [optBusy, setOptBusy] = useState(false);
  const [viewPref, setViewPref] = useStoredState<{ view: View }>('shivshakti.quoteView', () => ({ view: 'list' }));
  const { quotations, editingId, editingQuotation, ev } = f;
  const siblings = editingQuotation ? siblingsOf(editingQuotation, quotations) : [];

  // Bring the form into view when it opens or switches quotation.
  useEffect(() => {
    if (f.showForm) formRef.current?.scrollIntoView?.({ block: 'start' });
  }, [f.showForm, editingId]);

  // Nav intent: 'new' opens the form (booking preselected); 'open' edits a quotation by its id or booking id.
  useEffect(() => {
    if (!intent || intentHandled.current) return;
    if (intent.action === 'open') {
      if (!f.quotationsFetched) return;
      intentHandled.current = true;
      const q = intent.id ? quotations.find(x => x.id === intent.id) ?? quotations.find(x => x.booking_id === intent.id) : undefined;
      if (q) { f.openEdit(q); return; }
      if (!intent.id) return;
    }
    intentHandled.current = true;
    f.openCreate();
    if (intent.id) ev.selectBooking(intent.id);
  }, [intent, f.quotationsFetched]); // eslint-disable-line

  const save = async () => { if (await f.handleSave()) f.resetForm(); };

  const handleDelete = async (q: Quotation) => {
    const ok = await confirm({ title: 'Delete quotation?', message: `${q.quotation_number}${q.customer?.name ? ` for ${q.customer.name}` : ''} will be deleted permanently.`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try {
      await deleteQuotation.mutateAsync(q.id);
      if (editingId === q.id) f.resetForm();
      toast.success('Deleted');
    } catch (e: any) { toast.error(e?.message || 'Failed to delete'); }
  };

  const handleClone = async (q: Quotation) => {
    const ok = await confirm({ title: 'Clone quotation?', message: `A new draft will be created with the same details as ${q.quotation_number}.`, confirmLabel: 'Clone' });
    if (!ok) return;
    try { await f.createQuotation.mutateAsync(quoteCopy(q)); toast.success('Cloned as new draft'); }
    catch (e: any) { toast.error(e?.message || 'Failed to clone'); }
  };

  // Copies the saved quote as the next option (B, C…) of the same enquiry and opens it.
  const addOption = async () => {
    const cur = editingQuotation;
    if (!cur || f.dirty) return;
    setOptBusy(true);
    try {
      const group = cur.option_group || crypto.randomUUID();
      const sibs = cur.option_group ? siblings : [{ ...cur, option_label: 'A' }];
      if (!cur.option_group) await f.updateQuotation.mutateAsync({ id: cur.id, option_group: group, option_label: 'A' });
      const label = nextLabel(sibs);
      const created = await f.createQuotation.mutateAsync({ ...quoteCopy(cur), option_group: group, option_label: label, option_name: null });
      f.openEdit(created);
      toast.success(`Option ${label} added — change its menu and price`);
    } catch (e: any) { toast.error(e?.message || 'Could not add an option'); }
    finally { setOptBusy(false); }
  };

  const switchOption = async (q: Quotation) => {
    if (f.dirty && !(await confirm({ title: 'Switch option?', message: 'Unsaved changes in this option will be lost.', confirmLabel: 'Switch' }))) return;
    f.openEdit(q);
  };

  const openNewOn = (date: string) => { f.openCreate(date); };
  const view: View = viewPref.view;
  const date = f.isMultiDay ? (f.eventDays[0]?.date || '') : (f.selectedBooking?.event_date || ev.draft.date);
  const note = f.showForm ? sameDayNote(date, f.selectedBooking?.venue || ev.draft.venue || '', quotations, f.bookings,
    { id: editingId ?? undefined, group: editingQuotation?.option_group, bookingId: f.selectedBooking?.id }) : '';
  const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  return (
    <div style={{ padding: '20px 16px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Quotations</h2>
          <div style={{ fontSize: 12, color: '#888880', marginTop: 2 }}>{quotations.length} quotation{quotations.length !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div role="group" aria-label="View" style={{ display: 'flex', border: '0.5px solid #D0D0CC', borderRadius: 8, overflow: 'hidden' }}>
            {(['list', 'calendar'] as View[]).map(v => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => setViewPref({ view: v })}
                style={{ padding: '7px 14px', border: 'none', fontSize: 13, cursor: 'pointer', background: view === v ? '#E8750A' : '#fff', color: view === v ? '#fff' : '#555550', fontWeight: view === v ? 600 : 400 }}>
                {v === 'list' ? 'List' : 'Calendar'}
              </button>
            ))}
          </div>
          {!f.showForm && <button onClick={() => f.openCreate()} style={btnPrimary}>+ New Quotation</button>}
        </div>
      </div>

      {f.showForm && (
        <div key={editingId || 'new'} ref={formRef} style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #E5E5E0', marginBottom: 24, overflow: 'hidden', scrollMarginTop: 12 }}>
          <div style={{ padding: '14px 20px', borderBottom: '0.5px solid #E5E5E0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{editingQuotation ? `Edit ${editingQuotation.quotation_number}` : 'New Quotation'}</div>
            <button onClick={() => f.resetForm()} aria-label="Close form" style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888880' }}>×</button>
          </div>

          <div style={{ padding: '16px' }}>
            <QuotationOptionsBar current={editingQuotation} siblings={siblings} enabled={hasOptions} dirty={f.dirty} busy={optBusy}
              name={f.optionName} onName={f.setOptionName} onSwitch={switchOption} onAdd={addOption} onAccept={flow.accept} />

            {note && (
              <div role="status" style={{ marginBottom: 12, padding: '9px 12px', borderRadius: 8, background: '#FFF6E5', border: '0.5px solid #F2C77E', fontSize: 12.5, color: '#6D4C00', lineHeight: 1.45 }}>{note}</div>
            )}

            <QuotationEventFields
              ev={ev} bookings={f.eligibleBookings} editing={!!editingId}
              foodType={f.foodType} onFoodType={f.setFoodType}
              isMultiDay={f.isMultiDay} onMultiDay={f.toggleMultiDay}
              itemPrices={f.showPrices} onItemPrices={f.setItemPricesPref} lockItemPrices={f.hasItemPrices} />

            {f.isMultiDay ? (
              <QuotationMultiDay
                eventDays={f.eventDays} setEventDays={f.setEventDays}
                activeMealKey={f.activeMealKey} setActiveMealKey={f.setActiveMealKey}
                guestCount={f.guestCount} defaultDate={f.selectedBooking?.event_date || ev.draft.date || ''}
                menuItems={f.activeItems} priceFor={f.priceFor} showPrices={f.showPrices} />
            ) : (
              <>
                <QuotationPackagePicker menuItems={f.activeItems} bookingMenuId={f.selectedBooking?.menu_id} onApply={f.applyPackage} />
                <QuotationItemPanels showPrices={f.showPrices}
                  menuItems={f.activeItems} items={f.selectedItems}
                  selectedTitle="SELECTED ITEMS" totalLabel="Plate price from items"
                  onAdd={f.addItem}
                  onAmount={(id, amount) => f.patchItem(id, { amount })}
                  onRemove={id => f.setSelectedItems(prev => prev.filter(i => i.item_id !== id))}
                  onText={(id, field: ItemTextField, value) => f.patchItem(id, { [field]: value })}
                  onReorder={f.reorderItems}
                  onReset={() => f.setSelectedItems([])}
                  onChoice={f.setSelectedItems} toLine={f.toLine} />

                <div style={{ marginTop: 14, background: '#F9F8F5', borderRadius: 10, padding: '12px 16px', border: '0.5px solid #E5E5E0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: '#666', whiteSpace: 'nowrap' }}>
                    Per Plate (₹)
                    <input type="number" min="0" inputMode="decimal" value={f.perPlate} onChange={e => f.typePerPlate(e.target.value)}
                      placeholder="0" style={{ width: 100, border: '1px solid #E5E5E0', borderRadius: 7, padding: '6px 8px', fontSize: 13, textAlign: 'right', background: '#fff' }} />
                  </label>
                  {f.perPlateMax != null && <span style={{ fontSize: 12.5, fontWeight: 600, color: '#A84F00' }}>customer pays {rupees(f.plateLow)} – {rupees(f.perPlateMax)} by their picks</span>}
                  <span style={{ fontSize: 13, color: '#888880' }}>×</span>
                  <div style={{ fontSize: 13, color: '#444' }}><strong>{f.guestCount}</strong> <span style={{ color: '#888880' }}>guests</span></div>
                  <span style={{ fontSize: 13, color: '#888880' }}>=</span>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1A18' }}>
                    {rupees(f.totals.subtotal)}{f.perPlateMax != null ? ` – ${rupees(f.perPlateMax * f.guestCount)}` : ''}
                    <span style={{ fontSize: 11, color: '#888880', fontWeight: 400, marginLeft: 4 }}>(Subtotal)</span>
                  </div>
                  {f.showPrices && (
                    <label title="On: the price you typed. Off: adds up the dish prices. Either way, alternatives add or take off their price difference." style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginLeft: 'auto', cursor: 'pointer' }}>
                      <input type="checkbox" checked={!f.autoPrice} onChange={e => f.setAutoPrice(!e.target.checked)} style={{ accentColor: '#E8750A', width: 15, height: 15 }} />
                      Own price
                    </label>
                  )}
                </div>
              </>
            )}

            <QuotationCharges
              isMultiDay={f.isMultiDay} eventDays={f.eventDays} gstRate={f.dcGstRate}
              gstChecked={f.gstChecked} setGstChecked={f.setGstChecked}
              discounts={f.additionalDiscounts} setDiscounts={f.setAdditionalDiscounts}
              extraCharges={f.extraCharges} setExtraCharges={f.setExtraCharges}
              transport={f.transportationCharges} setTransport={f.setTransportationCharges}
              totals={{
                mealSavings: f.totals.mealSavings, discount: f.totals.discount,
                extra: f.extraCharges.reduce((s, c) => s + (c.amount || 0), 0),
                transport: f.transportationCharges.reduce((s, c) => s + (c.amount || 0), 0),
                gst: f.totals.gst, multiDaySubtotal: f.isMultiDay ? f.totals.subtotal : 0,
                perPlate: f.plateLow, subtotal: f.isMultiDay ? 0 : f.totals.subtotal, final: f.totals.final,
              }} />
            {f.totalMax != null && (
              <div style={{ marginTop: 6, textAlign: 'right', fontSize: 12.5, color: '#A84F00', fontWeight: 600 }}>
                Up to {rupees(f.totalMax)} depending on the customer's picks
              </div>
            )}

            <div style={{ marginTop: 14 }}>
              <label style={lbl}>NOTES (OPTIONAL)</label>
              <textarea value={f.notes} onChange={e => f.setNotes(e.target.value)} rows={2} placeholder="Add any notes…" style={{ ...inp, resize: 'vertical' }} />
            </div>

            <div style={{ marginTop: 14, padding: '10px 14px', background: '#F5F8FF', border: '0.5px solid #B8C8F4', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <label style={{ display: f.showPrices ? 'flex' : 'none', alignItems: 'center', gap: 7, fontSize: 12, cursor: 'pointer', userSelect: 'none', marginRight: 'auto' }}>
                <input type="checkbox" checked={pdfWithPrices} onChange={e => setPdfWithPrices(e.target.checked)} style={{ accentColor: '#E8750A', width: 14, height: 14 }} />
                <span>Include item prices in PDF</span>
              </label>
              <button onClick={() => { const q = f.draftQuotation(); downloadDoc(() => quotationDoc(q, { withPrices: f.showPrices && pdfWithPrices, options: siblings })); }} style={{ ...btnSmall, background: '#378ADD' }}>⬇ Download PDF</button>
              {editingId && (
                <button onClick={() => flow.share(f.draftQuotation(), f.showPrices && pdfWithPrices, siblings)} style={{ ...btnSmall, background: '#1DA851' }}>📤 Share</button>
              )}
            </div>

            <div style={{ marginTop: 10, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => f.resetForm()} style={btnGhost}>Cancel</button>
              <button onClick={save} disabled={f.isSaving} style={{ ...btnPrimary, opacity: f.isSaving ? 0.6 : 1 }}>
                {f.isSaving ? 'Saving…' : editingId ? 'Update Quotation' : 'Save Quotation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {view === 'calendar'
        ? <QuotationCalendar quotations={quotations} onOpen={f.openEdit} onNew={openNewOn} />
        : <QuotationList quotations={quotations}
            onPdf={q => downloadDoc(() => quotationDoc(q, { options: siblingsOf(q, quotations) }))}
            onShare={q => { flow.share(q, true, siblingsOf(q, quotations)); }}
            onEdit={f.openEdit} onClone={handleClone} onDelete={handleDelete} onStatus={flow.setStatus} />}

      {flow.ui}
      {dialog}
    </div>
  );
};

const btnPrimary: React.CSSProperties = { background: '#E8750A', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const btnGhost: React.CSSProperties = { border: '1px solid #E5E5E0', background: '#fff', borderRadius: 8, padding: '8px 18px', fontSize: 13, cursor: 'pointer' };
const btnSmall: React.CSSProperties = { color: '#fff', border: 'none', borderRadius: 7, padding: '7px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' };
const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#888880', display: 'block', marginBottom: 4 };
const inp: React.CSSProperties = { width: '100%', border: '1px solid #E5E5E0', borderRadius: 8, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box', background: '#fff' };

export default Quotations;
