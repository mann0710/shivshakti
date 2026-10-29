import React from 'react';
import { Invoice } from '../../types';
import { Quotation } from '../../hooks/useQuotations';
import { ORANGE } from './InvoiceUi';

interface Props { invoice: Invoice; quotation?: Quotation; showGST: boolean }

const Row: React.FC<{ label: React.ReactNode; value: string; color?: string }> = ({ label, value, color = '#666660' }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '3px 0', fontSize: 12, color }}>
    <span>{label}</span><span style={{ flexShrink: 0 }}>{value}</span>
  </div>
);

// Saved totals of an invoice: subtotal, charges, GST, discount, paid and balance.
const InvoiceTotals: React.FC<Props> = ({ invoice: inv, quotation, showGST }) => {
  const perPlate = quotation?.per_plate_amount ?? 0;
  const due = inv.balance_due > 0;
  const dueColor = due ? '#A32D2D' : '#3B6D11';
  return (
    <div style={{ border: '0.5px solid #E5E5E0', borderRadius: 8, padding: '10px 12px', marginBottom: 12, background: '#fff' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#888880', marginBottom: 8 }}>TOTAL SUMMARY</div>
      <Row label={`Subtotal${!inv.is_multi_day && perPlate > 0 ? ` (₹${perPlate}/plate × ${quotation?.guest_count})` : ''}`} value={`₹${inv.subtotal.toLocaleString()}`} />
      {(inv.extra_charges || []).map((ec, i) => (
        <Row key={i} label={ec.description || 'Extra Charge'} value={`+₹${(ec.amount || 0).toLocaleString()}`} />
      ))}
      {showGST && inv.gst_rate > 0 && <Row label={`GST @${inv.gst_rate}%`} value={`+₹${inv.gst_amount.toLocaleString()}`} />}
      {(inv.transportation_charge || 0) > 0 && <Row label="Transportation" value={`+₹${inv.transportation_charge.toLocaleString()}`} />}
      {inv.discount_amount > 0 && (
        <Row color="#3B6D11" value={`-₹${inv.discount_amount.toLocaleString()}`}
          label={`Discount${inv.discount_type === 'percentage' ? ` (${Math.round((inv.discount_amount / inv.subtotal) * 100)}%)` : ''}`} />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0 4px', fontSize: 14, fontWeight: 700, borderTop: '0.5px solid #E5E5E0', marginTop: 6, color: '#1A1A18' }}>
        <span>Total</span><span style={{ color: ORANGE }}>₹{inv.total_amount.toLocaleString()}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
        <div style={{ background: '#EAF3DE', padding: '8px 12px', borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: '#3B6D11' }}>Amount paid</div>
          <div style={{ fontWeight: 600, color: '#3B6D11', fontSize: 14, marginTop: 2 }}>₹{inv.advance_paid.toLocaleString()}</div>
        </div>
        <div style={{ background: due ? '#FCEBEB' : '#EAF3DE', padding: '8px 12px', borderRadius: 8 }}>
          <div style={{ fontSize: 11, color: dueColor }}>Balance due</div>
          <div style={{ fontWeight: 600, color: dueColor, fontSize: 14, marginTop: 2 }}>
            {due ? `₹${inv.balance_due.toLocaleString()}` : '✓ Fully paid'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceTotals;
