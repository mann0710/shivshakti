import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import {
  useInvoices, useCreateInvoice, useRecordPayment,
  useUpdatePayment, useDeletePayment, usePaymentHistory,
  useRecalculateTotals, useDeleteInvoice,
} from '../hooks/useInvoices';
import { useBookings } from '../hooks/useBookings';
import { useDataCenter } from '../hooks/useDataCenter';
import { useQuotations } from '../hooks/useQuotations';
import StatusPill from '../components/StatusPill';
import { formatDateIST, todayIST } from '../lib/ist';
import { Payment, LineItem, Invoice } from '../types';
import { Quotation } from '../hooks/useQuotations';

// ─── PDF generator ────────────────────────────────────────────────────────────
const generateInvoicePDF = (
  inv: Invoice,
  quotation: Quotation | undefined,
  payments: Payment[],
  gstNumber: string | undefined,
) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const margin = 18;
  let y = 18;

  const hline = (y1: number, color = '#E5E5E0') => {
    doc.setDrawColor(color); doc.line(margin, y1, W - margin, y1);
  };
  const row = (label: string, value: string, color = '#666660') => {
    doc.setFontSize(9); doc.setTextColor(color);
    doc.text(label, margin, y);
    doc.setTextColor(30, 30, 28);
    doc.text(value, W - margin, y, { align: 'right' });
    y += 5;
  };

  // Header bar
  doc.setFillColor(232, 117, 10);
  doc.rect(0, 0, W, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18); doc.setFont('helvetica', 'bold');
  doc.text('Shiv Shakti', margin, 12);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text('Catering & Events', margin, 19);
  if (gstNumber) doc.text(`GSTIN: ${gstNumber}`, margin, 25);
  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', W - margin, 12, { align: 'right' });
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text(inv.invoice_number, W - margin, 19, { align: 'right' });
  doc.text(`Date: ${formatDateIST(inv.issue_date, 'dd-MM-yyyy')}`, W - margin, 25, { align: 'right' });
  y = 38;

  // Customer info
  const booking = inv.booking;
  const customer = booking?.customer;
  doc.setTextColor(80, 80, 78); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
  doc.setTextColor(150, 150, 148); doc.text('BILL TO', margin, y); y += 4;
  doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 30, 28); doc.setFontSize(12);
  doc.text(customer?.name || '—', margin, y); y += 5;
  doc.setFontSize(9); doc.setTextColor(100, 100, 98);
  if (booking?.event_type) { doc.text(`Event: ${booking.event_type}`, margin, y); y += 4; }
  if (booking?.venue)      { doc.text(`Venue: ${booking.venue}`, margin, y); y += 4; }
  if (booking?.guest_count){ doc.text(`Guests: ${booking.guest_count}`, margin, y); y += 4; }
  if (customer?.phone)     { doc.text(`Phone: ${customer.phone}`, margin, y); y += 4; }
  y += 3; hline(y); y += 7;

  // Multi-day event schedule OR flat menu items
  if (inv.is_multi_day && (inv.event_days as any[] || []).length > 0) {
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(150, 150, 148);
    doc.text('EVENT SCHEDULE', margin, y); y += 6;
    for (const day of (inv.event_days as any[])) {
      if (y > 255) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(232, 117, 10);
      doc.text(`Day ${day.day_number}  —  ${formatDateIST(day.date, 'dd-MM-yyyy')}`, margin, y); y += 5;
      for (const meal of (day.meals as any[])) {
        if (y > 255) { doc.addPage(); y = 20; }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(60, 60, 58);
        const offerRateBill = meal.discount_amount || 0;
        let mealRateLine = `  ${meal.meal_type}${meal.time ? ` (${meal.time})` : ''}  ·  ${meal.guest_count} guests  ·  Rs.${meal.per_plate_amount}/plate`;
        if (offerRateBill > 0) mealRateLine += `  (Offer: Rs.${offerRateBill}/pl)`;
        doc.text(mealRateLine, margin + 2, y); y += 4;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(100, 100, 98);
        for (const item of (meal.items as any[])) {
          if (y > 255) { doc.addPage(); y = 20; }
          doc.text(`    · ${item.item_name}`, margin + 4, y); y += 4;
        }
        doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 58);
        const mealNetBill = offerRateBill > 0 ? offerRateBill * meal.guest_count : (meal.subtotal || 0);
        doc.text(`  ${meal.meal_type} subtotal:`, margin + 2, y);
        doc.text(`Rs.${mealNetBill.toLocaleString('en-IN')}`, W - margin, y, { align: 'right' });
        y += 5;
      }
      const dayNetBill = (day.meals as any[]).reduce((s: number, m: any) => {
        const or = m.discount_amount || 0;
        return s + (or > 0 ? or * m.guest_count : (m.subtotal || 0));
      }, 0);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(30, 30, 28);
      doc.text(`  Day ${day.day_number} Subtotal`, margin, y);
      doc.text(`Rs.${dayNetBill.toLocaleString('en-IN')}`, W - margin, y, { align: 'right' });
      y += 5;
      doc.setDrawColor(220, 220, 218); doc.line(margin, y, W - margin, y); y += 5;
    }
  } else {
    if ((inv.line_items || []).length > 0) {
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(150, 150, 148);
      doc.text('MENU ITEMS', margin, y); y += 5;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60, 60, 58);
      (inv.line_items || []).forEach(item => {
        if (y > 240) { doc.addPage(); y = 20; }
        doc.text(`· ${item.description}`, margin + 2, y); y += 4.5;
      });
      y += 2;
    }
    if ((quotation?.per_plate_amount ?? 0) > 0) {
      doc.setFontSize(9); doc.setTextColor(100, 100, 98);
      row('Per Plate Rate', `Rs.${(quotation!.per_plate_amount).toLocaleString('en-IN')}`);
      row('Number of Guests', String(booking?.guest_count || quotation!.guest_count));
    }
  }

  y += 2; hline(y); y += 6;

  // Extra charges
  if ((inv.extra_charges || []).length > 0) {
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(150, 150, 148);
    doc.text('EXTRA CHARGES', margin, y); y += 5;
    doc.setFont('helvetica', 'normal');
    (inv.extra_charges || []).forEach(ec => {
      row(ec.description || 'Extra Charge', `+Rs.${(ec.amount || 0).toLocaleString('en-IN')}`);
    });
    y += 2;
  }

  // Totals
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  row('Subtotal', `Rs.${inv.subtotal.toLocaleString('en-IN')}`);
  if (inv.gst_rate > 0)
    row(`GST @${inv.gst_rate}%`, `+Rs.${inv.gst_amount.toLocaleString('en-IN')}`);
  if ((inv.transportation_charge || 0) > 0)
    row('Transportation', `+Rs.${inv.transportation_charge.toLocaleString('en-IN')}`);
  if (inv.discount_amount > 0)
    row('Discount', `-Rs.${inv.discount_amount.toLocaleString('en-IN')}`, '#3B6D11');

  y += 2; hline(y, '#E8750A'); y += 7;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(30, 30, 28);
  doc.text('Total', margin, y);
  doc.setTextColor(232, 117, 10);
  doc.text(`Rs.${inv.total_amount.toLocaleString('en-IN')}`, W - margin, y, { align: 'right' });
  y += 8;

  // Payment summary
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  hline(y); y += 5;
  row('Amount Paid', `Rs.${inv.advance_paid.toLocaleString('en-IN')}`, '#3B6D11');
  const balColor = inv.balance_due > 0 ? '#A32D2D' : '#3B6D11';
  row('Balance Due', inv.balance_due <= 0 ? 'Fully Paid' : `Rs.${inv.balance_due.toLocaleString('en-IN')}`, balColor);

  // Payment history
  if (payments.length > 0) {
    y += 3; hline(y); y += 6;
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(150, 150, 148);
    doc.text('PAYMENT HISTORY', margin, y); y += 5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    payments.forEach(p => {
      if (y > 275) { doc.addPage(); y = 20; }
      doc.setTextColor(60, 60, 58);
      doc.text(`· Rs.${p.amount.toLocaleString('en-IN')} · ${p.payment_type} · ${p.payment_mode.replace('_', ' ')}`, margin + 2, y);
      doc.setTextColor(150, 150, 148);
      doc.text(formatDateIST(p.payment_date, 'dd-MM-yyyy'), W - margin, y, { align: 'right' });
      y += 5;
    });
  }

  doc.setFontSize(7); doc.setTextColor(180, 180, 178);
  doc.text('Thank you for choosing Shiv Shakti Catering & Events', W / 2, 285, { align: 'center' });
  doc.save(`${inv.invoice_number}.pdf`);
};

