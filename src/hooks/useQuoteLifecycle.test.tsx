import React from 'react';
import { act, render, renderHook, screen } from '@testing-library/react';
import toast, { Toaster } from 'react-hot-toast';
import { useQuoteLifecycle } from './useQuoteLifecycle';

const saved = { id: 'b1', status: 'confirmed', event_type: 'Wedding', event_date: '2026-11-25', event_time: '19:00', guest_count: 150, venue: 'Party Plot', customer: { name: 'Kavit M', email: 'k@example.com' } };
jest.mock('../lib/supabase', () => ({ supabase: {} }));
jest.mock('./useBookings', () => ({ useUpdateBooking: () => ({ mutateAsync: jest.fn(async () => saved) }) }));
jest.mock('./useQuotations', () => ({ useUpdateQuotationStatus: () => ({ mutateAsync: jest.fn() }) }));
jest.mock('./useDataCenter', () => ({ useTeamMembers: () => ({ data: [{ email: 'team@example.com' }] }) }));

Object.assign(window, { matchMedia: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }) });
afterEach(() => act(() => { toast.remove(); }));

const quote = (status: string) => ({ id: 'q1', quotation_number: 'QTN-0023', status: 'sent', booking_id: 'b1', booking: { ...saved, status }, customer: saved.customer }) as any;

// Accepting a quote confirms the booking, so it offers Google Calendar like Bookings → Confirm does.
test('accepting a quote that confirms the booking offers Add to Google Calendar and Create invoice', async () => {
  render(<Toaster />);
  const { result } = renderHook(() => useQuoteLifecycle(jest.fn()));
  await act(() => result.current.setStatus([quote('followup')], 'accepted'));
  expect(await screen.findByText("QTN-0023 accepted · Kavit's booking confirmed")).toBeInTheDocument();
  const link = screen.getByRole('link', { name: /Add to Google Calendar/ });
  expect(link.getAttribute('href')).toContain('calendar.google.com');
  expect(decodeURIComponent(link.getAttribute('href')!)).toContain('k@example.com,team@example.com');
  expect(screen.getByRole('button', { name: 'Create invoice' })).toBeInTheDocument();
});

test('accepting a quote on an already confirmed booking does not offer the calendar again', async () => {
  render(<Toaster />);
  const { result } = renderHook(() => useQuoteLifecycle(jest.fn()));
  await act(() => result.current.setStatus([quote('confirmed')], 'accepted'));
  expect(await screen.findByText('QTN-0023 accepted')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /Google Calendar/ })).toBeNull();
});
