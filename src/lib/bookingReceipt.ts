import { fill } from './fillText';
import { inr } from './money';
import { formatDateIST } from './ist';

// WhatsApp receipt for money on a catering booking, in English or Hindi. Hindi comes from a translation pass; edit there, not by hand.

export type ReceiptLang = 'en' | 'hi';
type Key = 'greeting' | 'received' | 'kind_advance' | 'kind_payment' | 'refunded' | 'totals' | 'paid_full' | 'thanks'
  | 'mode_cash' | 'mode_upi' | 'mode_bank_transfer' | 'mode_cheque';

const TEXT: Record<ReceiptLang, Record<Key, string>> = {
  en: {
    greeting: 'Namaste {name} ji,',
    received: 'Received {amount} by {mode} on {date} as {kind} for your {event} on {eventDate}.',
    kind_advance: 'advance',
    kind_payment: 'payment',
    refunded: 'Returned {amount} by {mode} on {date} for your {event} on {eventDate}.',
    totals: 'Total {total} · received {received} · balance due {due}.',
    paid_full: 'Total {total} is now paid in full.',
    thanks: 'Thank you! {shop}',
    mode_cash: 'cash', mode_upi: 'UPI', mode_bank_transfer: 'bank transfer', mode_cheque: 'cheque',
  },
  hi: {
    greeting: 'नमस्ते {name} जी,',
    received: '{date} को {mode} से {amount} मिले, आपके {eventDate} वाले {event} के लिए {kind} के रूप में।',
    kind_advance: 'एडवांस',
    kind_payment: 'भुगतान',
    refunded: '{date} को {mode} से {amount} वापस किए गए, आपके {eventDate} वाले {event} के लिए।',
    totals: 'कुल {total} · प्राप्त {received} · बकाया {due}।',
    paid_full: 'कुल {total} का पूरा भुगतान हो चुका है।',
    thanks: 'धन्यवाद! {shop}',
    mode_cash: 'नकद', mode_upi: 'UPI', mode_bank_transfer: 'बैंक ट्रांसफर', mode_cheque: 'चेक',
  },
};

export interface ReceiptInfo {
  name: string; amount: number; mode: string; day: string; advance: boolean;
  event: string; eventDate: string; total: number; received: number; shop: string;
}

export function bookingReceipt(lang: ReceiptLang, r: ReceiptInfo): string {
  const t = TEXT[lang];
  const mode = t[`mode_${r.mode}` as Key] ?? r.mode;
  const v = {
    name: r.name.split(/\s+/)[0] || r.name, amount: inr(Math.abs(r.amount)), mode, date: formatDateIST(r.day, 'd MMM'),
    kind: r.advance ? t.kind_advance : t.kind_payment, event: r.event, eventDate: formatDateIST(r.eventDate, 'd MMM'),
    total: inr(r.total), received: inr(r.received), due: inr(Math.max(0, r.total - r.received)), shop: r.shop,
  };
  return [
    fill(t.greeting, v),
    fill(r.amount < 0 ? t.refunded : t.received, v),
    ...(r.total > 0 ? [fill(r.received >= r.total ? t.paid_full : t.totals, v)] : []),
    fill(t.thanks, v),
  ].join('\n');
}
