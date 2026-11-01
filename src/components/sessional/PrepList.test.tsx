import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { SeasonalPreorder } from '../../hooks/useSeasonalPreorders';
import PrepList, { prepByDate, prepDoc } from './PrepList';

jest.mock('../../lib/ist', () => ({ todayIST: () => '2026-11-03' }));
jest.mock('../../lib/docs/output', () => ({ downloadDoc: jest.fn() }));

const line = (item_name: string, weight: number, qty: number) =>
  ({ item_id: item_name, item_name, weight, weight_unit: 'gm' as const, qty, price: weight, line_total: weight * qty });
const pre = (id: string, delivery_date: string, items: ReturnType<typeof line>[], status: SeasonalPreorder['status'] = 'pending'): SeasonalPreorder =>
  ({ id, customer_name: id, phone: '', items, subtotal: 0, discount_amount: 0, discount_type: 'amount', total_amount: 0, advance_paid: 0, payment_mode: null, delivery_date, status, year: 2026, created_at: '2026-10-20T10:00:00Z' });

const rowOf = (name: string) => screen.getAllByRole('row').find(r => within(r).queryByText(name))!;

const orders = [
  pre('a', '2026-11-03', [line('Mohanthal', 500, 10), line('Kaju Katli', 1000, 20)]),
  pre('b', '2026-11-03', [line('Kaju Katli', 500, 1)]),
  pre('c', '2026-11-05', [line('Magas', 500, 2)]),
  pre('d', '2026-11-03', [line('Magas', 500, 9)], 'ready'),
];

describe('kitchen prep list', () => {
  it('shows packs as size × count, biggest pack first, with the total', () => {
    const [day] = prepByDate(orders);
    const katli = day.items.find(i => i.name === 'Kaju Katli')!;
    expect(katli.sizes).toEqual([[1000, 20], [500, 1]]);
    render(<PrepList preorders={orders} />);
    const row = rowOf('Kaju Katli');
    expect(row).toHaveTextContent('1 kg × 20 + 500 g × 1');
    expect(row).toHaveTextContent('20.5 kg');
    expect(rowOf('Mohanthal')).toHaveTextContent('500 g × 105 kg');
    expect(prepDoc(prepByDate(orders), '').html).toContain('<b>1 kg × 20</b> + <b>500 g × 1</b>');
  });

  it('has its own pickup-date filter for the screen, Print and Download PDF', () => {
    render(<PrepList preorders={orders} />);
    const pick = screen.getByLabelText('Kitchen prep dates');
    fireEvent.change(pick, { target: { value: 'today' } });
    expect(screen.getByText(/Kitchen prep list · Tue 3 Nov/)).toBeInTheDocument();
    expect(screen.queryByText('Magas')).toBeNull();
    fireEvent.change(pick, { target: { value: 'tomorrow' } });
    expect(screen.getByText('Nothing to make for these dates.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download PDF' })).toBeNull();
    fireEvent.change(pick, { target: { value: 'next3' } });
    expect(rowOf('Magas')).toHaveTextContent('500 g × 2');
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeInTheDocument();
  });
});
