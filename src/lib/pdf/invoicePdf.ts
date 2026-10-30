// Invoice PDF (navy + gold theme), moved out of Billing.tsx unchanged.
import jsPDF from 'jspdf';
import { formatDateIST } from '../ist';
import { Payment, Invoice } from '../../types';
import { Quotation, QuotationLineItem } from '../../hooks/useQuotations';
import { amountInWords, taxSplit } from '../gst';
import { SHOP } from '../shop';

// ─── PDF logo (preloaded at module level) ─────────────────────────────────────
const _iPdfLogo = (() => { const i = new Image(); i.src = '/logo.png'; return i; })();

// ─── PDF generator ────────────────────────────────────────────────────────────
// Builds the PDF; generateInvoicePDF saves it, sharing code sends it.
export const buildInvoicePdf = (
  inv: Invoice,
  quotation: Quotation | undefined,
  payments: Payment[],
  gstNumber: string | undefined,
): { doc: jsPDF; fileName: string } => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210; const M = 15; const CW = W - M * 2; // 180mm content width
  const RH = 7;
  let y = 0;

  const hasLogo = _iPdfLogo.complete && _iPdfLogo.naturalWidth > 0;
  const taxed = inv.gst_rate > 0 && inv.gst_amount > 0;
  const customer = inv.booking?.customer;

  // ── Header bar ────────────────────────────────────────────────────────────
  doc.setFillColor(255, 255, 255); doc.rect(0, 0, W, 36, 'F');
  doc.setFillColor(26, 35, 126); doc.rect(0, 35.5, W, 0.5, 'F');
  y = 4;
  if (hasLogo) {
    try { doc.addImage(_iPdfLogo as any, 'PNG', M, y, 40, 29); } catch {}
  }
  doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(26, 35, 126);
  doc.text(taxed ? 'TAX INVOICE' : 'INVOICE', W - M, y + 11, { align: 'right' });
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 78);
  doc.text(inv.invoice_number, W - M, y + 18, { align: 'right' });
  doc.text(`Date: ${formatDateIST(inv.issue_date, 'dd-MM-yyyy')}`, W - M, y + 25, { align: 'right' });
  if (gstNumber) doc.text(`GSTIN: ${gstNumber}${taxed ? `  ·  SAC: ${SHOP.sac}` : ''}`, W - M, y + 32, { align: 'right' });
  y = 43;

  // ── Helpers ──────────────────────────────────────────────────────────────
  const infoRow = (label: string, value: string) => {
    if (y > 272) { doc.addPage(); y = 15; }
    doc.setDrawColor(210, 208, 205);
    doc.rect(M, y, 52, RH); doc.rect(M + 52, y, CW - 52, RH);
    doc.setFontSize(8.5); doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 118, 115); doc.text(label, M + 3, y + RH - 2);
    doc.setTextColor(30, 30, 28); doc.text(value, M + 55, y + RH - 2);
    y += RH;
  };

  // Meal table columns: Day=20, MealType=45, Guests=20, Rate=35, Amount=60
  const MC = [20, 45, 20, 35, 60];
  const drawMealHeader = () => {
    if (y > 272) { doc.addPage(); y = 15; }
    doc.setFillColor(26, 35, 126); doc.rect(M, y, CW, RH, 'F');
    doc.setDrawColor(200, 198, 195); doc.rect(M, y, CW, RH);
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

  // ── Info block ────────────────────────────────────────────────────────────
  const booking = inv.booking;
  infoRow('Invoice No.', inv.invoice_number);
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
  if (booking?.guest_count) infoRow('Guests', String(booking.guest_count));
  if (quotation?.food_type) infoRow('Food Type', quotation.food_type);
  if (customer?.gstin) infoRow('Customer GSTIN', customer.gstin);
  y += 6;

  // ── Event Schedule ────────────────────────────────────────────────────────
  if (inv.is_multi_day && (inv.event_days as any[] || []).length > 0) {
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 28);
    doc.text('EVENT SCHEDULE', M, y); y += 5;
    drawMealHeader();

    for (const day of (inv.event_days as any[])) {
      if (y > 265) { doc.addPage(); y = 15; drawMealHeader(); }
      const dayNetBill = (day.meals as any[]).reduce((s: number, m: any) => {
        const or = m.discount_amount || 0;
        return s + (or > 0 ? or * m.guest_count : (m.subtotal || 0));
      }, 0);

      // Day separator row
      doc.setFillColor(235, 238, 252); doc.rect(M, y, CW, RH, 'F');
      doc.setDrawColor(210, 208, 205); doc.rect(M, y, CW, RH);
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(26, 35, 126);
      doc.text(`Day ${day.day_number}  —  ${formatDateIST(day.date, 'dd-MM-yyyy')}`, M + 3, y + RH - 2);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 78);
      doc.text(`Rs.${dayNetBill.toLocaleString('en-IN')}`, M + CW - 2, y + RH - 2, { align: 'right' });
      y += RH;

      for (const meal of (day.meals as any[])) {
        if (y > 265) { doc.addPage(); y = 15; drawMealHeader(); }
        const offerRate = meal.discount_amount || 0;
        const mealNet = offerRate > 0 ? offerRate * meal.guest_count : (meal.subtotal || 0);
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
        const mealGrpsI: { label: string; items: any[] }[] = [];
        const mealGrpIdxI = new Map<string, number>();
        for (const item of (meal.items as any[])) {
          const sk = item.subcategory_name || '';
          if (!mealGrpIdxI.has(sk)) { mealGrpIdxI.set(sk, mealGrpsI.length); mealGrpsI.push({ label: sk, items: [] }); }
          mealGrpsI[mealGrpIdxI.get(sk)!].items.push(item);
        }
        for (const grp of mealGrpsI) {
          if (grp.label) {
            if (y > 272) { doc.addPage(); y = 15; drawMealHeader(); }
            const hdrH = 6;
            doc.setFillColor(235, 238, 252); doc.rect(M, y, CW, hdrH, 'F');
            doc.setDrawColor(210, 208, 205); doc.rect(M, y, CW, hdrH);
            doc.line(M + MC[0], y, M + MC[0], y + hdrH);
            doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(26, 35, 126);
            doc.text(`  ${grp.label}`, M + MC[0] + 2, y + hdrH - 1.5);
            y += hdrH;
          }
          for (const item of grp.items) {
            if (y > 272) { doc.addPage(); y = 15; drawMealHeader(); }
            const subH = 6;
            doc.setFillColor(250, 249, 246); doc.rect(M, y, CW, subH, 'F');
            doc.setDrawColor(210, 208, 205); doc.rect(M, y, CW, subH);
            doc.line(M + MC[0], y, M + MC[0], y + subH);
            doc.setFontSize(8); doc.setFont('times', 'italic'); doc.setTextColor(80, 80, 78);
            doc.text(`  · ${item.item_name}`, M + MC[0] + 2, y + subH - 1.5);
            y += subH;
            if (item.instruction) {
              if (y > 272) { doc.addPage(); y = 15; drawMealHeader(); }
              const noteH = 5.5;
              doc.setFillColor(252, 250, 244); doc.rect(M, y, CW, noteH, 'F');
              doc.setDrawColor(210, 208, 205); doc.rect(M, y, CW, noteH);
              doc.line(M + MC[0], y, M + MC[0], y + noteH);
              doc.setFontSize(7.5); doc.setFont('times', 'italic'); doc.setTextColor(100, 70, 30);
              doc.text(`  Note: ${item.instruction}`, M + MC[0] + 2, y + noteH - 1.5);
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
    if ((quotation?.items?.length ?? 0) > 0) {
      // Subcategory-grouped menu items from quotation
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 28);
      doc.text('MENU ITEMS', M, y); y += 5;

      const seenGrps: Record<string, { label: string; items: QuotationLineItem[] }> = {};
      const grpOrder: string[] = [];
      for (const qi of quotation!.items) {
        const gk = `${qi.category_name}|||${qi.subcategory_name}`;
        if (!seenGrps[gk]) { seenGrps[gk] = { label: qi.subcategory_name, items: [] }; grpOrder.push(gk); }
        seenGrps[gk].items.push(qi);
      }
      for (const gk of grpOrder) {
        const grp = seenGrps[gk];
        if (y > 268) { doc.addPage(); y = 20; }
        doc.setFillColor(235, 238, 252); doc.rect(M, y, CW, RH, 'F');
        doc.setDrawColor(200, 198, 195); doc.rect(M, y, CW, RH);
        doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(26, 35, 126);
        doc.text(grp.label, M + 3, y + RH - 2);
        y += RH;
        for (const qi of grp.items) {
          if (y > 272) { doc.addPage(); y = 15; }
          const subH = 6;
          doc.setFillColor(250, 249, 246); doc.rect(M, y, CW, subH, 'F');
          doc.setDrawColor(210, 208, 205); doc.rect(M, y, CW, subH);
          doc.setFontSize(8); doc.setFont('times', 'italic'); doc.setTextColor(30, 30, 28);
          doc.text(`  · ${qi.item_name}`, M + 3, y + subH - 1.5);
          y += subH;
          if (qi.instruction) {
            if (y > 272) { doc.addPage(); y = 15; }
            const noteH = 5.5;
            doc.setFillColor(252, 250, 244); doc.rect(M, y, CW, noteH, 'F');
            doc.setDrawColor(210, 208, 205); doc.rect(M, y, CW, noteH);
            doc.setFontSize(7.5); doc.setFont('times', 'italic'); doc.setTextColor(100, 70, 30);
            doc.text(`  Note: ${qi.instruction}`, M + 3, y + noteH - 1.5);
            y += noteH;
          }
        }
      }
      y += 3;
    } else if ((inv.line_items || []).length > 0) {
      // Flat line items table (fallback when no quotation)
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 28);
      doc.text('MENU ITEMS', M, y); y += 5;

      // Header: Description=100, Qty=20, Unit Price=30, Total=30
      doc.setFillColor(26, 35, 126); doc.rect(M, y, CW, RH, 'F');
      doc.setDrawColor(200, 198, 195); doc.rect(M, y, CW, RH);
      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
      doc.text('Description', M + 3, y + RH - 2);
      doc.line(M + 100, y, M + 100, y + RH);
      doc.text('Qty', M + 103, y + RH - 2);
      doc.line(M + 120, y, M + 120, y + RH);
      doc.text('Unit Price', M + 123, y + RH - 2);
      doc.line(M + 155, y, M + 155, y + RH);
      doc.text('Total', M + CW - 2, y + RH - 2, { align: 'right' });
      y += RH;

      (inv.line_items || []).forEach(item => {
        if (y > 268) { doc.addPage(); y = 20; }
        doc.setFillColor(255, 255, 255); doc.rect(M, y, CW, RH, 'F');
        doc.setDrawColor(210, 208, 205); doc.rect(M, y, CW, RH);
        doc.line(M + 100, y, M + 100, y + RH);
        doc.line(M + 120, y, M + 120, y + RH);
        doc.line(M + 155, y, M + 155, y + RH);
        doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 30, 28);
        doc.text(item.description, M + 3, y + RH - 2);
        doc.text(String(item.quantity), M + 103, y + RH - 2);
        doc.text(`Rs.${item.unit_price.toLocaleString('en-IN')}`, M + 123, y + RH - 2);
        doc.text(`Rs.${item.total.toLocaleString('en-IN')}`, M + CW - 2, y + RH - 2, { align: 'right' });
        y += RH;
      });
      y += 3;
    }
    if ((quotation?.per_plate_amount ?? 0) > 0) {
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 78);
      doc.text(`Per Plate: Rs.${quotation!.per_plate_amount.toLocaleString('en-IN')}  ×  ${(booking?.guest_count || quotation!.guest_count)} guests`, M, y);
      y += 5;
    }
    y += 4;
  }

  // Extra charges block
  if ((inv.extra_charges || []).filter(ec => ec.description || ec.amount).length > 0) {
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 28);
    doc.text('EXTRA CHARGES', M, y); y += 5;
    (inv.extra_charges || []).forEach(ec => {
      if (!ec.description && !ec.amount) return;
      if (y > 272) { doc.addPage(); y = 15; }
      doc.setFillColor(255, 255, 255); doc.rect(M, y, CW, RH, 'F');
      doc.setDrawColor(210, 208, 205);
      doc.rect(M, y, 120, RH); doc.rect(M + 120, y, CW - 120, RH);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 78); doc.text(ec.description || 'Extra Charge', M + 3, y + RH - 2);
      doc.setTextColor(30, 30, 28); doc.text(`+Rs.${(ec.amount || 0).toLocaleString('en-IN')}`, M + CW - 2, y + RH - 2, { align: 'right' });
      y += RH;
    });
    y += 3;
  }

  // ── Billing Summary ───────────────────────────────────────────────────────
  doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 28);
  doc.text('BILLING SUMMARY', M, y); y += 5;

  if (inv.is_multi_day && (inv.event_days as any[] || []).length > 0) {
    summaryRow('Original Price', `Rs.${inv.subtotal.toLocaleString('en-IN')}`);
    for (const day of (inv.event_days as any[])) {
      for (const meal of (day.meals as any[] || [])) {
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
    for (const ad of (inv.additional_discounts as any[] || [])) {
      if (!ad.amount) continue;
      summaryRow(`  ${ad.description || 'Discount'}`, `-Rs.${ad.amount.toLocaleString('en-IN')}`, false, [34, 120, 34]);
    }
  } else {
    summaryRow('Subtotal', `Rs.${inv.subtotal.toLocaleString('en-IN')}`);
    if (inv.discount_amount > 0)
      summaryRow('Discount', `-Rs.${inv.discount_amount.toLocaleString('en-IN')}`, false, [34, 120, 34]);
  }
  if ((inv.transportation_charge || 0) > 0)
    summaryRow('Transportation', `Rs.${inv.transportation_charge.toLocaleString('en-IN')}`);
  for (const t of taxSplit(inv.gst_amount, inv.gst_rate, gstNumber, customer?.gstin))
    summaryRow(t.label, `Rs.${t.amount.toLocaleString('en-IN')}`);
  summaryRow('Payable Amount', `Rs.${inv.total_amount.toLocaleString('en-IN')}`, true, [26, 35, 126]);
  doc.setFontSize(8.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(80, 80, 78);
  doc.text(doc.splitTextToSize(amountInWords(inv.total_amount), CW - 4), M + 2, y + 5);
  y += 10;

  summaryRow('Amount Paid', `Rs.${inv.advance_paid.toLocaleString('en-IN')}`, false, [34, 120, 34]);
  const balColor: [number, number, number] = inv.balance_due > 0 ? [163, 45, 45] : [34, 120, 34];
  summaryRow(
    'Balance Due',
    inv.balance_due <= 0 ? 'Fully Paid' : `Rs.${inv.balance_due.toLocaleString('en-IN')}`,
    false, balColor,
  );
  y += 5;

  // ── Payment History ───────────────────────────────────────────────────────
  if (payments.length > 0) {
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(30, 30, 28);
    doc.text('PAYMENT HISTORY', M, y); y += 5;

    // Payment table columns: Date=40, Type=40, Mode=50, Amount=50
    const PC = [40, 40, 50, 50];
    doc.setFillColor(26, 35, 126); doc.rect(M, y, CW, RH, 'F');
    doc.setDrawColor(200, 198, 195); doc.rect(M, y, CW, RH);
    const pHeaders = ['Date', 'Type', 'Mode', 'Amount'];
    let px = M;
    pHeaders.forEach((h, i) => {
      if (i > 0) { doc.setDrawColor(200, 198, 195); doc.line(px, y, px, y + RH); }
      doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
      const right = i === 3;
      doc.text(h, right ? px + PC[i] - 2 : px + 3, y + RH - 2, { align: right ? 'right' : 'left' });
      px += PC[i];
    });
    y += RH;

    payments.forEach(p => {
      if (y > 272) { doc.addPage(); y = 15; }
      doc.setFillColor(255, 255, 255); doc.rect(M, y, CW, RH, 'F');
      doc.setDrawColor(210, 208, 205); doc.rect(M, y, CW, RH);
      let qx = M;
      const pCells = [
        formatDateIST(p.payment_date, 'dd-MM-yyyy'),
        p.payment_type.charAt(0).toUpperCase() + p.payment_type.slice(1),
        p.payment_mode.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        `Rs.${p.amount.toLocaleString('en-IN')}`,
      ];
      pCells.forEach((cell, i) => {
        if (i > 0) { doc.setDrawColor(210, 208, 205); doc.line(qx, y, qx, y + RH); }
        doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 30, 28);
        const right = i === 3;
        doc.text(cell, right ? qx + PC[i] - 2 : qx + 3, y + RH - 2, { align: right ? 'right' : 'left' });
        qx += PC[i];
      });
      y += RH;
    });
  }

  doc.setFontSize(7); doc.setTextColor(180, 180, 178);
  doc.text('Thank you for choosing Shiv Shakti Catering & Events', W / 2, 285, { align: 'center' });
  const invName = (customer?.name || 'Customer').replace(/[^a-zA-Z0-9]/g, '_');
  return { doc, fileName: `${invName}_${inv.invoice_number}.pdf` };
};

export const generateInvoicePDF = (...args: Parameters<typeof buildInvoicePdf>) => {
  const { doc, fileName } = buildInvoicePdf(...args);
  doc.save(fileName);
};