// ─── Component ────────────────────────────────────────────────────────────────
const Billing: React.FC = () => {
  const { data: invoices = [], isLoading } = useInvoices();
  const { data: bookings = [] } = useBookings();
  const { data: dc } = useDataCenter();
  const createInvoice = useCreateInvoice();
  const recordPayment = useRecordPayment();
  const updatePayment = useUpdatePayment();
  const deletePayment = useDeletePayment();
  const recalcTotals = useRecalculateTotals();
  const deleteInvoice = useDeleteInvoice();
  const { data: quotations = [] } = useQuotations();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showGST, setShowGST] = useState(true);

  const [createBookingId, setCreateBookingId] = useState('');
  const [createAdvance, setCreateAdvance] = useState('');

  const [discountForm, setDiscountForm] = useState({ type: 'amount' as 'amount' | 'percentage', value: '' });
  const [transportItems, setTransportItems] = useState<{ description: string; amount: number }[]>([]);

  const [payForm, setPayForm] = useState({
    amount: '', payment_type: 'advance' as 'advance' | 'partial',
    payment_mode: 'upi', notes: '', payment_date: todayIST(),
  });
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editPayForm, setEditPayForm] = useState({
    amount: '', payment_type: 'advance' as 'advance' | 'partial',
    payment_mode: 'upi', notes: '', payment_date: todayIST(),
  });

  const selected = invoices.find(i => i.id === selectedId) || invoices[0];
  const confirmedBookings = bookings.filter(b => b.status === 'confirmed');
  const selectedCreateBooking = bookings.find(b => b.id === createBookingId);
  const quotationForBooking = useMemo(
    () => quotations.find(q => q.booking_id === createBookingId),
    [quotations, createBookingId]
  );
  const selectedInvoiceQuotation = useMemo(
    () => quotations.find(q => q.id === selected?.quotation_id),
    [quotations, selected?.quotation_id]
  );

  const outstanding = invoices.filter(i => i.balance_due > 0);
  const advanceTotal = invoices.reduce((s, i) => s + (i.advance_paid || 0), 0);
  const thisMonth = invoices.filter(i => {
    const d = new Date(i.created_at); const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const { data: paymentHistory = [] } = usePaymentHistory(selected?.id);

  useEffect(() => {
    if (!selected) return;
    setShowGST(selected.gst_rate > 0);
    setDiscountForm({
      type: (selected.discount_type as 'amount' | 'percentage') || 'amount',
      value: selected.discount_amount > 0
        ? String(selected.discount_type === 'percentage'
            ? Math.round((selected.discount_amount / selected.subtotal) * 100)
            : selected.discount_amount)
        : '',
    });
    setTransportItems(
      selected.transportation_charges?.length
        ? selected.transportation_charges
        : selected.transportation_charge > 0
          ? [{ description: 'Transportation', amount: selected.transportation_charge }]
          : []
    );
  }, [selected?.id]); // eslint-disable-line

  const handleCreate = async () => {
    if (!createBookingId) { toast.error('Select a booking'); return; }
    const booking = bookings.find(b => b.id === createBookingId);
    if (!booking) return;

    let subtotal: number;
    let lineItems: LineItem[];
    let gst_rate = 0, gst_amount = 0, discount_amount = 0;
    let discount_type: 'amount' | 'percentage' = 'amount';
    let quotation_id: string | undefined;
    let extra_charges: { description: string; amount: number }[] = [];
    let transportation_charges: { description: string; amount: number }[] = [];

    if (quotationForBooking) {
      subtotal = quotationForBooking.subtotal;
      gst_rate = quotationForBooking.gst_rate;
      gst_amount = quotationForBooking.gst_amount;
      discount_amount = quotationForBooking.discount_amount;
      discount_type = quotationForBooking.discount_type;
      quotation_id = quotationForBooking.id;
      extra_charges = quotationForBooking.extra_charges || [];
      transportation_charges = quotationForBooking.transportation_charges || [];
      if (quotationForBooking.is_multi_day && quotationForBooking.event_days?.length) {
        lineItems = [];
        for (const day of quotationForBooking.event_days) {
          for (const meal of day.meals) {
            for (const item of meal.items) {
              lineItems.push({
                description: `Day ${day.day_number} · ${meal.meal_type} · ${item.item_name}`,
                quantity: meal.guest_count,
                unit_price: item.amount,
                total: item.amount,
              });
            }
          }
        }
      } else {
        lineItems = quotationForBooking.items.map(item => ({
          description: `${item.category_name} › ${item.subcategory_name} › ${item.item_name}`,
          quantity: 1, unit_price: item.amount, total: item.amount,
        }));
      }
    } else {
      subtotal = booking.estimated_cost;
      lineItems = [{
        description: `${booking.menu?.name || 'Catering'} × ${booking.guest_count} guests`,
        quantity: booking.guest_count,
        unit_price: booking.menu?.price_per_plate || 0,
        total: booking.estimated_cost,
      }];
    }

    try {
      const inv = await createInvoice.mutateAsync({
        booking_id: createBookingId, quotation_id, subtotal,
        discount_amount, discount_type, gst_rate, gst_amount, extra_charges, transportation_charges,
        advance_paid: parseFloat(createAdvance) || 0,
        line_items: lineItems, status: 'draft', issue_date: todayIST(),
        is_multi_day: quotationForBooking?.is_multi_day,
        event_days: quotationForBooking?.event_days,
      });
      setSelectedId(inv.id);
      toast.success('Invoice created as Draft!');
      setShowCreateForm(false); setCreateBookingId(''); setCreateAdvance('');
    } catch (e: any) { toast.error(e.message || 'Failed to create invoice'); }
  };

  const handlePayment = async () => {
    if (!selected || !payForm.amount) { toast.error('Enter payment amount'); return; }
    const amount = parseFloat(payForm.amount);
    if (amount > selected.balance_due) {
      toast.error(`Amount cannot exceed balance due ₹${selected.balance_due.toLocaleString()}`); return;
    }
    try {
      await recordPayment.mutateAsync({
        invoiceId: selected.id, amount,
        payment_type: payForm.payment_type, payment_mode: payForm.payment_mode,
        notes: payForm.notes, payment_date: payForm.payment_date || todayIST(),
      });
      toast.success('Payment recorded!');
      setShowPaymentForm(false);
      setPayForm({ amount: '', payment_type: 'advance', payment_mode: 'upi', notes: '', payment_date: todayIST() });
    } catch (e: any) { toast.error(e?.message || 'Failed to record payment'); }
  };

  const handleEditPayment = (p: Payment) => {
    setEditingPaymentId(p.id);
    setEditPayForm({ amount: String(p.amount), payment_type: p.payment_type, payment_mode: p.payment_mode, notes: p.notes || '', payment_date: p.payment_date });
  };

  const handleSaveEditPayment = async (p: Payment) => {
    if (!editPayForm.amount) { toast.error('Enter amount'); return; }
    try {
      await updatePayment.mutateAsync({
        id: p.id, invoiceId: p.invoice_id,
        amount: parseFloat(editPayForm.amount),
        payment_type: editPayForm.payment_type,
        payment_mode: editPayForm.payment_mode as Payment['payment_mode'],
        notes: editPayForm.notes, payment_date: editPayForm.payment_date,
      });
      toast.success('Payment updated!'); setEditingPaymentId(null);
    } catch (e: any) { toast.error(e?.message || 'Failed to update'); }
  };

  const handleDeletePayment = async (p: Payment) => {
    try {
      await deletePayment.mutateAsync({ id: p.id, invoiceId: p.invoice_id });
      toast.success('Payment deleted');
    } catch (e: any) { toast.error(e?.message || 'Failed to delete'); }
  };

  const handleGSTToggle = async (checked: boolean) => {
    if (!selected) return;
    setShowGST(checked);
    try {
      await recalcTotals.mutateAsync({
        invoiceId: selected.id,
        discount_amount: parseFloat(discountForm.value) || 0,
        discount_type: discountForm.type,
        apply_gst: checked, gst_rate: dc?.gst_rate ?? 18,
        transportation_charges: transportItems,
      });
      toast.success(checked ? `GST @${dc?.gst_rate ?? 18}% added` : 'GST removed');
    } catch (e: any) { toast.error(e?.message || 'Failed to update GST'); }
  };

  const handleApplyDiscount = async () => {
    if (!selected) return;
    try {
      await recalcTotals.mutateAsync({
        invoiceId: selected.id,
        discount_amount: parseFloat(discountForm.value) || 0,
        discount_type: discountForm.type,
        apply_gst: showGST, gst_rate: dc?.gst_rate ?? 18,
        transportation_charges: transportItems,
      });
      toast.success('Discount applied!');
    } catch (e: any) { toast.error(e?.message || 'Failed to apply discount'); }
  };

  const handleApplyTransportation = async () => {
    if (!selected) return;
    try {
      await recalcTotals.mutateAsync({
        invoiceId: selected.id,
        discount_amount: parseFloat(discountForm.value) || 0,
        discount_type: discountForm.type,
        apply_gst: showGST, gst_rate: dc?.gst_rate ?? 18,
        transportation_charges: transportItems,
      });
      toast.success('Transportation charge applied!');
    } catch (e: any) { toast.error(e?.message || 'Failed to apply transport'); }
  };

  const handleDeleteInvoice = async (inv: Invoice, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Delete invoice ${inv.invoice_number}?`)) return;
    try {
      await deleteInvoice.mutateAsync(inv.id);
      if (selectedId === inv.id) setSelectedId(null);
      toast.success('Invoice deleted');
    } catch (err: any) { toast.error(err?.message || 'Failed to delete invoice'); }
  };

  const downloadPDF = () => {
    if (!selected) return;
    toast.loading('Generating PDF...');
    generateInvoicePDF(selected, selectedInvoiceQuotation, paymentHistory, dc?.gst_number);
    toast.dismiss();
    toast.success('PDF downloaded!');
  };

  const sendWhatsApp = () => {
    if (!selected) return;
    const booking = selected.booking;
    const customer = booking?.customer;
    const phone = customer?.phone?.replace(/\D/g, '') || '';
    const itemLines = (selected.line_items || []).map(i => `  · ${i.description}`).join('\n') || '  · Catering service';
    const extraLines = (selected.extra_charges || []).filter(e => e.amount > 0)
      .map(e => `${e.description}: +₹${e.amount.toLocaleString()}`).join('\n');
    const discountLine = selected.discount_amount > 0 ? `Discount: -₹${selected.discount_amount.toLocaleString()}\n` : '';
    const gstLine = selected.gst_rate > 0 ? `GST @${selected.gst_rate}%: ₹${selected.gst_amount.toLocaleString()}\n` : '';
    const transportLine = (selected.transportation_charge || 0) > 0 ? `Transportation: +₹${selected.transportation_charge.toLocaleString()}\n` : '';
    const payHistLines = paymentHistory.length
      ? paymentHistory.map(p => `  · ₹${p.amount.toLocaleString()} (${p.payment_type}, ${p.payment_mode}) on ${formatDateIST(p.payment_date, 'dd-MM-yyyy')}`).join('\n')
      : '  None yet';
    const msg = encodeURIComponent(
      `Dear ${customer?.name},\n\nYour invoice *${selected.invoice_number}* is ready.\n\n` +
      `*Event:* ${booking?.event_type} · ${formatDateIST(booking?.event_date, 'dd-MM-yyyy')}\n` +
      `*Venue:* ${booking?.venue || '—'} · *Guests:* ${booking?.guest_count}\n\n` +
      `*Menu Items:*\n${itemLines}\n\n` +
      (extraLines ? `*Extra Charges:*\n${extraLines}\n\n` : '') +
      `*Invoice Summary*\nSubtotal: ₹${selected.subtotal.toLocaleString()}\n${gstLine}${transportLine}${discountLine}*Total: ₹${selected.total_amount.toLocaleString()}*\n\n` +
      `*Payments:*\n${payHistLines}\n\nPaid: ₹${selected.advance_paid.toLocaleString()} | Balance: ₹${selected.balance_due.toLocaleString()}\n\nThank you!\nShiv Shakti Caterers`
    );
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
  };

  return (
    <div>
      <div className="page-topbar">
        <div style={{ fontSize: 16, fontWeight: 600 }}>Billing & Invoices</div>
        <button style={btnPrimary} onClick={() => { setShowCreateForm(!showCreateForm); setCreateBookingId(''); setCreateAdvance(''); }}>
          + Create Invoice
        </button>
      </div>
      <div className="page-content">

        {/* Stats */}
        <div className="g3" style={{ marginBottom: 20 }}>
          <div style={statCard}>
            <div style={statLbl}>Outstanding dues</div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>₹{outstanding.reduce((s, i) => s + i.balance_due, 0).toLocaleString()}</div>
            <div style={{ fontSize: 11, color: '#E24B4A', marginTop: 3 }}>{outstanding.length} invoices unpaid</div>
          </div>
          <div style={statCard}>
            <div style={statLbl}>Total collected</div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>₹{advanceTotal.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: '#AAAAAA', marginTop: 3 }}>Advance + partial payments</div>
          </div>
          <div style={statCard}>
            <div style={statLbl}>Invoices this month</div>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{thisMonth.length}</div>
            <div style={{ fontSize: 11, color: '#AAAAAA', marginTop: 3 }}>{thisMonth.filter(i => i.status === 'paid').length} paid · {thisMonth.filter(i => i.status !== 'paid').length} pending</div>
          </div>
        </div>

        {/* Create Invoice Form */}
        {showCreateForm && (
          <div style={{ ...card, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Create Invoice from Confirmed Booking</div>
            {confirmedBookings.length === 0 && (
              <div style={{ background: '#FFF8EE', border: '0.5px solid #FAC775', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: '#854F0B' }}>
                ⚠️ No confirmed bookings found. Change a booking status to "Confirmed" first.
              </div>
            )}
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Select booking *</label>
              <select style={inp} value={createBookingId} onChange={e => setCreateBookingId(e.target.value)}>
                <option value="">-- Select confirmed booking --</option>
                {confirmedBookings.map(b => (
                  <option key={b.id} value={b.id}>{b.customer?.name} — {b.event_type} on {formatDateIST(b.event_date, 'dd-MM-yyyy')}</option>
                ))}
              </select>
            </div>
            {selectedCreateBooking && (
              <div style={{ background: '#FAFAF8', border: '0.5px solid #E5E5E0', borderRadius: 10, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#E8750A', marginBottom: 10 }}>
                  {selectedCreateBooking.customer?.name} · {selectedCreateBooking.event_type}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, marginBottom: 10 }}>
                  <div><div style={infoLbl}>Customer Address</div><div style={infoVal}>{selectedCreateBooking.customer?.address || '—'}</div></div>
                  <div><div style={infoLbl}>Event Date</div><div style={infoVal}>{formatDateIST(selectedCreateBooking.event_date, 'EEEE, dd-MM-yyyy')}</div></div>
                  <div><div style={infoLbl}>Event Venue</div><div style={infoVal}>{selectedCreateBooking.venue || '—'}</div></div>
                  <div><div style={infoLbl}>Guests · Menu</div><div style={infoVal}>{selectedCreateBooking.guest_count} guests · {selectedCreateBooking.menu?.name || 'No menu'}{selectedCreateBooking.menu && ` (₹${selectedCreateBooking.menu.price_per_plate}/plate)`}</div></div>
                </div>
                <div style={{ background: '#EAF3DE', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#3B6D11' }}>{quotationForBooking ? 'Quotation Total' : 'Estimated Total'}</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#3B6D11' }}>₹{(quotationForBooking?.total_amount ?? selectedCreateBooking.estimated_cost).toLocaleString()}</span>
                  </div>
                  {quotationForBooking && (
                    <div style={{ fontSize: 10, color: '#639922', marginTop: 3 }}>
                      From {quotationForBooking.quotation_number} ·{' '}
                      {quotationForBooking.is_multi_day
                        ? `Multi-day (${quotationForBooking.event_days?.length ?? 0} days)`
                        : `${quotationForBooking.items.length} items`}
                      {quotationForBooking.gst_rate > 0 && ` · GST @${quotationForBooking.gst_rate}% included`}
                    </div>
                  )}
                </div>
                <div>
                  <label style={lbl}>Advance already paid (₹) — optional</label>
                  <input type="number" style={{ ...inp, maxWidth: 200 }} value={createAdvance} onChange={e => setCreateAdvance(e.target.value)} placeholder="0" />
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={btnGhost} onClick={() => setShowCreateForm(false)}>Cancel</button>
              <button style={btnPrimary} onClick={handleCreate} disabled={!createBookingId || createInvoice.isPending}>
                {createInvoice.isPending ? 'Creating...' : 'Generate Invoice'}
              </button>
            </div>
          </div>
        )}

        <div className="g2-billing">
          {/* Invoice list */}
          <div className="table-wrap" style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: '0.5px solid #E5E5E0', fontSize: 13, fontWeight: 600 }}>All invoices</div>
            {isLoading ? <div style={{ padding: 30, textAlign: 'center', color: '#888880' }}>Loading...</div> : (
              invoices.length === 0
                ? <div style={{ padding: 30, textAlign: 'center', color: '#888880', fontSize: 13 }}>No invoices yet</div>
                : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead><tr style={{ background: '#FAFAF8' }}>
                      {['Invoice #', 'Customer', 'Amount', 'Balance', 'Status', ''].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500, color: '#888880', fontSize: 12 }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {invoices.map(inv => (
                        <tr key={inv.id}
                          onClick={() => { setSelectedId(inv.id); setShowPaymentForm(false); setEditingPaymentId(null); }}
                          style={{ borderTop: '0.5px solid #F0F0EC', cursor: 'pointer', background: (selectedId === inv.id || (!selectedId && inv === invoices[0])) ? '#FFFBF5' : 'transparent' }}>
                          <td style={{ padding: '9px 12px', fontWeight: 500, color: '#E8750A' }}>{inv.invoice_number}</td>
                          <td style={{ padding: '9px 8px' }}>{inv.booking?.customer?.name}</td>
                          <td style={{ padding: '9px 8px', fontWeight: 500 }}>₹{inv.total_amount.toLocaleString()}</td>
                          <td style={{ padding: '9px 8px', color: inv.balance_due > 0 ? '#A32D2D' : '#3B6D11', fontWeight: 500 }}>₹{inv.balance_due.toLocaleString()}</td>
                          <td style={{ padding: '9px 12px' }}><StatusPill status={inv.status} /></td>
                          <td style={{ padding: '9px 8px' }} onClick={e => e.stopPropagation()}>
                            <button onClick={e => handleDeleteInvoice(inv, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CC4444', fontSize: 16, padding: '0 4px', lineHeight: 1 }}>×</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
            )}
          </div>

          {/* ── Invoice Preview ─────────────────────────────────── */}
          {selected ? (
            <div style={card}>
              {/* Header row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Invoice Preview</div>
                  <div style={{ fontSize: 11, color: '#888880' }}>{selected.invoice_number} · {formatDateIST(selected.issue_date, 'dd-MM-yyyy')}</div>
                </div>
                <StatusPill status={selected.status} />
              </div>

              {/* GST checkbox */}
              {dc?.gst_number && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#666660', marginBottom: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={showGST} onChange={e => handleGSTToggle(e.target.checked)} style={{ accentColor: '#E8750A' }} />
                  Include GST @{dc.gst_rate ?? 18}% ({dc.gst_number})
                </label>
              )}

              {/* ── Customer info ── */}
              <div style={{ background: '#FAFAF8', border: '0.5px solid #E5E5E0', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 5 }}>{selected.booking?.customer?.name}</div>
                <div style={{ fontSize: 11, color: '#555552', lineHeight: 1.9 }}>
                  <div><span style={{ color: '#AAAAAA', width: 46, display: 'inline-block' }}>Event</span>{selected.booking?.event_type}</div>
                  <div><span style={{ color: '#AAAAAA', width: 46, display: 'inline-block' }}>Venue</span>{selected.booking?.venue || selected.booking?.customer?.address || '—'}</div>
                </div>
              </div>

              {/* ── Event content: multi-day schedule or flat menu items ── */}
              {selected.is_multi_day && (selected.event_days || []).length > 0 ? (
                <div style={{ border: '0.5px solid #E5E5E0', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
                  <div style={{ padding: '7px 12px', background: '#F9F8F5', fontSize: 11, fontWeight: 600, color: '#888880', borderBottom: '0.5px solid #E5E5E0' }}>EVENT SCHEDULE</div>
                  {(selected.event_days as any[]).map((day: any, di: number) => (
                    <div key={di} style={{ borderBottom: di < (selected.event_days?.length ?? 0) - 1 ? '0.5px solid #E5E5E0' : 'none' }}>
                      <div style={{ padding: '8px 12px 4px', fontWeight: 600, fontSize: 12, color: '#E8750A', background: '#FFFBF5' }}>
                        Day {day.day_number} — {day.date}
                      </div>
                      {(day.meals as any[]).map((meal: any, mi: number) => (
                        <div key={mi} style={{ padding: '6px 12px', borderTop: '0.5px solid #F5F5F0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#333' }}>{meal.meal_type}{meal.time ? ` (${meal.time})` : ''}</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#E8750A' }}>₹{(meal.subtotal || 0).toLocaleString()}</span>
                          </div>
                          <div style={{ fontSize: 11, color: '#888880', marginBottom: 4 }}>
                            {meal.guest_count} guests × ₹{meal.per_plate_amount}/plate
                          </div>
                          {(meal.items as any[]).map((item: any, ii: number) => (
                            <div key={ii} style={{ fontSize: 11, color: '#666660', paddingLeft: 8, paddingTop: 1 }}>· {item.item_name}</div>
                          ))}
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', background: '#F9F8F5', borderTop: '0.5px solid #E5E5E0' }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#444' }}>Day {day.day_number} Subtotal</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#1A1A18' }}>₹{(day.day_subtotal || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {/* ── Menu Items ── */}
                  {(selected.line_items || []).length > 0 && (
                    <div style={{ border: '0.5px solid #E5E5E0', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
                      <div style={{ padding: '7px 12px', background: '#F9F8F5', fontSize: 11, fontWeight: 600, color: '#888880', borderBottom: '0.5px solid #E5E5E0' }}>MENU ITEMS</div>
                      <div style={{ padding: '8px 12px' }}>
                        {(selected.line_items || []).map((item, i) => (
                          <div key={i} style={{ fontSize: 12, color: '#333', padding: '3px 0', borderBottom: i < (selected.line_items?.length ?? 0) - 1 ? '0.5px solid #F5F5F0' : 'none' }}>
                            · {item.description}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* ── Per Plate Rate + Guests ── */}
                  {(selectedInvoiceQuotation?.per_plate_amount ?? 0) > 0 && (
                    <div style={{ background: '#F9F8F5', border: '0.5px solid #E5E5E0', borderRadius: 8, padding: '8px 12px', marginBottom: 12, fontSize: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#444' }}>
                        <span style={{ color: '#888880' }}>Per Plate Rate</span>
                        <span style={{ fontWeight: 600 }}>₹{(selectedInvoiceQuotation?.per_plate_amount ?? 0).toLocaleString()}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#444' }}>
                        <span style={{ color: '#888880' }}>Number of Guests</span>
                        <span style={{ fontWeight: 600 }}>{selected.booking?.guest_count}</span>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ── Extra Charges (from quotation) ── */}
              {(selected.extra_charges || []).length > 0 && (
                <div style={{ border: '0.5px solid #E5E5E0', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
                  <div style={{ padding: '7px 12px', background: '#F9F8F5', fontSize: 11, fontWeight: 600, color: '#888880', borderBottom: '0.5px solid #E5E5E0' }}>EXTRA CHARGES</div>
                  <div style={{ padding: '8px 12px' }}>
                    {(selected.extra_charges || []).map((ec, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#444', padding: '3px 0' }}>
                        <span>{ec.description || 'Extra Charge'}</span>
                        <span style={{ fontWeight: 500 }}>+₹{(ec.amount || 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Discount ── */}
              <div style={{ background: '#FAFAF8', border: '0.5px solid #E5E5E0', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: '#444440' }}>Discount</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select style={{ ...inp, width: 148, fontSize: 12 }} value={discountForm.type}
                    onChange={e => setDiscountForm(f => ({ ...f, type: e.target.value as 'amount' | 'percentage' }))}>
                    <option value="amount">Amount (₹)</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                  <input type="number" style={{ ...inp, flex: 1, fontSize: 12 }} placeholder="0"
                    value={discountForm.value} onChange={e => setDiscountForm(f => ({ ...f, value: e.target.value }))} />
                  <button onClick={handleApplyDiscount} style={{ ...btnPrimary, fontSize: 12, whiteSpace: 'nowrap' }} disabled={recalcTotals.isPending}>
                    {recalcTotals.isPending ? '...' : 'Apply'}
                  </button>
                </div>
                {selected.discount_amount > 0 && (
                  <div style={{ fontSize: 11, color: '#3B6D11', marginTop: 6 }}>
                    Applied: -₹{selected.discount_amount.toLocaleString()}
                    {selected.discount_type === 'percentage' && ` (${Math.round((selected.discount_amount / selected.subtotal) * 100)}%)`}
                  </div>
                )}
              </div>

              {/* ── Transportation Charges ── */}
              <div style={{ background: '#FAFAF8', border: '0.5px solid #E5E5E0', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#444440' }}>Transportation Charges</div>
                  <button onClick={() => setTransportItems(prev => [...prev, { description: '', amount: 0 }])}
                    style={{ fontSize: 11, color: '#E8750A', background: 'none', border: '1px solid #E8750A', borderRadius: 5, padding: '2px 8px', cursor: 'pointer' }}>
                    + Add
                  </button>
                </div>
                {transportItems.length === 0 && (
                  <div style={{ fontSize: 11, color: '#AAAAAA', marginBottom: 6 }}>No transportation charges</div>
                )}
                {transportItems.map((tc, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                    <input placeholder="Description"
                      value={tc.description}
                      onChange={e => setTransportItems(prev => prev.map((c, j) => j === i ? { ...c, description: e.target.value } : c))}
                      style={{ ...inp, flex: 1, fontSize: 12 }} />
                    <input type="number" placeholder="₹ 0"
                      value={tc.amount || ''}
                      onChange={e => setTransportItems(prev => prev.map((c, j) => j === i ? { ...c, amount: parseFloat(e.target.value) || 0 } : c))}
                      style={{ ...inp, width: 90, fontSize: 12, textAlign: 'right' as const }} />
                    <button onClick={() => setTransportItems(prev => prev.filter((_, j) => j !== i))}
                      style={{ background: 'none', border: 'none', color: '#CC4444', fontSize: 18, cursor: 'pointer', padding: '0 2px', flexShrink: 0 }}>×</button>
                  </div>
                ))}
                {transportItems.length > 0 && (
                  <button onClick={handleApplyTransportation} style={{ ...btnPrimary, fontSize: 12, width: '100%', marginTop: 4 }} disabled={recalcTotals.isPending}>
                    {recalcTotals.isPending ? '...' : 'Apply Transportation'}
                  </button>
                )}
                {(selected.transportation_charge || 0) > 0 && (
                  <div style={{ fontSize: 11, color: '#666660', marginTop: 6 }}>Applied: +₹{selected.transportation_charge.toLocaleString()}</div>
                )}
              </div>

              {/* ── Totals Section ── */}
              <div style={{ border: '0.5px solid #E5E5E0', borderRadius: 8, padding: '10px 12px', marginBottom: 12, background: '#fff' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#888880', marginBottom: 8 }}>TOTAL SUMMARY</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12, color: '#666660' }}>
                  <span>Subtotal{!selected.is_multi_day && (selectedInvoiceQuotation?.per_plate_amount ?? 0) > 0 ? ` (₹${selectedInvoiceQuotation?.per_plate_amount}/plate × ${selectedInvoiceQuotation?.guest_count})` : ''}</span>
                  <span>₹{selected.subtotal.toLocaleString()}</span>
                </div>
                {(selected.extra_charges || []).map((ec, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12, color: '#666660' }}>
                    <span>{ec.description || 'Extra Charge'}</span><span>+₹{(ec.amount || 0).toLocaleString()}</span>
                  </div>
                ))}
                {showGST && selected.gst_rate > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12, color: '#666660' }}>
                    <span>GST @{selected.gst_rate}%</span><span>+₹{selected.gst_amount.toLocaleString()}</span>
                  </div>
                )}
                {(selected.transportation_charge || 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12, color: '#666660' }}>
                    <span>Transportation</span><span>+₹{selected.transportation_charge.toLocaleString()}</span>
                  </div>
                )}
                {selected.discount_amount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12, color: '#3B6D11' }}>
                    <span>Discount{selected.discount_type === 'percentage' ? ` (${Math.round((selected.discount_amount / selected.subtotal) * 100)}%)` : ''}</span>
                    <span>-₹{selected.discount_amount.toLocaleString()}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0 4px', fontSize: 14, fontWeight: 700, borderTop: '0.5px solid #E5E5E0', marginTop: 6, color: '#1A1A18' }}>
                  <span>Total</span><span style={{ color: '#E8750A' }}>₹{selected.total_amount.toLocaleString()}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
                  <div style={{ background: '#EAF3DE', padding: '8px 12px', borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: '#3B6D11' }}>Amount paid</div>
                    <div style={{ fontWeight: 600, color: '#3B6D11', fontSize: 14, marginTop: 2 }}>₹{selected.advance_paid.toLocaleString()}</div>
                  </div>
                  <div style={{ background: selected.balance_due > 0 ? '#FCEBEB' : '#EAF3DE', padding: '8px 12px', borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: selected.balance_due > 0 ? '#A32D2D' : '#3B6D11' }}>Balance due</div>
                    <div style={{ fontWeight: 600, color: selected.balance_due > 0 ? '#A32D2D' : '#3B6D11', fontSize: 14, marginTop: 2 }}>
                      {selected.balance_due <= 0 ? '✓ Fully paid' : `₹${selected.balance_due.toLocaleString()}`}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Payment History (always visible, with edit/delete) ── */}
              <div style={{ background: '#FAFAF8', border: '0.5px solid #E5E5E0', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#888880', marginBottom: 8 }}>PAYMENT HISTORY</div>
                {paymentHistory.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#BBBBBB' }}>No payments recorded yet</div>
                ) : paymentHistory.map(p => (
                  <div key={p.id} style={{ borderBottom: '0.5px solid #E5E5E0', paddingBottom: 8, marginBottom: 8 }}>
                    {editingPaymentId === p.id ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        <div><label style={lbl}>Type</label>
                          <select style={inp} value={editPayForm.payment_type} onChange={e => setEditPayForm({ ...editPayForm, payment_type: e.target.value as 'advance' | 'partial' })}>
                            <option value="advance">Advance</option><option value="partial">Partial</option>
                          </select></div>
                        <div><label style={lbl}>Amount (₹)</label>
                          <input type="number" style={inp} value={editPayForm.amount} onChange={e => setEditPayForm({ ...editPayForm, amount: e.target.value })} /></div>
                        <div><label style={lbl}>Mode</label>
                          <select style={inp} value={editPayForm.payment_mode} onChange={e => setEditPayForm({ ...editPayForm, payment_mode: e.target.value })}>
                            {['upi', 'cash', 'bank_transfer', 'cheque'].map(m => <option key={m} value={m}>{m.replace('_', ' ').toUpperCase()}</option>)}
                          </select></div>
                        <div><label style={lbl}>Date</label>
                          <input type="date" style={inp} value={editPayForm.payment_date} onChange={e => setEditPayForm({ ...editPayForm, payment_date: e.target.value })} /></div>
                        <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Notes</label>
                          <input style={inp} value={editPayForm.notes} onChange={e => setEditPayForm({ ...editPayForm, notes: e.target.value })} /></div>
                        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button onClick={() => setEditingPaymentId(null)} style={{ ...btnGhost, fontSize: 11, padding: '3px 10px' }}>Cancel</button>
                          <button onClick={() => handleSaveEditPayment(p)} style={{ ...btnPrimary, fontSize: 11, padding: '3px 10px' }}>Save</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span style={{ fontSize: 12, fontWeight: 500 }}>₹{p.amount.toLocaleString()}</span>
                            <span style={{ fontSize: 10, background: p.payment_type === 'advance' ? '#EAF3DE' : '#E6F1FB', color: p.payment_type === 'advance' ? '#3B6D11' : '#185FA5', padding: '1px 7px', borderRadius: 12, fontWeight: 600 }}>
                              {p.payment_type === 'advance' ? 'Advance' : 'Partial'}
                            </span>
                            <span style={{ fontSize: 10, color: '#888880' }}>{p.payment_mode.replace('_', ' ').toUpperCase()}</span>
                          </div>
                          <div style={{ fontSize: 11, color: '#888880', marginTop: 2 }}>{formatDateIST(p.payment_date, 'dd-MM-yyyy')}</div>
                          {p.notes && <div style={{ fontSize: 11, color: '#888880' }}>{p.notes}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginLeft: 8 }}>
                          <button onClick={() => handleEditPayment(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#378ADD', fontSize: 12 }}>✏ Edit</button>
                          <button onClick={() => handleDeletePayment(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A32D2D', fontSize: 16 }}>×</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* ── Action buttons ── */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <button style={{ ...btnGhost, flex: 1, fontSize: 12 }} onClick={sendWhatsApp}>📱 WhatsApp</button>
                <button style={{ ...btnPrimary, flex: 1, fontSize: 12 }} onClick={downloadPDF}>⬇ PDF</button>
              </div>

              {selected.balance_due > 0 && (
                <button style={{ ...btnGhost, width: '100%', fontSize: 12 }} onClick={() => setShowPaymentForm(!showPaymentForm)}>
                  + Record payment received
                </button>
              )}

              {/* Payment form */}
              {showPaymentForm && selected.balance_due > 0 && (
                <div style={{ marginTop: 10, padding: 12, background: '#FAFAF8', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: '#888880', marginBottom: 8 }}>
                    Balance due: <strong style={{ color: '#A32D2D' }}>₹{selected.balance_due.toLocaleString()}</strong>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <div>
                      <label style={lbl}>Payment type</label>
                      <select style={inp} value={payForm.payment_type} onChange={e => setPayForm({ ...payForm, payment_type: e.target.value as 'advance' | 'partial' })}>
                        <option value="advance">Advance payment</option>
                        <option value="partial">Partial payment</option>
                      </select>
                    </div>
                    <div>
                      <label style={lbl}>Amount (₹)</label>
                      <input type="number" style={inp} value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} placeholder={`Max ₹${selected.balance_due}`} />
                    </div>
                    <div>
                      <label style={lbl}>Payment mode</label>
                      <select style={inp} value={payForm.payment_mode} onChange={e => setPayForm({ ...payForm, payment_mode: e.target.value })}>
                        {['upi', 'cash', 'bank_transfer', 'cheque'].map(m => (
                          <option key={m} value={m}>{m.replace('_', ' ').toUpperCase()}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={lbl}>Payment date</label>
                      <input type="date" style={inp} value={payForm.payment_date} onChange={e => setPayForm({ ...payForm, payment_date: e.target.value })} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={lbl}>Notes</label>
                      <input style={inp} value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })} placeholder="Optional note" />
                    </div>
                  </div>
                  <button style={{ ...btnPrimary, width: '100%' }} onClick={handlePayment}>Save Payment</button>
                </div>
              )}

            </div>
          ) : (
            <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888880', fontSize: 13 }}>
              Select an invoice to preview
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const card: React.CSSProperties = { background: '#FFFFFF', border: '0.5px solid #E5E5E0', borderRadius: 12, padding: 16 };
const statCard: React.CSSProperties = { background: '#FFFFFF', border: '0.5px solid #E5E5E0', borderRadius: 12, padding: '14px 16px' };
const statLbl: React.CSSProperties = { fontSize: 11, color: '#888880', marginBottom: 6 };
const btnPrimary: React.CSSProperties = { background: '#E8750A', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 };
const btnGhost: React.CSSProperties = { background: 'transparent', border: '0.5px solid #D0D0CC', padding: '6px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#666660' };
const lbl: React.CSSProperties = { fontSize: 11, color: '#888880', display: 'block', marginBottom: 4 };
const infoLbl: React.CSSProperties = { fontSize: 10, color: '#AAAAAA', marginBottom: 2 };
const infoVal: React.CSSProperties = { fontSize: 12, color: '#333330', fontWeight: 500 };
const inp: React.CSSProperties = { width: '100%', padding: '7px 10px', borderRadius: 7, border: '0.5px solid #D0D0CC', fontSize: 13, background: '#FFFFFF', color: '#1A1A18', boxSizing: 'border-box' };

export default Billing;
