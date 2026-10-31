import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Sidebar from './components/Sidebar';
import { NAV_ITEMS } from './components/navItems';

jest.mock('./hooks/useDocSettings', () => ({ useDocSettings: () => ({ logo_url: '' }) }));

test('sidebar lists every page once and navigates on click', () => {
  const onNavigate = jest.fn();
  render(<Sidebar currentPage="dashboard" role="owner" onNavigate={onNavigate} />);
  NAV_ITEMS.forEach(i => expect(screen.getByText(i.label)).toBeInTheDocument());
  fireEvent.click(screen.getByText('Sweets POS'));
  expect(onNavigate).toHaveBeenCalledWith('seasonal_billing');
});

test('counter staff see only the sweets screens', () => {
  render(<Sidebar currentPage="seasonal_billing" role="counter" onNavigate={jest.fn()} />);
  expect(screen.getByText('Sweets POS')).toBeInTheDocument();
  expect(screen.queryByText('Money')).toBeNull();
  expect(screen.queryByText('Settings')).toBeNull();
  expect(screen.getByText('Counter')).toBeInTheDocument();
});
