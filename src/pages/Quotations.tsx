import React, { useState, useMemo, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { formatDateIST } from '../lib/ist';
import { useBookings } from '../hooks/useBookings';
import { useMenuItemsFull } from '../hooks/useMenuBuilder';
import { useDataCenter } from '../hooks/useDataCenter';
import {
  useQuotations, useCreateQuotation, useUpdateQuotation,
  useUpdateQuotationStatus, useDeleteQuotation,
  Quotation, QuotationLineItem, MealSlot, EventDay,
} from '../hooks/useQuotations';

interface SelectedItem extends QuotationLineItem {}

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Hi-Tea', 'Snacks', 'Dinner', 'Supper'];

const STATUS_COLORS: Record<string, string> = {
  draft: '#888880', sent: '#378ADD', accepted: '#639922', rejected: '#CC4444',
};

const genId = () => Math.random().toString(36).slice(2, 10);

// Day number = ordinal position of date among unique dates in first-appearance order
const getDayNumber = (date: string, days: EventDay[]): number => {
  const seen: string[] = [];
  for (const d of days) {
    if (d.date && !seen.includes(d.date)) seen.push(d.date);
  }
  const idx = seen.indexOf(date);
  return idx >= 0 ? idx + 1 : 1;
};

// ─── PDF generator ────────────────────────────────────────────────────────────
const downloadPDF = (q: Quotation, withPrices = true) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210; const margin = 18;
  let y = 18;

  const hline = (y1: number, color = '#E5E5E0') => { doc.setDrawColor(color); doc.line(margin, y1, W - margin, y1); };

  doc.setFillColor(232, 117, 10); doc.rect(0, 0, W, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.text('Shiv Shakti', margin, 12);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.text('Catering & Events', margin, 19);
  doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.text('QUOTATION', W - margin, 12, { align: 'right' });
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.text(q.quotation_number, W - margin, 19, { align: 'right' });
  y = 38;

  doc.setTextColor(80, 80, 78); doc.setFontSize(9);
  doc.text(`Date: ${formatDateIST(q.issue_date, 'dd-MM-yyyy')}`, margin, y);
  doc.text(`Status: ${q.status.charAt(0).toUpperCase() + q.status.slice(1)}`, W - margin, y, { align: 'right' });
  y += 6; hline(y); y += 7;

  const customer = q.customer; const booking = q.booking;
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(150, 150, 148);
  doc.text('CUSTOMER', margin, y); y += 4;
  doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 30, 28); doc.setFontSize(11);
  doc.text(customer?.name || '—', margin, y); y += 5;
  if (customer?.phone) { doc.setFontSize(9); doc.setTextColor(100, 100, 98); doc.text(customer.phone, margin, y); y += 4; }

  if (booking) {
    y += 3; hline(y); y += 6;
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(150, 150, 148); doc.text('EVENT DETAILS', margin, y); y += 4;
    doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 30, 28);
    const details: [string, string][] = [['Event', booking.event_type || '—'], ['Date', formatDateIST(booking.event_date, 'dd-MM-yyyy')]];
    if (booking.end_date && booking.end_date !== booking.event_date) details.push(['End Date', formatDateIST(booking.end_date, 'dd-MM-yyyy')]);
    if (booking.event_time) details.push(['Time', booking.event_time]);
    if (booking.venue) details.push(['Venue', booking.venue]);
    details.forEach(([lbl, val]) => {
      doc.setFontSize(9); doc.setTextColor(120, 120, 118); doc.text(`${lbl}:`, margin, y);
      doc.setTextColor(30, 30, 28); doc.text(val, margin + 24, y); y += 5;
    });
  }

  y += 3; hline(y); y += 6;

  if (q.is_multi_day && q.event_days?.length) {
    for (const day of q.event_days) {
      if (y > 240) { doc.addPage(); y = 20; }
      // Day header bar
      doc.setFillColor(249, 248, 245); doc.rect(margin, y - 3, W - margin * 2, 8, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(232, 117, 10);
      doc.text(`Day ${day.day_number}  -  ${formatDateIST(day.date, 'dd-MM-yyyy')}`, margin + 2, y + 1);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80, 80, 78);
      doc.text(`Rs.${day.day_subtotal.toLocaleString('en-IN')}`, W - margin - 2, y + 1, { align: 'right' });
      y += 11;

      for (const meal of day.meals) {
        if (y > 248) { doc.addPage(); y = 20; }
        const offerRate = meal.discount_amount || 0;
        const mealNet = offerRate > 0 ? (meal.per_plate_amount - offerRate) * meal.guest_count : meal.subtotal;
        const mealSaving = offerRate > 0 ? offerRate * meal.guest_count : 0;

        // Meal type header — warm background
        doc.setFillColor(255, 248, 235);
        doc.rect(margin + 2, y - 2, W - margin * 2 - 4, 7, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(180, 90, 0);
        doc.text(meal.meal_type.charAt(0).toUpperCase() + meal.meal_type.slice(1), margin + 6, y + 2);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(130, 130, 128);
        const mealMeta = [meal.time, `${meal.guest_count} guests`].filter(Boolean).join('  .  ');
        doc.text(mealMeta, W - margin - 4, y + 2, { align: 'right' });
        y += 9;

        // Items — one per line; show price on right when withPrices
        if ((meal.items || []).length > 0) {
          for (const it of (meal.items || [])) {
            if (y > 262) { doc.addPage(); y = 20; }
            doc.setFont('times', 'italic'); doc.setFontSize(9); doc.setTextColor(50, 50, 48);
            doc.text(`  · ${(it as any).item_name}`, margin + 6, y);
            if (withPrices && (it as any).amount > 0) {
              doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(80, 80, 78);
              doc.text(`Rs.${((it as any).amount || 0).toLocaleString('en-IN')}`, W - margin - 4, y, { align: 'right' });
            }
            y += 4.5;
          }
          y += 1.5;
        }

        // Pricing summary — always shown regardless of withPrices checkbox
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(90, 90, 88);
        if (offerRate > 0) {
          // Line 1: left = "Rs.X/plate x Y pax"   right = "Actual: Rs.Z"
          if (y > 268) { doc.addPage(); y = 20; }
          doc.text(`Rs.${meal.per_plate_amount.toLocaleString('en-IN')}/plate x ${meal.guest_count} pax`, margin + 6, y);
          doc.text(`Actual: Rs.${meal.subtotal.toLocaleString('en-IN')}`, W - margin - 4, y, { align: 'right' });
          y += 4.5;
          // Line 2: left = "Offer: Rs.A/plate"   right = "Saving: - Rs.B"
          if (y > 268) { doc.addPage(); y = 20; }
          doc.setTextColor(34, 139, 34);
          doc.text(`Discount: Rs.${offerRate.toLocaleString('en-IN')}/plate`, margin + 6, y);
          doc.text(`Saving: - Rs.${mealSaving.toLocaleString('en-IN')}`, W - margin - 4, y, { align: 'right' });
          doc.setTextColor(90, 90, 88);
          y += 5;
        } else {
          doc.text(`Rs.${meal.per_plate_amount.toLocaleString('en-IN')}/plate x ${meal.guest_count} pax = Rs.${meal.subtotal.toLocaleString('en-IN')}`, margin + 6, y);
          y += 4.5;
        }
        // Meal total line (always shown)
        doc.setDrawColor(220, 218, 215);
        doc.line(margin + 4, y, W - margin - 4, y); y += 3.5;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
        doc.setTextColor(40, 40, 38);
        doc.text('Meal Total', margin + 6, y);
        doc.setTextColor(offerRate > 0 && withPrices ? 232 : 30, offerRate > 0 && withPrices ? 117 : 30, offerRate > 0 && withPrices ? 10 : 28);
        doc.text(`Rs.${mealNet.toLocaleString('en-IN')}`, W - margin - 4, y, { align: 'right' });
        y += 8;
      }
      hline(y, '#E5E5E0'); y += 5;
    }
  } else {
    // Single-day: items table
    doc.setFillColor(249, 248, 245); doc.rect(margin, y - 4, W - margin * 2, 8, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(120, 120, 118);
    doc.text('CATEGORY', margin + 2, y + 1); doc.text('SUBCATEGORY', margin + 48, y + 1);
    doc.text('ITEM', margin + 90, y + 1);
    if (withPrices) doc.text('AMOUNT', W - margin - 2, y + 1, { align: 'right' });
    y += 9; hline(y); y += 5;

    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); let lastCat = '';
    (q.items || []).forEach(item => {
      if (y > 240) { doc.addPage(); y = 20; }
      if (item.category_name !== lastCat) {
        doc.setFont('helvetica', 'bold'); doc.setTextColor(232, 117, 10); doc.text(item.category_name, margin + 2, y);
        doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 30, 28); lastCat = item.category_name; y += 5;
      }
      doc.setTextColor(100, 100, 98); doc.text(item.subcategory_name, margin + 48, y);
      doc.setTextColor(30, 30, 28); doc.text(item.item_name, margin + 90, y);
      if (withPrices) doc.text(`Rs.${(item.amount || 0).toLocaleString('en-IN')}`, W - margin - 2, y, { align: 'right' });
      y += 5;
    });

    y += 3; hline(y); y += 6;
    if (withPrices && q.per_plate_amount > 0) {
      doc.setFontSize(9); doc.setTextColor(100, 100, 98);
      doc.text('Per Plate Rate:', margin, y); doc.setTextColor(30, 30, 28);
      doc.text(`Rs.${q.per_plate_amount.toLocaleString('en-IN')}`, W - margin, y, { align: 'right' }); y += 5;
      doc.setTextColor(100, 100, 98);
      doc.text(`Subtotal (${q.per_plate_amount} x ${q.guest_count} guests):`, margin, y); doc.setTextColor(30, 30, 28);
      doc.text(`Rs.${q.subtotal.toLocaleString('en-IN')}`, W - margin, y, { align: 'right' }); y += 5;
    }
  }

  // Discount section — with meal-wise breakdown for multi-day
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  if (q.is_multi_day && (q.event_days || []).length > 0) {
    doc.setTextColor(100, 100, 98);
    doc.text('Original Price:', margin, y);
    doc.setTextColor(30, 30, 28);
    doc.text(`Rs.${q.subtotal.toLocaleString('en-IN')}`, W - margin, y, { align: 'right' }); y += 5;
    for (const day of (q.event_days || [])) {
      for (const meal of (day.meals || [])) {
        const offer = meal.discount_amount || 0;
        if (offer > 0) {
          const saving = offer * meal.guest_count;
          if (y > 268) { doc.addPage(); y = 20; }
          doc.setTextColor(100, 100, 98);
          doc.text(`  ${meal.meal_type.charAt(0).toUpperCase() + meal.meal_type.slice(1)} (Day ${day.day_number}):`, margin, y);
          doc.setTextColor(70, 140, 40);
          doc.text(`-Rs.${saving.toLocaleString('en-IN')}`, W - margin, y, { align: 'right' }); y += 4.5;
        }
      }
    }
    for (const ad of (q.additional_discounts || [])) {
      if (!ad.amount) continue;
      if (y > 268) { doc.addPage(); y = 20; }
      doc.setTextColor(100, 100, 98);
      doc.text(`  ${ad.description || 'Discount'}:`, margin, y);
      doc.setTextColor(70, 140, 40);
      doc.text(`-Rs.${ad.amount.toLocaleString('en-IN')}`, W - margin, y, { align: 'right' }); y += 4.5;
    }
    y += 1;
  } else {
    if (q.discount_amount > 0) {
      doc.setTextColor(100, 100, 98);
      doc.text('Discount:', margin, y); doc.setTextColor(70, 140, 40);
      doc.text(`-Rs.${q.discount_amount.toLocaleString('en-IN')}`, W - margin, y, { align: 'right' }); y += 5;
    }
  }
  (q.extra_charges || []).forEach(ec => {
    if (!ec.description && !ec.amount) return;
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setTextColor(100, 100, 98); doc.text(`${ec.description || 'Extra Charge'}:`, margin, y);
    doc.setTextColor(30, 30, 28); doc.text(`Rs.${(ec.amount || 0).toLocaleString('en-IN')}`, W - margin, y, { align: 'right' }); y += 5;
  });
  (q.transportation_charges || []).forEach(tc => {
    if (!tc.description && !tc.amount) return;
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setTextColor(100, 100, 98); doc.text(`${tc.description || 'Transportation'}:`, margin, y);
    doc.setTextColor(30, 30, 28); doc.text(`Rs.${(tc.amount || 0).toLocaleString('en-IN')}`, W - margin, y, { align: 'right' }); y += 5;
  });
  if (q.gst_rate > 0) {
    doc.setTextColor(100, 100, 98); doc.text(`GST @${q.gst_rate}%:`, margin, y);
    doc.setTextColor(30, 30, 28); doc.text(`Rs.${q.gst_amount.toLocaleString('en-IN')}`, W - margin, y, { align: 'right' }); y += 5;
  }

  y += 2; hline(y, '#E8750A'); y += 7;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(30, 30, 28);
  doc.text('Payable Amount', margin, y); doc.setTextColor(232, 117, 10);
  doc.text(`Rs.${(q.total_amount || 0).toLocaleString('en-IN')}`, W - margin, y, { align: 'right' }); y += 8;

  if (q.notes) {
    hline(y); y += 6;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(150, 150, 148); doc.text('NOTES', margin, y); y += 4;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80, 80, 78);
    doc.text(doc.splitTextToSize(q.notes, W - margin * 2), margin, y);
  }
  doc.setFontSize(7); doc.setTextColor(180, 180, 178);
  doc.text('Thank you for considering Shiv Shakti Catering & Events', W / 2, 285, { align: 'center' });
  doc.save(`${q.quotation_number}.pdf`);
};

