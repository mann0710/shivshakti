import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import QuoteBoard from './QuoteBoard';
import SendDialog from './SendDialog';
import QuoteAcceptDialog from '../catering/QuoteAcceptDialog';

jest.mock('../../lib/supabase', () => ({ supabase: {} }));
jest.mock('../../lib/docs/output', () => ({ downloadDoc: jest.fn(), shareDoc: jest.fn(), pdfBlob: jest.fn() }));
jest.mock('../../hooks/useBookings', () => ({ useBookings: () => ({ data: [] }), useUpdateBooking: () => ({ mutateAsync: jest.fn() }) }));
jest.mock('../../hooks/useQuotations', () => ({ useUpdateQuotationStatus: () => ({ mutateAsync: jest.fn() }) }));
jest.mock('../../hooks/useDocSettings', () => ({ useDocSettings: () => ({ ...jest.requireActual('../../lib/docs/settings').DEFAULT_DOC_SETTINGS, schedule: [{ pct: 30, label: 'Advance', when: '' }, { pct: 70, label: 'Balance', when: '' }] }) }));

Object.assign(window, { matchMedia: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }) });

const farsan = { id: 'f', label: 'Farsan', pick: 1 };
const dish = (name: string, amount = 0, extra: object = {}) => ({ item_id: name, item_name: name, category_name: 'Farsan', subcategory_name: 'Farsan', amount, ...extra });
const base = { created_at: '2026-10-29T10:00:00Z', issue_date: '2026-10-29', extra_charges: [], additional_discounts: [], gst_rate: 0, gst_amount: 0, discount_amount: 0 };
const kavit = {
  ...base, id: 'k', quotation_number: 'QTN-0023', status: 'sent', guest_count: 140, per_plate_amount: 195, per_plate_max: 215, total_amount: 28800, total_max: 31600, subtotal: 27300,
  transportation_charges: [{ description: 'Transport', amount: 1500 }], booking_id: 'bk', customer: { name: 'Kavit Mangrolya', phone: '9876544821' },
  booking: { event_type: 'Vashtu', event_date: '2099-11-25', guest_count: 140, status: 'followup' },
  items: [dish('South Boll', 60, { choice: farsan }), dish('Mix Bhajiya', 80, { choice: farsan })],
} as any;
const bhavin = { ...base, id: 'b', quotation_number: 'QTN-0015', status: 'draft', guest_count: 175, per_plate_amount: 201, total_amount: 35175, subtotal: 35175, transportation_charges: [], booking_id: 'bb', customer: { name: 'Bhavin bhai' }, booking: { event_type: 'Vashtu', event_date: '2099-11-26', guest_count: 175 }, items: [dish('Puri')] } as any;

const actions = () => ({ open: jest.fn(), send: jest.fn(), pdf: jest.fn(), accept: jest.fn(), duplicate: jest.fn(), addOption: jest.fn(), savePackage: jest.fn(), setStatus: jest.fn(), remove: jest.fn(), invoice: jest.fn() });

describe('quotation list', () => {
  it('shows follow-ups first, the selected quote and its next steps', () => {
    const a = actions();
    render(<QuoteBoard quotes={[bhavin, kavit]} loading={false} invoiced={new Set()} a={a} onNew={jest.fn()} />);
    expect(screen.getByText('1 waiting for the customer · 1 draft to send')).toBeInTheDocument();
    const titles = screen.getAllByText(/· 1$/).map(e => e.textContent);
    expect(titles).toEqual(['Waiting for the customer · 1', 'Drafts to send · soonest event first · 1']);
    const panel = screen.getByRole('complementary', { name: 'Selected quotation' });
    expect(within(panel).getByText('Farsan — customer picks 1')).toBeInTheDocument();
    expect(within(panel).getByText('No reply yet — a reminder is on Home')).toBeInTheDocument();
    fireEvent.click(within(panel).getByText('Accept with this farsan'));
    expect(a.accept).toHaveBeenCalledWith(kavit, new Set([':South Boll']));
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(a.send).toHaveBeenCalledWith(bhavin, undefined);
  });
  it('searches and says when nothing matches', () => {
    render(<QuoteBoard quotes={[bhavin, kavit]} loading={false} invoiced={new Set()} a={actions()} onNew={jest.fn()} />);
    fireEvent.change(screen.getByLabelText('Search quotations'), { target: { value: 'kavitt' } });
    expect(screen.getByText('Nothing matches "kavitt"')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Clear search'));
    expect(screen.getByText('Kavit Mangrolya · Vashtu')).toBeInTheDocument();
  });
  it('invites a first quote when there are none', () => {
    const onNew = jest.fn();
    render(<QuoteBoard quotes={[]} loading={false} invoiced={new Set()} a={actions()} onNew={onNew} />);
    expect(screen.getByText('No quotations yet')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: '+ New quotation' })[1]);
    expect(onNew).toHaveBeenCalled();
  });
});

describe('quote popups', () => {
  it('accept records the pick, final guests and an advance only once it is paid', () => {
    const onConfirm = jest.fn();
    render(<QuoteAcceptDialog quote={kavit} options={[kavit]} busy={false} onClose={jest.fn()} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('radio', { name: /Mix Bhajiya/ }));
    fireEvent.click(screen.getByRole('button', { name: 'UPI' }));
    const accept = screen.getByRole('button', { name: /^Accept · / });
    expect(accept).toHaveTextContent('Accept · ₹31,600');
    fireEvent.click(accept);
    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ id: 'k' }), new Set([':Mix Bhajiya']), 140, { amount: 9480, mode: 'upi' });
  });
  it('send shows the saved number, the message and mark as sent', () => {
    render(<SendDialog quote={bhavin} options={[bhavin]} all={false} withPrices onClose={jest.fn()} onSent={jest.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Send QTN-0015 to Bhavin' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /All options in one PDF/ })).toBeDisabled();
    expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toContain('Namaste Bhavin ji, here is the quotation for your Vashtu');
    expect(screen.getByLabelText('Mark the quote as sent')).toBeChecked();
    expect(screen.getByRole('button', { name: 'Open WhatsApp' })).toBeInTheDocument();
  });
});
