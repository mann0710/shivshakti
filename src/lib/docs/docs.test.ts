import { quotationDoc } from './quotationDoc';
import { invoiceDoc, eventMenuDoc } from './invoiceDoc';
import { posBillHtml } from '../thermalSlips';
import { coursesOf, daysOf, courseGrid } from './menu';
import { mergeDocSettings, scheduleAmounts, DEFAULT_DOC_SETTINGS } from './settings';
import { qrSvg, upiLink } from './qr';
import { orderReceipt } from '../sessionalReceipts';

const ctx = { settings: { ...DEFAULT_DOC_SETTINGS, upi_id: 'shop@bank' }, gstNumber: '24ABCDE1234F1Z5', logo: 'data:image/png;base64,AA' };
const dish = (c: string, s: string, n: string, a = 0) => ({ item_id: n, item_name: n, category_name: c, subcategory_name: s, amount: a });
const menu = [dish('Starters', 'Hot', 'Paneer Tikka', 90), dish('Sweets', 'Hot', 'Halwa', 60), dish('Sweets', 'Cold', 'Rasmalai', 50)];
const booking = { event_type: 'Wedding', event_date: '2026-12-20', venue: 'Hall', guest_count: 100, customer: { name: 'Ravi <b>', phone: '9876543210', gstin: '27AAACS1234A1Z5' } };
const quote = (o: object) => ({ id: 'q', customer_id: 'c', customer: booking.customer, booking, quotation_number: 'QTN-0009', status: 'sent', issue_date: '2026-10-31', created_at: '',
  items: menu, per_plate_amount: 200, guest_count: 100, subtotal: 20000, discount_amount: 0, discount_type: 'amount', gst_rate: 0, gst_amount: 0, total_amount: 20000,
  extra_charges: [], transportation_charges: [], additional_discounts: [], ...o }) as any;
const meal = (t: string, g: number, pp: number, offer: number) => ({ id: t, meal_type: t, time: '1 PM', guest_count: g, per_plate_amount: pp, discount_amount: offer, items: menu, subtotal: pp * g });

describe('document settings', () => {
  it('merges saved values over defaults and ignores junk', () => {
    const s = mergeDocSettings({ upi_id: 'x@y', quote_valid_days: 'ten' as any, terms: [' a ', ''] });
    expect(s.upi_id).toBe('x@y');
    expect(s.quote_valid_days).toBe(15);
    expect(s.terms).toEqual(['a']);
  });
  it('splits a total by the schedule without losing rupees', () => {
    expect(scheduleAmounts(166001, DEFAULT_DOC_SETTINGS.schedule)).toEqual([16600, 116201, 33200]);
  });
  it('makes a UPI QR', () => {
    expect(upiLink('shop@bank', 100, 'QTN')).toBe('upi://pay?pa=shop%40bank&pn=Shiv+Shakti&cu=INR&am=100.00&tn=QTN');
    expect(qrSvg('hello')).toContain('<svg');
  });
});

describe('menu blocks', () => {
  it('groups dishes by course with a flat list and per-course price', () => {
    expect(coursesOf(menu).map(c => [c.name, c.entries.map(e => e.item?.item_name), c.sum])).toEqual([['Starters', ['Paneer Tikka'], 90], ['Sweets', ['Halwa', 'Rasmalai'], 110]]);
  });
  it('treats entries on the same date as one day', () => {
    const g = daysOf([{ day_number: 1, date: '2026-12-19', meals: [meal('lunch', 1, 1, 0)], day_subtotal: 0 }, { day_number: 1, date: '2026-12-19', meals: [meal('dinner', 1, 1, 0)], day_subtotal: 0 }]);
    expect(g).toHaveLength(1);
    expect(g[0].meals).toHaveLength(2);
  });
});

describe('quotation', () => {
  it('per plate: no dish prices, escaped names, banner total', () => {
    const d = quotationDoc(quote({ items: menu.map(m => ({ ...m, amount: 0 })) }), {}, ctx);
    expect(d.html).toContain('Ravi &lt;b&gt;');
    expect(d.html).toContain('₹200 per plate × 100 guests');
    expect(d.html).not.toContain('/ plate</span>');
    expect(d.fileName).toBe('Ravi_b_QTN-0009.pdf');
  });
  it('per item: menu value, special price and saving', () => {
    const html = quotationDoc(quote({ per_plate_amount: 180, subtotal: 18000, total_amount: 18000 }), {}, ctx).html;
    expect(html).toContain('Menu value');
    expect(html).toContain('Special price · ₹20 off per plate');
    expect(html).toContain('You save ₹2,000');
    expect(html).toContain('₹90</span>');
  });
  it('multi-day: one line per meal and offers as savings', () => {
    const days = [{ day_number: 1, date: '2026-12-19', meals: [meal('lunch', 100, 300, 250), meal('dinner', 200, 400, 0)], day_subtotal: 0 }];
    const html = quotationDoc(quote({ is_multi_day: true, event_days: days, subtotal: 110000, total_amount: 105000 }), {}, ctx).html;
    expect(html).toContain('Lunch offer · Day 1');
    expect(html).toContain('− ₹5,000');
    expect(html).toContain('2 meals over 1 day');
    expect(html).toContain('UPI QR code');
  });
});

