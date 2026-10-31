import { invoiceTodo, needsYou, daysBetween } from './cateringTodo';
import { outOfStep, fixCounts } from './quoteSync';

const b = (id: string, status: any, event_date: string, name = id) => ({ id, status, event_date, event_type: 'Vashtu', guest_count: 100, customer: { name } });
const q = (id: string, booking_id: string, status: any, total = 1000) => ({ id, booking_id, status, quotation_number: `Q-${id}`, total_amount: total, created_at: '2026-10-01' });
const TODAY = '2026-10-31';

describe('quoteSync', () => {
  it('accepts the only quote of a confirmed booking, rejects cancelled and passed ones', () => {
    const bookings = [b('c', 'confirmed', '2026-12-05'), b('x', 'cancelled', '2027-01-23'), b('p', 'inquiry', '2026-09-19'), b('f', 'inquiry', '2026-12-13')];
    const quotes = [q('1', 'c', 'draft'), q('2', 'x', 'draft'), q('3', 'p', 'draft'), q('4', 'f', 'draft')];
    const fixes = outOfStep(quotes, bookings, TODAY);
    expect(fixes).toEqual([{ id: '1', to: 'accepted', why: 'booked' }, { id: '2', to: 'rejected', why: 'cancelled' }, { id: '3', to: 'rejected', why: 'passed' }]);
    expect(fixCounts(fixes)).toEqual({ booked: 1, cancelled: 1, passed: 1 });
  });
  it('leaves a confirmed booking with two live options for a person to decide', () => {
    expect(outOfStep([q('1', 'c', 'sent'), q('2', 'c', 'sent')], [b('c', 'confirmed', '2026-12-05')], TODAY)).toEqual([]);
  });
});

describe('cateringTodo', () => {
  it('groups owing, ready and past-without-invoice', () => {
    const bookings = [b('j', 'confirmed', '2026-09-13', 'Jigar'), b('a', 'confirmed', '2026-12-05'), b('n', 'completed', '2026-05-07')];
    const quotes = [q('1', 'a', 'draft', 37000), q('2', 'n', 'draft', 114300)];
    const invoices = [{ id: 'i', booking_id: 'j', invoice_number: 'INV-0001', total_amount: 116675, balance_due: 66675, status: 'sent' as const }];
    const t = invoiceTodo(bookings, quotes, invoices, TODAY);
    expect(t.owing[0].days).toBe(48);
    expect(t.ready.map(r => r.booking.id)).toEqual(['a']);
    expect(t.past.map(r => r.booking.id)).toEqual(['n']);
    expect(t.pastValue).toBe(114300);
  });
  it('puts money first and tidy-up last on Home', () => {
    const items = needsYou({
      bookings: [b('j', 'confirmed', '2026-09-13', 'Jigar'), b('k', 'inquiry', '2026-11-26', 'Bhavin')],
      quotes: [q('1', 'k', 'draft', 35175)],
      invoices: [{ id: 'i', booking_id: 'j', invoice_number: 'INV-0001', total_amount: 116675, balance_due: 66675, status: 'sent' }],
      unpaidBills: [], preorders: [{ name: 'Krinal', date: '2026-11-04', total: 13603, advance: 0, open: true }], outOfStep: 16, today: TODAY,
    });
    expect(items[0].title).toBe('Collect ₹66,675 from Jigar');
    expect(items[1].title).toContain('pre-booking on 4 Nov');
    expect(items.find(i => i.key === '1')?.title).toBe("Bhavin's quote is still a draft");
    expect(items[items.length - 1].title).toBe('16 quotes out of step');
  });
  it('gives each tidy-up its own row and screen', () => {
    const items = needsYou({ bookings: [b('n', 'completed', '2026-05-07')], quotes: [], invoices: [], unpaidBills: [], preorders: [], outOfStep: 1, today: TODAY });
    expect(items.map(i => [i.key, i.page, i.title])).toEqual([
      ['tidy', 'billing', '1 past event has no invoice'], ['tidy-quotes', 'quotations', '1 quote out of step'],
    ]);
  });
  it('counts days', () => expect(daysBetween('2026-10-31', '2026-11-26')).toBe(26));

  it('shows each reminder at the time set in Settings, or not at all', () => {
    const base = {
      bookings: [b('j', 'confirmed', '2026-11-10', 'Jigar'), b('k', 'followup', '2026-11-26', 'Bhavin')],
      quotes: [{ ...q('1', 'k', 'sent', 35175), created_at: '2026-10-30T09:00:00Z' }],
      invoices: [{ id: 'i', booking_id: 'j', invoice_number: 'INV-0002', total_amount: 50000, balance_due: 20000, status: 'sent' as const }],
      unpaidBills: [{ name: 'Krinal', total: 400, at: '2026-10-27T10:00:00Z' }],
      preorders: [{ name: 'Mira', date: '2026-11-01', total: 1200, advance: 500, open: true }],
      outOfStep: 0, today: TODAY,
    };
    const keys = (r?: any) => needsYou({ ...base, reminders: r }).map(i => i.key);
    // Defaults: money 3 days before (event is 10 days away), reply after 2 days (sent 1 day ago), pickup the day before, bills after 7 days.
    expect(keys()).toEqual(['pick-2026-11-01']);
    const on = (days: number) => ({ on: true, days });
    expect(keys({ pay_due: on(14), quote_reply: on(1), pickup: on(1), sweets_unpaid: on(3) })).toEqual(['i', 'bill-0', 'pick-2026-11-01', '1']);
    expect(keys({ pay_due: on(14), quote_reply: { on: false, days: 0 }, pickup: { on: false, days: 1 }, sweets_unpaid: { on: false, days: 0 } })).toEqual(['i']);
    const pick = needsYou({ ...base }).find(i => i.key === 'pick-2026-11-01')!;
    expect(pick.title).toBe('1 pre-booking to hand over on 1 Nov');
    expect(pick.line).toBe('Mira ₹700 to collect');
    expect(needsYou({ ...base, reminders: { pay_due: on(14), quote_reply: on(9), pickup: on(0), sweets_unpaid: on(9) } })[0].line).toBe('INV-0002 · Vashtu on 10 Nov · event in 10 days');
  });
});
