import { buildInvoicePdf } from './invoicePdf';

// Records every text drawn so the tax lines can be checked.
const mockTexts: string[] = [];
jest.mock('jspdf', () => {
  const Actual = jest.requireActual('jspdf').default;
  return {
    __esModule: true,
    default: class extends Actual {
      constructor(...args: any[]) {
        super(...args);
        const text = (this as any).text.bind(this);
        (this as any).text = (t: string | string[], ...rest: any[]) => { mockTexts.push(...([] as string[]).concat(t)); return text(t, ...rest); };
      }
    },
  };
});

const invoice = (gstin: string | null) => ({
  id: 'i1', booking_id: 'b1', invoice_number: 'INV-0001', subtotal: 100000, discount_amount: 0, discount_type: 'amount',
  gst_rate: 5, gst_amount: 5000, transportation_charge: 0, total_amount: 105000, advance_paid: 0, balance_due: 105000,
  status: 'sent', issue_date: '2026-10-30', created_at: '2026-10-30',
  booking: { id: 'b1', customer_id: 'c1', event_type: 'Wedding', event_date: '2026-11-20', venue: 'Hall', guest_count: 200,
    status: 'confirmed', estimated_cost: 0, created_at: '', customer: { id: 'c1', name: 'Ramesh', phone: '9824012345', address: '', gstin, created_at: '' } },
}) as any;

beforeEach(() => { mockTexts.length = 0; });

test('prints a tax invoice with CGST/SGST, SAC, buyer GSTIN and amount in words', () => {
  buildInvoicePdf(invoice('24AAACS1234A1Z5'), undefined, [], '24ABCDE1234F1Z5');
  const all = mockTexts.join('\n');
  expect(all).toContain('TAX INVOICE');
  expect(all).toContain('SAC: 996334');
  expect(all).toContain('24AAACS1234A1Z5');
  expect(all).toContain('CGST @2.5%');
  expect(all).toContain('SGST @2.5%');
  expect(all).toContain('Rupees One Lakh Five Thousand Only');
});

test('uses IGST for an out-of-state buyer', () => {
  buildInvoicePdf(invoice('27AAACS1234A1Z5'), undefined, [], '24ABCDE1234F1Z5');
  expect(mockTexts.join('\n')).toContain('IGST @5%');
});
