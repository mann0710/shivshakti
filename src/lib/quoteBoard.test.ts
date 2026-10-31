import { buildBoard, boardSections, tabCounts, headline, matchesSearch, shortPrice, optionLine, bookingsToQuote, quoteHistory, pickText } from './quoteBoard';
import { readyChecks, planRows, compareRows, parseAmount, stageText, priceLines } from './quoteSummary';

const today = '2026-10-31';
const farsan = { id: 'f', label: 'Farsan', pick: 1 };
const dish = (name: string, cat: string, amount = 0, extra: object = {}) => ({ item_id: name, item_name: name, category_name: cat, subcategory_name: cat, amount, ...extra });
const q = (id: string, o: object = {}) => ({
  id, quotation_number: `QTN-${id}`, status: 'draft', created_at: '2026-09-05T10:00:00Z', issue_date: '2026-09-05', guest_count: 100,
  per_plate_amount: 200, total_amount: 20000, items: [dish('Puri', 'Breads')], extra_charges: [], transportation_charges: [], additional_discounts: [],
  gst_rate: 0, gst_amount: 0, discount_amount: 0, subtotal: 20000, customer: { name: 'Bhavin bhai', phone: '9974875588' },
  booking: { event_type: 'Vashtu', event_date: '2026-11-26', guest_count: 100, status: 'inquiry' }, booking_id: `b-${id}`, ...o,
}) as any;

const kavit = q('23', { status: 'sent', customer: { name: 'Kavit Mangrolya' }, booking: { event_type: 'Vashtu', event_date: '2026-11-25', status: 'followup' },
  total_max: 31600, total_amount: 28800, items: [dish('South Boll', 'Farsan', 60, { choice: farsan }), dish('Mix Bhajiya', 'Farsan', 80, { choice: farsan })] });
const bhavin = q('15');
const trushar = q('14', { customer: { name: 'trushar bhai' }, guest_count: 0, booking: { event_type: 'Wedding', event_date: '2026-12-13', guest_count: 0 } });
const mansiA = q('21', { option_group: 'm', option_label: 'A', option_name: 'Royal', status: 'sent', total_amount: 725000, customer: { name: 'Mansi' }, booking: { event_type: 'Wedding', event_date: '2027-01-25' } });
const mansiB = { ...mansiA, id: '22', quotation_number: 'QTN-22', option_label: 'B', option_name: 'Classic', total_amount: 625000 };
const amit = q('09', { status: 'accepted', customer: { name: 'Amit Shah' }, booking: { event_type: 'Grah Shanti', event_date: '2026-12-11', advance_received: 8640, advance_mode: 'upi', advance_date: '2026-11-01' } });
const lost = q('05', { status: 'rejected', booking: { event_type: 'Wedding', event_date: '2026-10-01', status: 'inquiry' } });
const rows = buildBoard([bhavin, trushar, kavit, mansiA, mansiB, amit, lost], today, new Set());
const row = (id: string) => rows.find(r => r.group.options.some(o => o.id === id))!;

