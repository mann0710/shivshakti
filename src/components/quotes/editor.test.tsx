import React from 'react';
import { render, screen, fireEvent, within, waitFor, act } from '@testing-library/react';
import Quotations from '../../pages/Quotations';

const mockUpdate = jest.fn();
const mockCreate = jest.fn();
const mockUpdateBooking = jest.fn();
const mockBookings = [
  { id: 'bk', customer_id: 'c1', customer: { name: 'Kavit Mangrolya', phone: '9876544821' }, event_type: 'Vashtu', event_date: '2099-11-25', event_time: '11:00:00', venue: '', guest_count: 140, status: 'followup', estimated_cost: 0, created_at: '' },
  { id: 'br', customer_id: 'c2', customer: { name: 'Rushi Ghandhi' }, event_type: 'Wedding', event_date: '2099-12-06', venue: '', guest_count: 0, status: 'inquiry', estimated_cost: 0, created_at: '' },
];
const mockQuotes = [{
  id: 'k', quotation_number: 'QTN-0023', status: 'sent', booking_id: 'bk', customer_id: 'c1', customer: mockBookings[0].customer, booking: mockBookings[0],
  guest_count: 140, per_plate_amount: 200, total_amount: 28000, subtotal: 28000, discount_amount: 0, discount_type: 'amount', gst_rate: 0, gst_amount: 0,
  extra_charges: [], transportation_charges: [], additional_discounts: [], created_at: '2026-10-29T10:00:00Z', issue_date: '2026-10-29',
  items: [{ item_id: 'puri', item_name: 'Puri', category_name: 'Indian Breads', subcategory_name: 'Indian Breads', amount: 0 }],
}];
const mockMenu = [
  { id: 'puri', name: 'Puri', subcategory: { name: 'Indian Breads', category: { name: 'Indian Breads' } } },
  { id: 'dal', name: 'Gujarati Dal', subcategory: { name: 'Dal', category: { name: 'Main Course' } } },
];
const mockPackages = [{ id: 'pk', name: 'Besic', category: 'Gujarati', price_per_plate: 270, items: ['Puri', 'Gujarati Dal'], is_active: true, created_at: '',
  price_tiers: [{ upto: 150, price: 270 }, { upto: 300, price: 250 }, { upto: null, price: 230 }] }];

jest.mock('../../lib/supabase', () => ({ supabase: { from: () => ({ update: () => ({ eq: async () => ({ error: null }) }) }) } }));
jest.mock('../../lib/docs/output', () => ({ downloadDoc: jest.fn(), shareDoc: jest.fn(), pdfBlob: jest.fn() }));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: jest.fn() }) }));
jest.mock('../../hooks/useBookings', () => ({ useBookings: () => ({ data: mockBookings, isFetched: true }), useUpdateBooking: () => ({ mutateAsync: mockUpdateBooking }) }));
jest.mock('../../hooks/useQuotations', () => ({
  useQuotations: () => ({ data: mockQuotes, isFetched: true, isLoading: false }),
  useCreateQuotation: () => ({ mutateAsync: mockCreate, isPending: false }),
  useUpdateQuotation: () => ({ mutateAsync: mockUpdate, isPending: false }),
  useUpdateQuotationStatus: () => ({ mutateAsync: jest.fn() }),
  useDeleteQuotation: () => ({ mutateAsync: jest.fn() }),
}));
jest.mock('../../hooks/useMenuBuilder', () => ({ useMenuItemsFull: () => ({ data: mockMenu }) }));
jest.mock('../../hooks/useItemPrices', () => ({ useItemPrices: () => () => 0 }));
jest.mock('../../hooks/useDataCenter', () => ({ useDataCenter: () => ({ data: { gst_rate: 5 } }), useEventTypes: () => ({ data: [] }), DEFAULT_EVENTS: ['Wedding'] }));
jest.mock('../../hooks/useInvoices', () => ({ useInvoices: () => ({ data: [] }) }));
jest.mock('../../hooks/useSchemaStatus', () => ({ useHasQuoteOptions: () => true }));
jest.mock('../../hooks/useMenus', () => ({ useMenus: () => ({ data: mockPackages }), useCreateMenu: () => ({ mutateAsync: jest.fn() }) }));
jest.mock('../../hooks/useDocSettings', () => ({ useDocSettings: () => jest.requireActual('../../lib/docs/settings').DEFAULT_DOC_SETTINGS }));
jest.mock('../catering/BookingFormModal', () => () => null);

