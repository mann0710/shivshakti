import { Report } from './model';
import { ReportInput } from './input';
import { salesReport, itemsReport, categoryReport, topReport } from './sweets';
import { paymentsReport, duesReport } from './money';
import { preorderReport, cateringReport } from './pipeline';
import { creditReport } from './credit';
import { summaryReport, registerReport, customersReport, itemDayReport } from './salesDetail';
import { hoursReport, discountsReport } from './salesTime';

export type ReportId = 'summary' | 'sales' | 'register' | 'itemdays' | 'customers' | 'hours' | 'discounts' | 'items' | 'categories' | 'payments' | 'preorders' | 'credit' | 'dues' | 'catering' | 'top';

export interface ReportDef { id: ReportId; label: string; icon: string; build: (inp: ReportInput) => Report; ranged: boolean }

// Order shown in the Reports tab.
export const REPORTS: ReportDef[] = [
  { id: 'summary', label: 'Summary', icon: '🧮', build: summaryReport, ranged: true },
  { id: 'sales', label: 'Sales', icon: '📈', build: salesReport, ranged: true },
  { id: 'register', label: 'Bill register', icon: '📒', build: registerReport, ranged: true },
  { id: 'items', label: 'Items', icon: '🍬', build: itemsReport, ranged: true },
  { id: 'itemdays', label: 'Item × day', icon: '📅', build: itemDayReport, ranged: true },
  { id: 'categories', label: 'Categories', icon: '🗂', build: categoryReport, ranged: true },
  { id: 'customers', label: 'Customers', icon: '👥', build: customersReport, ranged: true },
  { id: 'hours', label: 'Time of day', icon: '🕒', build: hoursReport, ranged: true },
  { id: 'discounts', label: 'Discounts & take-backs', icon: '✂', build: discountsReport, ranged: true },
  { id: 'payments', label: 'Payments', icon: '💳', build: paymentsReport, ranged: true },
  { id: 'preorders', label: 'Pre-bookings', icon: '📋', build: preorderReport, ranged: true },
  { id: 'credit', label: 'Credit', icon: '🧾', build: creditReport, ranged: true },
  { id: 'dues', label: 'Dues', icon: '⏳', build: duesReport, ranged: false },
  { id: 'catering', label: 'Catering', icon: '🍽', build: cateringReport, ranged: true },
  { id: 'top', label: 'Top', icon: '🏆', build: topReport, ranged: true },
];

export * from './model';
export type { ReportInput } from './input';
