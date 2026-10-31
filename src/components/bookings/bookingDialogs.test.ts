import { bookingView } from '../../lib/bookingBoard';
import { blankForm, bookingFields, dayHint, findCustomers, formErrors, formFromBooking, splitFood } from './bookingForm';
import { moneyRows, nextBanner, openPicks, remindHref, stageRows } from './eventFacts';

const today = '2026-10-31';
const farsan = { id: 'f', label: 'Farsan', pick: 1 };
const kavitQ = { id: 'q1', quotation_number: 'QTN-0023', booking_id: 'kavit', status: 'sent', created_at: '2026-10-29', issue_date: '2026-10-29',
  total_amount: 28800, total_max: 31600, items: [{ item_id: 'a', item_name: 'South Boll', amount: 60, choice: farsan }, { item_id: 'b', item_name: 'Mix Bhajiya', amount: 40, choice: farsan }] } as any;
const kavit = { id: 'kavit', customer_id: 'c1', customer: { name: 'Kavit Mangrolya', phone: '9876543210' }, event_type: 'Vashtu', event_date: '2026-11-25',
  venue: '', guest_count: 140, status: 'followup', estimated_cost: 0, created_at: '2026-10-28T10:00:00Z', special_instructions: 'Food style: Swaminarayan\nNo onion' } as any;
const jigar = { ...kavit, id: 'jigar', customer: { name: 'Jigar bhai (Hitesh Bhai)', phone: '9876500000' }, event_date: '2026-09-13', status: 'completed' } as any;
const jigarInv = { id: 'i1', booking_id: 'jigar', invoice_number: 'INV-0001', total_amount: 116675, advance_paid: 50000, balance_due: 66675, status: 'sent' } as any;
const view = (b: any, quotes: any[] = [], invoices: any[] = []) => bookingView(b, { quotes, invoices, today, value: 0 });

describe('booking form', () => {
  it('reads the food style from its column, or from older notes', () => {
    expect(splitFood('Food style: Jain\nAllergies')).toEqual({ food: 'Jain', notes: 'Allergies' });
    expect(splitFood('Just notes')).toEqual({ food: 'Regular', notes: 'Just notes' });
    expect(formFromBooking(kavit)).toMatchObject({ food: 'Swaminarayan', notes: 'No onion', guest_count: '140', multiDay: false });
    expect(formFromBooking({ ...kavit, food_type: 'Jain', special_instructions: 'x' })).toMatchObject({ food: 'Jain', notes: 'x' });
  });
  it('shows errors under the fields and saves clean columns', () => {
    expect(formErrors(blankForm(), '', true)).toEqual({ customer: 'Pick a customer, or type a new name and phone', event: 'Type the event name', date: 'Pick the event date' });
    const f = { ...blankForm('2026-11-22'), newName: 'Nikuj Rana', newPhone: '12345', multiDay: true, end_date: '2026-11-21' };
    expect(formErrors(f, 'Get Together', true)).toEqual({ customer: 'Phone must be a 10-digit mobile number', end: 'The last day is before the first day' });
    expect(bookingFields({ ...f, multiDay: false, guest_count: '80', venue: ' Green Lawns ', food: 'Jain' }, 'Get Together')).toEqual({
      event_type: 'Get Together', event_date: '2026-11-22', event_time: null, end_date: null, venue: 'Green Lawns', guest_count: 80, food_type: 'Jain', special_instructions: '',
    });
  });
  it('says whether the day is free', () => {
    expect(dayHint([kavit], '2026-11-22', '')).toEqual({ text: 'Free that day · 0 other events', busy: false });
    expect(dayHint([kavit], '2026-11-25', '')?.text).toBe('1 other event that day: Kavit Mangrolya (Vashtu)');
    expect(dayHint([kavit], '2026-11-25', '', 'kavit')?.busy).toBe(false);
  });
  it('finds customers by name or phone digits', () => {
    const list = [{ name: 'Nikunj', phone: '9000011111' }, { name: 'Nikuj Rana', phone: '7567112345' }, { name: 'Anik', phone: '' }];
    expect(findCustomers(list, 'nik').map(c => c.name)).toEqual(['Nikunj', 'Nikuj Rana', 'Anik']);
    expect(findCustomers(list, '75671').map(c => c.name)).toEqual(['Nikuj Rana']);
  });
});

describe('event page facts', () => {
  it('asks for the pick before accepting', () => {
    const v = view(kavit, [kavitQ]);
    expect(openPicks(kavitQ)).toEqual(['1 farsan']);
    expect(nextBanner(v, today)?.text).toBe('Next: Kavit picks 1 farsan, then you accept. The price is final after that.');
    expect(stageRows(v, [kavitQ]).map(r => [r.title, r.sub, r.mark])).toEqual([
      ['Inquiry', 'Booked 28 Oct', 'done'], ['Quoted', 'QTN-0023 sent · 29 Oct', 'now'], ['Confirmed', 'When the quote is accepted', ''], ['Invoiced', '', ''], ['Paid', '', ''],
    ]);
  });
  it('sums the money before the invoice', () => {
    expect(moneyRows(view(kavit, [kavitQ]), 30)).toEqual([
      { label: 'Advance to ask on accept (30%)', value: '₹8,640 – ₹9,480' }, { label: 'Received so far', value: '₹0' },
      { label: 'Still to come', value: '₹28,800 – ₹31,600', strong: true },
    ]);
    const paid = { ...kavit, advance_received: 5000, advance_mode: 'upi', advance_date: '2026-10-30' };
    expect(moneyRows(view(paid, [{ ...kavitQ, status: 'accepted', total_max: null }]), 30)).toEqual([
      { label: 'Received so far · UPI, 30 Oct', value: '₹5,000' }, { label: 'Still to come', value: '₹23,800', strong: true },
    ]);
  });
  it('flags money still due after the event and offers a reminder', () => {
    const v = view(jigar, [], [jigarInv]);
    expect(nextBanner(v, today)).toEqual({ tone: 'danger', text: '₹66,675 still due, 48 days after the event.' });
    expect(remindHref(v)).toContain('https://wa.me/919876500000?text=Namaste%20Jigar');
  });
});
