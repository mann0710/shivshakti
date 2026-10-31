import { groupQuotes, groupTotal, groupStatus } from './quoteGroups';
import { quotationMessage } from './quotationShare';
import { quotationDoc } from './docs/quotationDoc';
import { DEFAULT_DOC_SETTINGS } from './docs/settings';

// jest hoists this above the imports; the real module needs Supabase env.
jest.mock('./docs/output', () => ({ shareDoc: jest.fn() }));

const d = (name: string, amount: number) => ({ item_id: name, item_name: name, category_name: 'Menu', subcategory_name: '', amount }) as any;
const base = { status: 'draft', issue_date: '2026-10-31', guest_count: 140, discount_amount: 0, discount_type: 'amount', gst_rate: 0, gst_amount: 0,
  extra_charges: [], additional_discounts: [], transportation_charges: [], booking: { event_type: 'Vashtu', event_date: '2026-11-25' }, customer: { name: 'Kavit' } };
// Live QTN-0024 / 0025: options A and B of one enquiry, plus a plain quote.
const A = { ...base, id: 'a', quotation_number: 'QTN-0024', option_group: 'g', option_label: 'A', created_at: '2026-10-31T10:00', items: [d('Puri', 15), d('Chanaa', 80)], per_plate_amount: 95, subtotal: 13300, total_amount: 13300 } as any;
const B = { ...A, id: 'b', quotation_number: 'QTN-0025', option_label: 'B', created_at: '2026-10-31T10:05', items: [d('Fulka Roti', 55), d('Chanaa', 80)], per_plate_amount: 135, subtotal: 18900, total_amount: 18900 } as any;
const P = { ...base, id: 'p', quotation_number: 'QTN-0020', created_at: '2026-10-30T09:00', items: [], per_plate_amount: 100, subtotal: 14000, total_amount: 14000 } as any;
const ctx = { settings: DEFAULT_DOC_SETTINGS, gstNumber: '', logo: '' };

describe('quotation list groups', () => {
  it('puts options under one enquiry, newest enquiry first', () => {
    const g = groupQuotes([P, B, A]);
    expect(g.map(x => [x.grouped, x.options.map(o => o.option_label || o.quotation_number)])).toEqual([[true, ['A', 'B']], [false, ['QTN-0020']]]);
  });
  it('summarises total and status across options', () => {
    const [g] = groupQuotes([A, B]);
    expect(groupTotal(g)).toBe('₹13,300 – ₹18,900');
    expect(groupStatus(g).text).toBe('Draft · customer picks 1 of 2');
    const [won] = groupQuotes([A, { ...B, status: 'accepted' }]);
    expect(groupTotal(won)).toBe('₹18,900');
    expect(groupStatus(won).text).toBe('Option B accepted');
  });
});

describe('option PDFs', () => {
  it('one option prints only itself, with real payment amounts', () => {
    const doc = quotationDoc(A, {}, ctx);
    expect(doc.html).toContain('Quotation · Option A');
    expect(doc.html).not.toContain('QTN-0025');
    expect(doc.html).toContain('₹1,330'); // 10% of 13,300
    expect(doc.fileName).toBe('Kavit_QTN-0024_Option_A.pdf');
  });
  it('all options print once, numbered from option A, with each option per payment step', () => {
    const doc = quotationDoc(B, { options: [A, B] }, ctx);
    expect(doc.html).toContain('Quotation · 2 options');
    expect(doc.html).toContain('Option A: <b>₹1,330</b>');
    expect(doc.html).toContain('Option B: <b>₹1,890</b>');
    expect(doc.fileName).toBe('Kavit_QTN-0024_Options_AB.pdf');
  });
  it('the WhatsApp message lists every option', () => {
    expect(quotationMessage(A, [A, B])).toContain('here are 2 menu options for your Vashtu on Wed 25 Nov:\nOption A: ₹13,300\nOption B: ₹18,900');
    expect(quotationMessage(A)).toBe('Namaste Kavit ji, here is the quotation (Option A) for your Vashtu on Wed 25 Nov: ₹13,300 for 140 guests. — Shiv Shakti');
  });
});

describe('WhatsApp straight to the saved number', () => {
  const { openWhatsApp } = jest.requireActual('./receipt');
  it('opens the customer chat with the message, and reports a blocked window', () => {
    const open = jest.spyOn(window, 'open').mockReturnValueOnce({} as Window).mockReturnValueOnce(null);
    expect(openWhatsApp('+91 99748 75588', 'Namaste')).toBe(true);
    expect(open.mock.calls[0][0]).toBe('https://wa.me/919974875588?text=Namaste');
    expect(openWhatsApp('9974875588', 'Hi')).toBe(false);
    open.mockRestore();
  });
});
