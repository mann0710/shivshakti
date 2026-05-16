import React, { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useBookings } from '../hooks/useBookings';
import { useMenuItemsFull } from '../hooks/useMenuBuilder';
import {
  useQuotations, useCreateQuotation, useUpdateQuotationStatus, useDeleteQuotation,
  QuotationLineItem,
} from '../hooks/useQuotations';

interface SelectedItem extends QuotationLineItem {}

const STATUS_COLORS: Record<string, string> = {
  draft:    '#888880',
  sent:     '#378ADD',
  accepted: '#639922',
  rejected: '#CC4444',
};

const Quotations: React.FC = () => {
  const { data: bookings = [] } = useBookings();
  const { data: menuItems = [] } = useMenuItemsFull();
  const { data: quotations = [] } = useQuotations();
  const createQuotation = useCreateQuotation();
  const updateStatus   = useUpdateQuotationStatus();
  const deleteQuotation = useDeleteQuotation();

  const [showForm, setShowForm] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [notes, setNotes] = useState('');
  const [searchLeft, setSearchLeft] = useState('');

  // Only bookings that are not completed or cancelled
  const eligibleBookings = bookings.filter(
    b => b.status !== 'completed' && b.status !== 'cancelled',
  );

  const selectedBooking = eligibleBookings.find(b => b.id === selectedBookingId);

  // Active items only (all 3 levels must be active)
  const activeItems = menuItems.filter(
    it => it.is_active && it.subcategory?.is_active && it.subcategory?.category?.is_active,
  );

  // Left-panel items: filter by search, exclude chosen
  const leftItems = useMemo(() => {
    const chosen = new Set(selectedItems.map(i => i.item_id));
    const q = searchLeft.trim().toLowerCase();
    return activeItems.filter(
      it => !chosen.has(it.id) && (!q || it.name.toLowerCase().includes(q)
        || it.subcategory?.name.toLowerCase().includes(q)
        || it.subcategory?.category?.name.toLowerCase().includes(q)),
    );
  }, [activeItems, selectedItems, searchLeft]);

  // Group left items by category → subcategory
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

  // Group right items by category → subcategory (for display)
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

  const grandTotal = selectedItems.reduce((s, i) => s + (i.amount || 0), 0);

  const addItem = (it: typeof activeItems[0]) => {
    setSelectedItems(prev => [
      ...prev,
      {
        item_id:          it.id,
        item_name:        it.name,
        category_name:    it.subcategory?.category?.name || '',
        subcategory_name: it.subcategory?.name || '',
        amount:           0,
      },
    ]);
  };

  const removeItem = (itemId: string) =>
    setSelectedItems(prev => prev.filter(i => i.item_id !== itemId));

  const updateAmount = (itemId: string, value: string) => {
    const amount = parseFloat(value) || 0;
    setSelectedItems(prev => prev.map(i => i.item_id === itemId ? { ...i, amount } : i));
  };

  const resetForm = () => {
    setSelectedBookingId('');
    setSelectedItems([]);
    setNotes('');
    setSearchLeft('');
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!selectedBookingId && !selectedBooking) {
      toast.error('Please select a booking or customer');
      return;
    }
    if (selectedItems.length === 0) {
      toast.error('Please add at least one item');
      return;
    }
    try {
      await createQuotation.mutateAsync({
        customer_id:  selectedBooking?.customer_id || '',
        booking_id:   selectedBookingId || undefined,
        items:        selectedItems,
        total_amount: grandTotal,
        notes:        notes || undefined,
        status:       'draft',
      });
      toast.success('Quotation saved');
      resetForm();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save quotation');
    }
  };

  const handleDeleteQuotation = async (id: string, num: string) => {
    if (!window.confirm(`Delete quotation ${num}?`)) return;
    try {
      await deleteQuotation.mutateAsync(id);
      toast.success('Quotation deleted');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete');
    }
  };

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Quotations</h2>
          <div style={{ fontSize: 12, color: '#888880', marginTop: 2 }}>{quotations.length} quotation{quotations.length !== 1 ? 's' : ''}</div>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            style={{ background: '#E8750A', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            + New Quotation
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #E5E5E0', marginBottom: 24, overflow: 'hidden' }}>
          {/* Form header */}
          <div style={{ padding: '14px 20px', borderBottom: '0.5px solid #E5E5E0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>New Quotation</div>
            <button onClick={resetForm} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888880' }}>×</button>
          </div>

          <div style={{ padding: '16px 20px' }}>
            {/* Booking selector */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#888880', display: 'block', marginBottom: 4 }}>SELECT BOOKING</label>
              <select
                value={selectedBookingId}
                onChange={e => setSelectedBookingId(e.target.value)}
                style={{ width: '100%', maxWidth: 420, border: '1px solid #E5E5E0', borderRadius: 8, padding: '8px 10px', fontSize: 13 }}
              >
                <option value="">— Choose a booking —</option>
                {eligibleBookings.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.customer?.name} · {b.event_type} · {b.event_date}
                  </option>
                ))}
              </select>
            </div>

            {/* Booking summary card */}
            {selectedBooking && (
              <div style={{ background: '#F9F8F5', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#444', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 6 }}>
                <div><span style={{ color: '#888880' }}>Customer: </span>{selectedBooking.customer?.name}</div>
                <div><span style={{ color: '#888880' }}>Event: </span>{selectedBooking.event_type}</div>
                <div><span style={{ color: '#888880' }}>Date: </span>{selectedBooking.event_date}</div>
                {selectedBooking.venue && <div><span style={{ color: '#888880' }}>Venue: </span>{selectedBooking.venue}</div>}
                {selectedBooking.guest_count > 0 && <div><span style={{ color: '#888880' }}>Guests: </span>{selectedBooking.guest_count}</div>}
              </div>
            )}

            {/* Two-panel item selector */}
            <div className="quotation-panels">
              {/* LEFT — available items */}
              <div style={{ border: '0.5px solid #E5E5E0', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '8px 12px', borderBottom: '0.5px solid #E5E5E0', background: '#F9F8F5' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#444', marginBottom: 6 }}>AVAILABLE ITEMS</div>
                  <input
                    placeholder="Search items…"
                    value={searchLeft}
                    onChange={e => setSearchLeft(e.target.value)}
                    style={{ width: '100%', border: '1px solid #E5E5E0', borderRadius: 6, padding: '5px 8px', fontSize: 12, boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ flex: 1, overflowY: 'auto', maxHeight: 340, padding: '8px 0' }}>
                  {Object.keys(groupedLeft).length === 0 ? (
                    <div style={{ padding: '20px 12px', textAlign: 'center', color: '#AAAAAA', fontSize: 12 }}>
                      {activeItems.length === 0 ? 'No active menu items found' : 'All items selected'}
                    </div>
                  ) : (
                    Object.entries(groupedLeft).map(([cat, subs]) => (
                      <div key={cat}>
                        <div style={{ padding: '6px 12px 2px', fontSize: 10, fontWeight: 700, color: '#E8750A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{cat}</div>
                        {subs.map(sg => (
                          <div key={sg.subcategory}>
                            <div style={{ padding: '4px 12px 2px 18px', fontSize: 10, fontWeight: 600, color: '#888880', textTransform: 'uppercase' }}>{sg.subcategory}</div>
                            {sg.items.map(it => (
                              <div
                                key={it.id}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 12px 5px 24px', cursor: 'pointer' }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#F5F5F0')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                              >
                                <span style={{ fontSize: 13 }}>{it.name}</span>
                                <button
                                  onClick={() => addItem(it)}
                                  style={{ background: '#E8750A', color: '#fff', border: 'none', borderRadius: 5, width: 22, height: 22, fontSize: 14, lineHeight: '1', cursor: 'pointer', flexShrink: 0 }}
                                  title="Add to quotation"
                                >+</button>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* RIGHT — selected items */}
              <div style={{ border: '0.5px solid #E5E5E0', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '10px 12px', borderBottom: '0.5px solid #E5E5E0', background: '#F9F8F5', fontSize: 12, fontWeight: 600, color: '#444' }}>
                  SELECTED ITEMS
                </div>
                <div style={{ flex: 1, overflowY: 'auto', maxHeight: 340, padding: '8px 0' }}>
                  {selectedItems.length === 0 ? (
                    <div style={{ padding: '40px 12px', textAlign: 'center', color: '#AAAAAA', fontSize: 12 }}>
                      Click + on the left to add items
                    </div>
                  ) : (
                    Object.entries(groupedRight).map(([cat, subs]) => (
                      <div key={cat}>
                        <div style={{ padding: '6px 12px 2px', fontSize: 10, fontWeight: 700, color: '#E8750A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{cat}</div>
                        {subs.map(sg => (
                          <div key={sg.subcategory}>
                            <div style={{ padding: '4px 12px 2px 18px', fontSize: 10, fontWeight: 600, color: '#888880', textTransform: 'uppercase' }}>{sg.subcategory}</div>
                            {sg.items.map(it => (
                              <div key={it.item_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px 5px 24px' }}>
                                <span style={{ fontSize: 13, flex: 1 }}>{it.item_name}</span>
                                <span style={{ fontSize: 12, color: '#888880' }}>₹</span>
                                <input
                                  type="number"
                                  min="0"
                                  value={it.amount || ''}
                                  onChange={e => updateAmount(it.item_id, e.target.value)}
                                  placeholder="0"
                                  style={{ width: 80, border: '1px solid #E5E5E0', borderRadius: 6, padding: '4px 6px', fontSize: 13, textAlign: 'right' }}
                                />
                                <button
                                  onClick={() => removeItem(it.item_id)}
                                  style={{ background: 'none', border: 'none', color: '#CC4444', fontSize: 16, cursor: 'pointer', padding: '0 2px', flexShrink: 0 }}
                                  title="Remove"
                                >×</button>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    ))
                  )}
                </div>
                {/* Grand total */}
                <div style={{ borderTop: '0.5px solid #E5E5E0', padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F9F8F5' }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>Grand Total</span>
                  <span style={{ fontWeight: 700, fontSize: 16, color: '#E8750A' }}>
                    ₹{grandTotal.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div style={{ marginTop: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#888880', display: 'block', marginBottom: 4 }}>NOTES (OPTIONAL)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Add any notes for the customer…"
                style={{ width: '100%', border: '1px solid #E5E5E0', borderRadius: 8, padding: '8px 10px', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>

            {/* Actions */}
            <div style={{ marginTop: 14, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={resetForm}
                style={{ border: '1px solid #E5E5E0', background: '#fff', borderRadius: 8, padding: '8px 18px', fontSize: 13, cursor: 'pointer' }}
              >Cancel</button>
              <button
                onClick={handleSave}
                disabled={createQuotation.isPending}
                style={{ background: '#E8750A', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: createQuotation.isPending ? 0.6 : 1 }}
              >
                {createQuotation.isPending ? 'Saving…' : 'Save Quotation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quotations list */}
      {quotations.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #E5E5E0', padding: '48px 24px', textAlign: 'center', color: '#AAAAAA' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📝</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>No quotations yet</div>
          <div style={{ fontSize: 12 }}>Create your first quotation using the button above</div>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #E5E5E0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F9F8F5', borderBottom: '0.5px solid #E5E5E0' }}>
                {['Quotation #', 'Customer', 'Event', 'Items', 'Total', 'Status', 'Date', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#888880', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quotations.map((q, i) => (
                <tr key={q.id} style={{ borderBottom: i < quotations.length - 1 ? '0.5px solid #F0F0EA' : 'none' }}>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: '#E8750A' }}>{q.quotation_number}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13 }}>{q.customer?.name || '—'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#666' }}>
                    {q.booking ? `${q.booking.event_type} · ${q.booking.event_date}` : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: '#444' }}>{(q.items || []).length} item{q.items?.length !== 1 ? 's' : ''}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600 }}>₹{(q.total_amount || 0).toLocaleString('en-IN')}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <select
                      value={q.status}
                      onChange={async e => {
                        try {
                          await updateStatus.mutateAsync({ id: q.id, status: e.target.value });
                          toast.success('Status updated');
                        } catch { toast.error('Failed to update'); }
                      }}
                      style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 600, color: STATUS_COLORS[q.status] || '#888880', cursor: 'pointer', padding: 0 }}
                    >
                      {['draft', 'sent', 'accepted', 'rejected'].map(s => (
                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#888880' }}>{q.issue_date}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <button
                      onClick={() => handleDeleteQuotation(q.id, q.quotation_number)}
                      style={{ background: 'none', border: 'none', color: '#CC4444', fontSize: 14, cursor: 'pointer', padding: '2px 6px' }}
                      title="Delete quotation"
                    >×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Quotations;
