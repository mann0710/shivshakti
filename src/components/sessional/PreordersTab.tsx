import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  SeasonalPreorder, useUpdateSeasonalPreorder, useUpdateSeasonalPreorderStatus, useDeleteSeasonalPreorder,
} from '../../hooks/useSeasonalPreorders';
import { SeasonalOccasion } from '../../hooks/useSeasonalOccasions';
import { preorderReceipt, printReceipt, shareReceipt, formatDay } from '../../lib/sessionalReceipts';
import { formatLineSize } from '../../lib/units';
import { inr, cleanPhone } from '../../lib/money';
import { todayIST } from '../../lib/ist';
import Modal from '../ui/Modal';
import { useConfirm } from '../ui/ConfirmDialog';
import PrepList from './PrepList';
import { card, btnSm, btnGhost, btnPrimary, inp, lbl, empty, pill, segBtn, segWrap, PRE_STATUS, NAVY, DANGER } from '../ui/styles';

interface Props {
  preorders: SeasonalPreorder[];
  occasions: SeasonalOccasion[];
  gst?: string;
  onEdit: (p: SeasonalPreorder) => void;
}

type Show = 'open' | 'due' | 'done' | 'all';
const isOpen = (p: SeasonalPreorder) => p.status === 'pending' || p.status === 'confirmed';
const balanceOf = (p: SeasonalPreorder) => Math.max(0, p.total_amount - p.advance_paid);

