import React, { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import {
  useSeasonalOrders, useCreateSeasonalOrder, useUpdateSeasonalOrderPaid, useDeleteSeasonalOrder,
  SeasonalOrder, SeasonalOrderItem,
} from '../hooks/useSeasonalOrders';
import { useSeasonalItems } from '../hooks/useSeasonalItems';

function weightLabel(weight: number, unit: string) {
  if (unit === 'gm' && weight >= 1000) return `${weight / 1000} kg`;
  return `${weight} ${unit}`;
}

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

type Tab = 'billing' | 'orders' | 'reports';

const emptyBillForm = () => ({
  customer_name: '',
  phone: '',
  discount_amount: '' as string | number,
  discount_type: 'amount' as 'amount' | 'percentage',
  payment_mode: 'cash' as 'cash' | 'upi',
  is_unpaid: false,
  notes: '',
});

const SeasonalBilling: React.FC = () => {
  const [tab, setTab] = useState<Tab>('billing');
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const { data: allItems = [] } = useSeasonalItems();
  const { data: orders = [] } = useSeasonalOrders(selectedYear);
  const createOrder = useCreateSeasonalOrder();
  const updatePaid = useUpdateSeasonalOrderPaid();
  const deleteOrder = useDeleteSeasonalOrder();

  // Bill form state
  const [form, setForm] = useState(emptyBillForm());
  const [billItems, setBillItems] = useState<SeasonalOrderItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedQty, setSelectedQty] = useState(1);

  // Computed totals
  const subtotal = billItems.reduce((s, i) => s + i.line_total, 0);
  const discountAmt = useMemo(() => {
    const d = Number(form.discount_amount) || 0;
    if (form.discount_type === 'percentage') return Math.round((subtotal * d) / 100);
    return d;
  }, [subtotal, form.discount_amount, form.discount_type]);
  const totalAmount = Math.max(0, subtotal - discountAmt);

  // Report stats
  const totalSales = orders.reduce((s, o) => s + o.total_amount, 0);
  const totalPaid = orders.filter(o => o.is_paid).reduce((s, o) => s + o.total_amount, 0);
  const totalUnpaid = orders.filter(o => !o.is_paid).reduce((s, o) => s + o.total_amount, 0);
  const unpaidOrders = orders.filter(o => !o.is_paid);

  const addItemToBill = () => {
    if (!selectedItemId) return;
    const catalogItem = allItems.find(i => i.id === selectedItemId);
    if (!catalogItem) return;
    const qty = Math.max(1, selectedQty);
    const existing = billItems.findIndex(i => i.item_id === selectedItemId);
    if (existing >= 0) {
      setBillItems(prev => prev.map((it, idx) =>
        idx === existing ? { ...it, qty: it.qty + qty, line_total: (it.qty + qty) * it.price } : it
      ));
    } else {
      setBillItems(prev => [...prev, {
        item_id: catalogItem.id,
        item_name: catalogItem.name,
        weight: catalogItem.weight,
        weight_unit: catalogItem.weight_unit,
        price: catalogItem.price,
        qty,
        line_total: qty * catalogItem.price,
      }]);
    }
    setSelectedItemId('');
    setSelectedQty(1);
  };

  const removeItemFromBill = (itemId: string) => {
    setBillItems(prev => prev.filter(i => i.item_id !== itemId));
  };

  const updateItemQty = (itemId: string, qty: number) => {
    if (qty <= 0) { removeItemFromBill(itemId); return; }
    setBillItems(prev => prev.map(i => i.item_id === itemId ? { ...i, qty, line_total: qty * i.price } : i));
  };

  const handleCreateBill = async () => {
    if (!form.customer_name.trim()) { toast.error('Customer name required'); return; }
    if (billItems.length === 0) { toast.error('Add at least one item'); return; }
    if (!form.is_unpaid && !form.payment_mode) { toast.error('Select payment mode'); return; }

    try {
      await createOrder.mutateAsync({
        customer_name: form.customer_name.trim(),
        phone: form.phone.trim(),
        items: billItems,
        subtotal,
        discount_amount: discountAmt,
        discount_type: form.discount_type,
        total_amount: totalAmount,
        is_paid: !form.is_unpaid,
        payment_mode: form.is_unpaid ? null : form.payment_mode,
        year: currentYear,
        notes: form.notes.trim() || undefined,
      });
      toast.success('Bill created');
      setForm(emptyBillForm());
      setBillItems([]);
      setSelectedItemId('');
      setSelectedQty(1);
      setTab('orders');
    } catch (e: any) {
      toast.error(e.message || 'Error creating bill');
    }
  };

  const handleWhatsApp = (order: SeasonalOrder) => {
    if (!order.phone) { toast.error('No phone number on this order'); return; }
    const lines: string[] = [
      `*Shiv Shakti — Bill*`,
      `Customer: ${order.customer_name}`,
      `Date: ${new Date(order.created_at).toLocaleDateString('en-IN')}`,
      ``,
      `*Items:*`,
      ...order.items.map(i => `  ${i.item_name} (${weightLabel(i.weight, i.weight_unit)}) x${i.qty} = ₹${i.line_total.toLocaleString()}`),
      ``,
      `Subtotal: ₹${order.subtotal.toLocaleString()}`,
    ];
    if (order.discount_amount > 0) lines.push(`Discount: -₹${order.discount_amount.toLocaleString()}`);
    lines.push(`*Total: ₹${order.total_amount.toLocaleString()}*`);
    lines.push(order.is_paid ? `Status: ✅ Paid (${order.payment_mode?.toUpperCase()})` : `Status: ⏳ Unpaid`);
    const text = encodeURIComponent(lines.join('\n'));
    const phone = order.phone.replace(/\D/g, '');
    window.open(`https://wa.me/91${phone}?text=${text}`, '_blank');
  };

  const handleMarkPaid = async (order: SeasonalOrder) => {
    const mode = window.prompt('Payment mode: cash or upi?', 'cash') as 'cash' | 'upi' | null;
    if (!mode || !['cash', 'upi'].includes(mode)) return;
    try {
      await updatePaid.mutateAsync({ id: order.id, is_paid: true, payment_mode: mode });
      toast.success('Marked as paid');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this order?')) return;
    try {
      await deleteOrder.mutateAsync(id);
      toast.success('Deleted');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const downloadReportPDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const M = 15;
    const PW = 210;
    const CW = PW - M * 2;
    let y = M;

    // Header
    doc.setFillColor(26, 35, 126);
    doc.rect(M, y, CW, 14, 'F');
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('SEASONAL SALES REPORT', M + CW / 2, y + 9, { align: 'center' });
    y += 14;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`Year: ${selectedYear}   |   Generated: ${new Date().toLocaleDateString('en-IN')}`, M, y + 6);
    y += 14;

    // Summary boxes
    const boxes = [
      { label: 'Total Sales', value: `Rs ${totalSales.toLocaleString()}` },
      { label: 'Paid', value: `Rs ${totalPaid.toLocaleString()}` },
      { label: 'Unpaid', value: `Rs ${totalUnpaid.toLocaleString()}` },
      { label: 'Orders', value: String(orders.length) },
    ];
    const bw = CW / 4 - 2;
    boxes.forEach((box, i) => {
      const bx = M + i * (bw + 2.67);
      doc.setFillColor(235, 238, 252);
      doc.rect(bx, y, bw, 16, 'F');
      doc.setDrawColor(200, 205, 240);
      doc.rect(bx, y, bw, 16);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 120);
      doc.text(box.label, bx + bw / 2, y + 5, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(26, 35, 126);
      doc.text(box.value, bx + bw / 2, y + 12, { align: 'center' });
    });
    y += 22;

    // Orders table
    const cols = ['#', 'Customer', 'Phone', 'Items', 'Total', 'Status', 'Payment'];
    const colW = [8, 35, 28, 55, 20, 18, 16];
    const rowH = 8;

    doc.setFillColor(26, 35, 126);
    doc.rect(M, y, CW, rowH, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    let cx = M + 2;
    cols.forEach((col, i) => {
      doc.text(col, cx, y + 5.5);
      cx += colW[i];
    });
    y += rowH;

    doc.setFont('helvetica', 'normal');
    orders.forEach((order, idx) => {
      if (y > 270) {
        doc.addPage();
        y = M;
      }
      const bg = idx % 2 === 0 ? [250, 250, 248] : [255, 255, 255];
      doc.setFillColor(bg[0], bg[1], bg[2]);
      doc.rect(M, y, CW, rowH, 'F');
      doc.setDrawColor(230, 230, 228);
      doc.rect(M, y, CW, rowH);

      doc.setTextColor(50, 50, 50);
      doc.setFontSize(7);
      cx = M + 2;
      const itemSummary = order.items.map(i => `${i.item_name}(${i.qty})`).join(', ');
      const cells = [
        String(idx + 1),
        order.customer_name,
        order.phone || '—',
        itemSummary.length > 38 ? itemSummary.slice(0, 36) + '…' : itemSummary,
        `Rs ${order.total_amount.toLocaleString()}`,
        order.is_paid ? 'Paid' : 'Unpaid',
        order.payment_mode ? order.payment_mode.toUpperCase() : '—',
      ];
      cells.forEach((cell, i) => {
        doc.text(cell, cx, y + 5.5);
        cx += colW[i];
      });
      y += rowH;
    });

    // Unpaid customers section
    if (unpaidOrders.length > 0) {
      y += 8;
      if (y > 260) { doc.addPage(); y = M; }
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(26, 35, 126);
      doc.text('Unpaid Customers', M, y);
      y += 6;

      unpaidOrders.forEach(order => {
        if (y > 275) { doc.addPage(); y = M; }
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(180, 30, 30);
        doc.text(`• ${order.customer_name}${order.phone ? ` (${order.phone})` : ''} — Rs ${order.total_amount.toLocaleString()}`, M + 2, y);
        y += 6;
      });
    }

    doc.save(`seasonal-report-${selectedYear}.pdf`);
  };

  return (
    <div>
      <div className="page-topbar">
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Seasonal Billing</div>
          <div style={{ fontSize: 11, color: '#888880', marginTop: 2 }}>Festival & seasonal orders</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            style={{ border: '0.5px solid #D0D0CC', borderRadius: 7, padding: '5px 10px', fontSize: 13, background: '#fff' }}
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
          >
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '0 20px 0', borderBottom: '0.5px solid #E5E5E0', background: '#FAFAF8' }}>
        {(['billing', 'orders', 'reports'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: tab === t ? 600 : 400,
              color: tab === t ? '#1A237E' : '#888880',
              borderBottom: tab === t ? '2px solid #1A237E' : '2px solid transparent',
              textTransform: 'capitalize',
            }}
          >{t === 'billing' ? 'New Bill' : t === 'orders' ? 'Orders' : 'Reports'}</button>
        ))}
      </div>

      <div className="page-content">

        {/* ── NEW BILL TAB ── */}
        {tab === 'billing' && (
          <div>
            <div style={card}>
              <div style={cardTitle}>Customer Details</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <div style={fieldWrap}>
                  <label style={lbl}>Customer Name *</label>
                  <input style={inp} value={form.customer_name}
                    onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                    placeholder="Full name" />
                </div>
                <div style={fieldWrap}>
                  <label style={lbl}>Phone</label>
                  <input style={inp} value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="10-digit mobile" maxLength={10} />
                </div>
              </div>
            </div>

            <div style={card}>
              <div style={cardTitle}>Add Items</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginBottom: 16 }}>
                <div style={fieldWrap}>
                  <label style={lbl}>Select Item</label>
                  <select style={{ ...inp, minWidth: 200 }} value={selectedItemId}
                    onChange={e => setSelectedItemId(e.target.value)}>
                    <option value="">— choose item —</option>
                    {allItems.filter(i => i.is_active).map(i => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({weightLabel(i.weight, i.weight_unit)}) — ₹{i.price}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={fieldWrap}>
                  <label style={lbl}>Qty</label>
                  <input style={{ ...inp, width: 70 }} type="number" min={1} value={selectedQty}
                    onChange={e => setSelectedQty(Number(e.target.value))} />
                </div>
                <button style={btnPrimary} onClick={addItemToBill}>Add</button>
              </div>

              {billItems.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#F5F5F2', borderBottom: '0.5px solid #E5E5E0' }}>
                      <th style={th}>Item</th>
                      <th style={th}>Weight</th>
                      <th style={th}>Price</th>
                      <th style={th}>Qty</th>
                      <th style={th}>Total</th>
                      <th style={th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {billItems.map(item => (
                      <tr key={item.item_id} style={{ borderBottom: '0.5px solid #F0F0EC' }}>
                        <td style={td}>{item.item_name}</td>
                        <td style={td}>{weightLabel(item.weight, item.weight_unit)}</td>
                        <td style={td}>₹{item.price.toLocaleString()}</td>
                        <td style={td}>
                          <input
                            type="number" min={1} value={item.qty}
                            onChange={e => updateItemQty(item.item_id, Number(e.target.value))}
                            style={{ width: 60, border: '1px solid #E5E5E0', borderRadius: 5, padding: '3px 6px', fontSize: 12 }}
                          />
                        </td>
                        <td style={{ ...td, fontWeight: 600 }}>₹{item.line_total.toLocaleString()}</td>
                        <td style={td}>
                          <button style={{ ...btnSm, color: '#E24B4A' }} onClick={() => removeItemFromBill(item.item_id)}>✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={card}>
              <div style={cardTitle}>Totals & Payment</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24 }}>
                <div style={{ minWidth: 220 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                    <span style={{ color: '#666' }}>Subtotal</span>
                    <span>₹{subtotal.toLocaleString()}</span>
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: '#666', minWidth: 70 }}>Discount</span>
                    <div style={{ display: 'flex', gap: 0, border: '1px solid #E5E5E0', borderRadius: 6, overflow: 'hidden' }}>
                      {(['amount', 'percentage'] as const).map(dt => (
                        <button key={dt} onClick={() => setForm(f => ({ ...f, discount_type: dt }))}
                          style={{
                            padding: '4px 10px', fontSize: 11, border: 'none', cursor: 'pointer',
                            background: form.discount_type === dt ? '#1A237E' : '#F9F8F5',
                            color: form.discount_type === dt ? '#fff' : '#444',
                          }}>
                          {dt === 'amount' ? '₹' : '%'}
                        </button>
                      ))}
                    </div>
                    <input
                      type="number" min={0} value={form.discount_amount}
                      onChange={e => setForm(f => ({ ...f, discount_amount: e.target.value }))}
                      style={{ width: 80, border: '1px solid #E5E5E0', borderRadius: 5, padding: '4px 8px', fontSize: 12 }}
                    />
                    {discountAmt > 0 && <span style={{ fontSize: 12, color: '#3B6D11' }}>-₹{discountAmt.toLocaleString()}</span>}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, borderTop: '0.5px solid #E5E5E0', paddingTop: 8 }}>
                    <span>Total</span>
                    <span style={{ color: '#1A237E' }}>₹{totalAmount.toLocaleString()}</span>
                  </div>
                </div>

                <div style={{ minWidth: 220 }}>
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ ...lbl, display: 'block', marginBottom: 6 }}>Payment Mode</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {(['cash', 'upi'] as const).map(pm => (
                        <button key={pm} onClick={() => setForm(f => ({ ...f, payment_mode: pm }))}
                          style={{
                            padding: '6px 18px', borderRadius: 7, border: '1px solid',
                            borderColor: form.payment_mode === pm ? '#1A237E' : '#E5E5E0',
                            background: form.payment_mode === pm ? '#EEF0FB' : '#F9F8F5',
                            color: form.payment_mode === pm ? '#1A237E' : '#555',
                            fontWeight: form.payment_mode === pm ? 600 : 400,
                            fontSize: 13, cursor: 'pointer', textTransform: 'uppercase',
                          }}>{pm}</button>
                      ))}
                    </div>
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={form.is_unpaid}
                      onChange={e => setForm(f => ({ ...f, is_unpaid: e.target.checked }))}
                      style={{ width: 15, height: 15 }}
                    />
                    <span>Unpaid (collect later)</span>
                  </label>
                </div>
              </div>

              <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                <button style={btnPrimary} onClick={handleCreateBill}>Create Bill</button>
                <button style={btnGhost} onClick={() => { setForm(emptyBillForm()); setBillItems([]); }}>Clear</button>
              </div>
            </div>
          </div>
        )}

        {/* ── ORDERS TAB ── */}
        {tab === 'orders' && (
          <div>
            <div style={{ fontSize: 13, color: '#888880', marginBottom: 12 }}>
              {orders.length} orders in {selectedYear} · Total ₹{totalSales.toLocaleString()}
            </div>
            {orders.length === 0 ? (
              <div style={{ color: '#888880', fontSize: 13, textAlign: 'center', marginTop: 32 }}>No orders for {selectedYear}</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {orders.map(order => (
                  <div key={order.id} style={{ ...card, padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{order.customer_name}</div>
                        {order.phone && <div style={{ fontSize: 11, color: '#888880' }}>{order.phone}</div>}
                        <div style={{ fontSize: 11, color: '#AAAAAA', marginTop: 2 }}>
                          {new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#1A237E' }}>₹{order.total_amount.toLocaleString()}</div>
                        <div style={{
                          fontSize: 11, fontWeight: 600, marginTop: 2,
                          color: order.is_paid ? '#3B6D11' : '#C0392B',
                        }}>
                          {order.is_paid ? `✓ Paid · ${order.payment_mode?.toUpperCase()}` : '⏳ Unpaid'}
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: 10, fontSize: 12, color: '#555' }}>
                      {order.items.map(it => (
                        <span key={it.item_id} style={{ marginRight: 10 }}>
                          {it.item_name} ({weightLabel(it.weight, it.weight_unit)}) ×{it.qty}
                        </span>
                      ))}
                    </div>
                    {order.discount_amount > 0 && (
                      <div style={{ fontSize: 11, color: '#888880', marginTop: 4 }}>
                        Subtotal ₹{order.subtotal.toLocaleString()} · Discount ₹{order.discount_amount.toLocaleString()}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                      {!order.is_paid && (
                        <button style={{ ...btnSm, color: '#3B6D11', borderColor: '#B5D698' }} onClick={() => handleMarkPaid(order)}>
                          Mark Paid
                        </button>
                      )}
                      {order.phone && (
                        <button style={{ ...btnSm, color: '#128C7E', borderColor: '#A8D5CF' }} onClick={() => handleWhatsApp(order)}>
                          WhatsApp
                        </button>
                      )}
                      <button style={{ ...btnSm, color: '#E24B4A' }} onClick={() => handleDelete(order.id)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── REPORTS TAB ── */}
        {tab === 'reports' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Summary for {selectedYear}</div>
              <button style={btnPrimary} onClick={downloadReportPDF}>↓ Download PDF</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
              <StatCard label="Total Sales" value={`₹${totalSales.toLocaleString()}`} sub={`${orders.length} orders`} />
              <StatCard label="Collected" value={`₹${totalPaid.toLocaleString()}`} sub={`${orders.filter(o => o.is_paid).length} paid`} subColor="#3B6D11" />
              <StatCard label="Pending" value={`₹${totalUnpaid.toLocaleString()}`} sub={`${unpaidOrders.length} unpaid`} subColor={totalUnpaid > 0 ? '#C0392B' : '#3B6D11'} />
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
                      <th style={th}>Items</th>
                      <th style={th}>Total</th>
                      <th style={th}>Status</th>
                      <th style={th}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order, idx) => (
                      <tr key={order.id} style={{ borderBottom: idx < orders.length - 1 ? '0.5px solid #F0F0EC' : 'none' }}>
                        <td style={td}>
                          <div>{order.customer_name}</div>
                          {order.phone && <div style={{ fontSize: 11, color: '#888880' }}>{order.phone}</div>}
                        </td>
                        <td style={{ ...td, fontSize: 12, color: '#555' }}>
                          {order.items.map(it => `${it.item_name}×${it.qty}`).join(', ')}
                        </td>
                        <td style={{ ...td, fontWeight: 600 }}>₹{order.total_amount.toLocaleString()}</td>
                        <td style={td}>
                          <span style={{
                            fontSize: 11, padding: '3px 8px', borderRadius: 12,
                            background: order.is_paid ? '#EAF3DE' : '#FDE8E8',
                            color: order.is_paid ? '#3B6D11' : '#C0392B',
                            fontWeight: 600,
                          }}>
                            {order.is_paid ? 'Paid' : 'Unpaid'}
                          </span>
                        </td>
                        <td style={{ ...td, fontSize: 12, color: '#888880' }}>
                          {new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
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

const btnPrimary: React.CSSProperties = { background: '#1A237E', color: '#fff', border: 'none', padding: '7px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: 500 };
const btnGhost: React.CSSProperties = { background: 'transparent', border: '0.5px solid #D0D0CC', padding: '7px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: '#666660' };
const btnSm: React.CSSProperties = { background: '#F5F5F0', border: '0.5px solid #E5E5E0', padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#444' };
const card: React.CSSProperties = { background: '#fff', border: '0.5px solid #E5E5E0', borderRadius: 12, padding: 16, marginBottom: 14 };
const cardTitle: React.CSSProperties = { fontSize: 13, fontWeight: 600, marginBottom: 12 };
const fieldWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };
const lbl: React.CSSProperties = { fontSize: 11, color: '#888880', fontWeight: 500 };
const inp: React.CSSProperties = { border: '1px solid #E5E5E0', borderRadius: 7, padding: '6px 10px', fontSize: 13, minWidth: 160, background: '#fff' };
const th: React.CSSProperties = { padding: '8px 12px', fontWeight: 600, textAlign: 'left', fontSize: 12, color: '#888880' };
const td: React.CSSProperties = { padding: '9px 12px' };

export default SeasonalBilling;
