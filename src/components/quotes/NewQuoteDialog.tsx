import React, { useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import type { Booking } from '../../types';
import type { Quotation } from '../../hooks/useQuotations';
import { bookingsToQuote } from '../../lib/quoteBoard';
import { formatDateIST, todayIST } from '../../lib/ist';
import { fmtTime } from '../catering/BookingCalendar';
import { PickCard } from './bits';

interface Props {
  bookings: Booking[];
  quotes: Quotation[];
  onClose: () => void;
  onStart: (b: Booking) => void;
  onOpen: (q: Quotation) => void;
  onNewEvent: () => void;
}

const NEW = '__new';

// "+ New quotation": a booking that has no sent quote yet, or a brand-new event.
const NewQuoteDialog: React.FC<Props> = ({ bookings, quotes, onClose, onStart, onOpen, onNewEvent }) => {
  const list = useMemo(() => bookingsToQuote(bookings, quotes, todayIST()), [bookings, quotes]);
  const [pick, setPick] = useState(list[0]?.booking.id ?? NEW);
  const chosen = list.find(x => x.booking.id === pick);
  const first = String(chosen?.booking.customer?.name || '').trim().split(/\s+/)[0];
  const go = () => (!chosen ? onNewEvent() : chosen.draft ? onOpen(chosen.draft) : onStart(chosen.booking));
  const line = (b: Booking, draft?: Quotation) => [formatDateIST(b.event_date, 'EEE d MMM'), fmtTime(b.event_time),
    b.guest_count > 0 ? `${b.guest_count} guests` : '', draft ? `has a draft: ${draft.quotation_number}` : 'no quote yet'].filter(Boolean).join(' · ');

  return (
    <Modal title="New quotation" onClose={onClose} width={560}
      footer={<>
        <button type="button" className="ui-btn" onClick={onClose}>Cancel</button>
        <button type="button" className="ui-btn primary" onClick={go}>{!chosen ? 'Start a new event' : chosen.draft ? 'Open draft' : `Start for ${first || 'this booking'}`}</button>
      </>}>
      <p className="q-dlg-sub">For a booking you have, or start a new event here.</p>
      {list.length > 0 && <>
        <div className="q-h">Bookings without a sent quote</div>
        <div className="q-cards q-scroll" role="radiogroup" aria-label="Bookings without a sent quote">
          {list.map(({ booking: b, draft }) => (
            <PickCard key={b.id} on={pick === b.id} title={`${b.customer?.name ?? 'Customer'} · ${b.event_type}`} line={line(b, draft)}
              right={draft ? 'Open draft' : undefined} onClick={() => setPick(b.id)} />
          ))}
        </div>
        <div className="q-h">Or</div>
      </>}
      <div className="q-cards" role="radiogroup" aria-label="New event">
        <PickCard on={pick === NEW} title="A new event" line="Customer, date and guests here; the booking is made for you" onClick={() => setPick(NEW)} />
      </div>
    </Modal>
  );
};

export default NewQuoteDialog;
