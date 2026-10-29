import React from 'react';
import toast from 'react-hot-toast';
import { Booking } from '../../types';

const EVENT_HOURS = 4;

const ymd = (d: string) => d.slice(0, 10).replace(/-/g, '');
const addDays = (d: string, n: number) => {
  const t = new Date(`${d.slice(0, 10)}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};
// Wall-clock stamp in Google's YYYYMMDDTHHMMSS format (zone comes from ctz).
const stamp = (d: string, time: string, plusHours = 0) => {
  const t = new Date(`${d.slice(0, 10)}T${time.slice(0, 5)}:00Z`);
  t.setUTCHours(t.getUTCHours() + plusHours);
  return t.toISOString().replace(/[-:]/g, '').slice(0, 15);
};

// "18:30:00" → "6:30 PM"
export const fmtTime = (t?: string | null) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h)) return t;
  return `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

export function calendarUrl(b: Booking, teamEmails: string[] = []): string {
  const last = b.end_date && b.end_date > b.event_date ? b.end_date : b.event_date;
  const dates = b.event_time
    ? `${stamp(b.event_date, b.event_time)}/${stamp(last, b.event_time, EVENT_HOURS)}`
    : `${ymd(b.event_date)}/${ymd(addDays(last, 1))}`;
  const name = b.customer?.name ?? 'Customer';
  const details = [
    `Event: ${b.event_type}`, `Customer: ${name}`,
    b.customer?.phone && `Phone: ${b.customer.phone}`,
    b.venue && `Venue: ${b.venue}`, `Guests: ${b.guest_count}`,
  ].filter(Boolean).join('\n');
  const emails = [b.customer?.email, ...teamEmails].filter(Boolean) as string[];
  const p = new URLSearchParams({ action: 'TEMPLATE', text: `${b.event_type} – ${name}`, dates, details, ctz: 'Asia/Kolkata' });
  if (b.venue) p.set('location', b.venue);
  if (emails.length) p.set('add', emails.join(','));
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

// Opened from a real tap on a link, so phones don't block it as a popup.
export function promptCalendar(b: Booking, teamEmails: string[]) {
  toast(t => (
    <span style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13 }}>
      <span>✅ {b.customer?.name ?? 'Booking'} confirmed</span>
      <a href={calendarUrl(b, teamEmails)} target="_blank" rel="noopener noreferrer"
        onClick={() => toast.dismiss(t.id)}
        style={{ background: '#E8750A', color: '#fff', padding: '5px 10px', borderRadius: 7, textDecoration: 'none', fontWeight: 500, fontSize: 12 }}>
        📅 Add to Google Calendar
      </a>
    </span>
  ), { duration: 12000 });
}