describe('quotation board', () => {
  it('puts follow-ups first and drafts soonest event first', () => {
    const todo = boardSections(rows, 'todo');
    expect(todo.map(s => s.id)).toEqual(['waiting', 'drafts']);
    expect(todo[0].rows.map(r => r.head.id)).toEqual(['23', '21']);
    expect(todo[1].rows.map(r => r.head.id)).toEqual(['15', '14']);
    expect(tabCounts(rows)).toEqual({ todo: 4, accepted: 1, lost: 1, all: 6 });
    expect(headline(rows)).toBe('2 waiting for the customer · 2 drafts to send');
  });
  it('says what is missing and what to do next', () => {
    expect(row('23').line).toBe('QTN-23 · 100 guests · sent');
    expect(row('23').flag).toBe('has to pick 1 farsan');
    expect(row('23').next?.label).toBe('Pick farsan & accept');
    expect(pickText(kavit)).toBe('has to pick 1 farsan');
    expect(row('15').flag).toBe('event in 26 days');
    expect(row('15').line).toBe('QTN-15 · 100 guests · draft since 5 Sep');
    expect(row('14').flag).toBe('guest count missing');
    expect(row('21').next?.label).toBe('Accept an option');
    expect(row('21').line).toContain('2 options sent together');
    expect(row('09').next?.label).toBe('Create invoice');
    expect(buildBoard([amit], today, new Set(['b-09']))[0].next).toBeNull();
    expect(row('05').line).toContain('expired');
  });
  it('searches names, phones and numbers, across options', () => {
    expect(matchesSearch(row('15'), '74875')).toBe(true);
    expect(matchesSearch(row('21'), 'qtn-22')).toBe(true);
    expect(matchesSearch(row('21'), 'kavit')).toBe(false);
  });
  it('shortens prices for phones and lines for options', () => {
    expect(shortPrice(row('21').group)).toBe('₹6.25 – 7.25 L');
    expect(shortPrice(row('23').group)).toBe('₹28,800+');
    expect(optionLine(mansiA)).toBe('₹200 a plate · 1 dish');
  });
  it('lists bookings that still need a quote, with any draft', () => {
    const bookings = [
      { id: 'b-15', event_date: '2026-11-26', status: 'inquiry' }, { id: 'b-23', event_date: '2026-11-25', status: 'followup' },
      { id: 'new', event_date: '2026-12-06', status: 'inquiry' }, { id: 'old', event_date: '2026-10-01', status: 'inquiry' },
    ] as any[];
    expect(bookingsToQuote(bookings, [bhavin, kavit], today).map(x => [x.booking.id, x.draft?.id])).toEqual([['b-15', '15'], ['new', undefined]]);
  });
  it('tells the story of a quote', () => {
    expect(quoteHistory(row('23'), today).map(h => h.what)).toEqual(['Created with a farsan choice', 'Sent to Kavit Mangrolya', 'No reply yet — a reminder is on Home']);
    expect(quoteHistory(row('09'), today).map(h => h.what)).toContain('Advance ₹8,640 by UPI — goes on the invoice');
  });
});

describe('quote editor summary', () => {
  it('checks what is ready to send', () => {
    const c = readyChecks({ date: '2026-11-25', time: '11:00', guests: 140, multiDay: false, undated: 0, dishes: 11, courses: 4, picks: ['Farsan'], total: 28800, planPct: 100 });
    expect(c.map(x => `${x.tone} ${x.text}`)).toEqual(['ok Date, time and 140 guests set', 'ok 11 dishes in 4 courses', 'warn 1 choice left for the customer (farsan)', 'ok Payment plan adds up to 100%']);
    expect(readyChecks({ date: '', time: '', guests: 0, multiDay: false, undated: 0, dishes: 0, courses: 0, picks: [], total: 0, planPct: 90 }).map(x => x.tone)).toEqual(['bad', 'bad', 'bad', 'warn']);
  });
  it('splits the payment plan, as a range while the customer picks', () => {
    const steps = [{ pct: 30, label: 'Advance', when: 'On booking' }, { pct: 70, label: 'Balance', when: '' }];
    expect(planRows(28800, 31600, steps)).toEqual([
      { pct: '30%', text: 'Advance · On booking', amount: '₹8,640 – ₹9,480' }, { pct: '70%', text: 'Balance', amount: '₹20,160 – ₹22,120' }]);
  });
  it('compares options side by side', () => {
    const rowsOf = compareRows([mansiA, { ...mansiB, per_plate_amount: 150, items: [dish('Puri', 'Breads'), dish('Khaman', 'Farsan')] }]);
    expect(rowsOf.find(r => r.label === 'Plate price')).toMatchObject({ cells: ['₹200', '₹150'], differs: true });
    expect(rowsOf.find(r => r.label === 'Farsan')?.cells).toEqual(['—', 'Khaman']);
    expect(rowsOf.find(r => r.label === 'Guests')?.differs).toBe(false);
  });
  it('reads amounts and percentages', () => {
    expect(parseAmount('10%', 28800)).toBe(2880);
    expect(parseAmount('₹1,500', 0)).toBe(1500);
    expect(stageText({ status: 'followup', customer: { name: 'Kavit Mangrolya' } })).toBe('quoted, waiting for Kavit');
  });
  it('lists the price the customer sees', () => {
    const lines = priceLines({ ...kavit, per_plate_amount: 195, per_plate_max: 215, guest_count: 140, transportation_charges: [{ description: 'Transport', amount: 1500 }] });
    expect(lines.map(l => `${l.k}=${l.v}`)).toEqual(['₹195 – ₹215 × 140=₹27,300 – ₹30,100', 'Transport=₹1,500', 'GST=Not added']);
  });
});
