import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import QuotationMultiDay from './QuotationMultiDay';

const dish = (id: string, amount: number) => ({ item_id: id, item_name: id, category_name: 'Main Course', subcategory_name: '', amount }) as any;
const meal = { id: 'm', meal_type: 'dinner', time: '20:30', guest_count: 400, per_plate_amount: 690, discount_amount: 0, items: [dish('Paneer', 400), dish('Naan', 303)], subtotal: 276000 };

describe('meal plate price', () => {
  it('names the dish total and goes back to it when A plate is cleared', () => {
    let days: any[] = [{ day_number: 1, date: '2026-11-27', meals: [meal], day_subtotal: 276000 }];
    const set = (fn: any) => { days = typeof fn === 'function' ? fn(days) : fn; };
    const ui = () => <QuotationMultiDay eventDays={days} setEventDays={set} guestCount={400} defaultDate="2026-11-27" menuItems={[]} toLine={(x: any) => x} showPrices who="Pradeep" />;
    const { rerender } = render(ui());
    expect(screen.getByText(/dishes add up to ₹703/)).toBeInTheDocument();
    const box = screen.getByLabelText('A plate');
    fireEvent.change(box, { target: { value: '' } });
    rerender(ui());
    expect(days[0].meals[0].per_plate_amount).toBe(0);
    expect(screen.getByLabelText('A plate')).toHaveAttribute('placeholder', '₹703');
    fireEvent.blur(screen.getByLabelText('A plate'));
    rerender(ui());
    expect([days[0].meals[0].per_plate_amount, days[0].meals[0].subtotal]).toEqual([703, 281200]);
  });
  it('swaps a before-discount price typed below the plate price', () => {
    let days: any[] = [{ day_number: 1, date: '2026-11-27', meals: [{ ...meal, per_plate_amount: 703, subtotal: 281200 }], day_subtotal: 281200 }];
    const set = (fn: any) => { days = typeof fn === 'function' ? fn(days) : fn; };
    const ui = () => <QuotationMultiDay eventDays={days} setEventDays={set} guestCount={400} defaultDate="2026-11-27" menuItems={[]} toLine={(x: any) => x} showPrices who="Pradeep" />;
    const { rerender } = render(ui());
    fireEvent.change(screen.getByLabelText('Price a plate before discount'), { target: { value: '690' } });
    rerender(ui());
    fireEvent.blur(screen.getByLabelText('Price a plate before discount'));
    rerender(ui());
    const m = days[0].meals[0];
    expect([m.per_plate_amount, m.full_price, m.subtotal]).toEqual([690, 703, 276000]);
    expect(screen.getByText(/₹13 off ₹703 saves ₹5,200/)).toBeInTheDocument();
  });
});
