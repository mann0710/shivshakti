import React, { useState, useMemo, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import toast from 'react-hot-toast';
import { useBookings } from '../hooks/useBookings';
import { useMenuItemsFull } from '../hooks/useMenuBuilder';
import { useDataCenter } from '../hooks/useDataCenter';
import {
  useQuotations, useCreateQuotation, useUpdateQuotation,
  useUpdateQuotationStatus, useDeleteQuotation,
  Quotation, QuotationLineItem,
} from '../hooks/useQuotations';

interface SelectedItem extends QuotationLineItem {}

const STATUS_COLORS: Record<string, string> = {
  draft:    '#888880',
  sent:     '#378ADD',
  accepted: '#639922',
  rejected: '#CC4444',
};

// ─── PDF generator ───────────────────────────────────────────────────────────
const downloadPDF = (q: Quotation) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const margin = 18;
  let y = 18;

  const hline = (y1: number, color = '#E5E5E0') => {
    doc.setDrawColor(color);
    doc.line(margin, y1, W - margin, y1);
  };

  doc.setFillColor(232, 117, 10);
  doc.rect(0, 0, W, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18); doc.setFont('helvetica', 'bold');
  doc.text('Shiv Shakti', margin, 12);
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text('Catering & Events', margin, 19);
  doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text('QUOTATION', W - margin, 12, { align: 'right' });
  doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text(q.quotation_number, W - margin, 19, { align: 'right' });
  y = 38;

  doc.setTextColor(80, 80, 78); doc.setFontSize(9);
  doc.text(`Date: ${q.issue_date}`, margin, y);
  doc.text(`Status: ${q.status.charAt(0).toUpperCase() + q.status.slice(1)}`, W - margin, y, { align: 'right' });
  y += 6; hline(y); y += 7;

  const customer = q.customer;
  const booking  = q.booking;
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(150, 150, 148);
  doc.text('CUSTOMER', margin, y); y += 4;
  doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 30, 28); doc.setFontSize(11);
  doc.text(customer?.name || '—', margin, y); y += 5;
  if (customer?.phone) { doc.setFontSize(9); doc.setTextColor(100, 100, 98); doc.text(customer.phone, margin, y); y += 4; }

  if (booking) {
    y += 3; hline(y); y += 6;
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(150, 150, 148);
    doc.text('EVENT DETAILS', margin, y); y += 4;
    doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 30, 28);
    const details: [string, string][] = [
      ['Event', booking.event_type || '—'],
      ['Date',  booking.event_date || '—'],
    ];
    if (booking.event_time) details.push(['Time', booking.event_time]);
    if (booking.venue)      details.push(['Venue', booking.venue]);
    if (q.guest_count > 0)  details.push(['Guests', String(q.guest_count)]);
    details.forEach(([lbl, val]) => {
      doc.setFontSize(9); doc.setTextColor(120, 120, 118);
      doc.text(`${lbl}:`, margin, y);
      doc.setTextColor(30, 30, 28);
      doc.text(val, margin + 22, y);
      y += 5;
    });
  }

  y += 3; hline(y); y += 8;

  // Items table header
  doc.setFillColor(249, 248, 245);
  doc.rect(margin, y - 4, W - margin * 2, 8, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(120, 120, 118);
  doc.text('CATEGORY', margin + 2, y + 1);
  doc.text('SUBCATEGORY', margin + 48, y + 1);
  doc.text('ITEM', margin + 90, y + 1);
  doc.text('AMOUNT', W - margin - 2, y + 1, { align: 'right' });
  y += 9; hline(y); y += 5;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  let lastCat = '';
  (q.items || []).forEach(item => {
    if (y > 240) { doc.addPage(); y = 20; }
    if (item.category_name !== lastCat) {
      doc.setFont('helvetica', 'bold'); doc.setTextColor(232, 117, 10);
      doc.text(item.category_name, margin + 2, y);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 30, 28);
      lastCat = item.category_name; y += 5;
    }
    doc.setTextColor(100, 100, 98); doc.text(item.subcategory_name, margin + 48, y);
    doc.setTextColor(30, 30, 28); doc.text(item.item_name, margin + 90, y);
    doc.text(`Rs.${(item.amount || 0).toLocaleString('en-IN')}`, W - margin - 2, y, { align: 'right' });
    y += 5;
  });

  y += 3; hline(y); y += 6;

  // Per plate + totals
  if (q.per_plate_amount > 0) {
    doc.setFontSize(9); doc.setTextColor(100, 100, 98);
    doc.text('Per Plate Rate:', margin, y);
    doc.setTextColor(30, 30, 28);
    doc.text(`Rs.${q.per_plate_amount.toLocaleString('en-IN')}`, W - margin, y, { align: 'right' });
    y += 5;
    doc.setTextColor(100, 100, 98);
    doc.text(`Subtotal (${q.per_plate_amount} × ${q.guest_count} guests):`, margin, y);
    doc.setTextColor(30, 30, 28);
    doc.text(`Rs.${q.subtotal.toLocaleString('en-IN')}`, W - margin, y, { align: 'right' });
    y += 5;
  }
  if (q.discount_amount > 0) {
    doc.setTextColor(100, 100, 98);
    doc.text(`Discount${q.discount_type === 'percentage' ? ` (${Math.round((q.discount_amount / q.subtotal) * 100)}%)` : ''}:`, margin, y);
    doc.setTextColor(70, 140, 40);
    doc.text(`-Rs.${q.discount_amount.toLocaleString('en-IN')}`, W - margin, y, { align: 'right' });
    y += 5;
  }
  if (q.gst_rate > 0) {
    doc.setTextColor(100, 100, 98);
    doc.text(`GST @${q.gst_rate}%:`, margin, y);
    doc.setTextColor(30, 30, 28);
    doc.text(`Rs.${q.gst_amount.toLocaleString('en-IN')}`, W - margin, y, { align: 'right' });
    y += 5;
  }
  (q.extra_charges || []).forEach(ec => {
    if (!ec.description && !ec.amount) return;
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setTextColor(100, 100, 98);
    doc.text(`${ec.description || 'Extra Charge'}:`, margin, y);
    doc.setTextColor(30, 30, 28);
    doc.text(`Rs.${(ec.amount || 0).toLocaleString('en-IN')}`, W - margin, y, { align: 'right' });
    y += 5;
  });

  y += 2; hline(y, '#E8750A'); y += 7;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(30, 30, 28);
  doc.text('Grand Total', margin, y);
  doc.setTextColor(232, 117, 10);
  doc.text(`Rs.${(q.total_amount || 0).toLocaleString('en-IN')}`, W - margin, y, { align: 'right' });
  y += 8;

  if (q.notes) {
    hline(y); y += 6;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(150, 150, 148);
    doc.text('NOTES', margin, y); y += 4;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80, 80, 78);
    doc.text(doc.splitTextToSize(q.notes, W - margin * 2), margin, y);
  }

  doc.setFontSize(7); doc.setTextColor(180, 180, 178);
  doc.text('Thank you for considering Shiv Shakti Catering & Events', W / 2, 285, { align: 'center' });
  doc.save(`${q.quotation_number}.pdf`);
};

