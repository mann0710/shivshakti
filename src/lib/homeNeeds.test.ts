import { homeNeeds, clock, nextDays, eventNote, sweetsWeek, openChoicesOf } from './homeNeeds';
import { NeedItem } from './cateringTodo';

const TODAY = '2026-10-31';
const need = (key: string, tone: NeedItem['tone'], page: NeedItem['page'], title: string, line: string, action = ''): NeedItem => ({ key, tone, page, title, line, action });

describe('homeNeeds', () => {
  const base: NeedItem[] = [
    need('tidy', 'grey', 'billing', '7 past events have no invoice', 'Settle them'),
    need('bill-0', 'red', 'seasonal_billing', 'Nikuj Rana owes ₹7,350 for sweets', 'Unpaid since 30 Oct'),
    need('q23', 'purple', 'quotations', 'Kavit Mangrolya, 25 Nov: waiting for a reply', 'QTN-0023 · ₹28,800 – ₹31,600 · sent', 'Follow up'),
    need('q15', 'amber', 'quotations', "Bhavin bhai's quote is still a draft", 'QTN-0015 · Vashtu 26 Nov, in 26 days · ₹35,175', 'Send quote'),
    need('inv1', 'red', 'billing', 'Collect ₹66,675 from Jigar bhai', 'INV-0001'),
    need('pre-2026-11-04', 'amber', 'seasonal_billing', '2 sweets pre-bookings on 4 Nov, no advance yet', 'Krinal ₹13,603'),
  ];
  const ctx = { choices: (id: string) => (id === 'q23' ? [{ label: 'Farsan', options: ['South Boll', 'Mix Bhajiya'] }] : []), bills: [{ no: '5', day: '2026-10-30', paid: 0 }] };

  it('gives every row two actions and asks which dish is still open', () => {
    const list = homeNeeds(base, ctx);
    expect(list.map(i => i.kind)).toEqual(['bill', 'invoice', 'quote', 'preorders', 'quote', 'tidy']);
    const kavit = list.find(i => i.key === 'q23')!;
    expect(kavit).toMatchObject({ title: 'Kavit Mangrolya, 25 Nov: which farsan?', line: 'QTN-0023 · South Boll or Mix Bhajiya · ₹28,800 – ₹31,600', first: 'Pick farsan & accept', firstShort: 'Pick farsan', second: 'WhatsApp' });
    expect(list.find(i => i.key === 'q15')).toMatchObject({ tone: 'purple', first: 'Send on WhatsApp', second: 'Open' });
    expect(list.find(i => i.kind === 'bill')).toMatchObject({ line: 'Bill #5 · 30 Oct · not paid', first: 'Record payment' });
    expect(list.find(i => i.kind === 'preorders')).toMatchObject({ ref: '2026-11-04', first: 'Ask for advance', second: 'Open' });
    expect(list.find(i => i.kind === 'tidy')).toMatchObject({ first: 'Tidy up', second: 'Later' });
  });
  it('finds the dishes still to choose', () => {
    const choice = { id: 'c', label: 'Farsan', pick: 1 };
    const items: any[] = [{ item_name: 'Dal' }, { item_name: 'South Boll', choice }, { item_name: 'Mix Bhajiya', choice }];
    expect(openChoicesOf({ is_multi_day: false, items })).toEqual([{ label: 'Farsan', options: ['South Boll', 'Mix Bhajiya'] }]);
    expect(openChoicesOf({ is_multi_day: false, items: items.map(i => (i.item_name === 'South Boll' ? { ...i, chosen: true } : i)) })).toEqual([]);
  });
  it('hides both tidy-up rows after Later', () => {
    const both = [...base, need('tidy-quotes', 'grey', 'quotations', '3 quotes out of step', 'Settle them')];
    expect(homeNeeds(both, ctx).filter(i => i.kind === 'tidy').map(i => i.page)).toEqual(['billing', 'quotations']);
    expect(homeNeeds(both, { ...ctx, hideTidy: true }).some(i => i.kind === 'tidy')).toBe(false);
  });
});

describe('home tiles and lists', () => {
  it('formats times and next-30-day events', () => {
    expect(clock('11:30')).toBe('11:30 AM');
    expect(clock('19:05:00')).toBe('7:05 PM');
    expect(clock('')).toBe('');
    const n = nextDays([
      { id: 'a', event_date: '2026-11-25', status: 'inquiry', guest_count: 140 },
      { id: 'b', event_date: '2026-11-26', status: 'inquiry', guest_count: 175 },
      { id: 'c', event_date: '2026-11-20', status: 'cancelled', guest_count: 50 },
      { id: 'd', event_date: '2026-12-05', status: 'confirmed', guest_count: 0 },
    ], TODAY);
    expect(n).toMatchObject({ count: 2, guests: 315, daysText: '25 and 26 Nov' });
  });
  it('says what an upcoming event is missing', () => {
    expect(eventNote({ stage: 'quoted', guests: 140, time: '11:00', pick: 'Farsan', hasDraft: false, valueText: '' })).toBe('11:00 AM · 140 guests · farsan not picked');
    expect(eventNote({ stage: 'inquiry', guests: 175, time: '11:30', hasDraft: true, valueText: '' })).toBe('11:30 AM · 175 guests · quote not sent');
    expect(eventNote({ stage: 'confirmed', guests: 0, hasDraft: false, valueText: '₹37,000' })).toBe('Guest count missing');
    expect(eventNote({ stage: 'confirmed', guests: 0, time: null, hasDraft: false, valueText: '₹6,17,650' })).toBe('Guest count missing');
  });
  it('lists pre-bookings of the next 7 days, then unpaid bills', () => {
    const rows = sweetsWeek(
      [{ id: 'k', customer_name: 'Krinal', delivery_date: '2026-11-04', status: 'pending', total_amount: 13603, advance_paid: 0 },
        { id: 'z', customer_name: 'Later', delivery_date: '2026-11-20', status: 'pending', total_amount: 10, advance_paid: 0 }],
      [{ id: 'o', name: 'Nikuj Rana', no: '5', day: '2026-10-30', items: 2, due: 7350 }], TODAY);
    expect(rows.map(r => [r.when, r.name, r.line])).toEqual([
      ['Wed 4 Nov', 'Krinal · pre-booking', 'Pickup · no advance'],
      ['Unpaid', 'Nikuj Rana · bill #5', '30 Oct · 2 items'],
    ]);
  });
});
