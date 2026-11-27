import React from 'react';
import { act, render, screen } from '@testing-library/react';
import App from './App';

// The app shell only: auth is set per test, each page is a stub that shows its record from the address.
let mockAuth = { access: 'staff', role: 'owner' };
jest.mock('./hooks/useAuth', () => ({ useAuth: () => ({ ...mockAuth, email: 'a@b.c', needsPassword: false, signOut: async () => {} }) }));
jest.mock('./lib/supabase', () => ({ supabase: {} }));
jest.mock('./hooks/useDocSettings', () => ({ useDocSettings: () => ({ logo_url: '' }), useDocContextSync: () => {} }));
jest.mock('./components/LoginScreen', () => () => <p>Sign in</p>);
// A declaration, so the hoisted jest.mock calls can use it.
function mockPage(page: string) {
  const Page = () => {
    const { useRecordRoute } = require('./hooks/useRoute');
    return <p>{`${page}:${useRecordRoute(page).id ?? '-'}`}</p>;
  };
  return { __esModule: true, default: Page };
}
jest.mock('./pages/Dashboard', () => mockPage('dashboard'));
jest.mock('./pages/Bookings', () => mockPage('bookings'));
jest.mock('./pages/Customers', () => mockPage('customers'));
jest.mock('./pages/Menus', () => mockPage('menus'));
jest.mock('./pages/Billing', () => mockPage('billing'));
jest.mock('./pages/Finance', () => mockPage('finance'));
jest.mock('./pages/DataCenter', () => mockPage('datacenter'));
jest.mock('./pages/MenuBuilder', () => mockPage('menubuilder'));
jest.mock('./pages/Quotations', () => mockPage('quotations'));
jest.mock('./pages/SeasonalItems', () => mockPage('seasonal_items'));
jest.mock('./pages/SeasonalBilling', () => mockPage('seasonal_billing'));
jest.mock('./pages/SeasonalOccasions', () => mockPage('seasonal_occasions'));
jest.mock('./pages/SeasonalDashboard', () => mockPage('seasonal_dashboard'));
jest.mock('./pages/SeasonalCustomers', () => mockPage('seasonal_customers'));

const at = (url: string) => window.history.replaceState(null, '', url);
const popTo = (url: string) => act(() => { window.history.pushState(null, '', url); window.dispatchEvent(new PopStateEvent('popstate')); });

beforeEach(() => { mockAuth = { access: 'staff', role: 'owner' }; });

test('a pasted link opens its page and record, and Back/Forward follow the address', () => {
  at('/invoices/i1');
  render(<App />);
  expect(screen.getByText('billing:i1')).toBeInTheDocument();
  popTo('/quotations/q7');
  expect(screen.getByText('quotations:q7')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Quotations' })).toHaveAttribute('aria-current', 'page');
});

test('an old #page link opens its page under the new address', () => {
  at('/#quotations');
  render(<App />);
  expect(screen.getByText('quotations:-')).toBeInTheDocument();
  expect(window.location.pathname + window.location.hash).toBe('/quotations');
});

test('a signed-out visitor keeps the link until signed in', () => {
  mockAuth = { access: 'signed_out', role: 'owner' };
  at('/settings/credit');
  const { rerender } = render(<App />);
  expect(screen.getByText('Sign in')).toBeInTheDocument();
  expect(window.location.pathname).toBe('/settings/credit');
  mockAuth = { access: 'staff', role: 'owner' };
  rerender(<App />);
  expect(screen.getByText('datacenter:credit')).toBeInTheDocument();
});

test('a link the login cannot open goes to its home screen', () => {
  mockAuth = { access: 'staff', role: 'counter' };
  at('/quotations/q7');
  render(<App />);
  expect(screen.getByText('seasonal_billing:-')).toBeInTheDocument();
  expect(window.location.pathname).toBe('/pos');
});
