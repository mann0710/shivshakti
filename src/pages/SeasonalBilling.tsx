import React, { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import {
  useSeasonalOrders, useCreateSeasonalOrder, useUpdateSeasonalOrderPaid, useDeleteSeasonalOrder,
  SeasonalOrder, SeasonalOrderItem,
} from '../hooks/useSeasonalOrders';
import { useSeasonalItems } from '../hooks/useSeasonalItems';
import { useSeasonalOccasions } from '../hooks/useSeasonalOccasions';
import {
  useSeasonalPreorders, useCreateSeasonalPreorder, useUpdateSeasonalPreorderStatus, useDeleteSeasonalPreorder,
  SeasonalPreorder,
} from '../hooks/useSeasonalPreorders';

function weightLabel(weight: number, unit: string) {
  if (unit === 'gm' && weight >= 1000) return `${weight / 1000} kg`;
  return `${weight} ${unit}`;
}

const currentYear = new Date().getFullYear();
const yearOptions  = Array.from({ length: 6 }, (_, i) => currentYear - i);

type Tab = 'new_bill' | 'prebooking' | 'orders' | 'preorders' | 'reports';

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pending:   { bg: '#FFF3E0', color: '#E65100' },
  confirmed: { bg: '#E3F2FD', color: '#1565C0' },
  delivered: { bg: '#EAF3DE', color: '#3B6D11' },
  cancelled: { bg: '#FEECEC', color: '#C0392B' },
};

const emptyBillForm = () => ({
  occasion_id: '', customer_name: '', phone: '',
  discount_amount: '' as string | number,
  discount_type: 'amount' as 'amount' | 'percentage',
  payment_mode: 'cash' as 'cash' | 'upi',
  is_unpaid: false, notes: '',
});

const emptyPreForm = () => ({
  occasion_id: '', customer_name: '', phone: '',
  discount_amount: '' as string | number,
  discount_type: 'amount' as 'amount' | 'percentage',
  advance_paid: '' as string | number,
  payment_mode: 'cash' as 'cash' | 'upi',
  delivery_date: '', notes: '',
});

// ── shared item picker ──────────────────────────────────────────────────────
const useItemPicker = () => {
  const [billItems, setBillItems] = useState<SeasonalOrderItem[]>([]);
  const [selItemId, setSelItemId] = useState('');
  const [selQty, setSelQty]       = useState(1);

  const addItem = (catalogItems: ReturnType<typeof useSeasonalItems>['data']) => {
    if (!selItemId || !catalogItems) return;
    const ci = catalogItems.find(i => i.id === selItemId);
    if (!ci) return;
    const qty = Math.max(1, selQty);
    const idx = billItems.findIndex(i => i.item_id === selItemId);
    if (idx >= 0) {
      setBillItems(prev => prev.map((it, i) =>
        i === idx ? { ...it, qty: it.qty + qty, line_total: (it.qty + qty) * it.price } : it
      ));
    } else {
      setBillItems(prev => [...prev, {
        item_id: ci.id, item_name: ci.name,
        weight: ci.weight, weight_unit: ci.weight_unit,
        price: ci.price, qty, line_total: qty * ci.price,
      }]);
    }
    setSelItemId(''); setSelQty(1);
  };

  const removeItem = (itemId: string) => setBillItems(prev => prev.filter(i => i.item_id !== itemId));

  const updateQty = (itemId: string, qty: number) => {
    if (qty <= 0) { removeItem(itemId); return; }
    setBillItems(prev => prev.map(i => i.item_id === itemId ? { ...i, qty, line_total: qty * i.price } : i));
  };

  const clear = () => { setBillItems([]); setSelItemId(''); setSelQty(1); };

  const subtotal = billItems.reduce((s, i) => s + i.line_total, 0);

  return { billItems, selItemId, setSelItemId, selQty, setSelQty, addItem, removeItem, updateQty, clear, subtotal };
};

