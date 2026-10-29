import { salesReportPdf, unpaidReportPdf, itemSalesPdf } from './sessionalReportPdf';
import { totalsByItem } from './cart';
import { nameKey } from './itemCatalog';

const line = { item_id: 'a', item_name: 'Kaju Katli 500 gm', weight: 500, weight_unit: 'gm' as const, price: 500, qty: 2, line_total: 1000 };
const order = (over: object) => ({
  id: 'o1abcdef', bill_no: 7, customer_name: 'Ramesh', phone: '9824012345', items: [line], subtotal: 1000,
  discount_amount: 0, discount_type: 'amount' as const, total_amount: 1000, is_paid: false, payment_mode: null, year: 2026, created_at: '2026-10-30T10:00:00Z', ...over,
});

// Real jsPDF, but save() records the file name instead of downloading.
const mockSaved: string[] = [];
jest.mock('jspdf', () => {
  const Actual = jest.requireActual('jspdf').default;
  return {
    __esModule: true,
    default: class extends Actual {
      constructor(...args: any[]) { super(...args); (this as any).save = (name: string) => { mockSaved.push(name); return this; }; }
    },
  };
});

describe('sessional report PDFs', () => {
  it('builds sales, unpaid and item PDFs without throwing', () => {
    const orders = Array.from({ length: 60 }, (_, i) => order({ id: `o${i}xxxxxx`, is_paid: i % 2 === 0 }));
    const pre = [{ ...order({}), advance_paid: 200, status: 'pending' as const, delivery_date: '2026-10-31' }];
    salesReportPdf(2026, orders as any, () => 'Diwali');
    unpaidReportPdf(2026, orders as any, pre as any);
    itemSalesPdf(2026, totalsByItem(orders.flatMap(o => o.items), l => nameKey(l.item_name)), orders.length, pre.length);
    expect(mockSaved).toEqual(['sessional-report-2026.pdf', 'unpaid-report-2026.pdf', 'item-sales-2026.pdf']);
  });

  it('totals item sales across old and new names', () => {
    const t = totalsByItem([line, { ...line, item_name: 'Kaju Katli', weight: 1000, qty: 1, line_total: 1000 }], l => nameKey(l.item_name));
    expect(t).toEqual([{ key: 'kaju katli|kg', name: 'Kaju Katli', unit: 'kg', amount: 2000, packs: 3, revenue: 2000 }]);
  });
});
