import { basisOf, confirmPicks, moneyChip, moneyOf, paymentPicks, paymentsFor, payTypeOn } from './bookingMoney';
import { bookingReceipt } from './bookingReceipt';

const plan = [{ pct: 10, label: 'To confirm', when: '' }, { pct: 70, label: 'Advance', when: '' }, { pct: 20, label: 'Balance', when: '' }];
const pay = (amount: number, day: string, booking_id = 'b1') => ({ id: day + amount, invoice_id: null, booking_id, amount, payment_date: day, payment_type: 'advance', payment_mode: 'cash', created_at: day }) as any;

describe('booking money', () => {
  it('measures against the invoice, else the lower quote price', () => {
    expect(basisOf({ total_amount: 75150 }, { total_amount: 70000 })).toEqual({ total: 75150, label: 'Invoice', range: false });
    expect(basisOf(undefined, { total_amount: 28800, total_max: 31600 })).toEqual({ total: 28800, label: 'Quote', range: true });
    expect(basisOf(undefined, { total_amount: 5000, status: 'rejected' }).total).toBe(0);
  });
  it('adds up payments, refunds and overpayment', () => {
    const list = paymentsFor([pay(10000, '2026-11-12'), pay(5000, '2026-11-07'), pay(9, '2026-11-01', 'other')], 'b1');
    expect(list.map(p => p.amount)).toEqual([5000, 10000]);
    expect(moneyOf({ total: 22000, label: 'Quote', range: false }, list)).toMatchObject({ received: 15000, due: 7000, over: 0, count: 2 });
    expect(moneyOf({ total: 10000, label: 'Invoice', range: false }, [...list, pay(-2000, '2026-11-13')])).toMatchObject({ received: 13000, due: 0, over: 3000 });
  });
  it('suggests amounts from the payment plan', () => {
    expect(confirmPicks(22000, plan).map(p => p.value)).toEqual([2200, 5500, 22000]);
    expect(confirmPicks(0, plan)).toEqual([]);
    expect(paymentPicks(22000, plan, 2200).map(p => p.label)).toEqual(['Next in plan: Advance 70% · ₹15,400', 'Balance · ₹19,800', 'Half · ₹9,900']);
    expect(paymentPicks(22000, plan, 17600).map(p => p.value)).toEqual([4400, 2200]);
    expect(paymentPicks(22000, plan, 22000)).toEqual([]);
  });
  it('says what came in on the list', () => {
    const m = (total: number, got: number) => moneyOf({ total, label: 'Quote', range: false }, got ? [pay(got, '2026-11-14')] : []);
    expect(moneyChip('confirmed', m(22000, 0))).toEqual({ text: 'No advance yet', tone: 'warn' });
    expect(moneyChip('confirmed', m(22000, 2200))?.text).toBe('₹2,200 received · ₹19,800 due');
    expect(moneyChip('paid', m(22000, 22000))?.text).toBe('Paid in full');
    expect(moneyChip('inquiry', m(22000, 0))).toBeNull();
    expect(payTypeOn('2026-11-23', '2026-11-14')).toBe('advance');
  });
});

describe('booking receipt', () => {
  const r = { name: 'Ayushi Shah', amount: 2200, mode: 'upi', day: '2026-11-14', advance: true, event: 'Get Together', eventDate: '2026-11-23', total: 22000, received: 2200, shop: 'Shiv Shakti' };
  it('writes English and Hindi', () => {
    expect(bookingReceipt('en', r)).toBe('Namaste Ayushi ji,\nReceived ₹2,200 by UPI on 14 Nov as advance for your Get Together on 23 Nov.\nTotal ₹22,000 · received ₹2,200 · balance due ₹19,800.\nThank you! Shiv Shakti');
    expect(bookingReceipt('hi', r)).toContain('नमस्ते Ayushi जी');
    expect(bookingReceipt('en', { ...r, received: 22000 })).toContain('paid in full');
    expect(bookingReceipt('en', { ...r, amount: -2200, received: 0 })).toContain('Returned ₹2,200 by UPI');
  });
});