// ─── Component ───────────────────────────────────────────────────────────────
const Quotations: React.FC = () => {
  const { data: bookings = [] }    = useBookings();
  const { data: menuItems = [] }   = useMenuItemsFull();
  const { data: quotations = [] }  = useQuotations();
  const { data: dc }               = useDataCenter();
  const createQuotation  = useCreateQuotation();
  const updateQuotation  = useUpdateQuotation();
  const updateStatus     = useUpdateQuotationStatus();
  const deleteQuotation  = useDeleteQuotation();

  const [showForm, setShowForm]               = useState(false);
  const [editingId, setEditingId]             = useState<string | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [selectedItems, setSelectedItems]     = useState<SelectedItem[]>([]);
  const [notes, setNotes]                     = useState('');
  const [searchLeft, setSearchLeft]           = useState('');
  const [perPlate, setPerPlate]               = useState('');
  const [gstChecked, setGstChecked]           = useState(false);
  const [discountForm, setDiscountForm]       = useState({ type: 'amount' as 'amount' | 'percentage', value: '' });
  const [extraCharges, setExtraCharges]       = useState<{ description: string; amount: number }[]>([]);
  const perPlateAutoRef = useRef(true);

  const dcGstRate = dc?.gst_rate ?? 18;

  const eligibleBookings = bookings.filter(
    b => b.status !== 'completed' && b.status !== 'cancelled',
  );
  const selectedBooking = eligibleBookings.find(b => b.id === selectedBookingId)
    ?? bookings.find(b => b.id === selectedBookingId);

  const guestCount  = selectedBooking?.guest_count || 0;
  const perPlateNum = parseFloat(perPlate) || 0;
  const subtotal    = perPlateNum * guestCount;

  const discountAmt = useMemo(() => {
    const v = parseFloat(discountForm.value) || 0;
    if (discountForm.type === 'percentage') return Math.round((subtotal * v) / 100);
    return Math.min(v, subtotal);
  }, [discountForm, subtotal]);

  const discountedSubtotal = Math.max(0, subtotal - discountAmt);
  const gstAmount  = gstChecked ? Math.round((discountedSubtotal * dcGstRate) / 100) : 0;
  const extraChargesTotal = extraCharges.reduce((s, c) => s + (c.amount || 0), 0);
  const finalTotal = discountedSubtotal + gstAmount + extraChargesTotal;

  const activeItems = menuItems.filter(
    it => it.is_active && it.subcategory?.is_active && it.subcategory?.category?.is_active,
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

  // Auto-fill perPlate from items total when not manually overridden
  useEffect(() => {
    if (perPlateAutoRef.current) {
      setPerPlate(itemsTotal > 0 ? String(itemsTotal) : '');
    }
  }, [itemsTotal]);

  const openCreate = () => {
    setEditingId(null); setSelectedBookingId(''); setSelectedItems([]);
    setNotes(''); setSearchLeft(''); setPerPlate('');
    setGstChecked(false); setDiscountForm({ type: 'amount', value: '' });
    setExtraCharges([]);
    perPlateAutoRef.current = true;
    setShowForm(true);
  };

  const openEdit = (q: Quotation) => {
    setEditingId(q.id);
    setSelectedBookingId(q.booking_id || '');
    setSelectedItems(q.items || []);
    setNotes(q.notes || '');
    setPerPlate(q.per_plate_amount > 0 ? String(q.per_plate_amount) : '');
    setGstChecked(q.gst_rate > 0);
    setDiscountForm({
      type: (q.discount_type as 'amount' | 'percentage') || 'amount',
      value: q.discount_amount > 0 ? String(q.discount_type === 'percentage'
        ? Math.round((q.discount_amount / q.subtotal) * 100) : q.discount_amount) : '',
    });
    setExtraCharges(q.extra_charges || []);
    perPlateAutoRef.current = false;
    setSearchLeft('');
    setShowForm(true);
  };

  const resetForm = () => {
    setEditingId(null); setSelectedBookingId(''); setSelectedItems([]);
    setNotes(''); setSearchLeft(''); setPerPlate('');
    setGstChecked(false); setDiscountForm({ type: 'amount', value: '' });
    setExtraCharges([]);
    perPlateAutoRef.current = true;
    setShowForm(false);
  };

  const addItem = (it: typeof activeItems[0]) =>
    setSelectedItems(prev => [...prev, {
      item_id: it.id, item_name: it.name,
      category_name: it.subcategory?.category?.name || '',
      subcategory_name: it.subcategory?.name || '', amount: 0,
    }]);

  const removeItem = (itemId: string) =>
    setSelectedItems(prev => prev.filter(i => i.item_id !== itemId));

  const updateAmount = (itemId: string, value: string) => {
    const amount = parseFloat(value) || 0;
    setSelectedItems(prev => prev.map(i => i.item_id === itemId ? { ...i, amount } : i));
  };

  const handleSave = async () => {
    if (!selectedBookingId) { toast.error('Please select a booking'); return; }
    if (selectedItems.length === 0) { toast.error('Please add at least one item'); return; }
    const booking = bookings.find(b => b.id === selectedBookingId);
    const payload = {
      customer_id:     booking?.customer_id || '',
      booking_id:      selectedBookingId,
      items:           selectedItems,
      per_plate_amount: perPlateNum,
      guest_count:     guestCount,
      subtotal,
      discount_amount: discountAmt,
      discount_type:   discountForm.type,
      gst_rate:        gstChecked ? dcGstRate : 0,
      gst_amount:      gstAmount,
      extra_charges:   extraCharges.filter(c => c.description.trim() || c.amount > 0),
      total_amount:    finalTotal,
      notes:           notes || undefined,
      status:          'draft' as const,
    };
    try {
      if (editingId) {
        await updateQuotation.mutateAsync({ id: editingId, ...payload });
        toast.success('Quotation updated');
      } else {
        await createQuotation.mutateAsync(payload);
        toast.success('Quotation saved');
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

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Quotations</h2>
          <div style={{ fontSize: 12, color: '#888880', marginTop: 2 }}>{quotations.length} quotation{quotations.length !== 1 ? 's' : ''}</div>
        </div>
        {!showForm && (
          <button onClick={openCreate} style={btnPrimary}>+ New Quotation</button>
        )}
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

            {/* Two-panel item selector */}
            <div className="quotation-panels">
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

            {/* ── Per plate & totals ── */}
            <div style={{ marginTop: 16, background: '#F9F8F5', borderRadius: 10, padding: '14px 16px', border: '0.5px solid #E5E5E0' }}>
              {/* Per plate row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#666', whiteSpace: 'nowrap' }}>Per Plate (₹)</label>
                  <input type="number" min="0" value={perPlate}
                    onChange={e => { perPlateAutoRef.current = false; setPerPlate(e.target.value); }}
                    placeholder="0" style={{ width: 100, border: '1px solid #E5E5E0', borderRadius: 7, padding: '6px 8px', fontSize: 13, textAlign: 'right', background: '#fff' }} />
                </div>
                <span style={{ fontSize: 13, color: '#888880' }}>×</span>
                <div style={{ fontSize: 13, color: '#444' }}>
                  <strong>{guestCount}</strong> <span style={{ color: '#888880' }}>guests</span>
                </div>
                <span style={{ fontSize: 13, color: '#888880' }}>=</span>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1A18' }}>
                  ₹{subtotal.toLocaleString('en-IN')}
                  <span style={{ fontSize: 11, color: '#888880', fontWeight: 400, marginLeft: 4 }}>(Total Estimate)</span>
                </div>
              </div>

              {/* Discount row */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#888880', marginBottom: 6 }}>DISCOUNT</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select value={discountForm.type} onChange={e => setDiscountForm(f => ({ ...f, type: e.target.value as 'amount' | 'percentage' }))}
                    style={{ border: '1px solid #E5E5E0', borderRadius: 7, padding: '6px 8px', fontSize: 12, background: '#fff' }}>
                    <option value="amount">Amount (₹)</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                  <input type="number" min="0" value={discountForm.value} onChange={e => setDiscountForm(f => ({ ...f, value: e.target.value }))}
                    placeholder="0" style={{ width: 100, border: '1px solid #E5E5E0', borderRadius: 7, padding: '6px 8px', fontSize: 13, background: '#fff', textAlign: 'right' }} />
                  {discountAmt > 0 && (
                    <span style={{ fontSize: 12, color: '#3B6D11', fontWeight: 600 }}>-₹{discountAmt.toLocaleString('en-IN')}</span>
                  )}
                </div>
              </div>

              {/* Extra Charges */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#888880' }}>EXTRA CHARGES</span>
                  <button onClick={() => setExtraCharges(prev => [...prev, { description: '', amount: 0 }])}
                    style={{ fontSize: 11, color: '#E8750A', background: 'none', border: '1px solid #E8750A', borderRadius: 5, padding: '2px 8px', cursor: 'pointer' }}>
                    + Add Charge
                  </button>
                </div>
                {extraCharges.length === 0 && (
                  <div style={{ fontSize: 11, color: '#AAAAAA' }}>No extra charges added</div>
                )}
                {extraCharges.map((ec, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                    <input placeholder="Description (e.g. Venue setup, Decoration)"
                      value={ec.description}
                      onChange={e => setExtraCharges(prev => prev.map((c, j) => j === i ? { ...c, description: e.target.value } : c))}
                      style={{ flex: 1, border: '1px solid #E5E5E0', borderRadius: 7, padding: '6px 8px', fontSize: 12, background: '#fff' }} />
                    <input type="number" min="0" placeholder="₹ Amount"
                      value={ec.amount || ''}
                      onChange={e => setExtraCharges(prev => prev.map((c, j) => j === i ? { ...c, amount: parseFloat(e.target.value) || 0 } : c))}
                      style={{ width: 110, border: '1px solid #E5E5E0', borderRadius: 7, padding: '6px 8px', fontSize: 13, background: '#fff', textAlign: 'right' as const }} />
                    <button onClick={() => setExtraCharges(prev => prev.filter((_, j) => j !== i))}
                      style={{ background: 'none', border: 'none', color: '#CC4444', fontSize: 18, cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}>×</button>
                  </div>
                ))}
                {extraChargesTotal > 0 && (
                  <div style={{ fontSize: 12, color: '#444', textAlign: 'right', fontWeight: 600 }}>
                    Extra Charges Total: +₹{extraChargesTotal.toLocaleString('en-IN')}
                  </div>
                )}
              </div>

              {/* GST checkbox */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: 12 }}>
                <input type="checkbox" checked={gstChecked} onChange={e => setGstChecked(e.target.checked)} style={{ accentColor: '#E8750A', width: 15, height: 15 }} />
                <span>Add GST <strong>@{dcGstRate}%</strong></span>
                {gstChecked && gstAmount > 0 && (
                  <span style={{ color: '#666660', fontSize: 12 }}>(+₹{gstAmount.toLocaleString('en-IN')})</span>
                )}
              </label>

              {/* Final totals */}
              <div style={{ borderTop: '0.5px solid #E5E5E0', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: '#666' }}>
                  <div>Per Plate: <strong>₹{perPlateNum.toLocaleString('en-IN')}</strong></div>
                  <div style={{ fontSize: 11, color: '#888880', marginTop: 2 }}>Total Estimate: ₹{subtotal.toLocaleString('en-IN')} (before discount &amp; GST)</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#888880' }}>Grand Total</div>
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

            <div style={{ marginTop: 14, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
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
                  {['Quotation #', 'Customer', 'Event', 'Per Plate', 'Guests', 'Total', 'Status', 'Date', ''].map(h => (
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
                    <td style={{ padding: '10px 12px', fontSize: 13 }}>
                      {q.per_plate_amount > 0 ? `₹${q.per_plate_amount.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 13 }}>{q.guest_count > 0 ? q.guest_count : '—'}</td>
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
                    <td style={{ padding: '10px 12px', fontSize: 12, color: '#888880', whiteSpace: 'nowrap' }}>{q.issue_date}</td>
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
