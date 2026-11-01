import type { SeasonalPreorder } from '../hooks/useSeasonalPreorders';
import { buildPlan, datesSpan, phoneText, printedNow, registerDoc, registerHtml, spanLabel, titleCase } from './preorderPrint';
import { ALL_DATES, inDateSpan, presetSpan } from './preorders';

const line = (item_name: string, weight: number, qty: number, rate = 1000) =>
  ({ item_id: item_name, item_name, weight, weight_unit: 'gm' as const, qty, price: (rate * weight) / 1000, line_total: (rate * weight * qty) / 1000 });
let seq = 0;
const pre = (customer_name: string, delivery_date: string, items: ReturnType<typeof line>[], o: Partial<SeasonalPreorder> = {}): SeasonalPreorder => {
  const total = items.reduce((s, l) => s + l.line_total, 0);
  seq += 1;
  return { id: `p${seq}`, customer_name, phone: '9426549101', items, subtotal: total, discount_amount: 0, discount_type: 'amount',
    total_amount: total, advance_paid: 0, payment_mode: null, delivery_date, status: 'pending', year: 2026, created_at: '2026-10-20T10:00:00Z', ...o };
};

const week = () => [
  pre('vipul prajapati', '2026-11-05', [line('Kopra Pak', 500, 1), line('Mohanthal', 500, 1)]),
  pre('Kiran Solanki', '2026-11-03', [line('Kaju Katli', 500, 1), line('Kaju Katli', 1000, 2)], { advance_paid: 500 }),
  pre('Harsh Patel', '2026-11-05', [line('Kaju Katli', 500, 1)], { status: 'ready' }),
  pre('Gone Away', '2026-11-05', [line('Mohanthal', 500, 4)], { status: 'cancelled' }),
  pre('Gaurav Shah', '2026-11-05', [line('Kaju Cassata', 250, 4)], { fulfillment: 'delivery', address: '14 Shreeji Park', notes: 'call first', advance_paid: 1000 }),
];

describe('pre-booking register print', () => {
  it('numbers bookings by day then name and keeps cancelled ones out of the totals', () => {
    const plan = buildPlan(week());
    expect(plan.days.map(d => d.day)).toEqual(['2026-11-03', '2026-11-05']);
    expect(plan.days[1].rows.map(r => `${r.n} ${r.p.customer_name}`)).toEqual(['2 Gaurav Shah', '3 Gone Away', '4 Harsh Patel', '5 vipul prajapati']);
    expect(plan.days[1]).toMatchObject({ count: 3, packs: 7 });
    expect(plan).toMatchObject({ count: 4, packs: 10, advance: 1500, deliveries: 1 });
    expect(plan.due).toBe(2000 + 500 + 1000);
  });

  it('adds up what to make by pack size with the boxes that get it, leaving out packed boxes', () => {
    const { pack } = buildPlan(week());
    expect(pack.find(s => s.name === 'Kaju Katli')).toEqual({ name: 'Kaju Katli', total: '2.5 kg', packs: '2 × 1 kg + 1 × 500 g', boxes: [1] });
    expect(pack.find(s => s.name === 'Mohanthal')).toMatchObject({ total: '500 g', boxes: [5] });
    expect(pack.map(s => s.name)).toEqual(['Kaju Cassata', 'Kaju Katli', 'Kopra Pak', 'Mohanthal']);
  });

  it('prints every sweet however many there are, with money on each row', () => {
    const many = Array.from({ length: 18 }, (_, i) => line(`Sweet ${String.fromCharCode(65 + i)}`, 500, 1));
    const html = registerHtml(buildPlan([pre('Big Order', '2026-11-06', many)]), { scope: 'Open', printedAt: 'Sat 31 Oct, 6:24 pm' });
    many.forEach(l => expect(html).toContain(`<span>${l.item_name}</span>`));
    expect(html).toContain('₹9,000');
    expect(html).not.toContain('class="sub"');
  });

  it('lays out the page: header, day subtotals, walk-in rows, page numbers and a file name', () => {
    const html = registerHtml(buildPlan(week()), { scope: 'Open, not handed over yet', occasion: 'Diwali', printedAt: 'Sat 31 Oct, 6:24 pm' });
    expect(html).toContain('<title>Pre-bookings Diwali Sat 31 Oct</title>');
    expect(html).toContain('Diwali · Open, not handed over yet · Tue 3 – Thu 5 Nov · 1 home delivery');
    expect(html).toContain('4 bookings · 10 packs · To collect ₹3,500');
    expect(html).toContain('<b>Thu 5 Nov</b> · 3 bookings · 7 packs');
    expect(html).not.toContain('<b>Tue 3 Nov</b> ·');
    expect(html).toContain('Vipul Prajapati');
    expect(html).toContain('<b class="tag">DELIVERY</b> 14 Shreeji Park');
    expect(html).toContain('<b>Note:</b> call first');
    expect(html).toContain('<b class="tag on">Packed</b>');
    expect(html).toContain('<b>Cancelled</b>');
    expect(html).toContain('₹1,000 advance');
    expect(html).toContain('<td class="c">6</td><td></td><td>Walk-in or change: write it here</td>');
    expect(html).toContain('counter(page) " of " counter(pages)');
    expect(html).toContain('<thead>');
    expect(html).not.toContain('<tfoot>');
  });

  it('formats names, phones, dates and the print time', () => {
    expect(titleCase('hemant bhai patel')).toBe('Hemant Bhai Patel');
    expect(titleCase('Rana Traders (HO)')).toBe('Rana Traders (HO)');
    expect(phoneText('+91 94265 49101')).toBe('94265 49101');
    expect(phoneText('')).toBe('No phone');
    expect(datesSpan(['2026-11-03', '2026-11-05'])).toBe('Tue 3 – Thu 5 Nov');
    expect(datesSpan(['2026-10-31', '2026-11-03'])).toBe('Sat 31 Oct – Tue 3 Nov');
    expect(datesSpan(['2026-11-05'])).toBe('Thu 5 Nov');
    expect(printedNow(new Date('2026-10-31T12:54:00Z'))).toBe('Sat 31 Oct, 6:24 pm');
  });
});