// ─── Component ────────────────────────────────────────────────────────────────
const Quotations: React.FC = () => {
  const { data: bookings = [] }   = useBookings();
  const { data: menuItems = [] }  = useMenuItemsFull();
  const { data: quotations = [] } = useQuotations();
  const { data: dc }              = useDataCenter();
  const createQuotation = useCreateQuotation();
  const updateQuotation = useUpdateQuotation();
  const updateStatus    = useUpdateQuotationStatus();
  const deleteQuotation = useDeleteQuotation();

  // ── single-day state ──────────────────────────────────────────────────────
  const [showForm, setShowForm]             = useState(false);
  const [editingId, setEditingId]           = useState<string | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [selectedItems, setSelectedItems]   = useState<SelectedItem[]>([]);
  const [notes, setNotes]                   = useState('');
  const [searchLeft, setSearchLeft]         = useState('');
  const [perPlate, setPerPlate]             = useState('');
  const [gstChecked, setGstChecked]         = useState(false);
  const [additionalDiscounts, setAdditionalDiscounts] = useState<{ id: string; description: string; amount: number }[]>([]);
  const [extraCharges, setExtraCharges]     = useState<{ description: string; amount: number }[]>([]);
  const [transportationCharges, setTransportationCharges] = useState<{ description: string; amount: number }[]>([]);
  const perPlateAutoRef = useRef(true);

  // ── multi-day state ───────────────────────────────────────────────────────
  const [isMultiDay, setIsMultiDay]         = useState(false);
  const [eventDays, setEventDays]           = useState<EventDay[]>([]);
  const [activeMealKey, setActiveMealKey]   = useState<string | null>(null);
  const [mealSearch, setMealSearch]         = useState('');
  const [pdfWithPrices, setPdfWithPrices]   = useState(true);
  const [draggedMeal, setDraggedMeal]       = useState<{ dayIdx: number; mealId: string } | null>(null);
  const [dragOverDayIdx, setDragOverDayIdx] = useState<number | null>(null);

  useEffect(() => { setMealSearch(''); }, [activeMealKey]);

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
        sections.push({ day_number: idx + 1, date: cur.toISOString().split('T')[0], meals: [], day_subtotal: 0 });
        cur.setDate(cur.getDate() + 1); idx++;
      }
      setEventDays(sections);
    }
  }, [selectedBookingId]); // eslint-disable-line

  const dcGstRate = dc?.gst_rate ?? 18;

  const eligibleBookings = bookings.filter(b => b.status !== 'completed' && b.status !== 'cancelled');
  const selectedBooking  = eligibleBookings.find(b => b.id === selectedBookingId)
    ?? bookings.find(b => b.id === selectedBookingId);

  const guestCount  = selectedBooking?.guest_count || 0;
  const perPlateNum = parseFloat(perPlate) || 0;
  const subtotal    = perPlateNum * guestCount;

  // active subtotal depends on mode
  const multiDaySubtotal = eventDays.reduce((s, d) => s + d.day_subtotal, 0);
  const activeSubtotal   = isMultiDay ? multiDaySubtotal : subtotal;

  // Sum savings from all meal discount rates: discount_per_plate × guests
  const totalMealSavings = useMemo(() => {
    if (!isMultiDay) return 0;
    return eventDays.reduce((sum, day) =>
      sum + day.meals.reduce((ms, m) => {
        const disc = m.discount_amount || 0;
        return disc > 0 ? ms + disc * m.guest_count : ms;
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

  // ── menu items helpers ────────────────────────────────────────────────────
  const activeItems = menuItems.filter(
    it => it.is_active !== false && it.subcategory?.is_active !== false && it.subcategory?.category?.is_active !== false,
  );

  const leftItems = useMemo(() => {
    const chosen = new Set(selectedItems.map(i => i.item_id));
    const q = searchLeft.trim().toLowerCase();
    return activeItems.filter(
      it => !chosen.has(it.id) && (!q || it.name.toLowerCase().includes(q)
        || it.subcategory?.name.toLowerCase().includes(q)
        || it.subcategory?.category?.name.toLowerCase().includes(q)),
    );
  }, [activeItems, selectedItems, searchLeft]);

  const groupedLeft = useMemo(() => {
    const map: Record<string, { subcategory: string; items: typeof leftItems }[]> = {};
    leftItems.forEach(it => {
      const cat = it.subcategory?.category?.name || 'Uncategorised';
      const sub = it.subcategory?.name || 'General';
      if (!map[cat]) map[cat] = [];
      let sg = map[cat].find(g => g.subcategory === sub);
      if (!sg) { sg = { subcategory: sub, items: [] }; map[cat].push(sg); }
      sg.items.push(it);
    });
    return map;
  }, [leftItems]);

  const groupedRight = useMemo(() => {
    const map: Record<string, { subcategory: string; items: SelectedItem[] }[]> = {};
    selectedItems.forEach(it => {
      const cat = it.category_name || 'Uncategorised';
      const sub = it.subcategory_name || 'General';
      if (!map[cat]) map[cat] = [];
      let sg = map[cat].find(g => g.subcategory === sub);
      if (!sg) { sg = { subcategory: sub, items: [] }; map[cat].push(sg); }
      sg.items.push(it);
    });
    return map;
  }, [selectedItems]);

  const itemsTotal = selectedItems.reduce((s, i) => s + (i.amount || 0), 0);

  useEffect(() => {
    if (perPlateAutoRef.current) setPerPlate(itemsTotal > 0 ? String(itemsTotal) : '');
  }, [itemsTotal]);

  // ── meal item picker helpers ──────────────────────────────────────────────
  const getMealGroupedLeft = (mealItems: QuotationLineItem[]) => {
    const chosen = new Set(mealItems.map(i => i.item_id));
    const q = mealSearch.trim().toLowerCase();
    const filtered = activeItems.filter(
      it => !chosen.has(it.id) && (!q || it.name.toLowerCase().includes(q)
        || it.subcategory?.name.toLowerCase().includes(q)
        || it.subcategory?.category?.name.toLowerCase().includes(q)),
    );
    const map: Record<string, { subcategory: string; items: typeof filtered }[]> = {};
    filtered.forEach(it => {
      const cat = it.subcategory?.category?.name || 'Uncategorised';
      const sub = it.subcategory?.name || 'General';
      if (!map[cat]) map[cat] = [];
      let sg = map[cat].find(g => g.subcategory === sub);
      if (!sg) { sg = { subcategory: sub, items: [] }; map[cat].push(sg); }
      sg.items.push(it);
    });
    return map;
  };

  const getMealGroupedRight = (mealItems: QuotationLineItem[]) => {
    const map: Record<string, { subcategory: string; items: QuotationLineItem[] }[]> = {};
    mealItems.forEach(it => {
      const cat = it.category_name || 'Uncategorised';
      const sub = it.subcategory_name || 'General';
      if (!map[cat]) map[cat] = [];
      let sg = map[cat].find(g => g.subcategory === sub);
      if (!sg) { sg = { subcategory: sub, items: [] }; map[cat].push(sg); }
      sg.items.push(it);
    });
    return map;
  };

  // ── multi-day helpers ─────────────────────────────────────────────────────
  const addOccasion = () => {
    const lastDate = eventDays.length > 0 ? eventDays[eventDays.length - 1].date : (selectedBooking?.event_date || '');
    setEventDays(prev => [...prev, {
      day_number: 0, date: lastDate, meals: [], day_subtotal: 0,
    }]);

  };

  const removeDay = (idx: number) =>
    setEventDays(prev => prev.filter((_, i) => i !== idx));

  const updateDayDate = (idx: number, date: string) =>
    setEventDays(prev => prev.map((d, i) => i === idx ? { ...d, date } : d));

  const addMeal = (dayIdx: number) => {
    const mealId = genId();
    setEventDays(prev => prev.map((d, i) => i !== dayIdx ? d : {
      ...d,
      meals: [...d.meals, {
        id: mealId, meal_type: 'breakfast', time: '', guest_count: guestCount,
        per_plate_amount: 0, discount_amount: 0, items: [], subtotal: 0,
      }],
    }));
    setActiveMealKey(`${dayIdx}_${mealId}`);
  };

  const removeMeal = (dayIdx: number, mealId: string) => {
    setEventDays(prev => prev.map((d, i) => {
      if (i !== dayIdx) return d;
      const meals = d.meals.filter(m => m.id !== mealId);
      return { ...d, meals, day_subtotal: meals.reduce((s, m) => s + m.subtotal, 0) };
    }));
    if (activeMealKey === `${dayIdx}_${mealId}`) setActiveMealKey(null);
  };

  const cloneMeal = (dayIdx: number, mealId: string) => {
    setEventDays(prev => prev.map((d, i) => {
      if (i !== dayIdx) return d;
      const mealIdx = d.meals.findIndex(m => m.id === mealId);
      if (mealIdx < 0) return d;
      const original = d.meals[mealIdx];
      const cloned: MealSlot = { ...original, id: genId(), items: original.items.map(it => ({ ...it })) };
      const meals = [...d.meals.slice(0, mealIdx + 1), cloned, ...d.meals.slice(mealIdx + 1)];
      return { ...d, meals, day_subtotal: meals.reduce((s, m) => s + m.subtotal, 0) };
    }));
  };

  const handleMealDragStart = (e: React.DragEvent, dayIdx: number, mealId: string) => {
    setDraggedMeal({ dayIdx, mealId });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleMealDragEnd = () => {
    setDraggedMeal(null);
    setDragOverDayIdx(null);
  };

  const handleDayDragOver = (e: React.DragEvent, dayIdx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverDayIdx !== dayIdx) setDragOverDayIdx(dayIdx);
  };

  const handleDayDrop = (e: React.DragEvent, targetDayIdx: number) => {
    e.preventDefault();
    if (!draggedMeal || draggedMeal.dayIdx === targetDayIdx) {
      setDraggedMeal(null); setDragOverDayIdx(null); return;
    }
    const { dayIdx: srcIdx, mealId } = draggedMeal;
    setEventDays(prev => {
      const next = prev.map(d => ({ ...d, meals: [...d.meals] }));
      const meal = next[srcIdx].meals.find(m => m.id === mealId);
      if (!meal) return prev;
      next[srcIdx].meals = next[srcIdx].meals.filter(m => m.id !== mealId);
      next[srcIdx].day_subtotal = next[srcIdx].meals.reduce((s, m) => s + m.subtotal, 0);
      next[targetDayIdx].meals = [...next[targetDayIdx].meals, meal];
      next[targetDayIdx].day_subtotal = next[targetDayIdx].meals.reduce((s, m) => s + m.subtotal, 0);
      return next;
    });
    if (activeMealKey === `${srcIdx}_${mealId}`) setActiveMealKey(`${targetDayIdx}_${mealId}`);
    setDraggedMeal(null); setDragOverDayIdx(null);
  };

  const updateMealField = (dayIdx: number, mealId: string, field: keyof MealSlot, value: any) => {
    setEventDays(prev => prev.map((d, i) => {
      if (i !== dayIdx) return d;
      const meals = d.meals.map(m => {
        if (m.id !== mealId) return m;
        const updated = { ...m, [field]: value };
        updated.subtotal = updated.per_plate_amount * updated.guest_count;
        return updated;
      });
      return { ...d, meals, day_subtotal: meals.reduce((s, m) => s + m.subtotal, 0) };
    }));
  };

  const addItemToMeal = (dayIdx: number, mealId: string, it: typeof activeItems[0]) => {
    setEventDays(prev => prev.map((d, i) => {
      if (i !== dayIdx) return d;
      const meals = d.meals.map(m => {
        if (m.id !== mealId) return m;
        const items = [...m.items, {
          item_id: it.id, item_name: it.name,
          category_name: it.subcategory?.category?.name || '',
          subcategory_name: it.subcategory?.name || '', amount: 0,
        }];
        const itemsSum = items.reduce((s, x) => s + (x.amount || 0), 0);
        const per_plate_amount = itemsSum > 0 ? itemsSum : m.per_plate_amount;
        return { ...m, items, per_plate_amount, subtotal: per_plate_amount * m.guest_count };
      });
      return { ...d, meals, day_subtotal: meals.reduce((s, m) => s + m.subtotal, 0) };
    }));
  };

  const removeItemFromMeal = (dayIdx: number, mealId: string, itemId: string) => {
    setEventDays(prev => prev.map((d, i) => {
      if (i !== dayIdx) return d;
      const meals = d.meals.map(m => {
        if (m.id !== mealId) return m;
        const items = m.items.filter(x => x.item_id !== itemId);
        const itemsSum = items.reduce((s, x) => s + (x.amount || 0), 0);
        const per_plate_amount = itemsSum > 0 ? itemsSum : (items.length ? m.per_plate_amount : 0);
        return { ...m, items, per_plate_amount, subtotal: per_plate_amount * m.guest_count };
      });
      return { ...d, meals, day_subtotal: meals.reduce((s, m) => s + m.subtotal, 0) };
    }));
  };

  const updateMealItemAmount = (dayIdx: number, mealId: string, itemId: string, amount: number) => {
    setEventDays(prev => prev.map((d, i) => {
      if (i !== dayIdx) return d;
      const meals = d.meals.map(m => {
        if (m.id !== mealId) return m;
        const items = m.items.map(x => x.item_id === itemId ? { ...x, amount } : x);
        const itemsSum = items.reduce((s, x) => s + (x.amount || 0), 0);
        const per_plate_amount = itemsSum > 0 ? itemsSum : m.per_plate_amount;
        return { ...m, items, per_plate_amount, subtotal: per_plate_amount * m.guest_count };
      });
      return { ...d, meals, day_subtotal: meals.reduce((s, m) => s + m.subtotal, 0) };
    }));
  };

  const resetMealItems = (dayIdx: number, mealId: string) => {
    setEventDays(prev => prev.map((d, i) => {
      if (i !== dayIdx) return d;
      const meals = d.meals.map(m => m.id !== mealId ? m : { ...m, items: [], per_plate_amount: 0, subtotal: 0 });
      return { ...d, meals, day_subtotal: meals.reduce((s, m) => s + m.subtotal, 0) };
    }));
  };

  // ── form lifecycle ────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingId(null); setSelectedBookingId(''); setSelectedItems([]);
    setNotes(''); setSearchLeft(''); setPerPlate('');
    setGstChecked(false); setAdditionalDiscounts([]);
    setExtraCharges([]); setTransportationCharges([]);
    setIsMultiDay(false); setEventDays([]); setActiveMealKey(null);
    perPlateAutoRef.current = true;
    setShowForm(true);
  };

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
    setGstChecked(q.gst_rate > 0);
    setExtraCharges(q.extra_charges || []);
    setTransportationCharges(q.transportation_charges || []);
    setActiveMealKey(null);
    perPlateAutoRef.current = false;
    setSearchLeft('');
    setShowForm(true);
  };

  const resetForm = () => {
    setEditingId(null); setSelectedBookingId(''); setSelectedItems([]);
    setNotes(''); setSearchLeft(''); setPerPlate('');
    setGstChecked(false); setAdditionalDiscounts([]);
    setExtraCharges([]); setTransportationCharges([]);
    setIsMultiDay(false); setEventDays([]); setActiveMealKey(null);
    perPlateAutoRef.current = true;
    setShowForm(false);
  };

  // ── single-day item helpers ───────────────────────────────────────────────
  const addItem = (it: typeof activeItems[0]) =>
    setSelectedItems(prev => [...prev, {
      item_id: it.id, item_name: it.name,
      category_name: it.subcategory?.category?.name || '',
      subcategory_name: it.subcategory?.name || '', amount: 0,
    }]);

  const removeItem = (itemId: string) => setSelectedItems(prev => prev.filter(i => i.item_id !== itemId));

  const updateAmount = (itemId: string, value: string) => {
    const amount = parseFloat(value) || 0;
    setSelectedItems(prev => prev.map(i => i.item_id === itemId ? { ...i, amount } : i));
  };

  // ── save ──────────────────────────────────────────────────────────────────
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

    const booking = bookings.find(b => b.id === selectedBookingId);
    const payload = {
      customer_id:      booking?.customer_id || '',
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
      status:           'draft' as const,
      is_multi_day:     isMultiDay,
      event_days:       isMultiDay
        ? eventDays.map(d => ({ ...d, day_number: getDayNumber(d.date, eventDays) }))
        : [],
    };

    try {
      if (editingId) {
        await updateQuotation.mutateAsync({ id: editingId, ...payload });
        toast.success('Quotation updated');
      } else {
        await createQuotation.mutateAsync(payload);
        toast.success('Quotation saved');
      }
      // Update booking end_date to the latest date across all occasions
      if (isMultiDay && eventDays.length > 0) {
        const maxDate = eventDays.map(d => d.date).filter(Boolean).sort().pop() || '';
        if (maxDate) {
          try { await supabase.from('bookings').update({ end_date: maxDate }).eq('id', selectedBookingId); } catch (_) {}
        }
      }
      resetForm();
    } catch (e: any) { toast.error(e?.message || 'Failed to save quotation'); }
  };

  const handleDelete = async (id: string, num: string) => {
    if (!window.confirm(`Delete quotation ${num}?`)) return;
    try { await deleteQuotation.mutateAsync(id); toast.success('Deleted'); }
    catch (e: any) { toast.error(e?.message || 'Failed to delete'); }
  };

  const isSaving = createQuotation.isPending || updateQuotation.isPending;

  const buildDraftQuotation = (): Quotation => ({
    id: editingId || 'draft',
    quotation_number: editingId ? (quotations.find(q => q.id === editingId)?.quotation_number || 'DRAFT') : 'DRAFT',
    customer_id: selectedBooking?.customer_id || '',
    customer: selectedBooking?.customer || null,
    booking: selectedBooking || null,
    booking_id: selectedBookingId || undefined,
    items: isMultiDay ? [] : selectedItems,
    per_plate_amount: isMultiDay ? 0 : perPlateNum,
    guest_count: isMultiDay ? 0 : guestCount,
    subtotal: activeSubtotal,
    discount_amount: discountAmt,
    discount_type: 'amount' as const,
    gst_rate: gstChecked ? dcGstRate : 0,
    gst_amount: gstAmount,
    extra_charges: extraCharges.filter(c => c.description.trim() || c.amount > 0),
    transportation_charges: transportationCharges.filter(c => c.description.trim() || c.amount > 0),
    additional_discounts: additionalDiscounts.filter(d => d.description.trim() || d.amount > 0),
    total_amount: finalTotal,
    notes: notes || undefined,
    status: 'draft',
    issue_date: new Date().toISOString().split('T')[0],
    is_multi_day: isMultiDay,
    event_days: isMultiDay ? eventDays.map(d => ({ ...d, day_number: getDayNumber(d.date, eventDays) })) : [],
    created_at: new Date().toISOString(),
  });

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '20px 24px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Quotations</h2>
          <div style={{ fontSize: 12, color: '#888880', marginTop: 2 }}>{quotations.length} quotation{quotations.length !== 1 ? 's' : ''}</div>
        </div>
        {!showForm && <button onClick={openCreate} style={btnPrimary}>+ New Quotation</button>}
      </div>

      {/* ── Form ── */}
      {showForm && (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #E5E5E0', marginBottom: 24, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '0.5px solid #E5E5E0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{editingId ? 'Edit Quotation' : 'New Quotation'}</div>
            <button onClick={resetForm} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888880' }}>×</button>
          </div>

          <div style={{ padding: '16px 20px' }}>
            {/* Booking selector */}
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>SELECT BOOKING</label>
              <select value={selectedBookingId} onChange={e => setSelectedBookingId(e.target.value)} style={{ ...inp, maxWidth: 420 }}>
                <option value="">— Choose a booking —</option>
                {eligibleBookings.map(b => (
                  <option key={b.id} value={b.id}>{b.customer?.name} · {b.event_type} · {b.event_date}</option>
                ))}
              </select>
            </div>

            {/* Booking summary */}
            {selectedBooking && (
              <div style={{ background: '#F9F8F5', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#444', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 6 }}>
                <div><span style={{ color: '#888880' }}>Customer: </span>{selectedBooking.customer?.name}</div>
                <div><span style={{ color: '#888880' }}>Event: </span>{selectedBooking.event_type}</div>
                <div><span style={{ color: '#888880' }}>Date: </span>{selectedBooking.event_date}</div>
                {selectedBooking.venue && <div><span style={{ color: '#888880' }}>Venue: </span>{selectedBooking.venue}</div>}
                <div><span style={{ color: '#888880' }}>Guests: </span><strong>{guestCount}</strong></div>
              </div>
            )}

            {/* Multi-day toggle */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', userSelect: 'none' }}>
                <input type="checkbox" checked={isMultiDay} onChange={e => {
                  const checked = e.target.checked;
                  setIsMultiDay(checked);
                  setActiveMealKey(null);
                  if (checked && eventDays.length === 0) {
                    setEventDays([{ day_number: 1, date: selectedBooking?.event_date || '', meals: [], day_subtotal: 0 }]);
                  }
                  if (!checked) { setEventDays([]); }
                }} style={{ accentColor: '#E8750A', width: 15, height: 15 }} />
                <span style={{ fontWeight: 600 }}>Multi-day / Multi-meal event</span>
                <span style={{ fontSize: 11, color: '#888880' }}>(e.g. 2–3 day function with breakfast, lunch, dinner)</span>
              </label>
            </div>

            {isMultiDay ? (
              /* ── MULTI-DAY SECTION ── */
              <div style={{ marginBottom: 16 }}>
                {eventDays.map((day, dayIdx) => {
                  const dayNum = getDayNumber(day.date, eventDays);
                  return (
                  <div key={dayIdx} style={{ border: `0.5px solid ${dragOverDayIdx === dayIdx && draggedMeal?.dayIdx !== dayIdx ? '#E8750A' : '#E5E5E0'}`, borderRadius: 10, marginBottom: 14, overflow: 'hidden', transition: 'border-color 0.15s' }}>
                    {/* Day header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#F9F8F5', borderBottom: '0.5px solid #E5E5E0' }}>
                      <span style={{ fontWeight: 700, color: '#E8750A', fontSize: 13, minWidth: 50 }}>Day {dayNum}</span>
                      <input type="date" value={day.date} onChange={e => updateDayDate(dayIdx, e.target.value)}
                        style={{ border: '1px solid #E5E5E0', borderRadius: 7, padding: '5px 8px', fontSize: 13, background: '#fff' }} />
                      <div style={{ flex: 1 }} />
                      {day.day_subtotal > 0 && (
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#444' }}>₹{day.day_subtotal.toLocaleString('en-IN')}</span>
                      )}
                      <button onClick={() => removeDay(dayIdx)}
                        style={{ background: 'none', border: 'none', color: '#CC4444', fontSize: 18, cursor: 'pointer', padding: '0 4px' }}>×</button>
                    </div>

                    {/* Meals — drop zone for drag-and-drop */}
                    <div style={{ padding: '10px 14px', minHeight: draggedMeal && draggedMeal.dayIdx !== dayIdx ? 60 : undefined, transition: 'background 0.15s', background: dragOverDayIdx === dayIdx && draggedMeal?.dayIdx !== dayIdx ? '#FFF8EE' : 'transparent' }}
                      onDragOver={e => handleDayDragOver(e, dayIdx)}
                      onDragLeave={() => setDragOverDayIdx(null)}
                      onDrop={e => handleDayDrop(e, dayIdx)}>
                      {day.meals.length === 0 && (
                        <div style={{ fontSize: 12, color: dragOverDayIdx === dayIdx ? '#E8750A' : '#AAAAAA', marginBottom: 8, fontStyle: dragOverDayIdx === dayIdx ? 'normal' : 'normal' }}>
                          {dragOverDayIdx === dayIdx && draggedMeal ? 'Drop meal here' : 'No meals added for this day'}
                        </div>
                      )}
                      {day.meals.map(meal => {
                        const mealKey = `${dayIdx}_${meal.id}`;
                        const isOpen  = activeMealKey === mealKey;
                        const mealGroupedLeft  = isOpen ? getMealGroupedLeft(meal.items)  : {};
                        const mealGroupedRight = isOpen ? getMealGroupedRight(meal.items) : {};
                        const isBeingDragged = draggedMeal?.mealId === meal.id && draggedMeal?.dayIdx === dayIdx;
                        return (
                          <div key={meal.id}
                            draggable
                            onDragStart={e => handleMealDragStart(e, dayIdx, meal.id)}
                            onDragEnd={handleMealDragEnd}
                            style={{ border: `0.5px solid ${isOpen ? '#E8750A' : '#E5E5E0'}`, borderRadius: 8, marginBottom: 10, overflow: 'hidden', opacity: isBeingDragged ? 0.45 : 1, transition: 'opacity 0.15s' }}>
                            {/* Meal row */}
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 10px', flexWrap: 'wrap', background: isOpen ? '#FFF8EE' : '#fff' }}>
                              {/* Drag handle */}
                              <span title="Drag to move meal" style={{ cursor: 'grab', color: '#CCCCCA', fontSize: 15, padding: '0 2px', flexShrink: 0, userSelect: 'none' }}>⠿</span>
                              <select value={meal.meal_type} onChange={e => updateMealField(dayIdx, meal.id, 'meal_type', e.target.value)}
                                style={{ border: '1px solid #E5E5E0', borderRadius: 6, padding: '5px 8px', fontSize: 12, background: '#fff', fontWeight: 600, color: '#E8750A' }}>
                                {MEAL_TYPES.map(t => <option key={t} value={t.toLowerCase()}>{t}</option>)}
                              </select>
                              <input type="time" value={meal.time} onChange={e => updateMealField(dayIdx, meal.id, 'time', e.target.value)}
                                style={{ border: '1px solid #E5E5E0', borderRadius: 6, padding: '5px 8px', fontSize: 12, width: 110 }} />
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ fontSize: 11, color: '#888880' }}>Guests</span>
                                <input type="number" min="0" value={meal.guest_count || ''}
                                  onChange={e => updateMealField(dayIdx, meal.id, 'guest_count', parseInt(e.target.value) || 0)}
                                  placeholder="0" style={{ width: 70, border: '1px solid #E5E5E0', borderRadius: 6, padding: '5px 7px', fontSize: 12, textAlign: 'right' }} />
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ fontSize: 11, color: '#888880' }}>₹/plate</span>
                                <input type="number" min="0" value={meal.per_plate_amount || ''}
                                  onChange={e => updateMealField(dayIdx, meal.id, 'per_plate_amount', parseFloat(e.target.value) || 0)}
                                  placeholder="0" style={{ width: 80, border: '1px solid #E5E5E0', borderRadius: 6, padding: '5px 7px', fontSize: 12, textAlign: 'right' }} />
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ fontSize: 11, color: '#888880' }}>Disc. ₹/pl</span>
                                <input type="number" min="0" value={meal.discount_amount || ''}
                                  onChange={e => updateMealField(dayIdx, meal.id, 'discount_amount', parseFloat(e.target.value) || 0)}
                                  placeholder="0" style={{ width: 72, border: '1px solid #E5E5E0', borderRadius: 6, padding: '5px 7px', fontSize: 12, textAlign: 'right', background: '#FFFEF5' }} />
                              </div>
                              {meal.subtotal > 0 && (
                                (meal.discount_amount || 0) > 0 ? (
                                  <span style={{ fontSize: 12, fontWeight: 600, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.3 }}>
                                    <span style={{ textDecoration: 'line-through', color: '#AAAAAA', fontSize: 11 }}>₹{meal.subtotal.toLocaleString('en-IN')}</span>
                                    <span style={{ color: '#E8750A' }}>₹{((meal.per_plate_amount - (meal.discount_amount || 0)) * meal.guest_count).toLocaleString('en-IN')}</span>
                                  </span>
                                ) : (
                                  <span style={{ fontSize: 12, color: '#3B6D11', fontWeight: 600 }}>= ₹{meal.subtotal.toLocaleString('en-IN')}</span>
                                )
                              )}
                              <button onClick={() => { setActiveMealKey(isOpen ? null : mealKey); }}
                                style={{ fontSize: 11, color: '#E8750A', background: isOpen ? '#FFF0E0' : 'none', border: '1px solid #E8750A', borderRadius: 5, padding: '3px 8px', cursor: 'pointer', marginLeft: 'auto' }}>
                                {meal.items.length > 0 ? `${meal.items.length} items ` : 'Add Items '}
                                {isOpen ? '▲' : '▼'}
                              </button>
                              <button onClick={() => cloneMeal(dayIdx, meal.id)}
                                title="Clone this meal"
                                style={{ background: 'none', border: '1px solid #888880', borderRadius: 5, color: '#555552', fontSize: 11, cursor: 'pointer', padding: '3px 7px' }}>⧉ Clone</button>
                              <button onClick={() => removeMeal(dayIdx, meal.id)}
                                style={{ background: 'none', border: 'none', color: '#CC4444', fontSize: 18, cursor: 'pointer', padding: '0 2px' }}>×</button>
                            </div>

                            {/* Inline item picker */}
                            {isOpen && (
                              <div style={{ padding: '10px', borderTop: '0.5px solid #F5E8D0', background: '#FFFCF8' }}>
                                <div className="quotation-panels">
                                  {/* LEFT — available */}
                                  <div style={{ border: '0.5px solid #E5E5E0', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#fff' }}>
                                    <div style={{ padding: '8px 12px', borderBottom: '0.5px solid #E5E5E0', background: '#F9F8F5' }}>
                                      <div style={{ fontSize: 11, fontWeight: 600, color: '#444', marginBottom: 5 }}>AVAILABLE ITEMS</div>
                                      <input placeholder="Search items…" value={mealSearch} onChange={e => setMealSearch(e.target.value)}
                                        style={{ width: '100%', border: '1px solid #E5E5E0', borderRadius: 6, padding: '5px 8px', fontSize: 12, boxSizing: 'border-box' }} />
                                    </div>
                                    <div style={{ flex: 1, overflowY: 'auto', maxHeight: 240, padding: '6px 0' }}>
                                      {Object.keys(mealGroupedLeft).length === 0 ? (
                                        <div style={{ padding: '20px 12px', textAlign: 'center', color: '#AAAAAA', fontSize: 12 }}>
                                          {activeItems.length === 0 ? 'No active menu items' : 'All items selected'}
                                        </div>
                                      ) : Object.entries(mealGroupedLeft).map(([cat, subs]) => (
                                        <div key={cat}>
                                          <div style={{ padding: '5px 12px 2px', fontSize: 10, fontWeight: 700, color: '#E8750A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{cat}</div>
                                          {subs.map(sg => (
                                            <div key={sg.subcategory}>
                                              <div style={{ padding: '3px 12px 2px 18px', fontSize: 10, fontWeight: 600, color: '#888880', textTransform: 'uppercase' }}>{sg.subcategory}</div>
                                              {sg.items.map(it => (
                                                <div key={it.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 12px 4px 24px' }}
                                                  onMouseEnter={e => (e.currentTarget.style.background = '#F5F5F0')}
                                                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                                  <span style={{ fontSize: 12 }}>{it.name}</span>
                                                  <button onClick={() => addItemToMeal(dayIdx, meal.id, it)}
                                                    style={{ background: '#E8750A', color: '#fff', border: 'none', borderRadius: 4, width: 20, height: 20, fontSize: 14, cursor: 'pointer', flexShrink: 0 }}>+</button>
                                                </div>
                                              ))}
                                            </div>
                                          ))}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  {/* RIGHT — selected */}
                                  <div style={{ border: '0.5px solid #E5E5E0', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#fff' }}>
                                    <div style={{ padding: '8px 12px', borderBottom: '0.5px solid #E5E5E0', background: '#F9F8F5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                      <span style={{ fontSize: 11, fontWeight: 600, color: '#444' }}>SELECTED FOR THIS MEAL</span>
                                      {meal.items.length > 0 && (
                                        <button onClick={() => resetMealItems(dayIdx, meal.id)}
                                          style={{ fontSize: 11, color: '#CC4444', background: 'none', border: '1px solid #CC4444', borderRadius: 4, padding: '2px 7px', cursor: 'pointer' }}>Reset</button>
                                      )}
                                    </div>
                                    <div style={{ flex: 1, overflowY: 'auto', maxHeight: 240, padding: '6px 0' }}>
                                      {meal.items.length === 0 ? (
                                        <div style={{ padding: '36px 12px', textAlign: 'center', color: '#AAAAAA', fontSize: 12 }}>Click + on the left to add items</div>
                                      ) : Object.entries(mealGroupedRight).map(([cat, subs]) => (
                                        <div key={cat}>
                                          <div style={{ padding: '5px 12px 2px', fontSize: 10, fontWeight: 700, color: '#E8750A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{cat}</div>
                                          {subs.map(sg => (
                                            <div key={sg.subcategory}>
                                              <div style={{ padding: '3px 12px 2px 18px', fontSize: 10, fontWeight: 600, color: '#888880', textTransform: 'uppercase' }}>{sg.subcategory}</div>
                                              {sg.items.map(it => (
                                                <div key={it.item_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px 4px 24px' }}>
                                                  <span style={{ fontSize: 12, flex: 1 }}>{it.item_name}</span>
                                                  <span style={{ fontSize: 11, color: '#888880' }}>₹</span>
                                                  <input type="number" min="0" value={it.amount || ''} placeholder="0"
                                                    onChange={e => updateMealItemAmount(dayIdx, meal.id, it.item_id, parseFloat(e.target.value) || 0)}
                                                    style={{ width: 70, border: '1px solid #E5E5E0', borderRadius: 5, padding: '3px 5px', fontSize: 12, textAlign: 'right' }} />
                                                  <button onClick={() => removeItemFromMeal(dayIdx, meal.id, it.item_id)}
                                                    style={{ background: 'none', border: 'none', color: '#CC4444', fontSize: 15, cursor: 'pointer', padding: '0 2px' }}>×</button>
                                                </div>
                                              ))}
                                            </div>
                                          ))}
                                        </div>
                                      ))}
                                    </div>
                                    {meal.items.length > 0 && (
                                      <div style={{ borderTop: '0.5px solid #E5E5E0', padding: '6px 12px', background: '#F9F8F5', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#666' }}>
                                        <span>Items total → auto per plate</span>
                                        <span style={{ fontWeight: 600 }}>₹{meal.items.reduce((s, i) => s + (i.amount || 0), 0).toLocaleString('en-IN')}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <button onClick={() => addMeal(dayIdx)}
                        style={{ fontSize: 12, color: '#378ADD', background: 'none', border: '1px solid #378ADD', borderRadius: 6, padding: '4px 12px', cursor: 'pointer' }}>
                        + Add Meal for Day {dayNum}
                      </button>
                    </div>

                    {day.meals.length > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 14px', background: '#F9F8F5', borderTop: '0.5px solid #E5E5E0', fontSize: 13, fontWeight: 600, color: '#1A1A18' }}>
                        Day {dayNum} Total: <span style={{ color: '#E8750A', marginLeft: 8 }}>₹{day.day_subtotal.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                  </div>
                  );
                })}

                <button onClick={addOccasion}
                  style={{ ...btnPrimary, fontSize: 12, padding: '6px 16px', marginTop: 4, background: '#fff', color: '#E8750A', border: '1px dashed #E8750A' }}>
                  + Add Occasion
                </button>
              </div>
            ) : (
              /* ── SINGLE-DAY SECTION ── */
              <div className="quotation-panels" style={{ marginBottom: 0 }}>
                {/* LEFT */}
                <div style={{ border: '0.5px solid #E5E5E0', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '8px 12px', borderBottom: '0.5px solid #E5E5E0', background: '#F9F8F5' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#444', marginBottom: 6 }}>AVAILABLE ITEMS</div>
                    <input placeholder="Search items…" value={searchLeft} onChange={e => setSearchLeft(e.target.value)}
                      style={{ width: '100%', border: '1px solid #E5E5E0', borderRadius: 6, padding: '5px 8px', fontSize: 12, boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', maxHeight: 300, padding: '8px 0' }}>
                    {Object.keys(groupedLeft).length === 0 ? (
                      <div style={{ padding: '20px 12px', textAlign: 'center', color: '#AAAAAA', fontSize: 12 }}>
                        {activeItems.length === 0 ? 'No active menu items' : 'All items selected'}
                      </div>
                    ) : Object.entries(groupedLeft).map(([cat, subs]) => (
                      <div key={cat}>
                        <div style={{ padding: '6px 12px 2px', fontSize: 10, fontWeight: 700, color: '#E8750A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{cat}</div>
                        {subs.map(sg => (
                          <div key={sg.subcategory}>
                            <div style={{ padding: '4px 12px 2px 18px', fontSize: 10, fontWeight: 600, color: '#888880', textTransform: 'uppercase' }}>{sg.subcategory}</div>
                            {sg.items.map(it => (
                              <div key={it.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 12px 5px 24px' }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#F5F5F0')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                <span style={{ fontSize: 13 }}>{it.name}</span>
                                <button onClick={() => addItem(it)} style={{ background: '#E8750A', color: '#fff', border: 'none', borderRadius: 5, width: 22, height: 22, fontSize: 14, cursor: 'pointer', flexShrink: 0 }}>+</button>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
                {/* RIGHT */}
                <div style={{ border: '0.5px solid #E5E5E0', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '10px 12px', borderBottom: '0.5px solid #E5E5E0', background: '#F9F8F5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#444' }}>SELECTED ITEMS</span>
                    {selectedItems.length > 0 && (
                      <button onClick={() => setSelectedItems([])} style={{ fontSize: 11, color: '#CC4444', background: 'none', border: '1px solid #CC4444', borderRadius: 5, padding: '2px 8px', cursor: 'pointer' }}>Reset All</button>
                    )}
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', maxHeight: 300, padding: '8px 0' }}>
                    {selectedItems.length === 0 ? (
                      <div style={{ padding: '40px 12px', textAlign: 'center', color: '#AAAAAA', fontSize: 12 }}>Click + on the left to add items</div>
                    ) : Object.entries(groupedRight).map(([cat, subs]) => (
                      <div key={cat}>
                        <div style={{ padding: '6px 12px 2px', fontSize: 10, fontWeight: 700, color: '#E8750A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{cat}</div>
                        {subs.map(sg => (
                          <div key={sg.subcategory}>
                            <div style={{ padding: '4px 12px 2px 18px', fontSize: 10, fontWeight: 600, color: '#888880', textTransform: 'uppercase' }}>{sg.subcategory}</div>
                            {sg.items.map(it => (
                              <div key={it.item_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px 5px 24px' }}>
                                <span style={{ fontSize: 13, flex: 1 }}>{it.item_name}</span>
                                <span style={{ fontSize: 12, color: '#888880' }}>₹</span>
                                <input type="number" min="0" value={it.amount || ''} onChange={e => updateAmount(it.item_id, e.target.value)}
                                  placeholder="0" style={{ width: 80, border: '1px solid #E5E5E0', borderRadius: 6, padding: '4px 6px', fontSize: 13, textAlign: 'right' }} />
                                <button onClick={() => removeItem(it.item_id)} style={{ background: 'none', border: 'none', color: '#CC4444', fontSize: 16, cursor: 'pointer', padding: '0 2px' }}>×</button>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  {selectedItems.length > 0 && (
                    <div style={{ borderTop: '0.5px solid #E5E5E0', padding: '8px 12px', background: '#F9F8F5', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#666' }}>
                      <span>Items Total</span>
                      <span style={{ fontWeight: 600 }}>₹{itemsTotal.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Per plate + totals (single-day only) ── */}
            {!isMultiDay && (
              <div style={{ marginTop: 14, background: '#F9F8F5', borderRadius: 10, padding: '12px 16px', border: '0.5px solid #E5E5E0', marginBottom: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#666', whiteSpace: 'nowrap' }}>Per Plate (₹)</label>
                    <input type="number" min="0" value={perPlate}
                      onChange={e => { perPlateAutoRef.current = false; setPerPlate(e.target.value); }}
                      placeholder="0" style={{ width: 100, border: '1px solid #E5E5E0', borderRadius: 7, padding: '6px 8px', fontSize: 13, textAlign: 'right', background: '#fff' }} />
                  </div>
                  <span style={{ fontSize: 13, color: '#888880' }}>×</span>
                  <div style={{ fontSize: 13, color: '#444' }}><strong>{guestCount}</strong> <span style={{ color: '#888880' }}>guests</span></div>
                  <span style={{ fontSize: 13, color: '#888880' }}>=</span>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1A18' }}>
                    ₹{subtotal.toLocaleString('en-IN')}
                    <span style={{ fontSize: 11, color: '#888880', fontWeight: 400, marginLeft: 4 }}>(Subtotal)</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Common: Discount, Extra Charges, Transportation, GST, Total ── */}
            <div style={{ marginTop: 14, background: '#F9F8F5', borderRadius: 10, padding: '14px 16px', border: '0.5px solid #E5E5E0' }}>

              {/* Discount */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#888880', marginBottom: 6 }}>DISCOUNT</div>

                {/* Meal savings breakdown — auto, read-only */}
                {isMultiDay && totalMealSavings > 0 && (
                  <div style={{ background: '#F2FBE9', border: '0.5px solid #B8DCA0', borderRadius: 7, padding: '8px 10px', marginBottom: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#3B6D11', marginBottom: 5, letterSpacing: '0.04em' }}>MEAL OFFER SAVINGS (AUTO)</div>
                    {eventDays.map((day, di) => {
                      const dayNum = getDayNumber(day.date, eventDays);
                      return day.meals.map((meal, mi) => {
                        const offer = meal.discount_amount || 0;
                        if (offer <= 0) return null;
                        const saving = offer * meal.guest_count;
                        return (
                          <div key={`${di}-${mi}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 0', color: '#3B6D11' }}>
                            <span>{meal.meal_type.charAt(0).toUpperCase() + meal.meal_type.slice(1)} — Day {dayNum}{day.date ? ` · ${formatDateIST(day.date, 'dd-MM')}` : ''}</span>
                            <span style={{ fontWeight: 600 }}>-₹{saving.toLocaleString('en-IN')}</span>
                          </div>
                        );
                      });
                    })}
                  </div>
                )}

                {/* Additional manual discounts */}
                <div style={{ marginBottom: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: '#888880' }}>ADDITIONAL DISCOUNTS</span>
                    <button onClick={() => setAdditionalDiscounts(prev => [...prev, { id: genId(), description: '', amount: 0 }])}
                      style={{ fontSize: 11, color: '#3B6D11', background: 'none', border: '1px solid #3B6D11', borderRadius: 5, padding: '2px 8px', cursor: 'pointer' }}>
                      + Add Discount
                    </button>
                  </div>
                  {additionalDiscounts.length === 0 && (
                    <div style={{ fontSize: 11, color: '#BBBBBB', marginBottom: 4 }}>No additional discounts</div>
                  )}
                  {additionalDiscounts.map((d, i) => (
                    <div key={d.id} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                      <input placeholder="Reason (e.g. Festive Offer)" value={d.description}
                        onChange={e => setAdditionalDiscounts(prev => prev.map((x, j) => j === i ? { ...x, description: e.target.value } : x))}
                        style={{ flex: 1, border: '1px solid #E5E5E0', borderRadius: 7, padding: '6px 8px', fontSize: 12, background: '#fff' }} />
                      <input type="number" min="0" placeholder="₹ Amount" value={d.amount || ''}
                        onChange={e => setAdditionalDiscounts(prev => prev.map((x, j) => j === i ? { ...x, amount: parseFloat(e.target.value) || 0 } : x))}
                        style={{ width: 110, border: '1px solid #E5E5E0', borderRadius: 7, padding: '6px 8px', fontSize: 13, background: '#fff', textAlign: 'right' as const }} />
                      <button onClick={() => setAdditionalDiscounts(prev => prev.filter((_, j) => j !== i))}
                        style={{ background: 'none', border: 'none', color: '#CC4444', fontSize: 18, cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}>×</button>
                    </div>
                  ))}
                </div>

                {discountAmt > 0 && (
                  <div style={{ fontSize: 12, color: '#3B6D11', textAlign: 'right', fontWeight: 600 }}>
                    Total Discount: -₹{discountAmt.toLocaleString('en-IN')}
                  </div>
                )}
              </div>

              {/* Extra Charges */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#888880' }}>EXTRA CHARGES</span>
                  <button onClick={() => setExtraCharges(prev => [...prev, { description: '', amount: 0 }])}
                    style={{ fontSize: 11, color: '#E8750A', background: 'none', border: '1px solid #E8750A', borderRadius: 5, padding: '2px 8px', cursor: 'pointer' }}>+ Add</button>
                </div>
                {extraCharges.length === 0 && <div style={{ fontSize: 11, color: '#AAAAAA' }}>No extra charges added</div>}
                {extraCharges.map((ec, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                    <input placeholder="Description" value={ec.description}
                      onChange={e => setExtraCharges(prev => prev.map((c, j) => j === i ? { ...c, description: e.target.value } : c))}
                      style={{ flex: 1, border: '1px solid #E5E5E0', borderRadius: 7, padding: '6px 8px', fontSize: 12, background: '#fff' }} />
                    <input type="number" min="0" placeholder="₹ Amount" value={ec.amount || ''}
                      onChange={e => setExtraCharges(prev => prev.map((c, j) => j === i ? { ...c, amount: parseFloat(e.target.value) || 0 } : c))}
                      style={{ width: 110, border: '1px solid #E5E5E0', borderRadius: 7, padding: '6px 8px', fontSize: 13, background: '#fff', textAlign: 'right' as const }} />
                    <button onClick={() => setExtraCharges(prev => prev.filter((_, j) => j !== i))}
                      style={{ background: 'none', border: 'none', color: '#CC4444', fontSize: 18, cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}>×</button>
                  </div>
                ))}
                {extraChargesTotal > 0 && <div style={{ fontSize: 12, color: '#444', textAlign: 'right', fontWeight: 600 }}>Total: +₹{extraChargesTotal.toLocaleString('en-IN')}</div>}
              </div>

              {/* Transportation Charges */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#888880' }}>TRANSPORTATION CHARGES</span>
                  <button onClick={() => setTransportationCharges(prev => [...prev, { description: '', amount: 0 }])}
                    style={{ fontSize: 11, color: '#E8750A', background: 'none', border: '1px solid #E8750A', borderRadius: 5, padding: '2px 8px', cursor: 'pointer' }}>+ Add</button>
                </div>
                {transportationCharges.length === 0 && <div style={{ fontSize: 11, color: '#AAAAAA' }}>No transportation charges added</div>}
                {transportationCharges.map((tc, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                    <input placeholder="Description (e.g. Vehicle, Distance)" value={tc.description}
                      onChange={e => setTransportationCharges(prev => prev.map((c, j) => j === i ? { ...c, description: e.target.value } : c))}
                      style={{ flex: 1, border: '1px solid #E5E5E0', borderRadius: 7, padding: '6px 8px', fontSize: 12, background: '#fff' }} />
                    <input type="number" min="0" placeholder="₹ Amount" value={tc.amount || ''}
                      onChange={e => setTransportationCharges(prev => prev.map((c, j) => j === i ? { ...c, amount: parseFloat(e.target.value) || 0 } : c))}
                      style={{ width: 110, border: '1px solid #E5E5E0', borderRadius: 7, padding: '6px 8px', fontSize: 13, background: '#fff', textAlign: 'right' as const }} />
                    <button onClick={() => setTransportationCharges(prev => prev.filter((_, j) => j !== i))}
                      style={{ background: 'none', border: 'none', color: '#CC4444', fontSize: 18, cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}>×</button>
                  </div>
                ))}
                {transportationChargesTotal > 0 && <div style={{ fontSize: 12, color: '#444', textAlign: 'right', fontWeight: 600 }}>Total: +₹{transportationChargesTotal.toLocaleString('en-IN')}</div>}
              </div>

              {/* GST */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: 12 }}>
                <input type="checkbox" checked={gstChecked} onChange={e => setGstChecked(e.target.checked)} style={{ accentColor: '#E8750A', width: 15, height: 15 }} />
                <span>Add GST <strong>@{dcGstRate}%</strong></span>
                {gstChecked && gstAmount > 0 && <span style={{ color: '#666660', fontSize: 12 }}>(+₹{gstAmount.toLocaleString('en-IN')})</span>}
              </label>

              {/* Grand total */}
              <div style={{ borderTop: '0.5px solid #E5E5E0', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {isMultiDay ? (
                  <div style={{ fontSize: 12, color: '#666' }}>
                    {eventDays.map(d => (
                      <div key={d.day_number} style={{ fontSize: 11, color: '#888880' }}>
                        Day {d.day_number}{d.date ? ` (${d.date})` : ''}: ₹{d.day_subtotal.toLocaleString('en-IN')}
                      </div>
                    ))}
                    <div style={{ marginTop: 2 }}>Multi-day Subtotal: <strong>₹{multiDaySubtotal.toLocaleString('en-IN')}</strong></div>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: '#666' }}>
                    <div>Per Plate: <strong>₹{perPlateNum.toLocaleString('en-IN')}</strong></div>
                    <div style={{ fontSize: 11, color: '#888880', marginTop: 2 }}>Subtotal: ₹{subtotal.toLocaleString('en-IN')}</div>
                  </div>
                )}
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#888880' }}>Payable Amount</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#E8750A' }}>₹{finalTotal.toLocaleString('en-IN')}</div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div style={{ marginTop: 14 }}>
              <label style={lbl}>NOTES (OPTIONAL)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="Add any notes…" style={{ width: '100%', border: '1px solid #E5E5E0', borderRadius: 8, padding: '8px 10px', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
            </div>

            {/* Download PDF (draft preview) */}
            <div style={{ marginTop: 14, padding: '10px 14px', background: '#F5F8FF', border: '0.5px solid #B8C8F4', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, cursor: 'pointer', userSelect: 'none' }}>
                <input type="checkbox" checked={pdfWithPrices} onChange={e => setPdfWithPrices(e.target.checked)}
                  style={{ accentColor: '#E8750A', width: 14, height: 14 }} />
                <span>Include item prices in PDF</span>
              </label>
              <button
                onClick={() => {
                  if (!selectedBookingId) { toast.error('Select a booking first'); return; }
                  downloadPDF(buildDraftQuotation(), pdfWithPrices);
                }}
                style={{ background: '#378ADD', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                ⬇ Download PDF
              </button>
            </div>

            <div style={{ marginTop: 10, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={resetForm} style={btnGhost}>Cancel</button>
              <button onClick={handleSave} disabled={isSaving} style={{ ...btnPrimary, opacity: isSaving ? 0.6 : 1 }}>
                {isSaving ? 'Saving…' : editingId ? 'Update Quotation' : 'Save Quotation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Quotations list ── */}
      {quotations.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #E5E5E0', padding: '48px 24px', textAlign: 'center', color: '#AAAAAA' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>No quotations yet</div>
          <div style={{ fontSize: 12 }}>Create your first quotation using the button above</div>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #E5E5E0', overflow: 'hidden' }}>
          <div className="table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr style={{ background: '#F9F8F5', borderBottom: '0.5px solid #E5E5E0' }}>
                  {['Quotation #', 'Customer', 'Event', 'Type', 'Total', 'Status', 'Date', ''].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#888880', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quotations.map((q, i) => (
                  <tr key={q.id} style={{ borderBottom: i < quotations.length - 1 ? '0.5px solid #F0F0EA' : 'none' }}>
                    <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, color: '#E8750A', whiteSpace: 'nowrap' }}>{q.quotation_number}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13 }}>{q.customer?.name || '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: '#666', whiteSpace: 'nowrap' }}>
                      {q.booking ? `${q.booking.event_type} · ${q.booking.event_date}` : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {q.is_multi_day
                        ? <span style={{ background: '#E6F1FB', color: '#185FA5', fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>Multi-day ({q.event_days?.length || 0}d)</span>
                        : q.per_plate_amount > 0 ? `₹${q.per_plate_amount.toLocaleString('en-IN')}/plate` : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>₹{(q.total_amount || 0).toLocaleString('en-IN')}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <select value={q.status}
                        onChange={async e => {
                          try { await updateStatus.mutateAsync({ id: q.id, status: e.target.value }); toast.success('Status updated'); }
                          catch { toast.error('Failed to update'); }
                        }}
                        style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 600, color: STATUS_COLORS[q.status] || '#888880', cursor: 'pointer', padding: 0 }}>
                        {['draft', 'sent', 'accepted', 'rejected'].map(s => (
                          <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: '#888880', whiteSpace: 'nowrap' }}>{formatDateIST(q.issue_date, 'dd-MM-yyyy')}</td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      <button onClick={() => downloadPDF(q)} style={actionBtn('#378ADD')}>⬇ PDF</button>
                      <button onClick={() => openEdit(q)} style={actionBtn('#444')}>✏ Edit</button>
                      <button onClick={() => handleDelete(q.id, q.quotation_number)} style={{ background: 'none', border: 'none', color: '#CC4444', fontSize: 14, cursor: 'pointer', padding: '2px 4px' }}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

const btnPrimary: React.CSSProperties = { background: '#E8750A', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const btnGhost:   React.CSSProperties = { border: '1px solid #E5E5E0', background: '#fff', borderRadius: 8, padding: '8px 18px', fontSize: 13, cursor: 'pointer' };
const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#888880', display: 'block', marginBottom: 4 };
const inp: React.CSSProperties = { width: '100%', border: '1px solid #E5E5E0', borderRadius: 8, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box' as const };
const actionBtn = (color: string): React.CSSProperties => ({
  background: 'none', border: '1px solid #E5E5E0', borderRadius: 5,
  padding: '3px 8px', fontSize: 11, cursor: 'pointer', marginRight: 5, color,
});

export default Quotations;
