import React from 'react';
import StatusPill from '../StatusPill';
import { Booking, Customer } from '../../types';
import { Navigate } from '../../hooks/useNavIntent';
import { formatDateIST } from '../../lib/ist';
import { waNumber } from '../../lib/quoteMath';
import { inr } from '../../lib/money';
import { Avatar, ORANGE, btnGhost, btnPrimary, card } from './CustomerUi';

interface Props {
  customer: Customer;
  bookings: Booking[];
  onEdit: () => void;
  onDelete: () => void;
  onBack: () => void;
  onNavigate: Navigate;
}

// Contact, quick actions, stats and booking history for one customer.
const CustomerDetail: React.FC<Props> = ({ customer, bookings, onEdit, onDelete, onBack, onNavigate }) => {
  const live = bookings.filter(b => b.status !== 'cancelled');
  const bookedValue = live.reduce((s, b) => s + (b.estimated_cost || 0), 0);
  const lastEvent = live.reduce<string | undefined>((d, b) => (!d || b.event_date > d ? b.event_date : d), undefined);
  const history = [...bookings].sort((a, b) => b.event_date.localeCompare(a.event_date));
  const phone = customer.phone?.trim();
  const contact = [customer.phone, customer.email, customer.address].filter(Boolean).join(' · ');

  return (
    <div>
      <button type="button" className="only-mobile" style={backBtn} onClick={onBack}>↑ All customers</button>
      <div style={{ ...card, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
          <Avatar name={customer.name} size={52} />
          <div style={{ flex: '1 1 160px', minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 600 }}>{customer.name}</div>
            <div style={{ fontSize: 12, color: '#888880', marginTop: 2, wordBreak: 'break-word' }}>{contact || 'No contact details'}</div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button type="button" style={btnGhost} onClick={onEdit}>✏ Edit</button>
            <button type="button" style={{ ...btnGhost, color: '#CC4444', borderColor: '#CC4444' }} onClick={onDelete}>Delete</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {phone && <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} style={actionLink}>📞 Call</a>}
          {phone && (
            <a href={`https://wa.me/${waNumber(phone)}`} target="_blank" rel="noopener noreferrer" style={{ ...actionLink, color: '#128C7E', borderColor: '#128C7E' }}>
              💬 WhatsApp
            </a>
          )}
          <button type="button" style={btnPrimary} onClick={() => onNavigate('bookings', { action: 'new', id: customer.id })}>+ New booking</button>
        </div>

        <div className="g3" style={{ marginBottom: 0 }}>
          <div style={statCard}><div style={statLabel}>Total bookings</div><div style={statVal}>{bookings.length}</div></div>
          <div style={statCard}><div style={statLabel}>Booked value</div><div style={statVal}>{inr(bookedValue)}</div></div>
          <div style={statCard}><div style={statLabel}>Last event</div><div style={statVal}>{lastEvent ? formatDateIST(lastEvent, 'dd-MM-yyyy') : '—'}</div></div>
        </div>
        {customer.notes && <div style={{ marginTop: 12, fontSize: 12, color: '#888880', background: '#FAFAF8', padding: '8px 12px', borderRadius: 8 }}>📝 {customer.notes}</div>}
      </div>

      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 14px', borderBottom: '0.5px solid #E5E5E0', fontSize: 13, fontWeight: 600 }}>Booking history</div>
        {history.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#888880', fontSize: 12 }}>No bookings yet for this customer</div>
        ) : history.map(b => (
          <button key={b.id} type="button" title="Open in Bookings" style={{ ...historyRow, opacity: b.status === 'cancelled' ? 0.6 : 1 }}
            onClick={() => onNavigate('bookings', { action: 'open', id: b.id })}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{b.event_type}</div>
              <div style={{ fontSize: 11, color: '#888880', marginTop: 2 }}>
                {[formatDateIST(b.event_date, 'dd-MM-yyyy'), b.venue, `${b.guest_count} guests`].filter(Boolean).join(' · ')}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 3 }}>{inr(b.estimated_cost)}</div>
              <StatusPill status={b.status} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

const actionLink: React.CSSProperties = { ...btnGhost, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, color: '#1A1A18' };
const backBtn: React.CSSProperties = { background: 'none', border: 'none', color: ORANGE, fontSize: 13, fontWeight: 500, cursor: 'pointer', padding: '0 0 10px' };
const historyRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: '0.5px solid #F0F0EC', cursor: 'pointer', textAlign: 'left', color: 'inherit' };
const statCard: React.CSSProperties = { background: '#FAFAF8', borderRadius: 8, padding: '10px 12px' };
const statLabel: React.CSSProperties = { fontSize: 11, color: '#888880', marginBottom: 4 };
const statVal: React.CSSProperties = { fontSize: 18, fontWeight: 600 };

export default CustomerDetail;
