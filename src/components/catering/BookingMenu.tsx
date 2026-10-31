import React from 'react';
import { Booking } from '../../types';
import { Quotation } from '../../hooks/useQuotations';
import { BookingView } from '../../lib/bookingBoard';
import { waNumber } from '../../lib/quoteMath';
import ActionMenu, { MenuGroups } from '../bookings/ActionMenu';
import { BOOKING_STATUSES, STATUS_HINT, STATUS_TEXT } from './BookingActions';

// Everything the Bookings screen can do to one booking; `run` performs its next step.
export interface BoardActions {
  run: (v: BookingView) => void;
  open: (b: Booking) => void;
  edit: (b: Booking) => void;
  quote: (b: Booking) => void;
  invoice: (b: Booking) => void;
  pay: (v: BookingView) => void;
  accept: (q: Quotation) => void;
  send: (q: Quotation) => void;
  menuPdf: (v: BookingView) => void;
  status: (b: Booking, s: Booking['status']) => void;
  remove: (b: Booking) => void;
  calendarHref: (b: Booking) => string;
  newOn: (iso: string) => void;
}

interface Props { view: BookingView; actions: BoardActions; size?: number; onPage?: boolean }

// The ⋯ menu's groups: open · make money move · reach the customer · status · delete.
export const bookingMenuGroups = (v: BookingView, a: BoardActions, onPage = false): MenuGroups => {
  const b = v.b;
  const phone = b.customer?.phone?.trim();
  const live = v.stage !== 'cancelled' && b.status !== 'completed';
  const statuses = BOOKING_STATUSES.map(s => ({ label: STATUS_TEXT[s], hint: STATUS_HINT[s], checked: b.status === s, danger: s === 'cancelled',
    onSelect: () => { if (b.status !== s) a.status(b, s); } }));
  return [
    [...(onPage ? [] : [{ label: 'Open event page', strong: true, onSelect: () => a.open(b) }]), { label: 'Edit details', onSelect: () => a.edit(b) }],
    [
      ...(live ? [{ label: 'Make quotation', onSelect: () => a.quote(b) }] : []),
      ...(v.stage === 'confirmed' ? [{ label: 'Create invoice', onSelect: () => a.invoice(b) }] : []),
      ...(v.invoice && Number(v.invoice.balance_due) > 0 ? [{ label: 'Record payment', onSelect: () => a.pay(v) }] : []),
    ],
    [
      ...(phone ? [{ label: 'WhatsApp', href: `https://wa.me/${waNumber(phone)}`, external: true }, { label: 'Call', href: `tel:${phone.replace(/[^\d+]/g, '')}` }] : []),
      { label: 'Add to Google Calendar', href: a.calendarHref(b), external: true },
      ...(v.quote ? [{ label: 'Kitchen menu PDF', onSelect: () => a.menuPdf(v) }] : []),
    ],
    [{ label: 'Change status', hint: `${STATUS_TEXT[b.status] ?? b.status} ›`, submenu: [statuses.slice(0, -1), statuses.slice(-1)] }],
    [{ label: 'Delete booking…', danger: true, onSelect: () => a.remove(b) }],
  ];
};

// "⋯" beside a booking, or "⋯ More" in the event page footer.
const BookingMenu: React.FC<Props> = ({ view: v, actions: a, size = 44, onPage }) => {
  const who = v.b.customer?.name ?? 'booking';
  return onPage
    ? <ActionMenu label={`Actions for ${who}`} groups={bookingMenuGroups(v, a, true)} trigger="⋯ More" triggerClass="am-text" />
    : <ActionMenu label={`Actions for ${who}`} groups={bookingMenuGroups(v, a)} trigger="⋯" triggerClass="am-trigger"
        triggerLabel={`More actions for ${who}`} triggerStyle={{ width: size, height: size }} />;
};

export default BookingMenu;
