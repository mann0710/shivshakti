import React, { useState, useEffect, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  useInvoices, usePaymentHistory, useRecalculateTotals, useDeleteInvoice, useUpdateEventDays,
} from '../hooks/useInvoices';
import { useDataCenter } from '../hooks/useDataCenter';
import { useQuotations } from '../hooks/useQuotations';
import StatusPill from '../components/StatusPill';
import { formatDateIST } from '../lib/ist';
import { mealSavings } from '../lib/quoteMath';
import { inr } from '../lib/money';
import { Invoice } from '../types';
import { Navigate, useNavIntent } from '../hooks/useNavIntent';
import { useConfirm } from '../components/ui/ConfirmDialog';
import InvoiceList from '../components/catering/InvoiceList';
import InvoiceCreateModal from '../components/catering/InvoiceCreateModal';
import InvoiceChargeList, { InvoiceChargeBox } from '../components/catering/InvoiceChargeList';
import InvoiceTotals from '../components/catering/InvoiceTotals';
import InvoiceActions from '../components/catering/InvoiceActions';
import PaymentHistory from '../components/catering/PaymentHistory';
import PaymentFormModal from '../components/catering/PaymentFormModal';
import { ORANGE, box, btnGhost, btnPrimary, card, outlineBtn, revealOnPhone, statCard, statLbl } from '../components/catering/InvoiceUi';

const genBillingId = () => Math.random().toString(36).slice(2, 10);
type Charge = { description: string; amount: number };

// ─── Component ────────────────────────────────────────────────────────────────
interface Props { onNavigate?: Navigate }

