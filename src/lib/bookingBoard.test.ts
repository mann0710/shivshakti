import { bookingView, sortForTab, groupByMonth, boardStats, pipelineColumns, onDay, dateRangeText, neverInvoiced, festivalDays, TABS } from './bookingBoard';

const today = '2026-10-31';
const bk = (id: string, name: string, date: string, status: string, o: object = {}) =>
  ({ id, customer_id: id, customer: { name }, event_type: 'Vashtu', event_date: date, venue: '', guest_count: 100, status, estimated_cost: 0, created_at: '', ...o }) as any;
const farsan = { id: 'f', label: 'Farsan', pick: 1 };
const quotes = [
  { id: 'q1', booking_id: 'kavit', status: 'sent', created_at: '2026-10-30', total_amount: 28800, total_max: 31600, items: [{ item_id: 'a', amount: 60, choice: farsan }, { item_id: 'b', amount: 40, choice: farsan }] },
  { id: 'q2', booking_id: 'amit', status: 'accepted', created_at: '2026-10-01', total_amount: 37000, items: [] },
  { id: 'q3', booking_id: 'bhavin', status: 'sent', created_at: '2026-10-02', total_amount: 35175, items: [] },
] as any[];
const invoices = [
  { id: 'i1', booking_id: 'grand', total_amount: 46650, balance_due: 0, status: 'paid' },
  { id: 'i2', booking_id: 'exxat', total_amount: 22050, balance_due: 5000, status: 'sent' },
] as any[];
const all = [
  bk('kavit', 'Kavit Mangrolya', '2026-11-25', 'confirmed'),
  bk('bhavin', 'Bhavin bhai', '2026-11-28', 'followup'),
  bk('amit', 'Amit Shah', '2026-12-05', 'confirmed'),
  bk('rushi', 'Rushi Ghandhi', '2026-12-06', 'inquiry', { guest_count: 0 }),
  bk('dirgha', 'Dirgha Nanavati', '2026-10-24', 'inquiry'),
  bk('jigar', 'Jigar bhai', '2026-09-13', 'confirmed'),
  bk('grand', 'The Grand Dining', '2026-09-06', 'completed'),
  bk('exxat', 'Exxat System', '2026-08-22', 'completed'),
  bk('sanjay', 'Sanjay Bhai', '2026-06-16', 'cancelled'),
  bk('wed', 'Two-day wedding', '2026-12-19', 'confirmed', { end_date: '2026-12-20' }),
];
const views = all.map(b => bookingView(b, { quotes, invoices, today, value: b.id === 'amit' ? 37000 : 0 }));
const of = (id: string) => views.find(v => v.b.id === id)!;

describe('bookings board', () => {
  it('gives each booking one next step', () => {
    expect(of('kavit').next?.label).toBe('Pick farsan & accept');
    expect(of('kavit').valueText).toBe('₹28,800 – ₹31,600');
    expect(of('bhavin').next?.label).toBe('Mark accepted');
    expect(of('amit').next?.label).toBe('Create invoice');
    expect(of('rushi').next?.label).toBe('Make quotation');
    expect(of('rushi').valueText).toBe('No quote yet');
  });
  it('only picks or accepts a sent quote, never an unsent draft', () => {
    const ctx = (qs: any[]) => ({ quotes: qs, invoices: [], today, value: 0 });
    const neha = bk('neha', 'Neha Shah', '2026-12-10', 'inquiry');
    const draft = { id: 'd1', booking_id: 'neha', status: 'draft', created_at: '2026-10-29', total_amount: 1000, items: quotes[0].items };
    expect(bookingView(neha, ctx([draft])).next?.label).toBe('Send quote');
    const optA = { ...draft, id: 'd2', option_group: 'g', option_label: 'A', items: [] };
    expect(bookingView(neha, ctx([optA, { ...optA, id: 'd3', option_label: 'B' }])).next?.label).toBe('Send quote');
    const ravi = bk('ravi', 'Ravi Patel', '2026-12-12', 'followup');
    const sent = { id: 's1', booking_id: 'ravi', status: 'sent', created_at: '2026-10-01', total_amount: 5000, items: [] };
    const v = bookingView(ravi, ctx([{ ...sent, id: 's2', status: 'draft', created_at: '2026-10-20' }, sent]));
    expect([v.next?.label, v.quote?.id]).toEqual(['Mark accepted', 's1']);
  });
  it('puts past events that are still open under Needs attention', () => {
    expect([of('dirgha').tab, of('dirgha').next?.label]).toEqual(['attention', 'Close as lost']);
    expect([of('jigar').tab, of('jigar').next?.label]).toEqual(['attention', 'Mark completed']);
    expect([of('exxat').tab, of('exxat').next?.label]).toEqual(['attention', 'Record payment']);
    expect([of('grand').tab, of('grand').next]).toEqual(['past', null]);
    expect(of('sanjay').tab).toBe('cancelled');
  });
  it('sorts, groups by month and summarises', () => {
    const upcoming = sortForTab(views.filter(v => v.tab === 'upcoming'), 'upcoming');
    expect(groupByMonth(upcoming).map(g => [g.title, g.views.length])).toEqual([['November 2026', 2], ['December 2026', 3]]);
    const s = boardStats(views);
    expect([s.upcoming, s.nextUp?.b.id, s.confirmedValue, s.waiting]).toEqual([5, 'kavit', 37000, 8]);
    expect(s.waitingNote).toBe('2 invoices · 1 quote · 2 decisions · 1 payment · 2 to close');
  });
  it('builds pipeline columns; a confirmed booking waiting on its sent quote stays quoted', () => {
    const cols = pipelineColumns(views, today);
    expect(cols.map(c => [c.stage, c.cards.map(v => v.b.id)])).toEqual([
      ['inquiry', ['dirgha', 'rushi']], ['quoted', ['kavit', 'bhavin']], ['confirmed', ['jigar', 'amit', 'wed']],
      ['invoiced', ['exxat']], ['paid', ['grand']],
    ]);
    expect(cols.map(c => c.note)).toEqual(['', '', '₹37,000', '₹5,000 due', 'Last 90 days']);
  });
  it('finds finished events that were never invoiced', () => {
    expect(neverInvoiced(views).map(v => v.b.id)).toEqual(['jigar']);
    expect(TABS.find(t => t.id === 'cancelled')?.label).toBe('Lost or cancelled');
  });
  it('marks each festival on its last day', () => {
    const days = festivalDays([
      { name: 'Dhanteras', end_date: '2026-11-06' }, { name: 'Diwali', end_date: '2026-11-08' },
      { name: 'Bhai Dooj', end_date: '2026-11-08' }, { name: 'Uttarayan', end_date: null },
    ]);
    expect(Array.from(days.entries())).toEqual([['2026-11-06', ['Dhanteras']], ['2026-11-08', ['Diwali', 'Bhai Dooj']]]);
  });
  it('shows a multi-day event on each of its days', () => {
    expect(onDay(views, '2026-12-20').map(v => v.b.id)).toEqual(['wed']);
    expect(dateRangeText(all[9])).toBe('19-12-2026 → 20-12-2026');
  });
});
