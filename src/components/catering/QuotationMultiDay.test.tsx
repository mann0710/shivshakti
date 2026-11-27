import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import QuotationMultiDay from './QuotationMultiDay';

jest.mock('../../lib/supabase', () => ({ supabase: {} }));
jest.mock('../../hooks/useMenus', () => ({ useMenus: () => ({ data: [] }) }));
Object.assign(window, { matchMedia: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }) });

const dish = (id: string, amount: number) => ({ item_id: id, item_name: id, category_name: 'Main Course', subcategory_name: '', amount }) as any;
const meal = { id: 'm', meal_type: 'dinner', time: '20:30', guest_count: 400, per_plate_amount: 690, discount_amount: 0, items: [dish('Paneer', 400), dish('Naan', 303)], subtotal: 276000 };

const setup = (meals: any[] = [meal], onOneMeal?: jest.Mock, quotes: any[] = []) => {
  let days: any[] = [{ day_number: 1, date: '2026-11-27', meals, day_subtotal: 0 }];
  const set = (fn: any) => { days = typeof fn === 'function' ? fn(days) : fn; };
  const ui = () => <QuotationMultiDay eventDays={days} setEventDays={set} guestCount={400} defaultDate="2026-11-27" menuItems={[]} toLine={(x: any) => x}
    showPrices pdfPrices who="Pradeep" onOneMeal={onOneMeal} quotes={quotes} currentId={null} />;
  const view = render(ui());
  return { get: () => days, again: () => view.rerender(ui()) };
};

describe('meal price block', () => {
  it('shows the menu value, the plate discount and goes back to the dish total', () => {
    const t = setup();
    const block = screen.getByRole('group', { name: 'Price a plate' });
    expect(within(block).getByText('₹703')).toBeInTheDocument();
    expect(within(block).getByText('₹13 off a plate · ₹5,200 off this meal')).toBeInTheDocument();
    expect(within(block).getByRole('checkbox', { name: /Show the discount/ })).toBeChecked();
    fireEvent.click(within(block).getByRole('button', { name: 'Use ₹703' }));
    t.again();
    expect([t.get()[0].meals[0].per_plate_amount, t.get()[0].meals[0].subtotal]).toEqual([703, 281200]);
  });

  it('clearing your price follows the dishes, never ₹0', () => {
    const t = setup();
    const box = screen.getByLabelText('Your price');
    fireEvent.change(box, { target: { value: '' } });
    t.again();
    expect(t.get()[0].meals[0].per_plate_amount).toBe(703);
    expect(screen.getByLabelText('Your price')).toHaveAttribute('placeholder', '₹703');
  });

  it('the discount tick hides it, and a list price under More replaces the dish total', () => {
    const t = setup();
    fireEvent.click(screen.getByRole('checkbox', { name: /Show the discount/ }));
    t.again();
    expect(t.get()[0].meals[0].hide_discount).toBe(true);
    fireEvent.change(screen.getByLabelText(/List price a plate/), { target: { value: '710' } });
    t.again();
    expect(screen.getByText('₹20 off a plate · ₹8,000 off this meal')).toBeInTheDocument();
  });

  it('the only meal can go back to a one-meal quote', () => {
    const back = jest.fn();
    setup([meal], back);
    fireEvent.click(screen.getByRole('button', { name: 'Make it a one-meal quote' }));
    expect(back).toHaveBeenCalledWith('2026-11-27', expect.objectContaining({ id: 'm' }));
  });

  it('a meal with an offer price, ceremony or its own dish-price setting stays a meal', () => {
    setup([{ ...meal, ceremony_name: 'Haldi' }], jest.fn());
    expect(screen.queryByRole('button', { name: 'Make it a one-meal quote' })).toBeNull();
  });

  it('copies one meal of another quote into this meal', () => {
    const other = { id: 'o', quotation_number: 'QTN-0009', is_multi_day: true, created_at: '', customer: { name: 'Amit' }, booking: { event_type: 'Puja' },
      event_days: [{ date: '2026-12-11', meals: [{ ...meal, id: 'x', meal_type: 'lunch', items: [dish('Puri', 20), dish('Dal', 30)] }] }] };
    const t = setup([{ ...meal, items: [], per_plate_amount: 0, subtotal: 0 }], undefined, [other]);
    fireEvent.click(screen.getByRole('button', { name: 'Copy from another quote' }));
    expect(screen.getByText('Amit · Puja · Lunch · 8:30 PM')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Copy 2 dishes' }));
    t.again();
    expect([t.get()[0].meals[0].items.map((i: any) => i.item_name), t.get()[0].meals[0].per_plate_amount]).toEqual([['Puri', 'Dal'], 50]);
  });
});
