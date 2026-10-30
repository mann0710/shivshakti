import React, { useState, useMemo, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { todayIST } from '../lib/ist';
import { useQueryClient } from '@tanstack/react-query';
import { useBookings, useUpdateBooking } from '../hooks/useBookings';
import { useMenuItemsFull } from '../hooks/useMenuBuilder';
import { useDataCenter } from '../hooks/useDataCenter';
import {
  useQuotations, useCreateQuotation, useUpdateQuotation,
  useUpdateQuotationStatus, useDeleteQuotation,
  Quotation, QuotationLineItem, EventDay,
} from '../hooks/useQuotations';
import { downloadPDF, getDayNumber } from '../lib/pdf/quotationPdf';
import { shareQuotation } from '../lib/quotationShare';
import { Navigate, useNavIntent } from '../hooks/useNavIntent';
import { useConfirm } from '../components/ui/ConfirmDialog';
import QuotationList from '../components/catering/QuotationList';
import QuotationItemPanels, { PickerItem, ItemTextField } from '../components/catering/QuotationItemPanels';
import QuotationMultiDay, { genId } from '../components/catering/QuotationMultiDay';
import QuotationCharges, { Charge, Discount } from '../components/catering/QuotationCharges';
import QuotationBookingFields from '../components/catering/QuotationBookingFields';

interface Props { onNavigate?: Navigate }

const Quotations: React.FC<Props> = ({ onNavigate }) => {
  const { data: bookings = [] }   = useBookings();
  const { data: menuItems = [] }  = useMenuItemsFull();
  const { data: quotations = [], isFetched: quotationsFetched } = useQuotations();
  const { data: dc }              = useDataCenter();
  const createQuotation = useCreateQuotation();
  const updateQuotation = useUpdateQuotation();
  const qc = useQueryClient();
  const updateStatus    = useUpdateQuotationStatus();
  const deleteQuotation = useDeleteQuotation();
  const { confirm, dialog } = useConfirm();
  const updateBooking = useUpdateBooking();
  const intent = useNavIntent('quotations');
  const intentHandled = useRef(false);
  const formRef = useRef<HTMLDivElement>(null);

  // ── form state ────────────────────────────────────────────────────────────
  const [showForm, setShowForm]             = useState(false);
  const [editingId, setEditingId]           = useState<string | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [selectedItems, setSelectedItems]   = useState<QuotationLineItem[]>([]);
  const [notes, setNotes]                   = useState('');
  const [perPlate, setPerPlate]             = useState('');
  const [gstChecked, setGstChecked]         = useState(false);
  // Rate a saved quote was issued at; new quotes use today's Data Center rate.
  const [savedGstRate, setSavedGstRate]     = useState<number | null>(null);
  const [additionalDiscounts, setAdditionalDiscounts] = useState<Discount[]>([]);
  const [extraCharges, setExtraCharges]     = useState<Charge[]>([]);
  const [transportationCharges, setTransportationCharges] = useState<Charge[]>([]);
  const [foodType, setFoodType]             = useState('');
  const [pdfWithPrices, setPdfWithPrices]   = useState(true);
  const perPlateAutoRef = useRef(true);

  // ── multi-day state ───────────────────────────────────────────────────────
  const [isMultiDay, setIsMultiDay]         = useState(false);
  const [eventDays, setEventDays]           = useState<EventDay[]>([]);
  const [activeMealKey, setActiveMealKey]   = useState<string | null>(null);

  // Auto-enable multi-day when selected booking already has an end_date
  useEffect(() => {
    if (!selectedBookingId || editingId) return;
    const booking = bookings.find(b => b.id === selectedBookingId);
    if (booking?.end_date && booking.end_date !== booking.event_date) {
      setIsMultiDay(true);
      const sections: EventDay[] = [];
      const start = new Date(booking.event_date + 'T00:00:00');
      const end   = new Date(booking.end_date   + 'T00:00:00');
      let cur = new Date(start); let idx = 0;
      while (cur <= end && idx < 15) {
        sections.push({ day_number: idx + 1, date: cur.toLocaleDateString('en-CA'), meals: [], day_subtotal: 0 });
        cur.setDate(cur.getDate() + 1); idx++;
      }
      setEventDays(sections);
    }
  }, [selectedBookingId]); // eslint-disable-line

  const dcGstRate = savedGstRate ?? dc?.gst_rate ?? 18;

  const eligibleBookings = bookings.filter(b => b.status !== 'completed' && b.status !== 'cancelled');
  const selectedBooking  = eligibleBookings.find(b => b.id === selectedBookingId)
    ?? bookings.find(b => b.id === selectedBookingId);

  const guestCount  = selectedBooking?.guest_count || 0;
  const perPlateNum = parseFloat(perPlate) || 0;
  const subtotal    = perPlateNum * guestCount;

  // active subtotal depends on mode
  const multiDaySubtotal = eventDays.reduce((s, d) => s + d.day_subtotal, 0);
  const activeSubtotal   = isMultiDay ? multiDaySubtotal : subtotal;

  // Sum savings from all meal offer rates: (actual_rate - offer_rate) × guests
  const totalMealSavings = useMemo(() => {
    if (!isMultiDay) return 0;
    return eventDays.reduce((sum, day) =>
      sum + day.meals.reduce((ms, m) => {
        const offer = m.discount_amount || 0;
        return offer > 0 && m.per_plate_amount > offer
          ? ms + (m.per_plate_amount - offer) * m.guest_count
          : ms;
      }, 0)
    , 0);
  }, [isMultiDay, eventDays]);

  const additionalDiscountsTotal = additionalDiscounts.reduce((s, d) => s + (d.amount || 0), 0);
  const discountAmt = totalMealSavings + additionalDiscountsTotal;

  const discountedSubtotal       = Math.max(0, activeSubtotal - discountAmt);
  const gstAmount                = gstChecked ? Math.round((discountedSubtotal * dcGstRate) / 100) : 0;
  const extraChargesTotal        = extraCharges.reduce((s, c) => s + (c.amount || 0), 0);
  const transportationChargesTotal = transportationCharges.reduce((s, c) => s + (c.amount || 0), 0);
  const finalTotal               = discountedSubtotal + gstAmount + extraChargesTotal + transportationChargesTotal;

  // ── menu items + default prices ───────────────────────────────────────────
  const activeItems = useMemo(() => menuItems.filter(
    it => it.is_active !== false && it.subcategory?.is_active !== false && it.subcategory?.category?.is_active !== false,
  ), [menuItems]);

  // Latest priced amount per menu item across saved quotations, newest first.
  const lastPrices = useMemo(() => {
    const map = new Map<string, number>();
    [...quotations].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).forEach(q =>
      [...(q.items || []), ...(q.event_days || []).flatMap(d => (d.meals || []).flatMap(m => m.items || []))]
        .forEach(it => { if (it.amount > 0 && !map.has(it.item_id)) map.set(it.item_id, it.amount); }));
    return map;
  }, [quotations]);
  const savedPrices = useMemo(() => new Map(menuItems.map(it => [it.id, it.default_price || 0])), [menuItems]);
  // Menu Builder price first, else the last quoted price.
  const priceFor = (itemId: string) => savedPrices.get(itemId) || lastPrices.get(itemId) || 0;

  const itemsTotal = selectedItems.reduce((s, i) => s + (i.amount || 0), 0);

  useEffect(() => {
    if (perPlateAutoRef.current) setPerPlate(itemsTotal > 0 ? String(itemsTotal) : '');
  }, [itemsTotal]);

  const toggleMultiDay = (checked: boolean) => {
    setIsMultiDay(checked);
    setActiveMealKey(null);
    if (checked && eventDays.length === 0) {
      setEventDays([{ day_number: 1, date: selectedBooking?.event_date || '', meals: [], day_subtotal: 0 }]);
    }
    if (!checked) { setEventDays([]); }
  };

  // ── single-day item helpers ───────────────────────────────────────────────
  const addItem = (it: PickerItem) =>
    setSelectedItems(prev => [...prev, {
      item_id: it.id, item_name: it.name,
      category_name: it.subcategory?.category?.name || '',
      subcategory_name: it.subcategory?.name || '', amount: priceFor(it.id),
    }]);

  const patchItem = (itemId: string, change: Partial<QuotationLineItem>) =>
    setSelectedItems(prev => prev.map(i => (i.item_id === itemId ? { ...i, ...change } : i)));

  const reorderSelectedItems = (fromIdx: number, toIdx: number) =>
    setSelectedItems(prev => {
      const next = [...prev];
      const [removed] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, removed);
      return next;
    });

  // ── form lifecycle ────────────────────────────────────────────────────────
  const resetForm = (keepOpen = false) => {
    setEditingId(null); setSelectedBookingId(''); setSelectedItems([]);
    setNotes(''); setPerPlate('');
    setGstChecked(false); setSavedGstRate(null); setAdditionalDiscounts([]);
    setExtraCharges([]); setTransportationCharges([]);
    setIsMultiDay(false); setEventDays([]); setActiveMealKey(null);
    setFoodType('');
    perPlateAutoRef.current = true;
    setShowForm(keepOpen);
  };
  const openCreate = () => resetForm(true);

  const openEdit = (q: Quotation) => {
    setEditingId(q.id);
    setSelectedBookingId(q.booking_id || '');
    setIsMultiDay(q.is_multi_day || false);
    if (q.is_multi_day && q.event_days?.length) {
      setEventDays(q.event_days.map((d, i) => ({ ...d, day_number: i + 1 })));
      setAdditionalDiscounts(q.additional_discounts || []);
    } else {
      setSelectedItems(q.items || []);
      setPerPlate(q.per_plate_amount > 0 ? String(q.per_plate_amount) : '');
      // Backward compat: if no stored additional_discounts but there's a discount, show it
      if ((q.additional_discounts || []).length > 0) {
        setAdditionalDiscounts(q.additional_discounts);
      } else if (q.discount_amount > 0) {
        setAdditionalDiscounts([{ id: genId(), description: 'Discount', amount: q.discount_amount }]);
      } else {
        setAdditionalDiscounts([]);
      }
    }
    setNotes(q.notes || '');
    setFoodType(q.food_type || '');
    setGstChecked(q.gst_rate > 0);
    setSavedGstRate(q.gst_rate > 0 ? q.gst_rate : null);
    setExtraCharges(q.extra_charges || []);
    setTransportationCharges(q.transportation_charges || []);
    setActiveMealKey(null);
    perPlateAutoRef.current = false;
    setShowForm(true);
  };

  // Bring the form into view when it opens or switches quotation.
  useEffect(() => {
    if (showForm) formRef.current?.scrollIntoView?.({ block: 'start' });
  }, [showForm, editingId]);

  // Nav intent: 'new' opens the form (booking preselected); 'open' edits a quotation by its id or booking id.
  useEffect(() => {
    if (!intent || intentHandled.current) return;
    if (intent.action === 'open') {
      if (!quotationsFetched) return;
      intentHandled.current = true;
      const q = intent.id ? quotations.find(x => x.id === intent.id) ?? quotations.find(x => x.booking_id === intent.id) : undefined;
      if (q) { openEdit(q); return; }
      if (!intent.id) return;
    }
    intentHandled.current = true;
    openCreate();
    if (intent.id) setSelectedBookingId(intent.id);
  }, [intent, quotationsFetched]); // eslint-disable-line

  // ── save ──────────────────────────────────────────────────────────────────
  const buildPayload = () => ({
    customer_id:      selectedBooking?.customer_id || '',
    booking_id:       selectedBookingId,
    items:            isMultiDay ? [] : selectedItems,
    per_plate_amount: isMultiDay ? 0 : perPlateNum,
    guest_count:      isMultiDay ? 0 : guestCount,
    subtotal:         activeSubtotal,
    discount_amount:  discountAmt,
    discount_type:    'amount' as const,
    gst_rate:         gstChecked ? dcGstRate : 0,
    gst_amount:       gstAmount,
    extra_charges:    extraCharges.filter(c => c.description.trim() || c.amount > 0),
    transportation_charges: transportationCharges.filter(c => c.description.trim() || c.amount > 0),
    additional_discounts: additionalDiscounts.filter(d => d.description.trim() || d.amount > 0),
    total_amount:     finalTotal,
    notes:            notes || undefined,
    food_type:        foodType || undefined,
    status:           'draft' as const,
    is_multi_day:     isMultiDay,
    event_days:       isMultiDay
      ? eventDays.map(d => ({ ...d, day_number: getDayNumber(d.date, eventDays) }))
      : [],
  });

  const handleSave = async () => {
    if (!selectedBookingId) { toast.error('Please select a booking'); return; }
    if (isMultiDay) {
      if (eventDays.length === 0) { toast.error('Add at least one occasion'); return; }
      for (let i = 0; i < eventDays.length; i++) {
        const day = eventDays[i];
        const dayNum = getDayNumber(day.date, eventDays);
        if (!day.date) { toast.error(`Occasion ${i + 1}: select a date`); return; }
        if (day.meals.length === 0) { toast.error(`Day ${dayNum} occasion ${i + 1}: add at least one meal`); return; }
      }
    } else {
      if (selectedItems.length === 0) { toast.error('Please add at least one item'); return; }
    }

    const payload = buildPayload();
    try {
      if (editingId) {
        // Editing keeps the current status (sent / accepted) instead of resetting to draft.
        const { status: _status, ...changes } = payload;
        await updateQuotation.mutateAsync({ id: editingId, ...changes });
        toast.success('Quotation updated');
      } else {
        await createQuotation.mutateAsync(payload);
        toast.success('Quotation saved');
      }
      // Update booking end_date to the latest date across all occasions
      if (isMultiDay && eventDays.length > 0) {
        const maxDate = eventDays.map(d => d.date).filter(Boolean).sort().pop() || '';
        if (maxDate) {
          const { error: endErr } = await supabase.from('bookings').update({ end_date: maxDate }).eq('id', selectedBookingId);
          if (endErr) toast.error(`Quotation saved, but booking end date not updated: ${endErr.message}`);
          else qc.invalidateQueries({ queryKey: ['bookings'] });
        }
      }
      resetForm();
    } catch (e: any) { toast.error(e?.message || 'Failed to save quotation'); }
  };

  const handleDelete = async (q: Quotation) => {
    const ok = await confirm({
      title: 'Delete quotation?',
      message: `${q.quotation_number}${q.customer?.name ? ` for ${q.customer.name}` : ''} will be deleted permanently.`,
      confirmLabel: 'Delete', danger: true,
    });
    if (!ok) return;
    try {
      await deleteQuotation.mutateAsync(q.id);
      if (editingId === q.id) resetForm();
      toast.success('Deleted');
    } catch (e: any) { toast.error(e?.message || 'Failed to delete'); }
  };

  const handleClone = async (q: Quotation) => {
    const ok = await confirm({
      title: 'Clone quotation?',
      message: `A new draft will be created with the same details as ${q.quotation_number}.`,
      confirmLabel: 'Clone',
    });
    if (!ok) return;
    try {
      await createQuotation.mutateAsync({
        customer_id: q.customer_id, booking_id: q.booking_id || null, items: q.items || [],
        per_plate_amount: q.per_plate_amount, guest_count: q.guest_count, subtotal: q.subtotal,
        discount_amount: q.discount_amount, discount_type: q.discount_type,
        gst_rate: q.gst_rate, gst_amount: q.gst_amount,
        extra_charges: q.extra_charges || [], transportation_charges: q.transportation_charges || [],
        additional_discounts: q.additional_discounts || [], total_amount: q.total_amount,
        notes: q.notes, food_type: q.food_type, status: 'draft' as const,
        is_multi_day: q.is_multi_day || false, event_days: q.event_days || [],
      });
      toast.success('Cloned as new draft');
    } catch (e: any) { toast.error(e?.message || 'Failed to clone'); }
  };

  const handleStatus = async (q: Quotation, status: string) => {
    try { await updateStatus.mutateAsync({ id: q.id, status }); toast.success('Status updated'); }
    catch { toast.error('Failed to update'); return; }
    if (status === 'accepted') await afterAccept(q);
  };

  // Accepted quote: offer to confirm its booking, then jump straight to the invoice.
  const afterAccept = async (q: Quotation) => {
    const booking = bookings.find(b => b.id === q.booking_id);
    if (!booking || booking.status === 'completed' || booking.status === 'cancelled') return;
    if (booking.status !== 'confirmed') {
      const ok = await confirm({ title: 'Confirm the booking too?', message: `${q.customer?.name ?? 'This customer'}'s ${booking.event_type} on ${booking.event_date} will be marked Confirmed, so you can invoice it.`, confirmLabel: 'Confirm booking' });
      if (!ok) return;
      try { await updateBooking.mutateAsync({ id: booking.id, status: 'confirmed' }); }
      catch (e: any) { toast.error(e?.message || 'Could not confirm booking'); return; }
    }
    if (!onNavigate) return;
    toast(t => (
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        Booking confirmed.
        <button onClick={() => { toast.dismiss(t.id); onNavigate('billing', { action: 'new', id: booking.id }); }}
          style={{ background: '#E8750A', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 12 }}>
          Create invoice →
        </button>
      </span>
    ), { duration: 15000 });
  };

  const isSaving = createQuotation.isPending || updateQuotation.isPending;
  const editingQuotation = editingId ? quotations.find(q => q.id === editingId) : undefined;

  const buildDraftQuotation = (): Quotation => ({
    ...buildPayload(),
    id: editingId || 'draft',
    quotation_number: editingQuotation?.quotation_number || 'DRAFT',
    customer: selectedBooking?.customer || null,
    booking: selectedBooking || null,
    booking_id: selectedBookingId || undefined,
    issue_date: todayIST(),
    created_at: new Date().toISOString(),
  });

  // Form PDF and share use what is on screen, including unsaved edits.
  const withDraft = (fn: (q: Quotation) => void) => () => {
    if (!selectedBookingId) { toast.error('Select a booking first'); return; }
    fn(buildDraftQuotation());
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '20px 16px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Quotations</h2>
          <div style={{ fontSize: 12, color: '#888880', marginTop: 2 }}>{quotations.length} quotation{quotations.length !== 1 ? 's' : ''}</div>
        </div>
        {!showForm && <button onClick={openCreate} style={btnPrimary}>+ New Quotation</button>}
      </div>

      {/* ── Form ── */}
      {showForm && (
        <div key={editingId || 'new'} ref={formRef} style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #E5E5E0', marginBottom: 24, overflow: 'hidden', scrollMarginTop: 12 }}>
          <div style={{ padding: '14px 20px', borderBottom: '0.5px solid #E5E5E0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{editingQuotation ? `Edit ${editingQuotation.quotation_number}` : 'New Quotation'}</div>
            <button onClick={() => resetForm()} aria-label="Close form" style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888880' }}>×</button>
          </div>

          <div style={{ padding: '16px' }}>
            <QuotationBookingFields
              bookings={eligibleBookings} bookingId={selectedBookingId} onBooking={setSelectedBookingId}
              booking={selectedBooking} foodType={foodType} onFoodType={setFoodType}
              isMultiDay={isMultiDay} onMultiDay={toggleMultiDay} />

            {isMultiDay ? (
              <QuotationMultiDay
                eventDays={eventDays} setEventDays={setEventDays}
                activeMealKey={activeMealKey} setActiveMealKey={setActiveMealKey}
                guestCount={guestCount} defaultDate={selectedBooking?.event_date || ''}
                menuItems={activeItems} priceFor={priceFor} />
            ) : (
              <>
                <QuotationItemPanels
                  menuItems={activeItems} items={selectedItems}
                  selectedTitle="SELECTED ITEMS" totalLabel="Items Total"
                  onAdd={addItem}
                  onAmount={(id, amount) => patchItem(id, { amount })}
                  onRemove={id => setSelectedItems(prev => prev.filter(i => i.item_id !== id))}
                  onText={(id, field: ItemTextField, value) => patchItem(id, { [field]: value })}
                  onReorder={reorderSelectedItems}
                  onReset={() => setSelectedItems([])} />

                {/* Per plate × guests */}
                <div style={{ marginTop: 14, background: '#F9F8F5', borderRadius: 10, padding: '12px 16px', border: '0.5px solid #E5E5E0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: '#666', whiteSpace: 'nowrap' }}>
                    Per Plate (₹)
                    <input type="number" min="0" inputMode="decimal" value={perPlate}
                      onChange={e => { perPlateAutoRef.current = false; setPerPlate(e.target.value); }}
                      placeholder="0" style={{ width: 100, border: '1px solid #E5E5E0', borderRadius: 7, padding: '6px 8px', fontSize: 13, textAlign: 'right', background: '#fff' }} />
                  </label>
                  <span style={{ fontSize: 13, color: '#888880' }}>×</span>
                  <div style={{ fontSize: 13, color: '#444' }}><strong>{guestCount}</strong> <span style={{ color: '#888880' }}>guests</span></div>
                  <span style={{ fontSize: 13, color: '#888880' }}>=</span>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1A18' }}>
                    ₹{subtotal.toLocaleString('en-IN')}
                    <span style={{ fontSize: 11, color: '#888880', fontWeight: 400, marginLeft: 4 }}>(Subtotal)</span>
                  </div>
                </div>
              </>
            )}

            <QuotationCharges
              isMultiDay={isMultiDay} eventDays={eventDays} gstRate={dcGstRate}
              gstChecked={gstChecked} setGstChecked={setGstChecked}
              discounts={additionalDiscounts} setDiscounts={setAdditionalDiscounts}
              extraCharges={extraCharges} setExtraCharges={setExtraCharges}
              transport={transportationCharges} setTransport={setTransportationCharges}
              totals={{
                mealSavings: totalMealSavings, discount: discountAmt, extra: extraChargesTotal,
                transport: transportationChargesTotal, gst: gstAmount, multiDaySubtotal,
                perPlate: perPlateNum, subtotal, final: finalTotal,
              }} />

            {/* Notes */}
            <div style={{ marginTop: 14 }}>
              <label style={lbl}>NOTES (OPTIONAL)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="Add any notes…" style={{ ...inp, resize: 'vertical' }} />
            </div>

            {/* PDF + share of what is on screen */}
            <div style={{ marginTop: 14, padding: '10px 14px', background: '#F5F8FF', border: '0.5px solid #B8C8F4', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, cursor: 'pointer', userSelect: 'none', marginRight: 'auto' }}>
                <input type="checkbox" checked={pdfWithPrices} onChange={e => setPdfWithPrices(e.target.checked)}
                  style={{ accentColor: '#E8750A', width: 14, height: 14 }} />
                <span>Include item prices in PDF</span>
              </label>
              <button onClick={withDraft(q => downloadPDF(q, pdfWithPrices))} style={{ ...btnSmall, background: '#378ADD' }}>⬇ Download PDF</button>
              {editingId && (
                <button onClick={withDraft(q => { shareQuotation(q, pdfWithPrices); })} style={{ ...btnSmall, background: '#1DA851' }}>📤 Share</button>
              )}
            </div>

            <div style={{ marginTop: 10, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => resetForm()} style={btnGhost}>Cancel</button>
              <button onClick={handleSave} disabled={isSaving} style={{ ...btnPrimary, opacity: isSaving ? 0.6 : 1 }}>
                {isSaving ? 'Saving…' : editingId ? 'Update Quotation' : 'Save Quotation'}
              </button>
            </div>
          </div>
        </div>
      )}

      <QuotationList
        quotations={quotations}
        onPdf={q => downloadPDF(q)}
        onShare={q => { shareQuotation(q); }}
        onEdit={openEdit}
        onClone={handleClone}
        onDelete={handleDelete}
        onStatus={handleStatus} />

      {dialog}
    </div>
  );
};

const btnPrimary: React.CSSProperties = { background: '#E8750A', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const btnGhost:   React.CSSProperties = { border: '1px solid #E5E5E0', background: '#fff', borderRadius: 8, padding: '8px 18px', fontSize: 13, cursor: 'pointer' };
const btnSmall:   React.CSSProperties = { color: '#fff', border: 'none', borderRadius: 7, padding: '7px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' };
const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#888880', display: 'block', marginBottom: 4 };
const inp: React.CSSProperties = { width: '100%', border: '1px solid #E5E5E0', borderRadius: 8, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box', background: '#fff' };

export default Quotations;