const Billing: React.FC<Props> = () => {
  const intent = useNavIntent('billing');
  const { data: invoices = [], isLoading } = useInvoices();
  const { data: dc } = useDataCenter();
  const recalcTotals = useRecalculateTotals();
  const deleteInvoice = useDeleteInvoice();
  const updateEventDays = useUpdateEventDays();
  const { data: quotations = [] } = useQuotations();
  const { confirm, dialog } = useConfirm();

  const [selectedId, setSelectedId] = useState<string | null>(intent?.action === 'open' ? intent.id ?? null : null);
  const [showCreateForm, setShowCreateForm] = useState(intent?.action === 'new');
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showGST, setShowGST] = useState(true);
  const previewRef = useRef<HTMLDivElement>(null);

  const [additionalDiscounts, setAdditionalDiscounts] = useState<{ id: string; description: string; amount: number }[]>([]);
  const [transportItems, setTransportItems] = useState<Charge[]>([]);
  const [extraChargeItems, setExtraChargeItems] = useState<Charge[]>([]);
  const [editableEventDays, setEditableEventDays] = useState<any[]>([]);

  const selected = invoices.find(i => i.id === selectedId) || invoices[0];

  // Follows edited guest counts so "Save Guest Counts" uses the new numbers.
  const billMealSavings = useMemo(
    () => (selected?.is_multi_day ? mealSavings(editableEventDays) : 0),
    [selected?.is_multi_day, editableEventDays],
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
    if ((selected.additional_discounts || []).length > 0) {
      setAdditionalDiscounts(selected.additional_discounts!);
    } else if ((selected.discount_amount || 0) > 0) {
      // Backward compat: compute meal savings to find manual portion
      const mealSav = selected.is_multi_day ? mealSavings(selected.event_days) : 0;
      const additionalAmt = (selected.discount_amount || 0) - mealSav;
      setAdditionalDiscounts(additionalAmt > 0
        ? [{ id: genBillingId(), description: 'Discount', amount: additionalAmt }]
        : []);
    } else {
      setAdditionalDiscounts([]);
    }
    setTransportItems(
      selected.transportation_charges?.length
        ? selected.transportation_charges
        : selected.transportation_charge > 0
          ? [{ description: 'Transportation', amount: selected.transportation_charge }]
          : []
    );
    setExtraChargeItems(selected.extra_charges?.length ? [...selected.extra_charges] : []);
    setEditableEventDays((selected.event_days || []) as any[]);
  }, [selected?.id]); // eslint-disable-line

  const selectInvoice = (inv: Invoice) => {
    setSelectedId(inv.id);
    setShowPaymentForm(false);
    revealOnPhone(previewRef);
  };

  const computeTotalDiscount = () =>
    billMealSavings + additionalDiscounts.reduce((s, d) => s + (d.amount || 0), 0);

  // Same payload for every "Apply" button and the GST toggle.
  const recalc = (invoiceId: string, apply_gst: boolean) => recalcTotals.mutateAsync({
    invoiceId,
    discount_amount: computeTotalDiscount(),
    discount_type: 'amount',
    apply_gst, gst_rate: dc?.gst_rate ?? 18,
    transportation_charges: transportItems,
    additional_discounts: additionalDiscounts.filter(d => d.description.trim() || d.amount > 0),
    extra_charges: extraChargeItems.filter(e => e.description.trim() || e.amount > 0),
  });

  const applyTotals = async (done: string, failed: string, apply_gst = showGST) => {
    if (!selected) return;
    try {
      await recalc(selected.id, apply_gst);
      toast.success(done);
    } catch (e: any) { toast.error(e?.message || failed); }
  };

  const handleGSTToggle = (checked: boolean) => {
    if (!selected) return;
    setShowGST(checked);
    applyTotals(checked ? `GST @${dc?.gst_rate ?? 18}% added` : 'GST removed', 'Failed to update GST', checked);
  };

  const handleUpdateGuestCount = (dayIndex: number, mealIndex: number, newCount: number) => {
    setEditableEventDays(prev => prev.map((day: any, di: number) => {
      if (di !== dayIndex) return day;
      const meals = (day.meals as any[]).map((meal: any, mi: number) => {
        if (mi !== mealIndex) return meal;
        const subtotal = newCount * (meal.per_plate_amount || 0);
        return { ...meal, guest_count: newCount, subtotal };
      });
      const day_subtotal = meals.reduce((s: number, m: any) => s + (m.subtotal || 0), 0);
      return { ...day, meals, day_subtotal };
    }));
  };

  const handleApplyEventDays = async () => {
    if (!selected) return;
    const newSubtotal = editableEventDays.reduce((s: number, day: any) => s + (day.day_subtotal || 0), 0);
    try {
      await updateEventDays.mutateAsync({ invoiceId: selected.id, event_days: editableEventDays, subtotal: newSubtotal });
      await recalc(selected.id, showGST);
      toast.success('Guest counts updated!');
    } catch (e: any) { toast.error(e?.message || 'Failed to update guest counts'); }
  };

  const handleDeleteInvoice = async (inv: Invoice) => {
    const paid = inv.advance_paid > 0 ? ` Its recorded payments (${inr(inv.advance_paid)}) will be deleted too.` : '';
    const ok = await confirm({
      title: `Delete invoice ${inv.invoice_number}?`,
      message: `The invoice for ${inv.booking?.customer?.name ?? 'this booking'} (${inr(inv.total_amount)}) will be removed permanently.${paid}`,
      confirmLabel: 'Delete', danger: true,
    });
    if (!ok) return;
    try {
      await deleteInvoice.mutateAsync(inv.id);
      if (selectedId === inv.id) setSelectedId(null);
      toast.success('Invoice deleted');
    } catch (err: any) { toast.error(err?.message || 'Failed to delete invoice'); }
  };

  return (
    <div>
      <div className="page-topbar">
        <div style={{ fontSize: 16, fontWeight: 600 }}>Billing & Invoices</div>
        <button type="button" style={btnPrimary} onClick={() => setShowCreateForm(true)}>+ Create Invoice</button>
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

        <div className="g2-billing">
          <InvoiceList invoices={invoices} isLoading={isLoading} activeId={selected?.id} onSelect={selectInvoice} onDelete={handleDeleteInvoice} />

          {/* ── Invoice Preview ─────────────────────────────────── */}
          <div ref={previewRef}>
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
                    <input type="checkbox" checked={showGST} onChange={e => handleGSTToggle(e.target.checked)} style={{ accentColor: ORANGE }} />
                    Include GST @{dc.gst_rate ?? 18}% ({dc.gst_number})
                  </label>
                )}

                {/* ── Customer info ── */}
                <div style={box}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 5 }}>{selected.booking?.customer?.name}</div>
                  <div style={{ fontSize: 11, color: '#555552', lineHeight: 1.9 }}>
                    <div><span style={infoKey}>Event</span>{selected.booking?.event_type}</div>
                    <div><span style={infoKey}>Venue</span>{selected.booking?.venue || selected.booking?.customer?.address || '—'}</div>
                  </div>
                </div>

                {/* ── Event content: multi-day schedule or flat menu items ── */}
                {selected.is_multi_day && (selected.event_days || []).length > 0 ? (
                  <div style={{ border: '0.5px solid #E5E5E0', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
                    <div style={{ ...sectionHead, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>EVENT SCHEDULE</span>
                      <button type="button" onClick={handleApplyEventDays} disabled={updateEventDays.isPending || recalcTotals.isPending} style={outlineBtn(ORANGE)}>
                        {updateEventDays.isPending ? '...' : 'Save Guest Counts'}
                      </button>
                    </div>
                    {editableEventDays.map((day: any, di: number) => (
                      <div key={di} style={{ borderBottom: di < editableEventDays.length - 1 ? '0.5px solid #E5E5E0' : 'none' }}>
                        <div style={{ padding: '8px 12px 4px', fontWeight: 600, fontSize: 12, color: ORANGE, background: '#FFFBF5' }}>
                          Day {day.day_number} — {day.date}
                        </div>
                        {(day.meals as any[]).map((meal: any, mi: number) => (
                          <div key={mi} style={{ padding: '6px 12px', borderTop: '0.5px solid #F5F5F0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: '#333' }}>{meal.meal_type}{meal.time ? ` (${meal.time})` : ''}</span>
                              <span style={{ fontSize: 12, fontWeight: 600, color: ORANGE }}>₹{(meal.subtotal || 0).toLocaleString()}</span>
                            </div>
                            <div style={{ fontSize: 11, color: '#888880', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                              <input
                                type="number" min={1} inputMode="numeric"
                                value={meal.guest_count}
                                onChange={e => handleUpdateGuestCount(di, mi, parseInt(e.target.value) || 1)}
                                style={{ width: 64, padding: '2px 6px', borderRadius: 5, border: '0.5px solid #D0D0CC', fontSize: 12, textAlign: 'right' }}
                              />
                              <span>guests × ₹{meal.per_plate_amount}/plate</span>
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
                        <div style={sectionHead}>MENU ITEMS</div>
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
                        <div style={plateRow}>
                          <span style={{ color: '#888880' }}>Per Plate Rate</span>
                          <span style={{ fontWeight: 600 }}>₹{(selectedInvoiceQuotation?.per_plate_amount ?? 0).toLocaleString()}</span>
                        </div>
                        <div style={plateRow}>
                          <span style={{ color: '#888880' }}>Number of Guests</span>
                          <span style={{ fontWeight: 600 }}>{selected.booking?.guest_count}</span>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* ── Extra Charges (editable) ── */}
                <InvoiceChargeBox title="Extra Charges" color="#7B1FA2" items={extraChargeItems} onChange={setExtraChargeItems}
                  make={() => ({ description: '', amount: 0 })} empty="No extra charges" applyLabel="Apply Extra Charges"
                  onApply={() => applyTotals('Extra charges applied!', 'Failed to apply extra charges')} pending={recalcTotals.isPending} />

                {/* ── Discount ── */}
                <div style={{ ...box, marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: '#444440' }}>Discount</div>

                  {/* Meal savings breakdown — read-only */}
                  {selected.is_multi_day && billMealSavings > 0 && (
                    <div style={{ background: '#F2FBE9', border: '0.5px solid #B8DCA0', borderRadius: 6, padding: '7px 10px', marginBottom: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#3B6D11', marginBottom: 4, letterSpacing: '0.04em' }}>MEAL OFFER SAVINGS (AUTO)</div>
                      {(selected.event_days as any[] || []).map((day: any, di: number) =>
                        (day.meals as any[] || []).map((m: any, mi: number) => {
                          const offer = m.discount_amount || 0;
                          if (offer <= 0 || m.per_plate_amount <= offer) return null;
                          const saving = (m.per_plate_amount - offer) * m.guest_count;
                          return (
                            <div key={`${di}-${mi}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '1px 0', color: '#3B6D11' }}>
                              <span>{m.meal_type.charAt(0).toUpperCase() + m.meal_type.slice(1)} — Day {day.day_number}{day.date ? ` · ${formatDateIST(day.date, 'dd-MM')}` : ''}</span>
                              <span style={{ fontWeight: 600 }}>-₹{saving.toLocaleString('en-IN')}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* Additional manual discounts */}
                  <div style={{ marginBottom: 6 }}>
                    <InvoiceChargeList heading={<span style={{ fontSize: 10, fontWeight: 600, color: '#888880' }}>ADDITIONAL DISCOUNTS</span>}
                      color="#3B6D11" items={additionalDiscounts} onChange={setAdditionalDiscounts} placeholder="Reason"
                      make={() => ({ id: genBillingId(), description: '', amount: 0 })} empty="No additional discounts" />
                  </div>

                  <button type="button" onClick={() => applyTotals('Discount applied!', 'Failed to apply discount')} style={{ ...btnPrimary, fontSize: 12, width: '100%' }} disabled={recalcTotals.isPending}>
                    {recalcTotals.isPending ? '...' : 'Apply Discount'}
                  </button>
                  {selected.discount_amount > 0 && (
                    <div style={{ fontSize: 11, color: '#3B6D11', marginTop: 6 }}>
                      Applied: -₹{selected.discount_amount.toLocaleString('en-IN')}
                    </div>
                  )}
                </div>

                {/* ── Transportation Charges ── */}
                <InvoiceChargeBox title="Transportation Charges" color={ORANGE} items={transportItems} onChange={setTransportItems}
                  make={() => ({ description: '', amount: 0 })} empty="No transportation charges" applyLabel="Apply Transportation"
                  onApply={() => applyTotals('Transportation charge applied!', 'Failed to apply transport')} pending={recalcTotals.isPending}
                  applied={(selected.transportation_charge || 0) > 0 ? `Applied: +₹${selected.transportation_charge.toLocaleString()}` : undefined} />

                <InvoiceTotals invoice={selected} quotation={selectedInvoiceQuotation} showGST={showGST} />

                <PaymentHistory key={selected.id} payments={paymentHistory} />

                <InvoiceActions invoice={selected} quotation={selectedInvoiceQuotation} payments={paymentHistory} gstNumber={dc?.gst_number} />

                {selected.balance_due > 0 && (
                  <button type="button" style={{ ...btnGhost, width: '100%', fontSize: 12, color: ORANGE, borderColor: ORANGE }} onClick={() => setShowPaymentForm(true)}>
                    + Record payment received
                  </button>
                )}
              </div>
            ) : (
              <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888880', fontSize: 13, minHeight: 120 }}>
                Select an invoice to preview
              </div>
            )}
          </div>
        </div>
      </div>

      {showCreateForm && (
        <InvoiceCreateModal
          bookingId={intent?.action === 'new' ? intent.id : undefined}
          onClose={() => setShowCreateForm(false)}
          onCreated={id => { setSelectedId(id); setShowCreateForm(false); revealOnPhone(previewRef); }}
        />
      )}
      {showPaymentForm && selected && selected.balance_due > 0 && (
        <PaymentFormModal invoice={selected} onClose={() => setShowPaymentForm(false)} />
      )}
      {dialog}
    </div>
  );
};

const infoKey: React.CSSProperties = { color: '#AAAAAA', width: 46, display: 'inline-block' };
const sectionHead: React.CSSProperties = { padding: '7px 12px', background: '#F9F8F5', fontSize: 11, fontWeight: 600, color: '#888880', borderBottom: '0.5px solid #E5E5E0' };
const plateRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#444' };

export default Billing;
