import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PickupDates from './PickupDates';
import { ALL_DATES } from '../../lib/preorders';

jest.mock('../../lib/ist', () => ({ todayIST: () => '2026-11-03' }));

describe('pickup dates', () => {
  it('quick choices give a date span; Pick dates shows from and to boxes', () => {
    const onChange = jest.fn();
    const { rerender } = render(<PickupDates value={ALL_DATES} onChange={onChange} />);
    const select = screen.getByLabelText('Pickup dates');
    fireEvent.change(select, { target: { value: 'tomorrow' } });
    expect(onChange).toHaveBeenLastCalledWith({ from: '2026-11-04', to: '2026-11-04' });
    expect(screen.queryByLabelText('From pickup date')).toBeNull();
    fireEvent.change(select, { target: { value: 'custom' } });
    expect(onChange).toHaveBeenLastCalledWith({ from: '2026-11-03', to: '2026-11-05' });
    rerender(<PickupDates value={{ from: '2026-11-03', to: '2026-11-05' }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('To pickup date'), { target: { value: '2026-11-08' } });
    expect(onChange).toHaveBeenLastCalledWith({ from: '2026-11-03', to: '2026-11-08' });
    fireEvent.change(select, { target: { value: 'all' } });
    expect(onChange).toHaveBeenLastCalledWith(ALL_DATES);
  });
});