describe('choose-any groups in documents', () => {
  const g = { id: 'g', label: 'Sweets', pick: 1 };
  const items = [dish('Main', '', 'Dal', 30), { ...dish('Sweets', '', 'Jamun', 40), choice: g }, { ...dish('Sweets', '', 'Halwa', 60), choice: g }];
  it('quote shows tick boxes and the price effect', () => {
    const html = courseGrid(items, true);
    expect(html).toContain('Sweets · choose any 1');
    expect(html).toContain('+₹40 – ₹60 / plate');
  });
  it('served copies keep only the picked dish', () => {
    const html = courseGrid(items.map(i => (i.item_name === 'Halwa' ? { ...i, chosen: true } : i)), false, 'served');
    expect(html).toContain('Halwa');
    expect(html).not.toContain('Jamun');
  });
});

describe('invoice and event menu', () => {
  const inv = { id: 'i', booking_id: 'b', invoice_number: 'INV-0001', subtotal: 20000, discount_amount: 1000, discount_type: 'amount', gst_rate: 5, gst_amount: 950,
    transportation_charge: 500, total_amount: 20450, advance_paid: 5000, balance_due: 15450, status: 'sent', issue_date: '2026-12-21', created_at: '', booking } as any;
  it('splits IGST for an out-of-state buyer and shows place of supply', () => {
    const html = invoiceDoc(inv, quote({}), [], ctx).html;
    expect(html).toContain('Tax invoice');
    expect(html).toContain('IGST @5%');
    expect(html).toContain('Maharashtra (27)');
    expect(html).toContain('Rupees Twenty Thousand Four Hundred Fifty Only');
    expect(html).toContain('Pay the balance ₹15,450');
  });
  it('event menu has no prices', () => {
    expect(eventMenuDoc(booking as any, quote({}), ctx).html).not.toContain('₹90');
  });
  it('80 mm bill shows the footer line', () => {
    const r = orderReceipt({ id: 'b', bill_no: 5, customer_name: 'Walk-in', phone: '', items: [], subtotal: 0, discount_amount: 0, discount_type: 'amount', total_amount: 0, is_paid: true, payment_mode: 'cash', year: 2026, created_at: '2026-10-31T10:00:00Z' } as any);
    expect(posBillHtml(r, ctx)).toContain('Thank you! Visit again.');
  });
  it('prints the saved names, FSSAI number and sweets GST', () => {
    const own = { ...ctx, settings: { ...ctx.settings, catering_name: 'Shiv Shakti Caterers', sweets_name: 'Shiv Shakti Mithai', fssai_number: '10712345678901', sweets_gst_rate: 5 } };
    const q = quotationDoc(quote({}), {}, own).html;
    expect(q).toContain('Shiv Shakti Caterers');
    expect(q).toContain('<b>FSSAI</b> 10712345678901');
    expect(q).not.toContain('Shiv Shakti Catering Service');
    const r = orderReceipt({ id: 'b', bill_no: 5, customer_name: 'Walk-in', phone: '', items: [], subtotal: 1050, discount_amount: 0, discount_type: 'amount', total_amount: 1050, is_paid: true, payment_mode: 'cash', year: 2026, created_at: '2026-10-31T10:00:00Z' } as any, undefined, '24ABCDE1234F1Z5');
    const bill = posBillHtml(r, own);
    expect(bill).toContain('SHIV SHAKTI MITHAI');
    expect(bill).toContain('FSSAI 10712345678901');
    expect(bill).toContain('Incl. GST 5%');
    expect(bill).toContain('₹50');
    expect(posBillHtml({ ...r, gst_number: undefined }, own)).not.toContain('Incl. GST');
  });
  it('keeps a saved reminder and falls back on bad values', () => {
    const s2 = mergeDocSettings({ reminders: { pay_due: { on: false, days: 5 }, pickup: { on: true, days: -3 } } } as any);
    expect(s2.reminders.pay_due).toEqual({ on: false, days: 5 });
    expect(s2.reminders.pickup).toEqual({ on: true, days: 1 });
    expect(mergeDocSettings({ catering_name: '  ' } as any).catering_name).toBe('Shiv Shakti Catering Service');
  });
});