Object.assign(window, { matchMedia: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }) });
const settle = (ms = 250) => act(() => new Promise(r => setTimeout(r, ms)));

// CRA resets mocks before each test, so the saves answer like Supabase here.
beforeEach(() => {
  mockUpdate.mockImplementation(async (q: any) => ({ ...q }));
  mockCreate.mockImplementation(async (q: any) => ({ ...q, id: 'new1', quotation_number: 'QTN-0099', created_at: '2026-10-31T10:00:00Z' }));
  mockUpdateBooking.mockImplementation(async (b: any) => b);
});

describe('quote editor', () => {
  it('opens without writing, then saves a change by itself', async () => {
    render(<Quotations />);
    fireEvent.click(within(screen.getByRole('complementary', { name: 'Selected quotation' })).getByRole('button', { name: 'Edit' }));
    expect(screen.getByText('All changes saved')).toBeInTheDocument();
    ['Event', 'Menu', 'Price', 'Payment plan', 'On the PDF'].forEach(name => expect(screen.getByRole('region', { name })).toBeInTheDocument());
    expect(screen.getByText('1 dish in 1 course')).toBeInTheDocument();
    await settle();
    expect(mockUpdate).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Guests'), { target: { value: '150' } });
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(mockUpdate.mock.calls[0][0]).toMatchObject({ id: 'k', guest_count: 150, total_amount: 30000 });
    expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty('status');
    await waitFor(() => expect(mockUpdateBooking).toHaveBeenCalledWith({ id: 'bk', guest_count: 150 }));
    expect(await screen.findByText('All changes saved')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back to Quotations' }));
    expect(await screen.findByRole('heading', { name: 'Quotations' })).toBeInTheDocument();
  });

  it('a change still waiting is saved when the page closes', async () => {
    const { unmount } = render(<Quotations />);
    fireEvent.click(within(screen.getByRole('complementary', { name: 'Selected quotation' })).getByRole('button', { name: 'Edit' }));
    await settle();
    fireEvent.change(screen.getByLabelText('Note for Kavit'), { target: { value: 'Live counter on request' } });
    unmount();
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: 'k', notes: 'Live counter on request' })));
  });

  it('a package price follows the guest count until a price is typed', async () => {
    render(<Quotations />);
    fireEvent.click(within(screen.getByRole('complementary', { name: 'Selected quotation' })).getByRole('button', { name: 'Edit' }));
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Start from a package' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use Besic' }));
    const own = screen.getByLabelText('Own price a plate') as HTMLInputElement;
    expect(own.value).toBe('270');
    expect(screen.getByText('₹270 a plate for up to 150 guests (Besic)')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Guests'), { target: { value: '200' } });
    expect(own.value).toBe('250');
    expect(screen.getByText('₹250 a plate for 151–300 guests (Besic)')).toBeInTheDocument();
    fireEvent.change(own, { target: { value: '260' } });
    fireEvent.change(screen.getByLabelText('Guests'), { target: { value: '400' } });
    expect(own.value).toBe('260');
    fireEvent.click(screen.getByRole('button', { name: 'Use ₹230' }));
    expect(own.value).toBe('230');
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: 'k', guest_count: 400, per_plate_amount: 230 })), { timeout: 3000 });
  });

  it('a new quote is created on the first change', async () => {
    render(<Quotations />);
    fireEvent.click(screen.getByRole('button', { name: '+ New quotation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start for Rushi' }));
    expect(screen.getByText('Not saved yet — saves when you change something')).toBeInTheDocument();
    await settle();
    expect(mockCreate).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('combobox', { name: 'Add a dish' }), { target: { value: 'dal' } });
    fireEvent.click(screen.getByRole('option', { name: /Gujarati Dal/ }));
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(mockCreate.mock.calls[0][0]).toMatchObject({ booking_id: 'br', customer_id: 'c2', status: 'draft', items: [expect.objectContaining({ item_name: 'Gujarati Dal' })] });
    expect(await screen.findByText('QTN-0099 · Rushi Ghandhi')).toBeInTheDocument();
  });
});
