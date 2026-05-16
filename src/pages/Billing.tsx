import React, { useState, useRef, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  useInvoices, useCreateInvoice, useRecordPayment,
  useUpdatePayment, useDeletePayment, usePaymentHistory,
  useRecalculateTotals,
} from '../hooks/useInvoices';
import { useBookings } from '../hooks/useBookings';
import { useDataCenter } from '../hooks/useDataCenter';
import { useQuotations } from '../hooks/useQuotations';
import StatusPill from '../components/StatusPill';
import { formatDateIST, todayIST } from '../lib/ist';
import { Payment, LineItem } from '../types';

const Billing: React.FC = () => {
  const { data: invoices = [], isLoading } = useInvoices();
  const { data: bookings = [] } = useBookings();
  const { data: dc } = useDataCenter();
  const createInvoice = useCreateInvoice();
  const recordPayment = useRecordPayment();
  const updatePayment = useUpdatePayment();
  const deletePayment = useDeletePayment();
  const recalcTotals = useRecalculateTotals();
  const { data: quotations = [] } = useQuotations();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showGST, setShowGST] = useState(true);

  // Create form
  const [createBookingId, setCreateBookingId] = useState('');
  const [createAdvance, setCreateAdvance] = useState('');

  // Discount form — always visible in preview, synced to selected invoice
  const [discountForm, setDiscountForm] = useState({ type: 'amount' as 'amount' | 'percentage', value: '' });
  const [transportCharge, setTransportCharge] = useState('');

  // Payment form
  const [payForm, setPayForm] = useState({
    amount: '', payment_type: 'advance' as 'advance' | 'partial',
    payment_mode: 'upi', notes: '', payment_date: todayIST(),
  });

  // Edit payment state
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editPayForm, setEditPayForm] = useState({
    amount: '', payment_type: 'advance' as 'advance' | 'partial',
    payment_mode: 'upi', notes: '', payment_date: todayIST(),
  });

  const invoiceRef = useRef<HTMLDivElement>(null);

  const selected = invoices.find(i => i.id === selectedId) || invoices[0];
  const confirmedBookings = bookings.filter(b => b.status === 'confirmed');
  const selectedCreateBooking = bookings.find(b => b.id === createBookingId);
  const quotationForBooking = useMemo(
    () => quotations.find(q => q.booking_id === createBookingId),
    [quotations, createBookingId]
  );

  const outstanding = invoices.filter(i => i.balance_due > 0);
  const advanceTotal = invoices.reduce((s, i) => s + (i.advance_paid || 0), 0);
  const thisMonth = invoices.filter(i => {
    const d = new Date(i.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const { data: paymentHistory = [] } = usePaymentHistory(selected?.id);

  // Sync checkbox + discount form + transport when switching invoices
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
    setTransportCharge(selected.transportation_charge > 0 ? String(selected.transportation_charge) : '');
  }, [selected?.id]); // eslint-disable-line

  const handleCreate = async () => {
    if (!createBookingId) { toast.error('Select a booking'); return; }
    const booking = bookings.find(b => b.id === createBookingId);
    if (!booking) return;

    let subtotal: number;
    let lineItems: LineItem[];
    let gst_rate = 0;
    let gst_amount = 0;
    let discount_amount = 0;
    let discount_type: 'amount' | 'percentage' = 'amount';
    let quotation_id: string | undefined;

    if (quotationForBooking) {
      subtotal = quotationForBooking.subtotal;
      gst_rate = quotationForBooking.gst_rate;
      gst_amount = quotationForBooking.gst_amount;
      discount_amount = quotationForBooking.discount_amount;
      discount_type = quotationForBooking.discount_type;
      quotation_id = quotationForBooking.id;
      lineItems = quotationForBooking.items.map(item => ({
        description: `${item.category_name} › ${item.subcategory_name} › ${item.item_name}`,
        quantity: 1,
        unit_price: item.amount,
        total: item.amount,
      }));
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
        booking_id: createBookingId,
        quotation_id,
        subtotal,
        discount_amount,
        discount_type,
        gst_rate,
        gst_amount,
        advance_paid: parseFloat(createAdvance) || 0,
        line_items: lineItems,
        status: 'draft',
        issue_date: todayIST(),
      });
      setSelectedId(inv.id);
      toast.success('Invoice created as Draft!');
      setShowCreateForm(false);
      setCreateBookingId('');
      setCreateAdvance('');
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
        invoiceId: selected.id,
        amount,
        payment_type: payForm.payment_type,
        payment_mode: payForm.payment_mode,
        notes: payForm.notes,
        payment_date: payForm.payment_date || todayIST(),
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
        notes: editPayForm.notes,
        payment_date: editPayForm.payment_date,
      });
      toast.success('Payment updated!');
      setEditingPaymentId(null);
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
        apply_gst: checked,
        gst_rate: dc?.gst_rate ?? 18,
        transportation_charge: parseFloat(transportCharge) || 0,
      });
      toast.success(checked ? `GST @${dc?.gst_rate ?? 18}% added to bill` : 'GST removed from bill');
    } catch (e: any) { toast.error(e?.message || 'Failed to update GST'); }
  };

  const handleApplyDiscount = async () => {
    if (!selected) return;
    try {
      await recalcTotals.mutateAsync({
        invoiceId: selected.id,
        discount_amount: parseFloat(discountForm.value) || 0,
        discount_type: discountForm.type,
        apply_gst: showGST,
        gst_rate: dc?.gst_rate ?? 18,
        transportation_charge: parseFloat(transportCharge) || 0,
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
        apply_gst: showGST,
        gst_rate: dc?.gst_rate ?? 18,
        transportation_charge: parseFloat(transportCharge) || 0,
      });
      toast.success('Transportation charge applied!');
    } catch (e: any) { toast.error(e?.message || 'Failed to apply transportation charge'); }
  };

  const downloadPDF = async () => {
    if (!invoiceRef.current) return;
    toast.loading('Generating PDF...');
    const canvas = await html2canvas(invoiceRef.current, { scale: 2, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${selected?.invoice_number || 'invoice'}.pdf`);
    toast.dismiss();
    toast.success('PDF downloaded!');
  };

  const sendWhatsApp = () => {
    if (!selected) return;
    const booking = selected.booking;
    const customer = booking?.customer;
    const phone = customer?.phone?.replace(/\D/g, '') || '';
    const menuItems = booking?.menu?.items?.length
      ? booking.menu.items.map((item: string) => `  • ${item}`).join('\n')
      : `  • ${booking?.menu?.name || 'Catering service'}`;
    const payHistLines = paymentHistory.length
      ? paymentHistory.map(p =>
          `  • ₹${p.amount.toLocaleString()} — ${p.payment_type === 'advance' ? 'Advance' : 'Partial'} (${p.payment_mode.replace('_', ' ').toUpperCase()}) on ${formatDateIST(p.payment_date, 'dd MMM yyyy')}`
        ).join('\n')
      : '  None yet';
    const discountLine = selected.discount_amount > 0 ? `Discount: -₹${selected.discount_amount.toLocaleString()}\n` : '';
    const gstLine = showGST && dc?.gst_number ? `GST @${selected.gst_rate}%: ₹${selected.gst_amount.toLocaleString()}\n` : '';
    const msg = encodeURIComponent(
      `Dear ${customer?.name},\n\nYour invoice *${selected.invoice_number}* is ready.\n\n` +
      `*Event Details*\nEvent: ${booking?.event_type}\nDate: ${formatDateIST(booking?.event_date, 'MMM d, yyyy')}\nVenue: ${booking?.venue || '—'}\nGuests: ${booking?.guest_count}\n\n` +
      `*Menu: ${booking?.menu?.name || 'Catering'}*\n${menuItems}\n\n` +
      `*Invoice Summary*\nSubtotal: ₹${selected.subtotal.toLocaleString()}\n${discountLine}${gstLine}*Total: ₹${selected.total_amount.toLocaleString()}*\n\n` +
      `*Payment History*\n${payHistLines}\n\nTotal Paid: ₹${selected.advance_paid.toLocaleString()}\nBalance Due: ₹${selected.balance_due.toLocaleString()}\n\nThank you!\nShiv Shakti Caterers`
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

        {/* ── Create Invoice Form ───────────────────────────────── */}
        {showCreateForm && (
          <div style={{ ...card, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Create Invoice from Confirmed Booking</div>

            {confirmedBookings.length === 0 && (
              <div style={{ background: '#FFF8EE', border: '0.5px solid #FAC775', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 12, color: '#854F0B' }}>
                ⚠️ No confirmed bookings found. Change a booking's status to "Confirmed" first.
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Select booking *</label>
              <select style={inp} value={createBookingId} onChange={e => setCreateBookingId(e.target.value)}>
                <option value="">-- Select confirmed booking --</option>
                {confirmedBookings.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.customer?.name} — {b.event_type} on {formatDateIST(b.event_date, 'MMM d, yyyy')}
                  </option>
                ))}
              </select>
            </div>

            {/* Booking summary card */}
            {selectedCreateBooking && (
              <div style={{ background: '#FAFAF8', border: '0.5px solid #E5E5E0', borderRadius: 10, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#E8750A', marginBottom: 10 }}>
                  {selectedCreateBooking.customer?.name} · {selectedCreateBooking.event_type}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, marginBottom: 10 }}>
                  <div>
                    <div style={infoLbl}>Customer Address</div>
                    <div style={infoVal}>{selectedCreateBooking.customer?.address || '—'}</div>
                  </div>
                  <div>
                    <div style={infoLbl}>Event Date</div>
                    <div style={infoVal}>{formatDateIST(selectedCreateBooking.event_date, 'EEEE, MMM d, yyyy')}</div>
                  </div>
                  <div>
                    <div style={infoLbl}>Event Venue</div>
                    <div style={infoVal}>{selectedCreateBooking.venue || '—'}</div>
                  </div>
                  <div>
                    <div style={infoLbl}>Guests · Menu</div>
                    <div style={infoVal}>
                      {selectedCreateBooking.guest_count} guests · {selectedCreateBooking.menu?.name || 'No menu'}
                      {selectedCreateBooking.menu && ` (₹${selectedCreateBooking.menu.price_per_plate}/plate)`}
                    </div>
                  </div>
                </div>

                <div style={{ background: '#EAF3DE', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#3B6D11' }}>
                      {quotationForBooking ? 'Quotation Total' : 'Estimated Total'}
                    </span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#3B6D11' }}>
                      ₹{(quotationForBooking?.total_amount ?? selectedCreateBooking.estimated_cost).toLocaleString()}
                    </span>
                  </div>
                  {quotationForBooking && (
                    <div style={{ fontSize: 10, color: '#639922', marginTop: 3 }}>
                      From {quotationForBooking.quotation_number} · {quotationForBooking.items.length} items
                      {quotationForBooking.gst_rate > 0 && ` · GST @${quotationForBooking.gst_rate}% included`}
                    </div>
                  )}
                </div>

                <div>
                  <label style={lbl}>Advance already paid (₹) — optional</label>
                  <input type="number" style={{ ...inp, maxWidth: 200 }} value={createAdvance}
                    onChange={e => setCreateAdvance(e.target.value)} placeholder="0" />
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
                      {['Invoice #', 'Customer', 'Amount', 'Balance', 'Status'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500, color: '#888880', fontSize: 12 }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {invoices.map(inv => (
                        <tr key={inv.id}
                          onClick={() => { setSelectedId(inv.id); setShowHistory(false); setShowPaymentForm(false); setEditingPaymentId(null); }}
                          style={{ borderTop: '0.5px solid #F0F0EC', cursor: 'pointer', background: (selectedId === inv.id || (!selectedId && inv === invoices[0])) ? '#FFFBF5' : 'transparent' }}>
                          <td style={{ padding: '9px 12px', fontWeight: 500, color: '#E8750A' }}>{inv.invoice_number}</td>
                          <td style={{ padding: '9px 8px' }}>{inv.booking?.customer?.name}</td>
                          <td style={{ padding: '9px 8px', fontWeight: 500 }}>₹{inv.total_amount.toLocaleString()}</td>
                          <td style={{ padding: '9px 8px', color: inv.balance_due > 0 ? '#A32D2D' : '#3B6D11', fontWeight: 500 }}>₹{inv.balance_due.toLocaleString()}</td>
                          <td style={{ padding: '9px 12px' }}><StatusPill status={inv.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
            )}
          </div>

          {/* Invoice preview */}
          {selected ? (
            <div style={card}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Invoice Preview</span>
                <span style={{ fontSize: 11, color: '#888880', fontWeight: 400 }}>{selected.invoice_number}</span>
              </div>

              {/* GST checkbox */}
              {dc?.gst_number && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#666660', marginBottom: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={showGST} onChange={e => handleGSTToggle(e.target.checked)} style={{ accentColor: '#E8750A' }} />
                  Include GST @{dc.gst_rate ?? 18}% in bill ({dc.gst_number})
                </label>
              )}

              {/* ── Invoice document (captured for PDF) ── */}
              <div ref={invoiceRef} style={{ border: '0.5px solid #E5E5E0', borderRadius: 10, padding: 16, fontSize: 12, background: '#fff', marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Shiv Shakti Caterers</div>
                    {showGST && dc?.gst_number && <div style={{ color: '#888880', fontSize: 11 }}>GSTIN: {dc.gst_number}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600 }}>{selected.invoice_number}</div>
                    <div style={{ color: '#888880', fontSize: 11 }}>Date: {formatDateIST(selected.issue_date, 'MMM d, yyyy')}</div>
                    <div style={{ marginTop: 4 }}><StatusPill status={selected.status} /></div>
                  </div>
                </div>

                <div style={{ background: '#FAFAF8', padding: '8px 12px', borderRadius: 8, marginBottom: 14 }}>
                  <div style={{ fontWeight: 500 }}>Bill to: {selected.booking?.customer?.name}</div>
                  <div style={{ color: '#888880', fontSize: 11, marginTop: 2 }}>
                    {selected.booking?.customer?.address && <span>{selected.booking.customer.address} · </span>}
                    {selected.booking?.customer?.phone}
                  </div>
                  <div style={{ color: '#888880', fontSize: 11 }}>
                    {selected.booking?.event_type} · {formatDateIST(selected.booking?.event_date, 'MMM d, yyyy')}
                    {selected.booking?.venue && ` · ${selected.booking.venue}`}
                    {` · ${selected.booking?.guest_count} guests`}
                  </div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 4, fontSize: 12 }}>
                  <thead><tr style={{ borderBottom: '0.5px solid #E5E5E0' }}>
                    <th style={{ textAlign: 'left', padding: '4px 0', color: '#888880', fontWeight: 500 }}>Description</th>
                    <th style={{ textAlign: 'right', padding: '4px 0', color: '#888880', fontWeight: 500 }}>Amount</th>
                  </tr></thead>
                  <tbody>
                    {(selected.line_items || []).map((item, i) => (
                      <tr key={i} style={{ borderBottom: '0.5px solid #F0F0EC' }}>
                        <td style={{ padding: '5px 0', color: '#333' }}>{item.description}</td>
                        <td style={{ padding: '5px 0', textAlign: 'right' }}>₹{item.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {selected.booking?.menu?.items?.length ? (
                  <div style={{ marginBottom: 10, paddingLeft: 8 }}>
                    {(selected.booking.menu.items as string[]).map((item, i) => (
                      <div key={i} style={{ fontSize: 11, color: '#666660', lineHeight: 1.6 }}>· {item}</div>
                    ))}
                  </div>
                ) : null}

                <div style={{ borderTop: '0.5px solid #E5E5E0', paddingTop: 8, marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12, color: '#666660' }}>
                    <span>Subtotal</span><span>₹{selected.subtotal.toLocaleString()}</span>
                  </div>
                  {selected.discount_amount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12, color: '#3B6D11' }}>
                      <span>Discount {selected.discount_type === 'percentage' ? `(${Math.round((selected.discount_amount / selected.subtotal) * 100)}%)` : ''}</span>
                      <span>-₹{selected.discount_amount.toLocaleString()}</span>
                    </div>
                  )}
                  {showGST && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12, color: '#666660' }}>
                      <span>GST @{selected.gst_rate}%</span><span>₹{selected.gst_amount.toLocaleString()}</span>
                    </div>
                  )}
                  {(selected.transportation_charge || 0) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12, color: '#666660' }}>
                      <span>Transportation</span><span>+₹{selected.transportation_charge.toLocaleString()}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13, fontWeight: 600, borderTop: '0.5px solid #E5E5E0', marginTop: 4 }}>
                    <span>Total</span><span>₹{selected.total_amount.toLocaleString()}</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
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

                {paymentHistory.length > 0 && (
                  <div style={{ borderTop: '0.5px solid #E5E5E0', paddingTop: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#888880', marginBottom: 6 }}>Payment History</div>
                    {paymentHistory.map(p => (
                      <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#666660', padding: '2px 0' }}>
                        <span>₹{p.amount.toLocaleString()} · {p.payment_type === 'advance' ? 'Advance' : 'Partial'} · {p.payment_mode.replace('_', ' ').toUpperCase()}</span>
                        <span>{formatDateIST(p.payment_date, 'dd MMM yyyy')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Discount section (always visible, outside PDF) ── */}
              <div style={{ background: '#FAFAF8', border: '0.5px solid #E5E5E0', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: '#444440' }}>Discount</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select style={{ ...inp, width: 148, fontSize: 12 }} value={discountForm.type}
                    onChange={e => setDiscountForm(f => ({ ...f, type: e.target.value as 'amount' | 'percentage' }))}>
                    <option value="amount">Amount (₹)</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                  <input type="number" style={{ ...inp, flex: 1, fontSize: 12 }} placeholder="0"
                    value={discountForm.value}
                    onChange={e => setDiscountForm(f => ({ ...f, value: e.target.value }))} />
                  <button onClick={handleApplyDiscount} style={{ ...btnPrimary, fontSize: 12, whiteSpace: 'nowrap' }}
                    disabled={recalcTotals.isPending}>
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

              {/* Transportation charge section */}
              <div style={{ background: '#FAFAF8', border: '0.5px solid #E5E5E0', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: '#444440' }}>Transportation Charge</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="number" style={{ ...inp, flex: 1, fontSize: 12 }} placeholder="₹ 0"
                    value={transportCharge}
                    onChange={e => setTransportCharge(e.target.value)} />
                  <button onClick={handleApplyTransportation} style={{ ...btnPrimary, fontSize: 12, whiteSpace: 'nowrap' }}
                    disabled={recalcTotals.isPending}>
                    {recalcTotals.isPending ? '...' : 'Apply'}
                  </button>
                </div>
                {(selected.transportation_charge || 0) > 0 && (
                  <div style={{ fontSize: 11, color: '#666660', marginTop: 6 }}>
                    Applied: +₹{selected.transportation_charge.toLocaleString()}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <button style={{ ...btnGhost, flex: 1, fontSize: 12 }} onClick={sendWhatsApp}>📱 WhatsApp</button>
                <button style={{ ...btnGhost, flex: 1, fontSize: 12 }} onClick={() => { setShowHistory(!showHistory); setShowPaymentForm(false); }}>📜 History</button>
                <button style={{ ...btnPrimary, flex: 1, fontSize: 12 }} onClick={downloadPDF}>⬇ PDF</button>
              </div>

              {selected.balance_due > 0 && (
                <button style={{ ...btnGhost, width: '100%', fontSize: 12 }} onClick={() => { setShowPaymentForm(!showPaymentForm); setShowHistory(false); }}>
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

              {/* Payment history panel */}
              {showHistory && (
                <div style={{ marginTop: 10, padding: 12, background: '#FAFAF8', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Payment history</div>
                  {paymentHistory.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#888880' }}>No payments recorded yet</div>
                  ) : paymentHistory.map(p => (
                    <div key={p.id} style={{ borderBottom: '0.5px solid #E5E5E0', paddingBottom: 10, marginBottom: 10 }}>
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
                            <div style={{ fontSize: 11, color: '#888880', marginTop: 2 }}>{formatDateIST(p.payment_date, 'dd MMM yyyy')}</div>
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