// Pre-bookings by status with delivery-day focus, completion with balance collection and a prep list.
const PreordersTab: React.FC<Props> = ({ preorders, occasions, gst, onEdit }) => {
  const update = useUpdateSeasonalPreorder();
  const setStatus = useUpdateSeasonalPreorderStatus();
  const del = useDeleteSeasonalPreorder();
  const { confirm, dialog } = useConfirm();
  const [show, setShow] = useState<Show>('open');
  const [q, setQ] = useState('');
  const [completing, setCompleting] = useState<SeasonalPreorder | null>(null);
  const [amount, setAmount] = useState('');
  const today = todayIST();
  const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const occName = (id?: string) => occasions.find(o => o.id === id)?.name;

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const digits = cleanPhone(q);
    return preorders
      .filter(p => show === 'all' ? true : show === 'done' ? !isOpen(p)
        : show === 'due' ? isOpen(p) && !!p.delivery_date && p.delivery_date <= tomorrow : isOpen(p))
      .filter(p => !term || p.customer_name.toLowerCase().includes(term) || (digits.length >= 3 && (p.phone ?? '').includes(digits)))
      .sort((a, b) => (a.delivery_date || '9').localeCompare(b.delivery_date || '9'));
  }, [preorders, show, q, tomorrow]);

  const dueCount = preorders.filter(p => isOpen(p) && p.delivery_date && p.delivery_date <= tomorrow).length;
  const receipt = (p: SeasonalPreorder) => preorderReceipt(p, occName(p.occasion_id), gst);

  const changeStatus = async (p: SeasonalPreorder, status: SeasonalPreorder['status']) => {
    if (status === 'cancelled' && !(await confirm({ title: 'Cancel pre-booking?', message: `${p.customer_name}'s booking of ${inr(p.total_amount)} will be marked cancelled.`, confirmLabel: 'Cancel booking', danger: true }))) return;
    try { await setStatus.mutateAsync({ id: p.id, status }); toast.success(`Marked ${status}`); } catch (e: any) { toast.error(e.message); }
  };

  const remove = async (p: SeasonalPreorder) => {
    if (!(await confirm({ title: 'Delete pre-booking?', message: `${p.customer_name} (${inr(p.total_amount)}) will be removed permanently.`, confirmLabel: 'Delete', danger: true }))) return;
    try { await del.mutateAsync(p.id); toast.success('Deleted'); } catch (e: any) { toast.error(e.message); }
  };

  const complete = async (mode: 'cash' | 'upi') => {
    if (!completing) return;
    const received = Math.max(0, Number(amount) || 0);
    try {
      await update.mutateAsync({ id: completing.id, status: 'delivered', advance_paid: completing.advance_paid + received, payment_mode: received > 0 ? mode : completing.payment_mode });
      toast.success('Delivered');
      setCompleting(null);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div>
      <PrepList preorders={preorders} />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ ...segWrap, minWidth: 300 }}>
          {([['open', 'Open'], ['due', `Due by tomorrow (${dueCount})`], ['done', 'Done'], ['all', 'All']] as [Show, string][]).map(([k, label]) => (
            <button key={k} type="button" style={segBtn(show === k)} onClick={() => setShow(k)}>{label}</button>
          ))}
        </div>
        <input style={{ ...inp, flex: '1 1 200px', width: 'auto' }} value={q} onChange={e => setQ(e.target.value)} placeholder="Search name or mobile" />
      </div>

      {shown.length === 0 ? <div style={empty}>No pre-bookings here.</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {shown.map(p => {
            const late = isOpen(p) && p.delivery_date && p.delivery_date < today;
            return (
              <div key={p.id} style={{ ...card, padding: 14, marginBottom: 0, borderColor: late ? '#F5B7B1' : '#E5E5E0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{p.customer_name}</div>
                    <div style={{ fontSize: 11, color: '#888880' }}>{[p.phone, p.address].filter(Boolean).join(' · ')}</div>
                    {p.delivery_date && (
                      <div style={{ fontSize: 12, fontWeight: 600, marginTop: 3, color: late ? DANGER : '#E65100' }}>
                        {late ? '⚠ Overdue · ' : '🚚 '}{p.delivery_date === today ? 'Today' : p.delivery_date === tomorrow ? 'Tomorrow' : formatDay(p.delivery_date)}
                      </div>
                    )}
                    {occName(p.occasion_id) && <span style={{ ...pill('#EEF0FB', NAVY), marginTop: 4 }}>{occName(p.occasion_id)}</span>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>{inr(p.total_amount)}</div>
                    {p.advance_paid > 0 && <div style={{ fontSize: 11, color: '#3B6D11' }}>Advance {inr(p.advance_paid)}</div>}
                    {balanceOf(p) > 0 && <div style={{ fontSize: 11, color: '#E65100' }}>Balance {inr(balanceOf(p))}</div>}
                    <span style={{ ...pill(PRE_STATUS[p.status]?.bg ?? '#F5F5F0', PRE_STATUS[p.status]?.color ?? '#555'), marginTop: 4, textTransform: 'capitalize' }}>{p.status}</span>
                  </div>
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: '#555', lineHeight: 1.6 }}>
                  {p.items.map((it, i) => <span key={i} style={{ marginRight: 10 }}>{it.item_name} ({formatLineSize(it.weight, it.weight_unit)}) ×{it.qty}</span>)}
                </div>
                {p.notes && <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>📝 {p.notes}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  {p.status === 'pending' && <button style={{ ...btnSm, color: '#1565C0' }} onClick={() => changeStatus(p, 'confirmed')}>Confirm</button>}
                  {isOpen(p) && <button style={{ ...btnSm, color: '#2E7D32', background: '#E8F5E9' }} onClick={() => { setCompleting(p); setAmount(String(balanceOf(p))); }}>Deliver & collect</button>}
                  <button style={btnSm} onClick={() => printReceipt(receipt(p))}>🖨 Print</button>
                  {p.phone && <button style={{ ...btnSm, color: '#128C7E' }} onClick={() => shareReceipt(receipt(p))}>WhatsApp</button>}
                  {isOpen(p) && <button style={btnSm} onClick={() => onEdit(p)}>Edit</button>}
                  {isOpen(p) && <button style={{ ...btnSm, color: '#888880' }} onClick={() => changeStatus(p, 'cancelled')}>Cancel</button>}
                  <button style={{ ...btnSm, color: DANGER }} onClick={() => remove(p)}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {completing && (
        <Modal title={`Deliver to ${completing.customer_name}`} onClose={() => setCompleting(null)} width={380}
          footer={<button style={btnGhost} onClick={() => setCompleting(null)}>Cancel</button>}>
          <div style={{ fontSize: 13, marginBottom: 10 }}>Balance due: <b>{inr(balanceOf(completing))}</b></div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
            <span style={lbl}>Amount received now (₹)</span>
            <input style={inp} inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} autoFocus />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ ...btnPrimary, flex: 1, height: 46 }} onClick={() => complete('cash')}>Paid by Cash</button>
            <button style={{ ...btnPrimary, flex: 1, height: 46 }} onClick={() => complete('upi')}>Paid by UPI</button>
          </div>
        </Modal>
      )}
      {dialog}
    </div>
  );
};

export default PreordersTab;
