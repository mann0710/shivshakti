import React, { useState, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useInvoices, useCreateInvoice, useRecordPayment } from '../hooks/useInvoices';
import { useBookings } from '../hooks/useBookings';
import StatusPill from '../components/StatusPill';

const Billing: React.FC = () => {
  const { data: invoices = [], isLoading } = useInvoices();
  const { data: bookings = [] } = useBookings();
  const createInvoice = useCreateInvoice();
  const recordPayment = useRecordPayment();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [createForm, setCreateForm] = useState({ booking_id: '', advance_paid: '', extra_description: '', extra_amount: '' });
  const [payForm, setPayForm] = useState({ amount: '', payment_mode: 'upi', notes: '' });
  const invoiceRef = useRef<HTMLDivElement>(null);

  const selected = invoices.find(i => i.id === selectedId) || invoices[0];
  const pendingBookings = bookings.filter(b => b.status === 'confirmed' || b.status === 'pending');

  const outstanding = invoices.filter(i => i.balance_due > 0);
  const advanceTotal = invoices.reduce((s, i) => s + (i.advance_paid || 0), 0);
  const thisMonth = invoices.filter(i => {
    const d = parseISO(i.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const handleCreate = async () => {
    if (!createForm.booking_id) { toast.error('Select a booking'); return; }
    const booking = bookings.find(b => b.id === createForm.booking_id);
    if (!booking) return;
    const lineItems = [
      { description: `${booking.menu?.name || 'Catering'} × ${booking.guest_count} guests`, quantity: booking.guest_count, unit_price: booking.menu?.price_per_plate || 0, total: booking.estimated_cost },
    ];
    if (createForm.extra_description && createForm.extra_amount) {
      lineItems.push({ description: createForm.extra_description, quantity: 1, unit_price: parseFloat(createForm.extra_amount), total: parseFloat(createForm.extra_amount) });
    }
    const subtotal = lineItems.reduce((s, l) => s + l.total, 0);
    try {
      const inv = await createInvoice.mutateAsync({
        booking_id: createForm.booking_id,
        subtotal,
        advance_paid: parseFloat(createForm.advance_paid) || 0,
        line_items: lineItems,
        status: 'draft',
        issue_date: format(new Date(), 'yyyy-MM-dd'),
      });
      setSelectedId(inv.id);
      toast.success('Invoice created!');
      setShowCreateForm(false);
    } catch (e: any) { toast.error(e.message); }
  };

  const handlePayment = async () => {
    if (!selected || !payForm.amount) { toast.error('Enter payment amount'); return; }
    try {
      await recordPayment.mutateAsync({ invoiceId: selected.id, amount: parseFloat(payForm.amount), payment_mode: payForm.payment_mode, notes: payForm.notes });
      toast.success('Payment recorded!');
      setShowPaymentForm(false);
      setPayForm({ amount: '', payment_mode: 'upi', notes: '' });
    } catch (e: any) { toast.error(e?.message || 'Failed to record payment'); }
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
    const msg = encodeURIComponent(
      `Dear ${customer?.name},\n\nYour invoice ${selected.invoice_number} for ${booking?.event_type} on ${format(parseISO(booking?.event_date || ''), 'MMM d, yyyy')} is ready.\n\nTotal: ₹${selected.total_amount.toLocaleString()}\nAdvance paid: ₹${selected.advance_paid.toLocaleString()}\nBalance due: ₹${selected.balance_due.toLocaleString()}\n\nThank you!\nSharma Caterers`
    );
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
  };

  return (
    <div>
      <div className="page-topbar">
        <div style={{ fontSize: 16, fontWeight: 600 }}>Billing & Invoices</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={btnPrimary} onClick={() => setShowCreateForm(!showCreateForm)}>+ Create Invoice</button>
        </div>
      </div>
      <div className="page-content">
        {/* Stats */}
        <div className="g3" style={{ marginBottom: 20 }}>
          <div style={statCard}><div style={statLbl}>Outstanding dues</div><div style={{ fontSize: 22, fontWeight: 600 }}>₹{outstanding.reduce((s, i) => s + i.balance_due, 0).toLocaleString()}</div><div style={{ fontSize: 11, color: '#E24B4A', marginTop: 3 }}>{outstanding.length} invoices unpaid</div></div>
          <div style={statCard}><div style={statLbl}>Advance received</div><div style={{ fontSize: 22, fontWeight: 600 }}>₹{advanceTotal.toLocaleString()}</div><div style={{ fontSize: 11, color: '#AAAAAA', marginTop: 3 }}>Across all invoices</div></div>
          <div style={statCard}><div style={statLbl}>Invoices this month</div><div style={{ fontSize: 22, fontWeight: 600 }}>{thisMonth.length}</div><div style={{ fontSize: 11, color: '#AAAAAA', marginTop: 3 }}>{thisMonth.filter(i => i.status === 'paid').length} paid · {thisMonth.filter(i => i.status !== 'paid').length} pending</div></div>
        </div>

        {/* Create Invoice Form */}
        {showCreateForm && (
          <div style={{ ...card, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Create invoice from booking</div>
            <div className="g3" style={{ marginBottom: 12 }}>
              <div>
                <label style={lbl}>Select booking *</label>
                <select style={inp} value={createForm.booking_id} onChange={e => setCreateForm({ ...createForm, booking_id: e.target.value })}>
                  <option value="">-- Select booking --</option>
                  {pendingBookings.map(b => <option key={b.id} value={b.id}>{b.customer?.name} — {b.event_type} ({format(parseISO(b.event_date), 'MMM d')})</option>)}
                </select>
              </div>
              <div><label style={lbl}>Advance paid (₹)</label><input type="number" style={inp} value={createForm.advance_paid} onChange={e => setCreateForm({ ...createForm, advance_paid: e.target.value })} placeholder="0" /></div>
              <div><label style={lbl}>Extra item (optional)</label><input style={inp} value={createForm.extra_description} onChange={e => setCreateForm({ ...createForm, extra_description: e.target.value })} placeholder="e.g. Extra sweet counter" /></div>
              <div><label style={lbl}>Extra amount (₹)</label><input type="number" style={inp} value={createForm.extra_amount} onChange={e => setCreateForm({ ...createForm, extra_amount: e.target.value })} placeholder="0" /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={btnGhost} onClick={() => setShowCreateForm(false)}>Cancel</button>
              <button style={btnPrimary} onClick={handleCreate}>Generate Invoice</button>
            </div>
          </div>
        )}

        <div className="g2-billing">
          {/* Invoice list */}
          <div className="table-wrap" style={{ ...card, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: '0.5px solid #E5E5E0', fontSize: 13, fontWeight: 600 }}>
              All invoices
            </div>
            {isLoading ? <div style={{ padding: 30, textAlign: 'center', color: '#888880' }}>Loading...</div> : (
              invoices.length === 0 ? <div style={{ padding: 30, textAlign: 'center', color: '#888880', fontSize: 13 }}>No invoices yet</div> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr style={{ background: '#FAFAF8' }}>
                    {['Invoice #', 'Customer', 'Amount', 'Status'].map(h => <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500, color: '#888880', fontSize: 12 }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {invoices.map(inv => (
                      <tr key={inv.id} onClick={() => setSelectedId(inv.id)}
                        style={{ borderTop: '0.5px solid #F0F0EC', cursor: 'pointer', background: selectedId === inv.id ? '#FFFBF5' : 'transparent' }}>
                        <td style={{ padding: '9px 12px', fontWeight: 500, color: '#E8750A' }}>{inv.invoice_number}</td>
                        <td style={{ padding: '9px 8px' }}>{inv.booking?.customer?.name}</td>
                        <td style={{ padding: '9px 8px', fontWeight: 500 }}>₹{inv.total_amount.toLocaleString()}</td>
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
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, display: 'flex', justifyContent: 'space-between' }}>
                Invoice preview <span style={{ fontSize: 11, color: '#888880', fontWeight: 400 }}>{selected.invoice_number}</span>
              </div>

              <div ref={invoiceRef} style={{ border: '0.5px solid #E5E5E0', borderRadius: 10, padding: 16, fontSize: 12, background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Sharma Caterers</div>
                    <div style={{ color: '#888880', fontSize: 11 }}>GSTIN: 24ABCDE1234F1Z5</div>
                    <div style={{ color: '#888880', fontSize: 11 }}>Ahmedabad, Gujarat</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600 }}>{selected.invoice_number}</div>
                    <div style={{ color: '#888880', fontSize: 11 }}>Date: {format(parseISO(selected.issue_date), 'MMM d, yyyy')}</div>
                    <div style={{ marginTop: 4 }}><StatusPill status={selected.status} /></div>
                  </div>
                </div>

                <div style={{ background: '#FAFAF8', padding: '8px 12px', borderRadius: 8, marginBottom: 14 }}>
                  <div style={{ fontWeight: 500 }}>Bill to: {selected.booking?.customer?.name}</div>
                  <div style={{ color: '#888880', fontSize: 11, marginTop: 2 }}>
                    {selected.booking?.event_type} · {selected.booking?.event_date ? format(parseISO(selected.booking.event_date), 'MMM d, yyyy') : ''} · {selected.booking?.venue} · {selected.booking?.guest_count} guests
                  </div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12, fontSize: 12 }}>
                  <thead><tr style={{ borderBottom: '0.5px solid #E5E5E0' }}>
                    <th style={{ textAlign: 'left', padding: '4px 0', color: '#888880', fontWeight: 500 }}>Description</th>
                    <th style={{ textAlign: 'right', padding: '4px 0', color: '#888880', fontWeight: 500 }}>Amount</th>
                  </tr></thead>
                  <tbody>
                    {(selected.line_items || []).map((item, i) => (
                      <tr key={i} style={{ borderBottom: '0.5px solid #F0F0EC' }}>
                        <td style={{ padding: '5px 0', color: '#666660' }}>{item.description}</td>
                        <td style={{ padding: '5px 0', textAlign: 'right' }}>₹{item.total.toLocaleString()}</td>
                      </tr>
                    ))}
                    <tr style={{ borderBottom: '0.5px solid #E5E5E0' }}>
                      <td style={{ padding: '5px 0', color: '#666660' }}>GST @{selected.gst_rate}%</td>
                      <td style={{ padding: '5px 0', textAlign: 'right' }}>₹{selected.gst_amount.toLocaleString()}</td>
                    </tr>
                    <tr><td style={{ padding: '7px 0', fontWeight: 600, fontSize: 13 }}>Total</td><td style={{ padding: '7px 0', textAlign: 'right', fontWeight: 600, fontSize: 13 }}>₹{selected.total_amount.toLocaleString()}</td></tr>
                  </tbody>
                </table>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ background: '#EAF3DE', padding: '8px 12px', borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: '#3B6D11' }}>Advance paid</div>
                    <div style={{ fontWeight: 600, color: '#3B6D11', fontSize: 14, marginTop: 2 }}>₹{selected.advance_paid.toLocaleString()}</div>
                  </div>
                  <div style={{ background: selected.balance_due > 0 ? '#FCEBEB' : '#EAF3DE', padding: '8px 12px', borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: selected.balance_due > 0 ? '#A32D2D' : '#3B6D11' }}>Balance due</div>
                    <div style={{ fontWeight: 600, color: selected.balance_due > 0 ? '#A32D2D' : '#3B6D11', fontSize: 14, marginTop: 2 }}>₹{selected.balance_due.toLocaleString()}</div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button style={{ ...btnGhost, flex: 1, fontSize: 12 }} onClick={sendWhatsApp}>📱 WhatsApp</button>
                <button style={{ ...btnPrimary, flex: 1, fontSize: 12 }} onClick={downloadPDF}>⬇ Download PDF</button>
              </div>
              <button style={{ ...btnGhost, width: '100%', marginTop: 8, fontSize: 12 }} onClick={() => setShowPaymentForm(!showPaymentForm)}>
                + Record payment received
              </button>

              {showPaymentForm && (
                <div style={{ marginTop: 12, padding: 12, background: '#FAFAF8', borderRadius: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <div><label style={lbl}>Amount (₹)</label><input type="number" style={inp} value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} placeholder="Enter amount" /></div>
                    <div><label style={lbl}>Payment mode</label>
                      <select style={inp} value={payForm.payment_mode} onChange={e => setPayForm({ ...payForm, payment_mode: e.target.value })}>
                        {['upi', 'cash', 'bank_transfer', 'cheque'].map(m => <option key={m} value={m}>{m.replace('_', ' ').toUpperCase()}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ marginBottom: 8 }}><label style={lbl}>Notes</label><input style={inp} value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })} placeholder="Optional note" /></div>
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
const inp: React.CSSProperties = { width: '100%', padding: '7px 10px', borderRadius: 7, border: '0.5px solid #D0D0CC', fontSize: 13, background: '#FFFFFF', color: '#1A1A18' };

export default Billing;
