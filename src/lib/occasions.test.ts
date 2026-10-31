import {
  occasionOn, datesText, dayName, daysBetween, awayText, seasonTitle, nextOccasion, billIn, bookingIn, seasonCount, checkDates, seasonBanner, occasionState,
} from './occasions';

const diwali = { id: 'd', name: 'Diwali', is_active: true, start_date: '2026-10-25', end_date: '2026-11-08' };
const rakhi = { id: 'r', name: 'Rakhi', is_active: true, start_date: null, end_date: null };

describe('occasions', () => {
  it('finds the season for a day', () => {
    expect(occasionOn([diwali, rakhi], '2026-10-31')?.name).toBe('Diwali');
    expect(occasionOn([diwali, rakhi], '2026-11-09')).toBeUndefined();
  });
  it('prefers the shorter season and skips inactive ones', () => {
    const dhanteras = { id: 'x', name: 'Dhanteras', is_active: true, start_date: '2026-11-05', end_date: '2026-11-06' };
    expect(occasionOn([diwali, dhanteras], '2026-11-06')?.name).toBe('Dhanteras');
    expect(occasionOn([{ ...diwali, is_active: false }], '2026-10-31')).toBeUndefined();
  });
  it('formats dates', () => {
    expect(datesText(diwali)).toBe('25 Oct – 8 Nov');
    expect(datesText(rakhi)).toBe('');
    expect(dayName('2026-11-08')).toBe('Sun 8 Nov');
    expect(seasonTitle(diwali)).toBe('Diwali 2026');
    expect(seasonTitle({ ...diwali, name: 'Diwali 2025' })).toBe('Diwali 2025');
    expect(seasonTitle(rakhi)).toBe('Rakhi');
  });
  it('counts days to the festival', () => {
    expect(daysBetween('2026-10-31', '2026-11-08')).toBe(8);
    expect(awayText(8)).toBe('8 days away');
    expect(awayText(1)).toBe('tomorrow');
    expect(awayText(0)).toBe('today');
  });
  it('finds the next season', () => {
    expect(nextOccasion([diwali, rakhi], '2026-10-01')?.name).toBe('Diwali');
    expect(nextOccasion([diwali, rakhi], '2026-10-26')).toBeUndefined();
  });
  it('counts bills and pre-bookings within the dates, or by tag without dates', () => {
    const bills = [
      { created_at: '2026-10-30T20:00:00Z', occasion_id: null },            // 31 Oct in India
      { created_at: '2026-11-08T19:00:00Z', occasion_id: null },            // 9 Nov in India: outside
      { created_at: '2026-10-31T05:00:00Z', occasion_id: 'r', cancelled_at: '2026-10-31T06:00:00Z' },
      { created_at: '2026-08-01T05:00:00Z', occasion_id: 'r' },
    ];
    const bookings = [
      { created_at: '2026-10-20T05:00:00Z', delivery_date: '2026-11-04', status: 'pending' },
      { created_at: '2026-10-28T05:00:00Z', delivery_date: null, status: 'confirmed' },
      { created_at: '2026-10-28T05:00:00Z', delivery_date: '2026-11-04', status: 'cancelled' },
      { created_at: '2026-08-01T05:00:00Z', delivery_date: '2026-08-02', status: 'delivered', occasion_id: 'r' },
    ];
    expect(billIn(diwali, bills[0])).toBe(true);
    expect(billIn(diwali, bills[1])).toBe(false);
    expect(bookingIn(diwali, bookings[1])).toBe(true);
    expect(seasonCount(diwali, bills, bookings)).toEqual({ bills: 1, bookings: 2 });
    expect(seasonCount(rakhi, bills, bookings)).toEqual({ bills: 1, bookings: 1 });
  });
  it('checks the dates in the dialog', () => {
    expect(checkDates('', '')).toEqual({ ok: true });
    expect(checkDates('2026-10-25', '')).toEqual({ ok: false, error: 'Pick both dates, or leave both empty' });
    expect(checkDates('2026-11-08', '2026-10-25').ok).toBe(false);
    expect(checkDates('2026-10-25', '2026-11-08')).toEqual({ ok: true });
  });
  it('writes the season strip from the dates', () => {
    const dhanteras = { id: 'x', name: 'Dhanteras', is_active: false, start_date: '2026-11-06', end_date: '2026-11-06' };
    expect(seasonBanner([diwali, rakhi, dhanteras], '2026-10-31')).toEqual({
      badge: '8',
      title: 'Diwali season · Diwali is Sun 8 Nov, 8 days away',
      text: 'Bills and pre-bookings dated 25 Oct – 8 Nov count for "Diwali 2026". Dhanteras is Fri 6 Nov.',
      short: 'Diwali in 8 days',
    });
    expect(seasonBanner([diwali], '2026-11-08').title).toBe('Diwali season · Diwali is today, Sun 8 Nov');
    expect(seasonBanner([{ ...diwali, is_active: false }], '2026-10-20')).toMatchObject({ badge: '5', short: 'Diwali in 19 days' });
    expect(seasonBanner([rakhi], '2026-10-20').title).toBe('Rakhi is on the counter · dates not set');
    expect(seasonBanner([], '2026-10-20').short).toBe('no season');
  });
  it('says whether an occasion is on the counter', () => {
    expect(occasionState(diwali, '2026-10-31')).toBe('On the counter now · Diwali is Sun 8 Nov');
    expect(occasionState(diwali, '2026-10-01')).toBe('On the counter · season starts Sun 25 Oct');
    expect(occasionState(diwali, '2026-11-20')).toBe('On the counter · season ended Sun 8 Nov');
    expect(occasionState(rakhi, '2026-10-31')).toBe('On the counter · dates not set');
    expect(occasionState({ ...rakhi, is_active: false }, '2026-10-31')).toBe('Off — sweets hidden from the POS');
  });
});
