import { Report } from './model';
import { ReportInput } from './input';
import { salesReport, itemsReport, categoryReport, topReport } from './sweets';
import { paymentsReport, duesReport } from './money';
import { preorderReport, cateringReport } from './pipeline';

export type ReportId = 'sales' | 'items' | 'categories' | 'payments' | 'preorders' | 'dues' | 'catering' | 'top';

export interface ReportDef { id: ReportId; label: string; icon: string; build: (inp: ReportInput) => Report; ranged: boolean }

// Order shown in the Reports tab.
export const REPORTS: ReportDef[] = [
  { id: 'sales', label: 'Sales', icon: '📈', build: salesReport, ranged: true },
  { id: 'items', label: 'Items', icon: '🍬', build: itemsReport, ranged: true },
  { id: 'categories', label: 'Categories', icon: '🗂', build: categoryReport, ranged: true },
  { id: 'payments', label: 'Payments', icon: '💳', build: paymentsReport, ranged: true },
  { id: 'preorders', label: 'Pre-bookings', icon: '📋', build: preorderReport, ranged: true },
  { id: 'dues', label: 'Dues', icon: '⏳', build: duesReport, ranged: false },
  { id: 'catering', label: 'Catering', icon: '🍽', build: cateringReport, ranged: true },
  { id: 'top', label: 'Top', icon: '🏆', build: topReport, ranged: true },
];

export * from './model';
export type { ReportInput } from './input';
