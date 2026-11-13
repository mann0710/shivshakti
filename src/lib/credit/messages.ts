import { inr } from '../money';
import { fill } from '../fillText';
import { Account } from './accounts';
import { shortDay } from './dates';
import { Lang } from './types';

// WhatsApp reminders in English or Hindi. Hindi strings come from a translation pass; edit there, not by hand.

type Key = 'greeting' | 'due_one' | 'due_many' | 'promise' | 'pay_upi' | 'pay_counter' | 'thanks' | 'bill' | 'old_balance' | 'prebooking';

const TEXT: Record<Lang, Record<Key, string>> = {
  en: {
    greeting: 'Namaste {name} ji,',
    due_one: 'A gentle reminder from {shop}: {amount} is due for {what}.',
    due_many: 'A gentle reminder from {shop}: {amount} is due on {count} bills (oldest from {oldest}).',
    promise: 'You had said you would pay by {date}.',
    pay_upi: 'You can pay by UPI to {upi} or at the counter.',
    pay_counter: 'You can pay at the counter.',
    thanks: 'Thank you! {shop}',
    bill: 'bill #{no}',
    old_balance: 'your earlier balance',
    prebooking: 'your sweets pre-booking',
  },
  hi: {
    greeting: 'नमस्ते {name} जी,',
    due_one: '{shop} की ओर से एक छोटी सी याद दिलानी थी: {what} के लिए {amount} बाकी है।',
    due_many: '{shop} की ओर से एक छोटी सी याद दिलानी थी: {count} बिलों पर {amount} बकाया है (सबसे पुराना बिल {oldest} का है)।',
    promise: 'आपने {date} तक भुगतान करने की बात कही थी।',
    pay_upi: 'आप {upi} पर UPI से या काउंटर पर भुगतान कर सकते हैं।',
    pay_counter: 'आप काउंटर पर भुगतान कर सकते हैं।',
    thanks: 'धन्यवाद! {shop}',
    bill: 'बिल #{no}',
    old_balance: 'आपका पुराना बकाया',
    prebooking: 'आपकी मिठाई की प्री-बुकिंग',
  },
};


export interface ShopInfo { name: string; phone?: string; upi: string }

// One message for everything the customer owes.
export function creditReminder(a: Account, lang: Lang, shop: ShopInfo, today: string): string {
  const t = TEXT[lang];
  const first = a.name.split(/\s+/)[0] || a.name;
  const one = a.open.length === 1 ? a.open[0] : null;
  const what = !one ? '' : one.type === 'opening' ? t.old_balance : one.type === 'preorder' ? t.prebooking : fill(t.bill, { no: one.label.replace(/^Bill #/, '') });
  const shopName = shop.name + (shop.phone ? ` · ${shop.phone}` : '');
  return [
    fill(t.greeting, { name: first }),
    one ? fill(t.due_one, { shop: shop.name, amount: inr(a.owed), what })
      : fill(t.due_many, { shop: shop.name, amount: inr(a.owed), count: a.open.length, oldest: shortDay(a.open[0]?.day ?? today, today) }),
    ...(a.promise ? [fill(t.promise, { date: shortDay(a.promise.date, today) })] : []),
    shop.upi ? fill(t.pay_upi, { upi: shop.upi }) : t.pay_counter,
    fill(t.thanks, { shop: shopName }),
  ].join('\n');
}
