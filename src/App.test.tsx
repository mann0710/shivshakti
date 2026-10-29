import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from './components/Sidebar';
import { NAV_ITEMS } from './components/navItems';

test('sidebar lists every page once and navigates on click', () => {
  const onNavigate = jest.fn();
  render(<Sidebar currentPage="dashboard" onNavigate={onNavigate} />);
  NAV_ITEMS.forEach(i => expect(screen.getByText(i.label)).toBeInTheDocument());
  fireEvent.click(screen.getByText('Sweets POS'));
  expect(onNavigate).toHaveBeenCalledWith('seasonal_billing');
});
