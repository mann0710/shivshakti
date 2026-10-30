import { useState, useMemo, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { todayIST } from '../lib/ist';
import { useBookings } from './useBookings';
import { useQuoteEvent } from './useQuoteEvent';
import { useStoredState } from './useStoredState';
import { useMenuItemsFull } from './useMenuBuilder';
import { useItemPrices } from './useItemPrices';
import { useDataCenter } from './useDataCenter';
import { useQuotations, useCreateQuotation, useUpdateQuotation, Quotation, QuotationLineItem, EventDay } from './useQuotations';
import { getDayNumber, quoteTotals } from '../lib/quoteMath';
import { plateRange, atMaxPrices } from '../lib/quoteChoices';
import { genId } from '../components/catering/QuotationMultiDay';
import type { PickerItem } from '../components/catering/QuotationItemPanels';
import type { Charge, Discount } from '../components/catering/QuotationCharges';

// Everything the quotation form holds: event, menu, prices, charges, totals and save.
export const useQuoteForm = () => {
  const { data: bookings = [] } = useBookings();
  const { data: menuItems = [] } = useMenuItemsFull();
  const { data: quotations = [], isFetched: quotationsFetched } = useQuotations();
  const { data: dc } = useDataCenter();
  const createQuotation = useCreateQuotation();
  const updateQuotation = useUpdateQuotation();
  const qc = useQueryClient();
  const ev = useQuoteEvent(bookings);
  // Per-plate pricing by default; item prices only when switched on (per device).
  const [prefs, setPrefs] = useStoredState('shivshakti.quotePrefs', () => ({ itemPrices: false }));

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<QuotationLineItem[]>([]);
  const [notes, setNotes] = useState('');
  const [perPlate, setPerPlate] = useState('');
  // Plate price follows the dish prices until typed in (then it is a fixed price).
  const [autoPrice, setAutoPrice] = useState(true);
  const [gstChecked, setGstChecked] = useState(false);
  const [savedGstRate, setSavedGstRate] = useState<number | null>(null);
  const [additionalDiscounts, setAdditionalDiscounts] = useState<Discount[]>([]);
  const [extraCharges, setExtraCharges] = useState<Charge[]>([]);
  const [transportationCharges, setTransportationCharges] = useState<Charge[]>([]);
  const [foodType, setFoodType] = useState('');
  const [optionName, setOptionName] = useState('');
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [eventDays, setEventDays] = useState<EventDay[]>([]);
  const [activeMealKey, setActiveMealKey] = useState<string | null>(null);

  const selectedBookingId = ev.bookingId;
  const eligibleBookings = bookings.filter(b => b.status !== 'completed' && b.status !== 'cancelled');
  const selectedBooking = eligibleBookings.find(b => b.id === selectedBookingId) ?? bookings.find(b => b.id === selectedBookingId);

  // A booking spanning days starts multi-day with one section per date.
  useEffect(() => {
    if (!selectedBookingId || editingId) return;
    const booking = bookings.find(b => b.id === selectedBookingId);
    if (booking?.end_date && booking.end_date !== booking.event_date) {
      setIsMultiDay(true);
      const sections: EventDay[] = [];
      const cur = new Date(booking.event_date + 'T00:00:00');
      const end = new Date(booking.end_date + 'T00:00:00');
      for (let idx = 0; cur <= end && idx < 15; idx++, cur.setDate(cur.getDate() + 1)) {
        sections.push({ day_number: idx + 1, date: cur.toLocaleDateString('en-CA'), meals: [], day_subtotal: 0 });
      }
      setEventDays(sections);
    }
  }, [selectedBookingId]); // eslint-disable-line

  const dcGstRate = savedGstRate ?? dc?.gst_rate ?? 18;
  const guestCount = parseInt(ev.guests, 10) || 0;
  const perPlateNum = parseFloat(perPlate) || 0;

  const activeItems = useMemo(() => menuItems.filter(
    it => it.is_active !== false && it.subcategory?.is_active !== false && it.subcategory?.category?.is_active !== false,
  ), [menuItems]);
  const lookupPrice = useItemPrices(menuItems, quotations);
  const hasItemPrices = selectedItems.some(i => i.amount > 0) || eventDays.some(d => d.meals.some(m => m.items.some(i => i.amount > 0)));
  const showPrices = prefs.itemPrices || hasItemPrices;
  const priceFor = (itemId: string) => (showPrices ? lookupPrice(itemId) : 0);

  const range = plateRange(selectedItems);
  useEffect(() => {
    if (autoPrice && showPrices) setPerPlate(range.min > 0 ? String(range.min) : '');
  }, [range.min, autoPrice, showPrices]);

  const base = {
    additional: additionalDiscounts, gstRate: gstChecked ? dcGstRate : 0,
    extra: extraCharges.reduce((s, c) => s + (c.amount || 0), 0), transport: transportationCharges.reduce((s, c) => s + (c.amount || 0), 0),
  };
  const totals = quoteTotals({ ...base, isMultiDay, eventDays, perPlate: perPlateNum, guests: guestCount });
  // Top of the price range while "choose any" picks are open.
  const perPlateMax = !isMultiDay && autoPrice && showPrices && range.max > range.min ? range.max : null;
  const multiMax = isMultiDay && eventDays.some(d => d.meals.some(m => m.per_plate_max != null));
  const totalMax = perPlateMax != null
    ? quoteTotals({ ...base, isMultiDay: false, eventDays: [], perPlate: perPlateMax, guests: guestCount }).final
    : multiMax ? quoteTotals({ ...base, isMultiDay: true, eventDays: atMaxPrices(eventDays), perPlate: 0, guests: 0 }).final : null;

  const toggleMultiDay = (checked: boolean) => {
    setIsMultiDay(checked);
    setActiveMealKey(null);
    if (checked && eventDays.length === 0) setEventDays([{ day_number: 1, date: selectedBooking?.event_date || ev.draft.date || '', meals: [], day_subtotal: 0 }]);
    if (!checked) setEventDays([]);
  };

  const toLine = (it: PickerItem): QuotationLineItem => ({
    item_id: it.id, item_name: it.name, category_name: it.subcategory?.category?.name || '',
    subcategory_name: it.subcategory?.name || '', amount: priceFor(it.id),
  });
  const addItem = (it: PickerItem) => setSelectedItems(prev => [...prev, toLine(it)]);
  // Package items join the quote; the package price becomes the fixed per-plate rate.
  const applyPackage = (found: PickerItem[], price: number, missing: string[]) => {
    setSelectedItems(prev => [...prev, ...found.filter(f => !prev.some(p => p.item_id === f.id)).map(toLine)]);
    setAutoPrice(false);
    setPerPlate(price > 0 ? String(price) : '');
    toast.success(`Added ${found.length} item${found.length === 1 ? '' : 's'}${missing.length ? ` · not in Menu Builder: ${missing.join(', ')}` : ''}`, { duration: 6000 });
  };
  const patchItem = (itemId: string, change: Partial<QuotationLineItem>) => setSelectedItems(prev => prev.map(i => (i.item_id === itemId ? { ...i, ...change } : i)));
  const reorderItems = (from: number, to: number) => setSelectedItems(prev => {
    const next = [...prev];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
  });
  const typePerPlate = (v: string) => { setAutoPrice(false); setPerPlate(v); };

  const resetForm = (keepOpen = false) => {
    setEditingId(null); ev.reset(); setSelectedItems([]); setNotes(''); setPerPlate('');
    setGstChecked(false); setSavedGstRate(null); setAdditionalDiscounts([]); setExtraCharges([]); setTransportationCharges([]);
    setIsMultiDay(false); setEventDays([]); setActiveMealKey(null); setFoodType(''); setOptionName('');
    setAutoPrice(true);
    setShowForm(keepOpen);
  };
  const openCreate = (date?: string) => { resetForm(true); if (date) ev.patch({ date }); };

  const openEdit = (q: Quotation) => {
    setEditingId(q.id);
    ev.selectBooking(q.booking_id || '', q.is_multi_day ? undefined : q.guest_count);
    setIsMultiDay(q.is_multi_day || false);
    if (q.is_multi_day && q.event_days?.length) {
      setEventDays(q.event_days.map(d => ({ ...d, day_number: getDayNumber(d.date, q.event_days!) })));
      setAdditionalDiscounts(q.additional_discounts || []);
      setSelectedItems([]);
    } else {
      setEventDays([]);
      setSelectedItems(q.items || []);
      setPerPlate(q.per_plate_amount > 0 ? String(q.per_plate_amount) : '');
      // Older quotes kept the discount only as a total.
      setAdditionalDiscounts((q.additional_discounts || []).length ? q.additional_discounts
        : q.discount_amount > 0 ? [{ id: genId(), description: 'Discount', amount: q.discount_amount }] : []);
    }
    setNotes(q.notes || ''); setFoodType(q.food_type || ''); setOptionName(q.option_name || '');
    setGstChecked(q.gst_rate > 0); setSavedGstRate(q.gst_rate > 0 ? q.gst_rate : null);
    setExtraCharges(q.extra_charges || []); setTransportationCharges(q.transportation_charges || []);
    setActiveMealKey(null);
    setAutoPrice(q.per_plate_max != null);
    setShowForm(true);
  };

  const buildPayload = (ids?: { bookingId: string; customerId: string }) => ({
    customer_id: ids?.customerId ?? selectedBooking?.customer_id ?? '',
    booking_id: ids?.bookingId ?? selectedBookingId,
    items: isMultiDay ? [] : selectedItems,
    per_plate_amount: isMultiDay ? 0 : perPlateNum,
    per_plate_max: perPlateMax,
    guest_count: isMultiDay ? 0 : guestCount,
    subtotal: totals.subtotal,
    discount_amount: totals.discount,
    discount_type: 'amount' as const,
    gst_rate: gstChecked ? dcGstRate : 0,
    gst_amount: totals.gst,
    extra_charges: extraCharges.filter(c => c.description.trim() || c.amount > 0),
    transportation_charges: transportationCharges.filter(c => c.description.trim() || c.amount > 0),
    additional_discounts: additionalDiscounts.filter(d => d.description.trim() || d.amount > 0),
    total_amount: totals.final,
    total_max: totalMax,
    notes: notes || undefined,
    food_type: foodType || undefined,
    option_name: optionName.trim() || null,
    status: 'draft' as const,
    is_multi_day: isMultiDay,
    event_days: isMultiDay ? eventDays.map(d => ({ ...d, day_number: getDayNumber(d.date, eventDays) })) : [],
  });

  // Unsaved changes: payload differs from the one captured right after opening.
  const baseline = useRef('');
  const snapshot = JSON.stringify(buildPayload());
  useEffect(() => { baseline.current = ''; }, [editingId, showForm]);
  useEffect(() => { if (showForm && !baseline.current) baseline.current = snapshot; });
  const dirty = showForm && !!baseline.current && baseline.current !== snapshot;

  const handleSave = async (): Promise<Quotation | null> => {
    if (isMultiDay) {
      if (eventDays.length === 0) { toast.error('Add at least one occasion'); return null; }
      for (let i = 0; i < eventDays.length; i++) {
        const day = eventDays[i];
        if (!day.date) { toast.error(`Occasion ${i + 1}: select a date`); return null; }
        if (day.meals.length === 0) { toast.error(`Day ${getDayNumber(day.date, eventDays)} occasion ${i + 1}: add at least one meal`); return null; }
      }
    } else if (selectedItems.length === 0) { toast.error('Please add at least one item'); return null; }

    try {
      const ids = await ev.resolve();
      if (!ids) return null;
      const payload = buildPayload(ids);
      let saved: Quotation;
      if (editingId) {
        // Editing keeps the current status (sent / accepted) instead of resetting to draft.
        const { status: _status, ...changes } = payload;
        saved = await updateQuotation.mutateAsync({ id: editingId, ...changes });
        toast.success('Quotation updated');
      } else {
        saved = await createQuotation.mutateAsync(payload);
        toast.success('Quotation saved');
      }
      if (isMultiDay && eventDays.length > 0) {
        const maxDate = eventDays.map(d => d.date).filter(Boolean).sort().pop() || '';
        if (maxDate) {
          const { error } = await supabase.from('bookings').update({ end_date: maxDate }).eq('id', ids.bookingId);
          if (error) toast.error(`Quotation saved, but booking end date not updated: ${error.message}`);
          else qc.invalidateQueries({ queryKey: ['bookings'] });
        }
      }
      if (!isMultiDay) await ev.syncGuests(ids.bookingId);
      baseline.current = '';
      return saved;
    } catch (e: any) { toast.error(e?.message || 'Failed to save quotation'); return null; }
  };

  const editingQuotation = editingId ? quotations.find(q => q.id === editingId) : undefined;

  // What is on screen (unsaved edits included) as a quotation, for PDF and share.
  const draftQuotation = (): Quotation => ({
    ...buildPayload(),
    id: editingId || 'draft',
    quotation_number: editingQuotation?.quotation_number || 'DRAFT',
    option_group: editingQuotation?.option_group, option_label: editingQuotation?.option_label,
    customer: selectedBooking?.customer || (ev.draft.name ? { name: ev.draft.name, phone: ev.draft.phone } : null),
    booking: selectedBooking || { event_type: ev.draft.eventType, event_date: ev.draft.date, venue: ev.draft.venue, guest_count: guestCount },
    booking_id: selectedBookingId || undefined,
    issue_date: todayIST(),
    created_at: new Date().toISOString(),
  });

  return {
    quotations, quotationsFetched, bookings, eligibleBookings, selectedBooking, activeItems, ev,
    showForm, editingId, editingQuotation, dirty, isSaving: createQuotation.isPending || updateQuotation.isPending,
    selectedItems, setSelectedItems, addItem, applyPackage, patchItem, reorderItems,
    notes, setNotes, perPlate, typePerPlate, autoPrice, setAutoPrice, range, perPlateMax, totalMax, perPlateNum, guestCount,
    gstChecked, setGstChecked, dcGstRate, additionalDiscounts, setAdditionalDiscounts, extraCharges, setExtraCharges,
    transportationCharges, setTransportationCharges, foodType, setFoodType, optionName, setOptionName,
    isMultiDay, toggleMultiDay, eventDays, setEventDays, activeMealKey, setActiveMealKey, totals,
    showPrices, hasItemPrices, priceFor, setItemPricesPref: (v: boolean) => setPrefs({ itemPrices: v }),
    resetForm, openCreate, openEdit, handleSave, draftQuotation, createQuotation, updateQuotation,
  };
};

export type QuoteForm = ReturnType<typeof useQuoteForm>;
