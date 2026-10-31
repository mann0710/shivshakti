import React, { useState } from 'react';
import { format } from 'date-fns';
import { Booking } from '../../types';
import { inr } from '../../lib/money';
import { waNumber } from '../../lib/quoteMath';
import { formatPhone, initials, savedTwiceReason } from '../../lib/people';
import { HistoryItem, byMonth, dayLabel } from '../../lib/personHistory';
import { todayIST } from '../../lib/ist';
import { PersonRow } from '../people/usePeople';
import { Tags } from '../people/PeopleList';
import DotsMenu, { DotsItem } from '../people/DotsMenu';

interface Props {
  p: PersonRow;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCombine: () => void;
  onNewBooking: () => void;
  onSweetsBill: () => void;
  onMarkCompleted: (b: Booking) => void;
  onOpen: (h: HistoryItem) => void;
}

type Side = 'all' | 'catering' | 'sweets';
const SIDES: { id: Side; label: string }[] = [{ id: 'all', label: 'All' }, { id: 'catering', label: 'Catering' }, { id: 'sweets', label: 'Sweets' }];

// WhatsApp text listing what is still due.
const statement = (p: PersonRow) => [
  `Namaste ${p.name},`, 'Here is what is still due with Shiv Shakti:',
  ...p.s.history.filter(h => h.due > 0).map(h => `• ${h.title}, ${dayLabel(h.date, todayIST())}: ${inr(h.due)}`),
  `Total due: ${inr(p.s.owes)}`,
].join('\n');

// One person: contact, quick actions, money tiles and history across catering and sweets.
const CustomerDetail: React.FC<Props> = ({ p, onBack, onEdit, onDelete, onCombine, onNewBooking, onSweetsBill, onMarkCompleted, onOpen }) => {
  const [side, setSide] = useState<Side>('all');
  const today = todayIST();
  const phone = p.phone.replace(/[^\d+]/g, '');
  const wa = phone ? `https://wa.me/${waNumber(phone)}` : '';
  const since = p.since ? format(new Date(p.since), 'MMM yyyy') : '';
  const stale = p.s.stale[0];
  const items = p.s.history.filter(h => side === 'all' || h.side === side);

  const menu: DotsItem[] = [
    ...(wa ? [{ label: 'WhatsApp', href: wa, strong: true }, { label: 'Call', href: `tel:${phone}` }] : []),
    { label: 'New booking', onClick: onNewBooking, sep: !!wa },
    { label: 'Sweets bill', onClick: onSweetsBill },
    ...(wa && p.s.owes > 0 ? [{ label: 'Share statement', href: `${wa}?text=${encodeURIComponent(statement(p))}` }] : []),
    { label: 'Edit details', onClick: onEdit, sep: true },
    ...(p.twice ? [{ label: 'Combine with…', onClick: onCombine }] : []),
    { label: 'Delete…', onClick: onDelete, danger: true, sep: true },
  ];

  const tiles = [
    { label: 'Catering', value: inr(p.s.catering), note: p.s.cateringNote },
    { label: 'Sweets', value: inr(p.s.sweets), note: p.s.sweetsNote },
    p.s.owes > 0
      ? { label: 'Owes', value: inr(p.s.owes), note: p.s.owesNote, red: true }
      : { label: 'Not invoiced', value: inr(p.s.notInvoiced), note: p.s.notInvoicedNote },
    {
      label: 'Last seen', value: p.s.lastSeen ? dayLabel(p.s.lastSeen, today) : '—',
      note: p.s.next ? `Next: ${p.s.next.title.split(' · ')[0]} ${dayLabel(p.s.next.date, today)}` : 'No upcoming event',
    },
  ];

  return (
    <section className="pp-detail" aria-label={p.name}>
      <button type="button" className="pp-back" onClick={onBack}>‹ Customers</button>
      <div className="pp-card">
        <div className="pp-who">
          <span className="pp-av big" aria-hidden="true">{initials(p.name)}</span>
          <div className="pp-who-main">
            <h2>{p.name}</h2>
            <span>{[p.phone ? formatPhone(p.phone) : 'No phone saved', since && `customer since ${since}`].filter(Boolean).join(' · ')}</span>
            <Tags sides={p.s.sides} />
          </div>
          <div className="pp-acts">
            {phone && <a className="ui-btn" href={`tel:${phone}`}>Call</a>}
            {wa && <a className="ui-btn pp-wa" href={wa} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
            <button type="button" className="ui-btn primary" aria-label="New booking" onClick={onNewBooking}>+ <span className="pp-wide">New booking</span><span className="pp-narrow">Booking</span></button>
            <button type="button" className="ui-btn pp-outline" onClick={onSweetsBill}>+ Sweets bill</button>
            <DotsMenu label={`More actions for ${p.name}`} items={menu} />
          </div>
        </div>
        <div className="pp-tiles">
          {tiles.map(t => (
            <div key={t.label} className={`pp-tile${'red' in t ? ' red' : ''}`}><small>{t.label}</small><b>{t.value}</b><span>{t.note}</span></div>
          ))}
        </div>
        {stale && (
          <div className="pp-banner">
            <span>The {stale.event_type.toLowerCase()} on {dayLabel(stale.event_date, today)} is still marked Confirmed.{p.s.stale.length > 1 ? ` ${p.s.stale.length - 1} more past event${p.s.stale.length > 2 ? 's are' : ' is'} too.` : ''}</span>
            <button type="button" className="ui-btn" onClick={() => onMarkCompleted(stale)}>Mark completed</button>
          </div>
        )}
        {p.twice && (
          <div className="pp-banner phone-only">
            <span>Saved twice ({savedTwiceReason(p)}). Combine into one?</span>
            <button type="button" className="ui-btn" onClick={onCombine}>Combine</button>
          </div>
        )}
        {p.notes && <div className="pp-notes">{p.notes}</div>}
      </div>

      <div className="pp-card">
        <div className="pp-hist-head">
          <h3>History</h3>
          <div role="tablist" aria-label="History" className="pp-seg">
            {SIDES.map(s => <button key={s.id} type="button" role="tab" aria-selected={side === s.id} onClick={() => setSide(s.id)}>{s.label}</button>)}
          </div>
        </div>
        {!items.length && <div className="pp-empty">{side === 'all' ? 'No bookings or sweets bills yet.' : `No ${side} history yet.`}</div>}
        {byMonth(items).map(m => (
          <React.Fragment key={m.month}>
            <span className="pp-month">{m.month}</span>
            {m.items.map(h => (
              <button key={h.id} type="button" className="pp-hrow" onClick={() => onOpen(h)} title={h.side === 'catering' ? 'Open in Bookings' : 'Open the sweets counter'}>
                <span className="pp-hdate">{dayLabel(h.date, today)}</span>
                <span className={`pp-hdot ${h.side}`} aria-hidden="true" />
                <span className="pp-hmain"><b>{h.title}</b><span>{h.line}</span></span>
                <span className="pp-hside"><b>{inr(h.amount)}</b><span className={`pp-stat ${h.tone}`}>{h.status}</span></span>
              </button>
            ))}
          </React.Fragment>
        ))}
      </div>
    </section>
  );
};

export default CustomerDetail;
