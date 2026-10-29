import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import { useBookings } from '../../hooks/useBookings';
import { useQuotations } from '../../hooks/useQuotations';
import { useCreateInvoice } from '../../hooks/useInvoices';
import { formatDateIST, todayIST } from '../../lib/ist';
import { pickQuotation } from '../../lib/quoteMath';
import { LineItem } from '../../types';
import { ORANGE, btnGhost, btnPrimary, infoLbl, infoVal, inp, lbl } from './InvoiceUi';

interface Props { bookingId?: string; onClose: () => void; onCreated: (invoiceId: string) => void }

// Turns a confirmed booking (and its quotation, if any) into a draft invoice.
const InvoiceCreateModal: React.FC<Props> = ({ bookingId, onClose, onCreated }) => {
  const { data: bookings = [] } = useBookings();
  const { data: quotations = [] } = useQuotations();
  const createInvoice = useCreateInvoice();
  const [createBookingId, setCreateBookingId] = useState(bookingId ?? '');
  const [createAdvance, setCreateAdvance] = useState('');

  const confirmedBookings = bookings.filter(b => b.status === 'confirmed' || b.id === bookingId);
  const selectedCreateBooking = bookings.find(b => b.id === createBookingId);
  const quotationForBooking = useMemo(
    () => pickQuotation(quotations, createBookingId),
    [quotations, createBookingId]
  );

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
        additional_discounts: quotationForBooking?.additional_discounts || [],
        advance_paid: Math.max(0, parseFloat(createAdvance) || 0),
        line_items: lineItems, status: 'draft', issue_date: todayIST(),
        is_multi_day: quotationForBooking?.is_multi_day,
        event_days: quotationForBooking?.event_days,
      });
      toast.success('Invoice created as Draft!');
      onCreated(inv.id);
    } catch (e: any) { toast.error(e.message || 'Failed to create invoice'); }
  };

  return (
    <Modal title="Create invoice from confirmed booking" onClose={onClose} width={540}
      footer={<>
        <button type="button" style={btnGhost} onClick={onClose}>Cancel</button>
        <button type="button" style={{ ...btnPrimary, opacity: !createBookingId || createInvoice.isPending ? 0.6 : 1 }}
          onClick={handleCreate} disabled={!createBookingId || createInvoice.isPending}>
          {createInvoice.isPending ? 'Creating...' : 'Generate Invoice'}
        </button>
      </>}>
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
        <div style={{ background: '#FAFAF8', border: '0.5px solid #E5E5E0', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: ORANGE, marginBottom: 10 }}>
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
            <input type="number" inputMode="decimal" style={{ ...inp, maxWidth: 200 }} value={createAdvance} onChange={e => setCreateAdvance(e.target.value)} placeholder="0" />
          </div>
        </div>
      )}
    </Modal>
  );
};

export default InvoiceCreateModal;
