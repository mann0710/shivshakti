// Quotation PDF (navy + gold theme), moved out of Quotations.tsx unchanged.
import jsPDF from 'jspdf';
import { formatDateIST } from '../ist';
import { SHOP } from '../shop';
import { Quotation, EventDay } from '../../hooks/useQuotations';

// Day number = ordinal position of date among unique dates in first-appearance order
export const getDayNumber = (date: string, days: EventDay[]): number => {
  const seen: string[] = [];
  for (const d of days) {
    if (d.date && !seen.includes(d.date)) seen.push(d.date);
  }
  const idx = seen.indexOf(date);
  return idx >= 0 ? idx + 1 : 1;
};

// ─── PDF logo (preloaded at module level) ─────────────────────────────────────
const _qPdfLogo = (() => { const i = new Image(); i.src = '/logo.png'; return i; })();

// ─── PDF generator ────────────────────────────────────────────────────────────
export const downloadPDF = (q: Quotation, withPrices = true) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210; const M = 15; const CW = W - M * 2; // 180mm content width
  const RH = 7; // standard row height
  let y = 0;

  // ── Palette — refined navy brand with a warm gold accent ─────────────────────
  const NAVY: [number, number, number] = [26, 35, 126];
  const GOLD: [number, number, number] = [176, 141, 66];
  const INK:  [number, number, number] = [34, 34, 40];
  const MUTE: [number, number, number] = [122, 122, 130];
  const LINE: [number, number, number] = [221, 221, 226];
  const BAND: [number, number, number] = [244, 246, 253]; // light navy tint
  const setFill = (c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
  const setText = (c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
  const setDraw = (c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);

  const hasLogo = _qPdfLogo.complete && _qPdfLogo.naturalWidth > 0;

  // ── Header ────────────────────────────────────────────────────────────────
  doc.setFillColor(255, 255, 255); doc.rect(0, 0, W, 40, 'F');
  y = 5;
  if (hasLogo) {
    try { doc.addImage(_qPdfLogo as any, 'PNG', M, y, 40, 29); } catch {}
  }
  // Elegant serif title with a gold underscore rule
  doc.setFontSize(28); doc.setFont('times', 'bold'); setText(NAVY);
  doc.text('Quotation', W - M, y + 11, { align: 'right' });
  setDraw(GOLD); doc.setLineWidth(0.6);
  doc.line(W - M - 48, y + 14.5, W - M, y + 14.5); doc.setLineWidth(0.2);
  // Meta block — muted labels, inked values
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); setText(MUTE);
  doc.text('QUOTATION NO.', W - M - 44, y + 21);
  doc.text('DATE', W - M - 44, y + 27);
  doc.setFont('helvetica', 'bold'); setText(INK);
  doc.text(q.quotation_number, W - M, y + 21, { align: 'right' });
  doc.text(formatDateIST(q.issue_date, 'dd-MM-yyyy'), W - M, y + 27, { align: 'right' });
  // Twin accent rules under the header: fine gold over a navy band
  setFill(GOLD); doc.rect(0, 38.4, W, 0.5, 'F');
  setFill(NAVY); doc.rect(0, 38.9, W, 1.5, 'F');
  y = 47;

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const infoRow = (label: string, value: string) => {
    if (y > 272) { doc.addPage(); y = 15; }
    setFill(BAND); doc.rect(M, y, 52, RH, 'F');            // label band
    setDraw(LINE); doc.setLineWidth(0.2);
    doc.line(M, y + RH, M + CW, y + RH);                   // hairline under row
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold');
    setText(MUTE); doc.text(label.toUpperCase(), M + 3, y + RH - 2);
    doc.setFont('helvetica', 'normal'); setText(INK);
    doc.text(value, M + 55, y + RH - 2);
    y += RH;
  };

  // Elegant section heading: gold tab + serif label + hairline rule
  const sectionTitle = (title: string) => {
    if (y > 268) { doc.addPage(); y = 15; }
    setFill(GOLD); doc.rect(M, y - 3.4, 2.2, 5, 'F');
    doc.setFontSize(12); doc.setFont('times', 'bold'); setText(NAVY);
    doc.text(title, M + 5, y + 1);
    setDraw(LINE); doc.setLineWidth(0.3);
    doc.line(M, y + 3.6, M + CW, y + 3.6); doc.setLineWidth(0.2);
    y += 8;
  };

  // Meal table column widths: Day=20, MealType=45, Guests=20, Rate=35, Amount=60
  const MC = [20, 45, 20, 35, 60];
  const drawMealHeader = () => {
    if (y > 272) { doc.addPage(); y = 15; }
    setFill(NAVY); doc.rect(M, y, CW, RH, 'F');
    setFill(GOLD); doc.rect(M, y + RH - 0.7, CW, 0.7, 'F');
    const headers = ['Day', 'Meal Type', 'Guests', 'Rate/Plate', 'Amount'];
    let x = M;
    headers.forEach((h, i) => {
      if (i > 0) { doc.setDrawColor(200, 198, 195); doc.line(x, y, x, y + RH); }
      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
      const right = i >= 2;
      doc.text(h, right ? x + MC[i] - 2 : x + 3, y + RH - 2, { align: right ? 'right' : 'left' });
      x += MC[i];
    });
    y += RH;
  };

  const summaryRow = (label: string, value: string, bold = false, valColor: [number, number, number] = [30, 30, 28]) => {
    if (y > 272) { doc.addPage(); y = 15; }
    const rh = bold ? RH + 2 : RH;
    if (bold) { doc.setFillColor(249, 247, 244); doc.rect(M, y, CW, rh, 'F'); }
    doc.setDrawColor(210, 208, 205);
    doc.rect(M, y, 120, rh); doc.rect(M + 120, y, CW - 120, rh);
    doc.setFontSize(bold ? 10 : 9); doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setTextColor(80, 80, 78); doc.text(label, M + 3, y + rh - 2);
    doc.setTextColor(valColor[0], valColor[1], valColor[2]);
    doc.text(value, M + CW - 2, y + rh - 2, { align: 'right' });
    y += rh;
  };

  // ── Info block ──────────────────────────────────────────────────────────────
  const customer = q.customer; const booking = q.booking;
  infoRow('Customer', customer?.name || '—');
  if (customer?.phone) infoRow('Phone', customer.phone);
  if (booking?.event_type) infoRow('Event Type', booking.event_type);
  if (booking?.event_date) {
    if (booking.end_date && booking.end_date !== booking.event_date) {
      infoRow('Event Dates', `${formatDateIST(booking.event_date, 'dd-MM-yyyy')} – ${formatDateIST(booking.end_date, 'dd-MM-yyyy')}`);
    } else {
      infoRow('Event Date', formatDateIST(booking.event_date, 'dd-MM-yyyy'));
    }
  }
  if (booking?.event_time) infoRow('Time', booking.event_time);
  if (booking?.venue) infoRow('Venue', booking.venue);
  // No. of persons — single-day uses the quotation guest count; multi-day shows the
  // range across every meal (guest_count is stored as 0 on multi-day quotations).
  {
    const mealCounts = (q.is_multi_day ? (q.event_days || []) : [])
      .flatMap(d => (d.meals || []).map(ml => ml.guest_count || 0))
      .filter(n => n > 0);
    if (mealCounts.length) {
      const lo = Math.min(...mealCounts), hi = Math.max(...mealCounts);
      infoRow('No. of Persons', lo === hi ? String(lo) : `${lo} – ${hi}`);
    } else {
      const count = q.guest_count || booking?.guest_count || 0;
      if (count > 0) infoRow('No. of Persons', String(count));
    }
  }
  // Per plate rate — single-day uses the quotation rate; multi-day shows the range
  // of effective rates (the offer rate when one is set) across every meal.
  {
    const rates = (q.is_multi_day ? (q.event_days || []) : [])
      .flatMap(d => (d.meals || []).map(ml => {
        const off = ml.discount_amount || 0;
        return off > 0 ? off : (ml.per_plate_amount || 0);
      }))
      .filter(n => n > 0);
    if (rates.length) {
      const lo = Math.min(...rates), hi = Math.max(...rates);
      infoRow('Per Plate', lo === hi
        ? `Rs.${lo.toLocaleString('en-IN')}`
        : `Rs.${lo.toLocaleString('en-IN')} – Rs.${hi.toLocaleString('en-IN')}`);
    } else if (q.per_plate_amount > 0) {
      infoRow('Per Plate', `Rs.${q.per_plate_amount.toLocaleString('en-IN')}`);
    }
  }
  if (q.food_type) infoRow('Food Type', q.food_type);
  infoRow('Status', q.status.charAt(0).toUpperCase() + q.status.slice(1));
  y += 6;

  // ── Event Schedule ──────────────────────────────────────────────────────────
  if (q.is_multi_day && q.event_days?.length) {
    sectionTitle('Event Schedule');
    drawMealHeader();

    for (const day of q.event_days) {
      if (y > 265) { doc.addPage(); y = 15; drawMealHeader(); }
      // Day separator row
      doc.setFillColor(235, 238, 252); doc.rect(M, y, CW, RH, 'F');
      doc.setDrawColor(210, 208, 205); doc.rect(M, y, CW, RH);
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(26, 35, 126);
      doc.text(`Day ${day.day_number}  —  ${formatDateIST(day.date, 'dd-MM-yyyy')}`, M + 3, y + RH - 2);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 78);
      doc.text(`Rs.${day.day_subtotal.toLocaleString('en-IN')}`, M + CW - 2, y + RH - 2, { align: 'right' });
      y += RH;

      for (const meal of day.meals) {
        if (y > 265) { doc.addPage(); y = 15; drawMealHeader(); }
        const offerRate = meal.discount_amount || 0;
        const mealNet = offerRate > 0 ? offerRate * meal.guest_count : meal.subtotal;
        const rateStr = `Rs.${(offerRate > 0 ? offerRate : meal.per_plate_amount).toLocaleString('en-IN')}/pl`;

        // Main meal row
        doc.setFillColor(255, 255, 255); doc.rect(M, y, CW, RH, 'F');
        doc.setDrawColor(210, 208, 205); doc.rect(M, y, CW, RH);
        let x = M;
        const mealCells = [
          `Day ${day.day_number}`,
          meal.meal_type.charAt(0).toUpperCase() + meal.meal_type.slice(1),
          String(meal.guest_count),
          rateStr,
          `Rs.${mealNet.toLocaleString('en-IN')}`,
        ];
        for (let i = 0; i < mealCells.length; i++) {
          if (i > 0) { doc.setDrawColor(210, 208, 205); doc.line(x, y, x, y + RH); }
          doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 30, 28);
          const right = i >= 2;
          doc.text(mealCells[i], right ? x + MC[i] - 2 : x + 3, y + RH - 2, { align: right ? 'right' : 'left' });
          x += MC[i];
        }
        y += RH;

        // Ceremony name sub-row
        if (meal.ceremony_name) {
          if (y > 272) { doc.addPage(); y = 15; drawMealHeader(); }
          const cereH = 6;
          doc.setFillColor(235, 238, 252); doc.rect(M, y, CW, cereH, 'F');
          doc.setDrawColor(210, 208, 205); doc.rect(M, y, CW, cereH);
          doc.line(M + MC[0], y, M + MC[0], y + cereH);
          doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(26, 35, 126);
          doc.text(`  Ceremony: ${meal.ceremony_name}`, M + MC[0] + 2, y + cereH - 1.5);
          y += cereH;
        }

        // Item sub-rows grouped by subcategory
        const mealGrpsQ: { label: string; items: any[] }[] = [];
        const mealGrpIdxQ = new Map<string, number>();
        for (const it of (meal.items || [])) {
          const sk = (it as any).subcategory_name || '';
          if (!mealGrpIdxQ.has(sk)) { mealGrpIdxQ.set(sk, mealGrpsQ.length); mealGrpsQ.push({ label: sk, items: [] }); }
          mealGrpsQ[mealGrpIdxQ.get(sk)!].items.push(it);
        }
        for (const grp of mealGrpsQ) {
          if (grp.label) {
            if (y > 272) { doc.addPage(); y = 15; drawMealHeader(); }
            const hdrH = 6;
            setFill(BAND); doc.rect(M, y, CW, hdrH, 'F');
            setDraw(LINE); doc.rect(M, y, CW, hdrH);
            doc.line(M + MC[0], y, M + MC[0], y + hdrH);
            setFill(GOLD); doc.rect(M + MC[0] + 1.5, y + 1.4, 1.4, hdrH - 2.8, 'F');
            doc.setFontSize(8); doc.setFont('helvetica', 'bold'); setText(NAVY);
            doc.text(grp.label, M + MC[0] + 4.5, y + hdrH - 1.7);
            y += hdrH;
          }
          for (const it of grp.items) {
            if (y > 272) { doc.addPage(); y = 15; drawMealHeader(); }
            const subH = 6.5;
            doc.setFillColor(255, 255, 255); doc.rect(M, y, CW, subH, 'F');
            setDraw(LINE); doc.rect(M, y, CW, subH);
            doc.line(M + MC[0], y, M + MC[0], y + subH);
            doc.setFontSize(9); doc.setFont('times', 'normal'); setText(INK);
            doc.text(`•  ${(it as any).item_name}`, M + MC[0] + 4.5, y + subH - 2);
            if (withPrices && (it as any).amount > 0) {
              doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); setText([70, 70, 74]);
              doc.text(`Rs.${((it as any).amount || 0).toLocaleString('en-IN')}`, M + CW - 2, y + subH - 2, { align: 'right' });
            }
            y += subH;
            if ((it as any).served_with) {
              if (y > 272) { doc.addPage(); y = 15; drawMealHeader(); }
              const swH = 5.5;
              doc.setFillColor(244, 250, 244); doc.rect(M, y, CW, swH, 'F');
              doc.setDrawColor(210, 208, 205); doc.rect(M, y, CW, swH);
              doc.line(M + MC[0], y, M + MC[0], y + swH);
              doc.setFontSize(7.5); doc.setFont('times', 'italic'); doc.setTextColor(34, 90, 34);
              doc.text(`  Served with: ${(it as any).served_with}`, M + MC[0] + 2, y + swH - 1.5);
              y += swH;
            }
            if ((it as any).instruction) {
              if (y > 272) { doc.addPage(); y = 15; drawMealHeader(); }
              const noteH = 5.5;
              doc.setFillColor(252, 250, 244); doc.rect(M, y, CW, noteH, 'F');
              doc.setDrawColor(210, 208, 205); doc.rect(M, y, CW, noteH);
              doc.line(M + MC[0], y, M + MC[0], y + noteH);
              doc.setFontSize(7.5); doc.setFont('times', 'italic'); doc.setTextColor(100, 70, 30);
              doc.text(`  Note: ${(it as any).instruction}`, M + MC[0] + 2, y + noteH - 1.5);
              y += noteH;
            }
          }
        }

        // Offer saving sub-row
        if (offerRate > 0 && meal.per_plate_amount > offerRate) {
          if (y > 272) { doc.addPage(); y = 15; drawMealHeader(); }
          const saving = (meal.per_plate_amount - offerRate) * meal.guest_count;
          const subH = 6;
          doc.setFillColor(240, 252, 240); doc.rect(M, y, CW, subH, 'F');
          doc.setDrawColor(210, 208, 205); doc.rect(M, y, CW, subH);
          doc.line(M + MC[0], y, M + MC[0], y + subH);
          doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(34, 120, 34);
          doc.text(`  Actual Rs.${meal.per_plate_amount.toLocaleString('en-IN')}/pl — Offer saving`, M + MC[0] + 2, y + subH - 1.5);
          doc.text(`-Rs.${saving.toLocaleString('en-IN')}`, M + CW - 2, y + subH - 1.5, { align: 'right' });
          y += subH;
        }
      }
    }
    y += 6;
  } else {
    // Single-day: items grouped by subcategory
    if ((q.items || []).length > 0) {
      sectionTitle('Menu Items');

      // Header: Item, Amount
      setFill(NAVY); doc.rect(M, y, CW, RH, 'F');
      setFill(GOLD); doc.rect(M, y + RH - 0.7, CW, 0.7, 'F');
      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
      doc.text('Item', M + 3, y + RH - 2);
      if (withPrices) {
        doc.line(M + 158, y, M + 158, y + RH);
        doc.text('Amount', M + CW - 2, y + RH - 2, { align: 'right' });
      }
      y += RH;

      // Group items by subcategory (preserve first-appearance order)
      type SubGroup = { subcategoryName: string; categoryName: string; items: typeof q.items };
      const subGroups: SubGroup[] = [];
      const seenSubs = new Set<string>();
      for (const item of (q.items || [])) {
        const key = `${item.category_name}|||${item.subcategory_name}`;
        if (!seenSubs.has(key)) {
          seenSubs.add(key);
          subGroups.push({ subcategoryName: item.subcategory_name, categoryName: item.category_name, items: [] });
        }
        subGroups.find(g => g.subcategoryName === item.subcategory_name && g.categoryName === item.category_name)!.items.push(item);
      }

      for (const group of subGroups) {
        if (y > 268) { doc.addPage(); y = 20; }
        // Subcategory header row
        setFill(BAND); doc.rect(M, y, CW, RH, 'F');
        setDraw(LINE); doc.rect(M, y, CW, RH);
        setFill(GOLD); doc.rect(M + 2, y + 1.6, 1.4, RH - 3.2, 'F');
        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); setText(NAVY);
        doc.text(group.subcategoryName, M + 5, y + RH - 2);
        y += RH;

        for (const item of group.items) {
          if (y > 268) { doc.addPage(); y = 20; }
          doc.setFillColor(255, 255, 255); doc.rect(M, y, CW, RH, 'F');
          setDraw(LINE); doc.rect(M, y, CW, RH);
          doc.setFontSize(9); doc.setFont('times', 'normal'); setText(INK);
          doc.text(`•  ${item.item_name}`, M + 5, y + RH - 2);
          if (withPrices) {
            doc.line(M + 158, y, M + 158, y + RH);
            doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); setText([70, 70, 74]);
            doc.text(`Rs.${(item.amount || 0).toLocaleString('en-IN')}`, M + CW - 2, y + RH - 2, { align: 'right' });
          }
          y += RH;
          if (item.served_with) {
            if (y > 272) { doc.addPage(); y = 20; }
            const swH = 5.5;
            doc.setFillColor(244, 250, 244); doc.rect(M, y, CW, swH, 'F');
            doc.setDrawColor(210, 208, 205); doc.rect(M, y, CW, swH);
            doc.setFontSize(7.5); doc.setFont('times', 'italic'); doc.setTextColor(34, 90, 34);
            doc.text(`  Served with: ${item.served_with}`, M + 3, y + swH - 1.5);
            y += swH;
          }
          if (item.instruction) {
            if (y > 272) { doc.addPage(); y = 20; }
            const noteH = 5.5;
            doc.setFillColor(252, 250, 244); doc.rect(M, y, CW, noteH, 'F');
            doc.setDrawColor(210, 208, 205); doc.rect(M, y, CW, noteH);
            doc.setFontSize(7.5); doc.setFont('times', 'italic'); doc.setTextColor(100, 70, 30);
            doc.text(`  Note: ${item.instruction}`, M + 3, y + noteH - 1.5);
            y += noteH;
          }
        }
      }
      y += 3;
    }
    y += 4;
  }

  // ── Billing Summary ─────────────────────────────────────────────────────────
  sectionTitle('Billing Summary');

  if (q.is_multi_day && (q.event_days || []).length > 0) {
    const dayRates = (q.event_days || [])
      .flatMap(d => (d.meals || []).map(ml => ml.per_plate_amount || 0))
      .filter(n => n > 0);
    const lo = dayRates.length ? Math.min(...dayRates) : 0;
    const hi = dayRates.length ? Math.max(...dayRates) : 0;
    const origLabel = !dayRates.length ? 'Original Price'
      : lo === hi ? `Original Price (Rs.${lo.toLocaleString('en-IN')}/plate)`
      : `Original Price (Rs.${lo.toLocaleString('en-IN')} – Rs.${hi.toLocaleString('en-IN')}/plate)`;
    summaryRow(origLabel, `Rs.${q.subtotal.toLocaleString('en-IN')}`);
    for (const day of (q.event_days || [])) {
      for (const meal of (day.meals || [])) {
        const offer = meal.discount_amount || 0;
        if (offer > 0 && meal.per_plate_amount > offer) {
          const saving = (meal.per_plate_amount - offer) * meal.guest_count;
          summaryRow(
            `  ${meal.meal_type.charAt(0).toUpperCase() + meal.meal_type.slice(1)} Offer (Day ${day.day_number})`,
            `-Rs.${saving.toLocaleString('en-IN')}`, false, [34, 120, 34],
          );
        }
      }
    }
    for (const ad of (q.additional_discounts || [])) {
      if (!ad.amount) continue;
      summaryRow(`  ${ad.description || 'Discount'}`, `-Rs.${ad.amount.toLocaleString('en-IN')}`, false, [34, 120, 34]);
    }
  } else {
    if (q.per_plate_amount > 0 && q.guest_count > 0)
      summaryRow(
        `Per Plate Rs.${q.per_plate_amount.toLocaleString('en-IN')}  ×  ${q.guest_count} guests`,
        `Rs.${q.subtotal.toLocaleString('en-IN')}`,
      );
    if (q.discount_amount > 0)
      summaryRow('Discount', `-Rs.${q.discount_amount.toLocaleString('en-IN')}`, false, [34, 120, 34]);
  }
  (q.extra_charges || []).forEach(ec => {
    if (!ec.description && !ec.amount) return;
    summaryRow(ec.description || 'Extra Charge', `Rs.${(ec.amount || 0).toLocaleString('en-IN')}`);
  });
  (q.transportation_charges || []).forEach(tc => {
    if (!tc.description && !tc.amount) return;
    summaryRow(tc.description || 'Transportation', `Rs.${(tc.amount || 0).toLocaleString('en-IN')}`);
  });
  if (q.gst_rate > 0)
    summaryRow(`GST @${q.gst_rate}%`, `Rs.${q.gst_amount.toLocaleString('en-IN')}`);
  summaryRow('Payable Amount', `Rs.${(q.total_amount || 0).toLocaleString('en-IN')}`, true, [26, 35, 126]);
  y += 5;

  if (q.notes) {
    sectionTitle('Notes');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80, 80, 78);
    const noteLines = doc.splitTextToSize(q.notes, CW);
    doc.text(noteLines, M, y);
    y += noteLines.length * 4.5 + 4;
  }

  // ── Terms & Contact ───────────────────────────────────────────────────────────
  // Navy section bar matching the menu/billing headers.
  const sectionBar = (title: string) => {
    if (y > 255) { doc.addPage(); y = 20; }
    setFill(NAVY); doc.rect(M, y, CW, RH, 'F');
    setFill(GOLD); doc.rect(M, y + RH - 0.7, CW, 0.7, 'F'); // gold underline accent
    doc.setFontSize(9.5); doc.setFont('times', 'bold'); doc.setTextColor(255, 255, 255);
    doc.text(title, M + 3.5, y + RH - 2.3);
    y += RH;
  };

  // Bulleted row (wraps long text, sizes the row to fit).
  const bulletRow = (text: string) => {
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(text, CW - 10) as string[];
    const h = Math.max(6, lines.length * 4.2 + 1.8);
    if (y + h > 280) { doc.addPage(); y = 20; }
    doc.setFillColor(250, 249, 246); doc.rect(M, y, CW, h, 'F');
    doc.setDrawColor(210, 208, 205); doc.rect(M, y, CW, h);
    doc.setTextColor(26, 35, 126); doc.text('•', M + 4, y + 4.6);
    doc.setTextColor(60, 60, 58); doc.text(lines, M + 9, y + 4.6);
    y += h;
  };

  // Continue right after the quotation details with a margin; sections break to a
  // new page on their own only when they actually run out of room (handled in the
  // sectionBar / bulletRow helpers below).
  y += 8;

  sectionBar('ADDITIONAL CHARGES (ON DEMAND)');
  [
    'Bone China Crockery — extra charges',
    'P.R.O. Services Girls',
    'V.I.P Boys',
    'Display Themes',
    'Water Bottles',
    'Transportation Charges extra',
  ].forEach(bulletRow);
  y += 5;

  sectionBar('TERMS & CONDITIONS');
  [
    'No deposit or fixed charge shall be payable by the caterer; any such charges at the party plot or hall shall be borne entirely by the Party.',
    'Faraskhana, Decoration, Light Connections and Kitchen Facility shall be arranged and paid for by the Party only.',
  ].forEach(bulletRow);
  y += 5;

  sectionBar('PAYMENT TERMS');
  {
    const gap = 5;
    const boxW = (CW - gap * 2) / 3;
    const boxH = 24;
    if (y + boxH > 280) { doc.addPage(); y = 20; }
    const boxes = [
      { pct: '10%', l1: 'On Booking',  l2: '' },
      { pct: '70%', l1: 'Advance',     l2: 'One Month Before Event' },
      { pct: '20%', l1: 'Balance Due', l2: 'On Event Day' },
    ];
    let bx = M;
    for (const b of boxes) {
      doc.setFillColor(235, 238, 252); doc.setDrawColor(26, 35, 126); doc.setLineWidth(0.4);
      doc.rect(bx, y, boxW, boxH, 'FD'); doc.setLineWidth(0.2);
      doc.setFontSize(17); doc.setFont('helvetica', 'bold'); doc.setTextColor(26, 35, 126);
      doc.text(b.pct, bx + boxW / 2, y + 9.5, { align: 'center' });
      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 28);
      doc.text(b.l1, bx + boxW / 2, y + 15, { align: 'center' });
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(90, 90, 88);
      const l2 = doc.splitTextToSize(b.l2, boxW - 4) as string[];
      doc.text(l2, bx + boxW / 2, y + 19.5, { align: 'center' });
      bx += boxW + gap;
    }
    y += boxH + 5;
  }

  sectionBar('CONTACT DETAIL');
  {
    const contactRow = (label: string, value: string) => {
      if (y + RH > 280) { doc.addPage(); y = 20; }
      doc.setDrawColor(210, 208, 205);
      doc.rect(M, y, 40, RH); doc.rect(M + 40, y, CW - 40, RH);
      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(120, 118, 115);
      doc.text(label, M + 3, y + RH - 2);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 30, 28);
      doc.text(value, M + 43, y + RH - 2);
      y += RH;
    };
    contactRow('Name', 'Mann Sheth');
    contactRow('Phone Number', SHOP.phone);
    contactRow('Email', SHOP.email);
  }

  setDraw(GOLD); doc.setLineWidth(0.4);
  doc.line(W / 2 - 30, 285, W / 2 + 30, 285); doc.setLineWidth(0.2);
  doc.setFontSize(8.5); doc.setFont('times', 'italic'); setText(NAVY);
  doc.text('Thank you for considering Shiv Shakti Catering & Events', W / 2, 290, { align: 'center' });

  const qName = (q.customer?.name || 'Customer').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`${qName}_${q.quotation_number}.pdf`);
};
