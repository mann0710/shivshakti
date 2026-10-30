import { ownRange, typedPrice, basePlate, acceptPatch, pickKey, pendingChoice, openChoiceLabels } from './quoteChoices';
import { quotationDoc } from './docs/quotationDoc';
import { DEFAULT_DOC_SETTINGS } from './docs/settings';

// QTN-0023: own price ₹215 with South Boll; Mix Bhajiya offered instead, ₹20 cheaper; other dishes unpriced.
const farsan = { id: 'f', label: 'Farsan', pick: 1 };
const d = (name: string, cat: string, amount = 0, choice?: object) =>
  ({ item_id: name, item_name: name, category_name: cat, subcategory_name: cat, amount, choice }) as any;
const items = [d('Churma Na Ladoo', 'Sweet'), d('Puri', 'Indian Breads'), d('South Boll', 'Main Course', 60, farsan),
  d('Mix Bhajiya', 'Main Course', 40, farsan), d('Green Salad', 'Including'), d('Gujarati Varani Dal', 'Delicious Dal')];
const ctx = { settings: DEFAULT_DOC_SETTINGS, gstNumber: '', logo: '' };
const quote = { id: 'q', quotation_number: 'QTN-0023', status: 'sent', issue_date: '2026-10-30', created_at: '', items,
  per_plate_amount: 195, per_plate_max: 215, guest_count: 140, subtotal: 27300, discount_amount: 0, discount_type: 'amount',
  gst_rate: 0, gst_amount: 0, total_amount: 28800, total_max: 31600, extra_charges: [], additional_discounts: [],
  transportation_charges: [{ description: 'Transportation', amount: 1500 }],
  booking: { event_type: 'Vashtu', event_date: '2026-11-25', guest_count: 140 }, customer: { name: 'Kavit Mangrolya' } } as any;

describe('own plate price with alternatives', () => {
  it('reads the typed price as the menu as listed, so a cheaper alternative lowers it', () => {
    expect(basePlate(items)).toBe(60);
    expect(ownRange(215, items)).toEqual({ low: 195, high: 215 });
  });
  it('gets the typed price back from what was saved', () => {
    expect(typedPrice(195, 215, items)).toBe(215);
    expect(typedPrice(215, null, items)).toBe(215); // older fixed-price quote
  });
  it('locks the picked price on accept', () => {
    expect(acceptPatch(quote, new Set([pickKey('Mix Bhajiya')])).total_amount).toBe(28800);
    expect(acceptPatch(quote, new Set([pickKey('South Boll')])).total_amount).toBe(31600);
  });
  it('prints one catering line with the range and no ₹0 rows', () => {
    const html = quotationDoc(quote, {}, ctx).html;
    expect(html).toContain('₹195 – ₹215');
    expect(html).toContain('₹28,800 – ₹31,600');
    expect(html).not.toContain('>₹0<');
    expect(html).not.toContain('adjustment');
    expect(html).toContain('+₹20');
  });
});

describe('payment schedule and times', () => {
  it('shows each payment step as a range while choices are open', () => {
    const html = quotationDoc(quote, {}, ctx).html;
    expect(html).toContain('₹2,880 – ₹3,160'); // 10% of 28,800 – 31,600
    expect(html).toContain('final once you choose');
  });
  it('prints times as 11:00 AM', () => {
    expect(quotationDoc({ ...quote, booking: { ...quote.booking, event_time: '11:00:00' } }, {}, ctx).html).toContain('25 Nov 2026 · 11:00 AM');
  });
});

describe('what the customer still has to choose', () => {
  it('an open farsan choice comes before the invoice', () => {
    expect(openChoiceLabels(quote)).toEqual(['Farsan']);
    expect(pendingChoice(quote, 1)).toBe('dishes');
    expect(pendingChoice(quote, 2)).toBe('option');
  });
  it('nothing once picked or accepted', () => {
    const picked = { ...quote, items: items.map((i: any) => (i.item_id === 'Mix Bhajiya' ? { ...i, chosen: true } : i)) };
    expect(pendingChoice(picked, 1)).toBeNull();
    expect(pendingChoice({ ...quote, status: 'accepted' }, 1)).toBeNull();
  });
});
