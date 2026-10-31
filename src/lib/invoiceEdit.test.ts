import { mealRows, editMeal, daysSubtotal, parseDiscount, payState, summaryLines, paymentPlan, quickAmounts, afterThis, invoiceFromQuote, needsGuests } from './invoiceEdit';

const TODAY = '2026-10-31';
const days = [{ day_number: 1, date: '2026-09-13', day_subtotal: 104575, meals: [
  { meal_type: 'breakfast', time: '', guest_count: 135, per_plate_amount: 80, subtotal: 10800, items: [{ item_name: 'Chai' }, { item_name: 'Jalebi' }] },
  { meal_type: 'breakfast', time: '12:04', guest_count: 275, per_plate_amount: 341, subtotal: 93775, items: [{ item_name: 'Pulka Roti' }] },
] }];

describe('invoice meals', () => {
  it('lists meals with final counts and flags a repeated meal type', () => {
    const rows = mealRows({ is_multi_day: true, event_days: days, subtotal: 104575, line_items: [] }, days, 0);
    expect(rows.map(r => [r.name, r.note, r.guests, r.rate, r.total])).toEqual([
      ['Breakfast', 'No time set', 135, 80, 10800],
      ['Second meal', 'Saved as "breakfast" at 12:04 PM — lunch?', 275, 341, 93775],
    ]);
    expect(rows[1].warn).toBe(true);
    expect(rows[0].dishes).toEqual(['Chai', 'Jalebi']);
  });
  it('reprices a meal and its day when guests or the plate rate change', () => {
    const next = editMeal(days, 0, 0, { guests: 140 });
    expect(next[0].meals[0].subtotal).toBe(11200);
    expect(daysSubtotal(next)).toBe(11200 + 93775);
    expect(editMeal(days, 0, 1, { rate: 300 })[0].meals[1].subtotal).toBe(82500);
  });
  it('derives single-day guests from the plate rate', () => {
    const [row] = mealRows({ is_multi_day: false, event_days: [], subtotal: 30000, line_items: [{ description: 'Sweets › Mithai › Jalebi', quantity: 1, unit_price: 0, total: 0 }] }, [], 300);
    expect(row).toMatchObject({ guests: 100, rate: 300, rateEditable: false, dishes: ['Jalebi'] });
  });
});

describe('invoice money', () => {
  const inv: any = { subtotal: 104575, extra_charges: [{ description: 'Farashkhana', amount: 10700 }], transportation_charge: 1400, discount_amount: 0, gst_amount: 0, gst_rate: 0, total_amount: 116675, advance_paid: 50000, balance_due: 66675 };
  it('reads discounts as rupees or a share', () => {
    expect(parseDiscount('10%', 1000)).toBe(100);
    expect(parseDiscount('₹2,500', 1000)).toBe(1000);
    expect(parseDiscount('', 1000)).toBe(0);
  });
  it('sums up the invoice like the editor side panel', () => {
    expect(summaryLines(inv).map(l => [l.k, l.v])).toEqual([
      ['Meals', '₹1,04,575'], ['Extras', '₹12,100'], ['Total', '₹1,16,675'], ['Paid', '− ₹50,000'], ['Balance', '₹66,675'],
    ]);
    expect(payState(inv)).toBe('Part paid');
    expect(payState({ advance_paid: 0, balance_due: 10 })).toBe('Not paid');
  });
  it('shows payments then the balance with its age', () => {
    const rows = paymentPlan([{ id: 'p', invoice_id: 'i', amount: 50000, payment_date: '2026-09-14', payment_type: 'advance', payment_mode: 'cash', created_at: '' }], inv, '2026-09-13', TODAY);
    expect(rows.map(r => [r.when, r.what, r.amount, r.status])).toEqual([['Mon 14 Sep', 'Advance · cash', 50000, 'Received'], ['After the event', 'Balance', 66675, '48 days']]);
  });
  it('offers full and half balance', () => {
    expect(quickAmounts(66675).map(q => q.value)).toEqual([66675, 33338]);
    expect(afterThis(66675, 66675)).toBe('Paid in full');
    expect(afterThis(66675, 60000)).toBe('₹6,675 still due');
  });
});

describe('new invoice from a quote', () => {
  const booking: any = { id: 'b', guest_count: 0, estimated_cost: 0 };
  const quote: any = { id: 'q', is_multi_day: false, per_plate_amount: 370, guest_count: 0, subtotal: 0, discount_amount: 0, discount_type: 'amount', gst_rate: 5, gst_amount: 0, items: [{ category_name: 'A', subcategory_name: 'B', item_name: 'Dal', amount: 0 }], extra_charges: [], transportation_charges: [], additional_discounts: [] };
  it('needs final guests when a per-plate quote has none, and prices with them', () => {
    expect(needsGuests(quote, booking)).toBe(true);
    const inv = invoiceFromQuote(booking, quote, 100);
    expect(inv).toMatchObject({ subtotal: 37000, gst_amount: 1850, quotation_id: 'q' });
    expect(inv.line_items![0].description).toBe('A › B › Dal');
  });
});