describe('pickup dates and PDF files', () => {
  it('filters by pickup date and names the span', () => {
    const today = '2026-11-03';
    expect(presetSpan('today', today)).toEqual({ from: today, to: today });
    expect(presetSpan('tomorrow', today)).toEqual({ from: '2026-11-04', to: '2026-11-04' });
    expect(presetSpan('next3', today)).toEqual({ from: today, to: '2026-11-05' });
    expect(presetSpan('week', today)).toEqual({ from: today, to: '2026-11-09' });
    const span = presetSpan('next3', today);
    expect(week().filter(p => inDateSpan(p, span)).map(p => p.customer_name)).toEqual(['vipul prajapati', 'Kiran Solanki', 'Harsh Patel', 'Gone Away', 'Gaurav Shah']);
    expect(inDateSpan({ delivery_date: '2026-11-06' }, span)).toBe(false);
    expect(inDateSpan({ delivery_date: undefined }, span)).toBe(false);
    expect(inDateSpan({ delivery_date: undefined }, ALL_DATES)).toBe(true);
    expect(spanLabel(span)).toBe('Tue 3 – Thu 5 Nov');
    expect(spanLabel(presetSpan('today', today))).toBe('Tue 3 Nov');
    expect(spanLabel({ from: today, to: '' })).toBe('from Tue 3 Nov');
    expect(spanLabel(ALL_DATES)).toBe('');
  });
  it('downloads the register as a named PDF that keeps its own page numbers', () => {
    const doc = registerDoc(buildPlan(week()), { scope: 'Open', occasion: 'Diwali', printedAt: 'Sat 31 Oct, 6:24 pm' }, 'Tue 3 – Thu 5 Nov');
    expect(doc.fileName).toBe('Pre_bookings_Diwali_Tue_3_Thu_5_Nov.pdf');
    expect(doc.footer).toBe('');
    expect(registerDoc(buildPlan(week()), { scope: 'Open', printedAt: 'Sat 31 Oct, 6:24 pm' }).fileName).toBe('Pre_bookings_Sat_31_Oct.pdf');
  });
});
