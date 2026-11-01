import { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { todayIST } from '../lib/ist';
import { Booking } from '../types';
import { useBookings } from './useBookings';
import { useQuoteEvent } from './useQuoteEvent';
import { useStoredState } from './useStoredState';
import { useMenuItemsFull } from './useMenuBuilder';
import { useItemPrices } from './useItemPrices';
import { useDataCenter } from './useDataCenter';
import { useQuotations, useCreateQuotation, useUpdateQuotation, Quotation, QuotationLineItem, EventDay, ChoiceMeta } from './useQuotations';
import { getDayNumber, quoteTotals } from '../lib/quoteMath';
import { plateRange, atMaxPrices, basePlate, ownRange, typedPrice, setPickPrices } from '../lib/quoteChoices';
import { genId, lineOf, mergeLines, moveLine, PickerItem, Charge, Discount } from '../lib/quoteLines';

// Everything the quotation editor holds: booking, menu, prices, charges, totals and save.
export const useQuoteForm = () => {
  const { data: bookings = [], isFetched: bookingsFetched } = useBookings();
  const { data: menuItems = [] } = useMenuItemsFull();
  const { data: quotations = [], isFetched: quotationsFetched, isLoading } = useQuotations();
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

  const selectedBookingId = ev.bookingId;
  const eligibleBookings = bookings.filter(b => b.status !== 'completed' && b.status !== 'cancelled');
  const selectedBooking = bookings.find(b => b.id === selectedBookingId);

  // A booking spanning days starts multi-day with one section per date.
  useEffect(() => {
    if (!selectedBooking || editingId || eventDays.length) return;
    const b = selectedBooking;
    if (b.end_date && b.end_date !== b.event_date) {
      setIsMultiDay(true);
      const sections: EventDay[] = [];
      const cur = new Date(b.event_date + 'T00:00:00');
      const end = new Date(b.end_date + 'T00:00:00');
      for (let idx = 0; cur <= end && idx < 15; idx++, cur.setDate(cur.getDate() + 1)) {
        sections.push({ day_number: idx + 1, date: cur.toLocaleDateString('en-CA'), meals: [], day_subtotal: 0 });
      }
      setEventDays(sections);
    }
  }, [selectedBooking?.id]); // eslint-disable-line

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
  const listed = basePlate(selectedItems);
  useEffect(() => {
    if (autoPrice && showPrices) setPerPlate(listed > 0 ? String(listed) : '');
  }, [listed, autoPrice, showPrices]);
  // The per-plate box is the menu as listed; open alternatives give the customer a range around it.
  const plate = ownRange(perPlateNum, selectedItems);
  const plateLow = isMultiDay ? 0 : Math.max(0, plate.low);

  const base = {
    additional: additionalDiscounts, gstRate: gstChecked ? dcGstRate : 0,
    extra: extraCharges.reduce((s, c) => s + (c.amount || 0), 0), transport: transportationCharges.reduce((s, c) => s + (c.amount || 0), 0),
  };
  const totals = quoteTotals({ ...base, isMultiDay, eventDays, perPlate: plateLow, guests: guestCount });
  // Top of the price range while "choose any" picks are open.
  const perPlateMax = !isMultiDay && plate.high != null && plate.high > plateLow ? plate.high : null;
  const multiMax = isMultiDay && eventDays.some(d => d.meals.some(m => m.per_plate_max != null));
  const totalMax = perPlateMax != null
    ? quoteTotals({ ...base, isMultiDay: false, eventDays: [], perPlate: perPlateMax, guests: guestCount }).final
    : multiMax ? quoteTotals({ ...base, isMultiDay: true, eventDays: atMaxPrices(eventDays), perPlate: 0, guests: 0 }).final : null;

  const toggleMultiDay = (checked: boolean) => {
    setIsMultiDay(checked);
    if (checked && eventDays.length === 0) setEventDays([{ day_number: 1, date: selectedBooking?.event_date || ev.draft.date || '', meals: [], day_subtotal: 0 }]);
    if (!checked) setEventDays([]);
  };

  const toLine = (it: PickerItem): QuotationLineItem => lineOf(it, priceFor(it.id));
  const addItem = (it: PickerItem) => setSelectedItems(prev => (prev.some(p => p.item_id === it.id) ? prev : [...prev, toLine(it)]));
  // Package dishes join (or replace) the menu; the package price becomes the fixed per-plate rate.
  const applyPackage = (found: (PickerItem & { choice?: ChoiceMeta })[], price: number, replace: boolean) => {
    setSelectedItems(prev => mergeLines(prev, found.map(it => (it.choice ? { ...toLine(it), choice: it.choice } : toLine(it))), replace));
    setAutoPrice(false);
    setPerPlate(price > 0 ? String(price) : '');
  };
  // Another quote's dishes, prices and notes join (or replace) this menu.
  const copyItems = (from: Quotation, replace: boolean) => setSelectedItems(prev => mergeLines(prev, (from.items ?? []).map(i => ({ ...i, chosen: undefined })), replace));
  const patchItem = (itemId: string, change: Partial<QuotationLineItem>) => setSelectedItems(prev => prev.map(i => (i.item_id === itemId ? { ...i, ...change } : i)));
  const reorderItems = (from: number, to: number) => setSelectedItems(prev => moveLine(prev, from, to));
  const typePerPlate = (v: string) => { setAutoPrice(false); setPerPlate(v); };
  // One fixed plate price at the top of the range, whatever the customer picks; or let picks move it again.
  const chargeHighest = () => { const top = perPlateMax ?? plateLow; setSelectedItems(setPickPrices(selectedItems, true)); typePerPlate(String(top)); };
  const letPicksPrice = () => { const next = setPickPrices(selectedItems, false); setSelectedItems(next); typePerPlate(String(basePlate(next))); };

  const resetForm = (keepOpen = false) => {
    setEditingId(null); ev.reset(); setSelectedItems([]); setNotes(''); setPerPlate('');
    setGstChecked(false); setSavedGstRate(null); setAdditionalDiscounts([]); setExtraCharges([]); setTransportationCharges([]);
    setIsMultiDay(false); setEventDays([]); setFoodType(''); setOptionName('');
    setAutoPrice(true);
    setShowForm(keepOpen);
  };
  // A new quote for a booking; nothing is saved until the first change.
  const openCreate = (b: Booking) => { resetForm(true); ev.selectBooking(b.id, b.guest_count, b); };

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
      const typed = typedPrice(q.per_plate_amount, q.per_plate_max, q.items);
      setPerPlate(typed > 0 ? String(typed) : '');
      setAutoPrice(typed > 0 && typed === basePlate(q.items));
      // Older quotes kept the discount only as a total.
      setAdditionalDiscounts((q.additional_discounts || []).length ? q.additional_discounts
        : q.discount_amount > 0 ? [{ id: genId(), description: 'Discount', amount: q.discount_amount }] : []);
    }
    setNotes(q.notes || ''); setFoodType(q.food_type || ''); setOptionName(q.option_name || '');
    setGstChecked(q.gst_rate > 0); setSavedGstRate(q.gst_rate > 0 ? q.gst_rate : null);
    setExtraCharges(q.extra_charges || []); setTransportationCharges(q.transportation_charges || []);
    if (q.is_multi_day) setAutoPrice(false);
    setShowForm(true);
  };

  const buildPayload = () => ({
    customer_id: selectedBooking?.customer_id ?? '',
    booking_id: selectedBookingId || null,
    items: isMultiDay ? [] : selectedItems,
    per_plate_amount: plateLow,
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

  // What autosave compares: the quote plus the event details that go to the booking.
  const snapshot = JSON.stringify([buildPayload(), ev.draft, ev.guests]);
  const canSave = showForm && !!selectedBooking;

  // Saves quietly (autosave); a new quote carries on as an edit of the saved one.
  const handleSave = async (): Promise<Quotation | null> => {
    if (!selectedBooking) return null;
    const payload = buildPayload();
    let saved: Quotation;
    if (editingId) {
      // Editing keeps the current status (sent / accepted) instead of resetting to draft.
      const { status: _status, ...changes } = payload;
      saved = await updateQuotation.mutateAsync({ id: editingId, ...changes });
    } else {
      saved = await createQuotation.mutateAsync(payload);
      setEditingId(saved.id);
    }
    const maxDate = isMultiDay ? eventDays.map(d => d.date).filter(Boolean).sort().pop() || '' : '';
    if (maxDate && maxDate !== (selectedBooking.end_date || selectedBooking.event_date)) {
      const { error } = await supabase.from('bookings').update({ end_date: maxDate }).eq('id', selectedBooking.id);
      if (error) throw new Error(`Quote saved, but the booking's last day was not updated: ${error.message}`);
      qc.invalidateQueries({ queryKey: ['bookings'] });
    }
    await ev.syncBooking(selectedBooking.id, !isMultiDay);
    return saved;
  };

  const editingQuotation = editingId ? quotations.find(q => q.id === editingId) : undefined;

  // What is on screen as a quotation, for PDF, send and the summary.
  const draftQuotation = (): Quotation => ({
    ...buildPayload(),
    status: editingQuotation?.status ?? 'draft',
    booking_id: selectedBookingId || undefined,
    id: editingId || 'draft',
    quotation_number: editingQuotation?.quotation_number || 'DRAFT',
    option_group: editingQuotation?.option_group, option_label: editingQuotation?.option_label,
    customer: selectedBooking?.customer ?? null,
    booking: selectedBooking
      ? { ...selectedBooking, event_type: ev.draft.eventType || selectedBooking.event_type, event_date: ev.draft.date || selectedBooking.event_date, event_time: ev.draft.time || null, guest_count: guestCount || selectedBooking.guest_count }
      : null,
    issue_date: editingQuotation?.issue_date || todayIST(),
    created_at: editingQuotation?.created_at || new Date().toISOString(),
  });

  return {
    quotations, quotationsFetched, isLoading, bookings, bookingsFetched, eligibleBookings, selectedBooking, activeItems, ev,
    showForm, editingId, editingQuotation, snapshot, canSave, isSaving: createQuotation.isPending || updateQuotation.isPending,
    selectedItems, setSelectedItems, addItem, applyPackage, copyItems, patchItem, reorderItems,
    notes, setNotes, perPlate, typePerPlate, chargeHighest, letPicksPrice, autoPrice, setAutoPrice, range, perPlateMax, totalMax, plateLow, guestCount,
    gstChecked, setGstChecked, dcGstRate, additionalDiscounts, setAdditionalDiscounts, extraCharges, setExtraCharges,
    transportationCharges, setTransportationCharges, foodType, setFoodType, optionName, setOptionName,
    isMultiDay, toggleMultiDay, eventDays, setEventDays, totals,
    showPrices, hasItemPrices, priceFor, setItemPricesPref: (v: boolean) => setPrefs({ itemPrices: v }),
    toLine, resetForm, openCreate, openEdit, handleSave, draftQuotation, createQuotation, updateQuotation,
  };
};

export type QuoteForm = ReturnType<typeof useQuoteForm>;