const SeasonalBilling: React.FC = () => {
  const [tab, setTab]               = useState<Tab>('new_bill');
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const { data: allItems = [] }     = useSeasonalItems();
  const { data: occasions = [] }    = useSeasonalOccasions(false);
  const { data: orders = [] }       = useSeasonalOrders(selectedYear);
  const { data: preorders = [] }    = useSeasonalPreorders(selectedYear);

  const createOrder    = useCreateSeasonalOrder();
  const updatePaid     = useUpdateSeasonalOrderPaid();
  const deleteOrder    = useDeleteSeasonalOrder();
  const createPreorder = useCreateSeasonalPreorder();
  const updatePreStatus = useUpdateSeasonalPreorderStatus();
  const deletePreorder = useDeleteSeasonalPreorder();

  // ── bill form ────────────────────────────────────────────────────────────
  const [billForm, setBillForm] = useState(emptyBillForm());
  const bill = useItemPicker();

  const billDiscount = useMemo(() => {
    const d = Number(billForm.discount_amount) || 0;
    return billForm.discount_type === 'percentage'
      ? Math.round((bill.subtotal * d) / 100) : d;
  }, [bill.subtotal, billForm.discount_amount, billForm.discount_type]);
  const billTotal = Math.max(0, bill.subtotal - billDiscount);

  // ── pre-booking form ─────────────────────────────────────────────────────
  const [preForm, setPreForm]   = useState(emptyPreForm());
  const pre = useItemPicker();

  const preDiscount = useMemo(() => {
    const d = Number(preForm.discount_amount) || 0;
    return preForm.discount_type === 'percentage'
      ? Math.round((pre.subtotal * d) / 100) : d;
  }, [pre.subtotal, preForm.discount_amount, preForm.discount_type]);
  const preTotal = Math.max(0, pre.subtotal - preDiscount);

  const occMap  = Object.fromEntries(occasions.map(o => [o.id, o.name]));
  const activeOccasions = occasions.filter(o => o.is_active);

  // Filter items by occasion
  const billItems4Occ = billForm.occasion_id
    ? allItems.filter(i => i.is_active && i.occasion_id === billForm.occasion_id)
    : allItems.filter(i => i.is_active);

  const preItems4Occ = preForm.occasion_id
    ? allItems.filter(i => i.is_active && i.occasion_id === preForm.occasion_id)
    : allItems.filter(i => i.is_active);

  // ── report stats ─────────────────────────────────────────────────────────
  const totalSales   = orders.reduce((s, o) => s + o.total_amount, 0);
  const totalPaid    = orders.filter(o => o.is_paid).reduce((s, o) => s + o.total_amount, 0);
  const totalUnpaid  = orders.filter(o => !o.is_paid).reduce((s, o) => s + o.total_amount, 0);
  const unpaidOrders = orders.filter(o => !o.is_paid);

  // ── handlers ─────────────────────────────────────────────────────────────
  const handleCreateBill = async () => {
    if (!billForm.customer_name.trim()) { toast.error('Customer name required'); return; }
    if (bill.billItems.length === 0)    { toast.error('Add at least one item');  return; }
    try {
      await createOrder.mutateAsync({
        occasion_id: billForm.occasion_id || undefined,
        customer_name: billForm.customer_name.trim(),
        phone: billForm.phone.trim(),
        items: bill.billItems,
        subtotal: bill.subtotal,
        discount_amount: billDiscount,
        discount_type: billForm.discount_type,
        total_amount: billTotal,
        is_paid: !billForm.is_unpaid,
        payment_mode: billForm.is_unpaid ? null : billForm.payment_mode,
        year: currentYear,
        notes: billForm.notes.trim() || undefined,
      });
      toast.success('Bill created');
      setBillForm(emptyBillForm()); bill.clear();
      setTab('orders');
    } catch (e: any) { toast.error(e.message || 'Error'); }
  };

  const handleCreatePreorder = async () => {
    if (!preForm.customer_name.trim()) { toast.error('Customer name required'); return; }
    if (pre.billItems.length === 0)    { toast.error('Add at least one item');  return; }
    try {
      await createPreorder.mutateAsync({
        occasion_id: preForm.occasion_id || undefined,
        customer_name: preForm.customer_name.trim(),
        phone: preForm.phone.trim(),
        items: pre.billItems,
        subtotal: pre.subtotal,
        discount_amount: preDiscount,
        discount_type: preForm.discount_type,
        total_amount: preTotal,
        advance_paid: Number(preForm.advance_paid) || 0,
        payment_mode: Number(preForm.advance_paid) > 0 ? preForm.payment_mode : null,
        delivery_date: preForm.delivery_date || undefined,
        status: 'pending',
        year: currentYear,
        notes: preForm.notes.trim() || undefined,
      });
      toast.success('Pre-booking saved');
      setPreForm(emptyPreForm()); pre.clear();
      setTab('preorders');
    } catch (e: any) { toast.error(e.message || 'Error'); }
  };

  const handleWhatsApp = (order: SeasonalOrder | SeasonalPreorder, isPreorder = false) => {
    if (!order.phone) { toast.error('No phone number'); return; }
    const lines = [
      `*Shiv Shakti — ${isPreorder ? 'Pre-Booking' : 'Bill'}*`,
      `Customer: ${order.customer_name}`,
      `Date: ${new Date(order.created_at).toLocaleDateString('en-IN')}`,
      order.occasion_id && occMap[order.occasion_id] ? `Occasion: ${occMap[order.occasion_id]}` : '',
      ``,
      `*Items:*`,
      ...order.items.map(i => `  ${i.item_name} (${weightLabel(i.weight, i.weight_unit)}) x${i.qty} = ₹${i.line_total.toLocaleString()}`),
      ``,
      `Subtotal: ₹${order.subtotal.toLocaleString()}`,
      order.discount_amount > 0 ? `Discount: -₹${order.discount_amount.toLocaleString()}` : '',
      `*Total: ₹${order.total_amount.toLocaleString()}*`,
      isPreorder
        ? `Advance: ₹${(order as SeasonalPreorder).advance_paid.toLocaleString()}`
        : ((order as SeasonalOrder).is_paid ? `Status: ✅ Paid` : `Status: ⏳ Unpaid`),
    ].filter(Boolean);
    const text  = encodeURIComponent(lines.join('\n'));
    const phone = order.phone.replace(/\D/g, '');
    window.open(`https://wa.me/91${phone}?text=${text}`, '_blank');
  };

  const handleMarkPaid = async (order: SeasonalOrder) => {
    const mode = window.prompt('Payment mode: cash or upi?', 'cash') as 'cash' | 'upi' | null;
    if (!mode || !['cash', 'upi'].includes(mode)) return;
    try {
      await updatePaid.mutateAsync({ id: order.id, is_paid: true, payment_mode: mode });
      toast.success('Marked as paid');
    } catch (e: any) { toast.error(e.message); }
  };

  const handleUpdatePreStatus = async (id: string, status: SeasonalPreorder['status']) => {
    try {
      await updatePreStatus.mutateAsync({ id, status });
      toast.success(`Status updated to ${status}`);
    } catch (e: any) { toast.error(e.message); }
  };

  const downloadReportPDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const M = 15; const PW = 210; const CW = PW - M * 2; let y = M;
    doc.setFillColor(26, 35, 126); doc.rect(M, y, CW, 14, 'F');
    doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
    doc.text('SESSIONAL SALES REPORT', M + CW / 2, y + 9, { align: 'center' });
    y += 14;
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 80);
    doc.text(`Year: ${selectedYear}   |   Generated: ${new Date().toLocaleDateString('en-IN')}`, M, y + 6);
    y += 14;

    const boxes = [
      { label: 'Total Sales', value: `Rs ${totalSales.toLocaleString()}` },
      { label: 'Paid',        value: `Rs ${totalPaid.toLocaleString()}` },
      { label: 'Unpaid',      value: `Rs ${totalUnpaid.toLocaleString()}` },
      { label: 'Orders',      value: String(orders.length) },
    ];
    const bw = CW / 4 - 2;
    boxes.forEach((box, i) => {
      const bx = M + i * (bw + 2.67);
      doc.setFillColor(235, 238, 252); doc.rect(bx, y, bw, 16, 'F');
      doc.setDrawColor(200, 205, 240); doc.rect(bx, y, bw, 16);
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(80, 80, 120);
      doc.text(box.label, bx + bw / 2, y + 5, { align: 'center' });
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(26, 35, 126);
      doc.text(box.value, bx + bw / 2, y + 12, { align: 'center' });
    });
    y += 22;

    const cols = ['#', 'Customer', 'Phone', 'Occasion', 'Total', 'Status'];
    const colW  = [8, 40, 28, 40, 22, 18];
    const rowH  = 8;

    doc.setFillColor(26, 35, 126); doc.rect(M, y, CW, rowH, 'F');
    doc.setFontSize(7.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
    let cx = M + 2;
    cols.forEach((col, i) => { doc.text(col, cx, y + 5.5); cx += colW[i]; });
    y += rowH;

    doc.setFont('helvetica', 'normal');
    orders.forEach((order, idx) => {
      if (y > 270) { doc.addPage(); y = M; }
      const bg = idx % 2 === 0 ? [250, 250, 248] : [255, 255, 255] as [number, number, number];
      doc.setFillColor(bg[0], bg[1], bg[2]); doc.rect(M, y, CW, rowH, 'F');
      doc.setDrawColor(230, 230, 228); doc.rect(M, y, CW, rowH);
      doc.setTextColor(50, 50, 50); doc.setFontSize(7);
      cx = M + 2;
      const cells = [
        String(idx + 1), order.customer_name,
        order.phone || '—',
        order.occasion_id ? (occMap[order.occasion_id] || '—') : '—',
        `Rs ${order.total_amount.toLocaleString()}`,
        order.is_paid ? 'Paid' : 'Unpaid',
      ];
      cells.forEach((cell, i) => { doc.text(cell, cx, y + 5.5); cx += colW[i]; });
      y += rowH;
    });

    if (unpaidOrders.length > 0) {
      y += 8; if (y > 260) { doc.addPage(); y = M; }
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(26, 35, 126);
      doc.text('Unpaid Customers', M, y); y += 6;
      unpaidOrders.forEach(order => {
        if (y > 275) { doc.addPage(); y = M; }
        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(180, 30, 30);
        doc.text(`• ${order.customer_name}${order.phone ? ` (${order.phone})` : ''} — Rs ${order.total_amount.toLocaleString()}`, M + 2, y);
        y += 6;
      });
    }

    doc.save(`sessional-report-${selectedYear}.pdf`);
  };

  // ── shared item picker UI ─────────────────────────────────────────────────
  const ItemPickerUI = ({
    picker, availableItems, label,
  }: {
    picker: ReturnType<typeof useItemPicker>;
    availableItems: typeof allItems;
    label?: string;
  }) => (
    <div>
      {label && <div style={cardTitle}>{label}</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginBottom: 14 }}>
        <div style={fieldWrap}>
          <label style={lbl}>Select Item</label>
          <select style={{ ...inp, minWidth: 200 }} value={picker.selItemId}
            onChange={e => picker.setSelItemId(e.target.value)}>
            <option value="">— choose item —</option>
            {availableItems.map(i => (
              <option key={i.id} value={i.id}>
                {i.name} ({weightLabel(i.weight, i.weight_unit)}) — ₹{i.price}
              </option>
            ))}
          </select>
        </div>
        <div style={fieldWrap}>
          <label style={lbl}>Qty</label>
          <input style={{ ...inp, width: 70 }} type="number" min={1}
            value={picker.selQty} onChange={e => picker.setSelQty(Number(e.target.value))} />
        </div>
        <button style={btnSecondary} onClick={() => picker.addItem(availableItems)}>Add</button>
      </div>

      {picker.billItems.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#F5F5F2', borderBottom: '0.5px solid #E5E5E0' }}>
              <th style={th}>Item</th><th style={th}>Weight</th>
              <th style={th}>Price</th><th style={th}>Qty</th>
              <th style={th}>Total</th><th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {picker.billItems.map(item => (
              <tr key={item.item_id} style={{ borderBottom: '0.5px solid #F0F0EC' }}>
                <td style={td}>{item.item_name}</td>
                <td style={td}>{weightLabel(item.weight, item.weight_unit)}</td>
                <td style={td}>₹{item.price.toLocaleString()}</td>
                <td style={td}>
                  <input type="number" min={1} value={item.qty}
                    onChange={e => picker.updateQty(item.item_id, Number(e.target.value))}
                    style={{ width: 60, border: '1px solid #E5E5E0', borderRadius: 5, padding: '3px 6px', fontSize: 12 }} />
                </td>
                <td style={{ ...td, fontWeight: 600 }}>₹{item.line_total.toLocaleString()}</td>
                <td style={td}>
                  <button style={{ ...btnSm, color: '#E24B4A' }} onClick={() => picker.removeItem(item.item_id)}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  // ── discount + total UI ───────────────────────────────────────────────────
  const DiscountTotalUI = ({
    subtotal, discountAmt, total,
    discountAmount, discountType,
    setDiscountAmount, setDiscountType,
  }: {
    subtotal: number; discountAmt: number; total: number;
    discountAmount: string | number; discountType: 'amount' | 'percentage';
    setDiscountAmount: (v: string) => void;
    setDiscountType: (t: 'amount' | 'percentage') => void;
  }) => (
    <div style={{ minWidth: 220 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
        <span style={{ color: '#666' }}>Subtotal</span>
        <span>₹{subtotal.toLocaleString()}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: '#666', minWidth: 70 }}>Discount</span>
        <div style={{ display: 'flex', gap: 0, border: '1px solid #E5E5E0', borderRadius: 6, overflow: 'hidden' }}>
          {(['amount', 'percentage'] as const).map(dt => (
            <button key={dt} onClick={() => setDiscountType(dt)}
              style={{ padding: '4px 10px', fontSize: 11, border: 'none', cursor: 'pointer',
                background: discountType === dt ? '#1A237E' : '#F9F8F5',
                color: discountType === dt ? '#fff' : '#444' }}>
              {dt === 'amount' ? '₹' : '%'}
            </button>
          ))}
        </div>
        <input type="number" min={0} value={discountAmount}
          onChange={e => setDiscountAmount(e.target.value)}
          style={{ width: 80, border: '1px solid #E5E5E0', borderRadius: 5, padding: '4px 8px', fontSize: 12 }} />
        {discountAmt > 0 && <span style={{ fontSize: 12, color: '#3B6D11' }}>-₹{discountAmt.toLocaleString()}</span>}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700,
        borderTop: '0.5px solid #E5E5E0', paddingTop: 8 }}>
        <span>Total</span>
        <span style={{ color: '#1A237E' }}>₹{total.toLocaleString()}</span>
      </div>
    </div>
  );

  return (
    <div>
      <div className="page-topbar">
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Sessional Billing</div>
          <div style={{ fontSize: 11, color: '#888880', marginTop: 2 }}>Festival &amp; seasonal orders</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            style={{ border: '0.5px solid #D0D0CC', borderRadius: 7, padding: '5px 10px', fontSize: 13, background: '#fff' }}
            value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, padding: '0 20px', borderBottom: '0.5px solid #E5E5E0', background: '#FAFAF8', overflowX: 'auto' }}>
        {([
          ['new_bill',   'New Bill'],
          ['prebooking', 'Pre-Booking'],
          ['orders',     'Orders'],
          ['preorders',  'Pre-Orders'],
          ['reports',    'Reports'],
        ] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: tab === t ? 600 : 400, whiteSpace: 'nowrap',
              color: tab === t ? '#1A237E' : '#888880',
              borderBottom: tab === t ? '2px solid #1A237E' : '2px solid transparent',
            }}>{label}</button>
        ))}
      </div>

      <div className="page-content">

        {/* ── NEW BILL ─────────────────────────────────────────────────────── */}
        {tab === 'new_bill' && (
          <div>
            <div style={card}>
              <div style={cardTitle}>Customer Details</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <div style={fieldWrap}>
                  <label style={lbl}>Choose Occasion</label>
                  <select style={inp} value={billForm.occasion_id}
                    onChange={e => setBillForm(f => ({ ...f, occasion_id: e.target.value }))}>
                    <option value="">— Select occasion —</option>
                    {activeOccasions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
                <div style={fieldWrap}>
                  <label style={lbl}>Customer Name *</label>
                  <input style={inp} value={billForm.customer_name}
                    onChange={e => setBillForm(f => ({ ...f, customer_name: e.target.value }))}
                    placeholder="Full name" />
                </div>
                <div style={fieldWrap}>
                  <label style={lbl}>Phone</label>
                  <input style={inp} value={billForm.phone}
                    onChange={e => setBillForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="10-digit mobile" maxLength={10} />
                </div>
              </div>
            </div>

            <div style={card}>
              <ItemPickerUI picker={bill} availableItems={billItems4Occ} label="Add Items" />
            </div>

            <div style={card}>
              <div style={cardTitle}>Totals &amp; Payment</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 28 }}>
                <DiscountTotalUI
                  subtotal={bill.subtotal} discountAmt={billDiscount} total={billTotal}
                  discountAmount={billForm.discount_amount} discountType={billForm.discount_type}
                  setDiscountAmount={v => setBillForm(f => ({ ...f, discount_amount: v }))}
                  setDiscountType={t => setBillForm(f => ({ ...f, discount_type: t }))}
                />
                <div style={{ minWidth: 200 }}>
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ ...lbl, display: 'block', marginBottom: 6 }}>Payment Mode</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {(['cash', 'upi'] as const).map(pm => (
                        <button key={pm} onClick={() => setBillForm(f => ({ ...f, payment_mode: pm }))}
                          style={{ padding: '6px 18px', borderRadius: 7, border: '1px solid',
                            borderColor: billForm.payment_mode === pm ? '#1A237E' : '#E5E5E0',
                            background: billForm.payment_mode === pm ? '#EEF0FB' : '#F9F8F5',
                            color: billForm.payment_mode === pm ? '#1A237E' : '#555',
                            fontWeight: billForm.payment_mode === pm ? 600 : 400,
                            fontSize: 13, cursor: 'pointer', textTransform: 'uppercase' }}>
                          {pm}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={billForm.is_unpaid}
                      onChange={e => setBillForm(f => ({ ...f, is_unpaid: e.target.checked }))}
                      style={{ width: 15, height: 15 }} />
                    Unpaid (collect later)
                  </label>
                </div>
              </div>
              <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                <button style={btnPrimary} onClick={handleCreateBill}>Create Bill</button>
                <button style={btnGhost} onClick={() => { setBillForm(emptyBillForm()); bill.clear(); }}>Clear</button>
              </div>
            </div>
          </div>
        )}

        {/* ── PRE-BOOKING ──────────────────────────────────────────────────── */}
        {tab === 'prebooking' && (
          <div>
            <div style={card}>
              <div style={cardTitle}>Pre-Booking Details</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <div style={fieldWrap}>
                  <label style={lbl}>Choose Occasion</label>
                  <select style={inp} value={preForm.occasion_id}
                    onChange={e => setPreForm(f => ({ ...f, occasion_id: e.target.value }))}>
                    <option value="">— Select occasion —</option>
                    {activeOccasions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
                <div style={fieldWrap}>
                  <label style={lbl}>Customer Name *</label>
                  <input style={inp} value={preForm.customer_name}
                    onChange={e => setPreForm(f => ({ ...f, customer_name: e.target.value }))}
                    placeholder="Full name" />
                </div>
                <div style={fieldWrap}>
                  <label style={lbl}>Phone</label>
                  <input style={inp} value={preForm.phone}
                    onChange={e => setPreForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="10-digit mobile" maxLength={10} />
                </div>
                <div style={fieldWrap}>
                  <label style={lbl}>Delivery Date</label>
                  <input style={inp} type="date" value={preForm.delivery_date}
                    onChange={e => setPreForm(f => ({ ...f, delivery_date: e.target.value }))} />
                </div>
              </div>
            </div>

            <div style={card}>
              <ItemPickerUI picker={pre} availableItems={preItems4Occ} label="Add Items" />
            </div>

            <div style={card}>
              <div style={cardTitle}>Totals &amp; Advance</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 28 }}>
                <DiscountTotalUI
                  subtotal={pre.subtotal} discountAmt={preDiscount} total={preTotal}
                  discountAmount={preForm.discount_amount} discountType={preForm.discount_type}
                  setDiscountAmount={v => setPreForm(f => ({ ...f, discount_amount: v }))}
                  setDiscountType={t => setPreForm(f => ({ ...f, discount_type: t }))}
                />
                <div style={{ minWidth: 220 }}>
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ ...lbl, display: 'block', marginBottom: 4 }}>Advance Paid (₹)</label>
                    <input style={{ ...inp, width: 140 }} type="number" min={0}
                      value={preForm.advance_paid}
                      onChange={e => setPreForm(f => ({ ...f, advance_paid: e.target.value }))}
                      placeholder="0" />
                  </div>
                  {Number(preForm.advance_paid) > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ ...lbl, display: 'block', marginBottom: 6 }}>Advance Mode</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {(['cash', 'upi'] as const).map(pm => (
                          <button key={pm} onClick={() => setPreForm(f => ({ ...f, payment_mode: pm }))}
                            style={{ padding: '5px 14px', borderRadius: 7, border: '1px solid',
                              borderColor: preForm.payment_mode === pm ? '#1A237E' : '#E5E5E0',
                              background: preForm.payment_mode === pm ? '#EEF0FB' : '#F9F8F5',
                              color: preForm.payment_mode === pm ? '#1A237E' : '#555',
                              fontWeight: preForm.payment_mode === pm ? 600 : 400,
                              fontSize: 12, cursor: 'pointer', textTransform: 'uppercase' }}>
                            {pm}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {preTotal > 0 && Number(preForm.advance_paid) > 0 && (
                    <div style={{ fontSize: 13, color: '#E65100', fontWeight: 500 }}>
                      Balance: ₹{Math.max(0, preTotal - Number(preForm.advance_paid)).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
              <div style={fieldWrap}>
                <label style={{ ...lbl, marginTop: 12 }}>Notes</label>
                <input style={{ ...inp, minWidth: 300 }} value={preForm.notes}
                  onChange={e => setPreForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Any special notes..." />
              </div>
              <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                <button style={btnPrimary} onClick={handleCreatePreorder}>Save Pre-Booking</button>
                <button style={btnGhost} onClick={() => { setPreForm(emptyPreForm()); pre.clear(); }}>Clear</button>
              </div>
            </div>
          </div>
        )}

        {/* ── ORDERS ───────────────────────────────────────────────────────── */}
        {tab === 'orders' && (
          <div>
            <div style={{ fontSize: 13, color: '#888880', marginBottom: 12 }}>
              {orders.length} orders · ₹{totalSales.toLocaleString()} total
            </div>
            {orders.length === 0 ? (
              <div style={{ color: '#888880', fontSize: 13, textAlign: 'center', marginTop: 32 }}>
                No orders for {selectedYear}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {orders.map(order => (
                  <div key={order.id} style={{ ...card, padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{order.customer_name}</div>
                        {order.phone && <div style={{ fontSize: 11, color: '#888880' }}>{order.phone}</div>}
                        {order.occasion_id && occMap[order.occasion_id] && (
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#EEF0FB', color: '#1A237E', fontWeight: 500, marginTop: 4, display: 'inline-block' }}>
                            {occMap[order.occasion_id]}
                          </span>
                        )}
                        <div style={{ fontSize: 11, color: '#AAAAAA', marginTop: 2 }}>
                          {new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#1A237E' }}>₹{order.total_amount.toLocaleString()}</div>
                        <div style={{ fontSize: 11, fontWeight: 600, marginTop: 2, color: order.is_paid ? '#3B6D11' : '#C0392B' }}>
                          {order.is_paid ? `✓ Paid · ${order.payment_mode?.toUpperCase()}` : '⏳ Unpaid'}
                        </div>
                      </div>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 12, color: '#555' }}>
                      {order.items.map(it => (
                        <span key={it.item_id} style={{ marginRight: 10 }}>
                          {it.item_name} ({weightLabel(it.weight, it.weight_unit)}) ×{it.qty}
                        </span>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      {!order.is_paid && (
                        <button style={{ ...btnSm, color: '#3B6D11' }} onClick={() => handleMarkPaid(order)}>Mark Paid</button>
                      )}
                      {order.phone && (
                        <button style={{ ...btnSm, color: '#128C7E' }} onClick={() => handleWhatsApp(order)}>WhatsApp</button>
                      )}
                      <button style={{ ...btnSm, color: '#E24B4A' }} onClick={() => deleteOrder.mutateAsync(order.id).then(() => toast.success('Deleted')).catch(e => toast.error(e.message))}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── PRE-ORDERS ───────────────────────────────────────────────────── */}
        {tab === 'preorders' && (
          <div>
            <div style={{ fontSize: 13, color: '#888880', marginBottom: 12 }}>
              {preorders.length} pre-bookings for {selectedYear}
            </div>
            {preorders.length === 0 ? (
              <div style={{ color: '#888880', fontSize: 13, textAlign: 'center', marginTop: 32 }}>
                No pre-bookings for {selectedYear}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {preorders.map(p => (
                  <div key={p.id} style={{ ...card, padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{p.customer_name}</div>
                        {p.phone && <div style={{ fontSize: 11, color: '#888880' }}>{p.phone}</div>}
                        {p.occasion_id && occMap[p.occasion_id] && (
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#EEF0FB', color: '#1A237E', fontWeight: 500, marginTop: 2, display: 'inline-block' }}>
                            {occMap[p.occasion_id]}
                          </span>
                        )}
                        {p.delivery_date && (
                          <div style={{ fontSize: 11, color: '#E65100', marginTop: 2 }}>
                            Deliver: {new Date(p.delivery_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#1A237E' }}>₹{p.total_amount.toLocaleString()}</div>
                        {p.advance_paid > 0 && (
                          <div style={{ fontSize: 11, color: '#3B6D11', marginTop: 1 }}>
                            Advance: ₹{p.advance_paid.toLocaleString()}
                          </div>
                        )}
                        {p.advance_paid > 0 && (
                          <div style={{ fontSize: 11, color: '#E65100', marginTop: 1 }}>
                            Balance: ₹{Math.max(0, p.total_amount - p.advance_paid).toLocaleString()}
                          </div>
                        )}
                        <span style={{
                          fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600, marginTop: 4, display: 'inline-block',
                          background: STATUS_COLORS[p.status]?.bg || '#F5F5F0',
                          color: STATUS_COLORS[p.status]?.color || '#555',
                        }}>
                          {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                        </span>
                      </div>
                    </div>

                    <div style={{ marginTop: 8, fontSize: 12, color: '#555' }}>
                      {p.items.map(it => (
                        <span key={it.item_id} style={{ marginRight: 10 }}>
                          {it.item_name} ({weightLabel(it.weight, it.weight_unit)}) ×{it.qty}
                        </span>
                      ))}
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      {p.status === 'pending' && (
                        <button style={{ ...btnSm, color: '#1565C0' }} onClick={() => handleUpdatePreStatus(p.id, 'confirmed')}>Confirm</button>
                      )}
                      {(p.status === 'pending' || p.status === 'confirmed') && (
                        <button style={{ ...btnSm, color: '#3B6D11' }} onClick={() => handleUpdatePreStatus(p.id, 'delivered')}>Delivered</button>
                      )}
                      {p.status !== 'cancelled' && p.status !== 'delivered' && (
                        <button style={{ ...btnSm, color: '#888880' }} onClick={() => handleUpdatePreStatus(p.id, 'cancelled')}>Cancel</button>
                      )}
                      {p.phone && (
                        <button style={{ ...btnSm, color: '#128C7E' }} onClick={() => handleWhatsApp(p, true)}>WhatsApp</button>
                      )}
                      <button style={{ ...btnSm, color: '#E24B4A' }} onClick={() => deletePreorder.mutateAsync(p.id).then(() => toast.success('Deleted')).catch(e => toast.error(e.message))}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── REPORTS ──────────────────────────────────────────────────────── */}
        {tab === 'reports' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Summary for {selectedYear}</div>
              <button style={btnPrimary} onClick={downloadReportPDF}>↓ Download PDF</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 12, marginBottom: 20 }}>
              <StatCard label="Total Sales"  value={`₹${totalSales.toLocaleString()}`}  sub={`${orders.length} orders`} />
              <StatCard label="Collected"    value={`₹${totalPaid.toLocaleString()}`}   sub={`${orders.filter(o => o.is_paid).length} paid`} subColor="#3B6D11" />
              <StatCard label="Pending"      value={`₹${totalUnpaid.toLocaleString()}`} sub={`${unpaidOrders.length} unpaid`} subColor={totalUnpaid > 0 ? '#C0392B' : '#3B6D11'} />
            </div>

            {unpaidOrders.length > 0 && (
              <div style={{ ...card, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#C0392B', marginBottom: 10 }}>
                  Unpaid Customers ({unpaidOrders.length})
                </div>
                {unpaidOrders.map(order => (
                  <div key={order.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '0.5px solid #F5F5F0', fontSize: 13 }}>
                    <div>
                      <span style={{ fontWeight: 500 }}>{order.customer_name}</span>
                      {order.phone && <span style={{ fontSize: 11, color: '#888880', marginLeft: 8 }}>{order.phone}</span>}
                    </div>
                    <span style={{ color: '#C0392B', fontWeight: 600 }}>₹{order.total_amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={card}>
              <div style={cardTitle}>All Orders — {selectedYear}</div>
              {orders.length === 0 ? (
                <div style={{ color: '#888880', fontSize: 13 }}>No orders</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#F5F5F2', borderBottom: '0.5px solid #E5E5E0' }}>
                      <th style={th}>Customer</th>
                      <th style={th}>Occasion</th>
                      <th style={th}>Items</th>
                      <th style={th}>Total</th>
                      <th style={th}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order, idx) => (
                      <tr key={order.id} style={{ borderBottom: idx < orders.length - 1 ? '0.5px solid #F0F0EC' : 'none' }}>
                        <td style={td}>
                          <div>{order.customer_name}</div>
                          {order.phone && <div style={{ fontSize: 11, color: '#888880' }}>{order.phone}</div>}
                        </td>
                        <td style={td}>
                          {order.occasion_id && occMap[order.occasion_id]
                            ? <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: '#EEF0FB', color: '#1A237E' }}>{occMap[order.occasion_id]}</span>
                            : <span style={{ color: '#AAAAAA' }}>—</span>}
                        </td>
                        <td style={{ ...td, fontSize: 12, color: '#555' }}>
                          {order.items.map(it => `${it.item_name}×${it.qty}`).join(', ')}
                        </td>
                        <td style={{ ...td, fontWeight: 600 }}>₹{order.total_amount.toLocaleString()}</td>
                        <td style={td}>
                          <span style={{
                            fontSize: 11, padding: '3px 8px', borderRadius: 12, fontWeight: 600,
                            background: order.is_paid ? '#EAF3DE' : '#FDE8E8',
                            color: order.is_paid ? '#3B6D11' : '#C0392B',
                          }}>
                            {order.is_paid ? 'Paid' : 'Unpaid'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string; sub: string; subColor?: string }> = ({ label, value, sub, subColor }) => (
  <div style={{ background: '#fff', border: '0.5px solid #E5E5E0', borderRadius: 10, padding: '12px 14px' }}>
    <div style={{ fontSize: 11, color: '#888880', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
    <div style={{ fontSize: 11, color: subColor || '#AAAAAA', marginTop: 2 }}>{sub}</div>
  </div>
);

const btnPrimary: React.CSSProperties  = { background: '#1A237E', color: '#fff', border: 'none', padding: '7px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 };
const btnSecondary: React.CSSProperties = { background: '#EEF0FB', color: '#1A237E', border: '1px solid #C5CAF5', padding: '7px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 };
const btnGhost: React.CSSProperties   = { background: 'transparent', border: '0.5px solid #D0D0CC', padding: '7px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#666660' };
const btnSm: React.CSSProperties      = { background: '#F5F5F0', border: '0.5px solid #E5E5E0', padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#444' };
const card: React.CSSProperties       = { background: '#fff', border: '0.5px solid #E5E5E0', borderRadius: 12, padding: 16, marginBottom: 14 };
const cardTitle: React.CSSProperties  = { fontSize: 13, fontWeight: 600, marginBottom: 12 };
const fieldWrap: React.CSSProperties  = { display: 'flex', flexDirection: 'column', gap: 4 };
const lbl: React.CSSProperties        = { fontSize: 11, color: '#888880', fontWeight: 500 };
const inp: React.CSSProperties        = { border: '1px solid #E5E5E0', borderRadius: 7, padding: '6px 10px', fontSize: 13, minWidth: 160, background: '#fff' };
const th: React.CSSProperties         = { padding: '8px 12px', fontWeight: 600, textAlign: 'left', fontSize: 12, color: '#888880' };
const td: React.CSSProperties         = { padding: '9px 12px' };

export default SeasonalBilling;
