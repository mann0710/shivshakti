import { XCell, XSheet } from './xlsx';

// "Download everything" (a sheet per list) and the JSON backup copy, both built from whole tables.

export type Rows = Record<string, any>[];
export type Tables = Record<string, Rows>;

export const TABLES: { table: string; sheet: string }[] = [
  { table: 'customers', sheet: 'Customers' }, { table: 'bookings', sheet: 'Bookings' }, { table: 'quotations', sheet: 'Quotations' },
  { table: 'invoices', sheet: 'Invoices' }, { table: 'payments', sheet: 'Payments' }, { table: 'spends', sheet: 'Spends' },
  { table: 'menus', sheet: 'Packages' }, { table: 'menu_categories', sheet: 'Menu categories' }, { table: 'menu_subcategories', sheet: 'Menu subcategories' },
  { table: 'menu_items', sheet: 'Dishes' }, { table: 'seasonal_items', sheet: 'Sweets' }, { table: 'seasonal_occasions', sheet: 'Occasions' },
  { table: 'seasonal_orders', sheet: 'Sweets bills' }, { table: 'seasonal_preorders', sheet: 'Pre-bookings' }, { table: 'seasonal_customers', sheet: 'Sweets customers' },
  { table: 'seasonal_day_closes', sheet: 'Day closes' }, { table: 'event_types', sheet: 'Event types' }, { table: 'team_members', sheet: 'Team for events' },
  { table: 'staff', sheet: 'Logins' }, { table: 'data_center', sheet: 'Settings' }, { table: 'deleted_items', sheet: 'Recycle bin' },
];

const cell = (v: unknown): XCell => (v === null || v === undefined ? null
  : typeof v === 'number' || typeof v === 'boolean' ? v
  : typeof v === 'object' ? JSON.stringify(v) : String(v));

// Columns in first-seen order (named ones first), lists and objects as JSON text.
export function rowsToSheet(name: string, rows: Rows, first: string[] = []): XSheet {
  const cols: string[] = [...first];
  rows.forEach(r => Object.keys(r).forEach(k => { if (!cols.includes(k)) cols.push(k); }));
  return { name, rows: [cols, ...rows.map(r => cols.map(c => cell(r[c])))] };
}

const index = (rows: Rows = [], label: (r: Record<string, any>) => string) => new Map(rows.map(r => [r.id, label(r)]));

// Readable names next to the ids that point at them (customer, dish place, invoice number).
export function withNames(t: Tables): Tables {
  const customer = index(t.customers, c => c.name);
  const cat = index(t.menu_categories, c => c.name);
  const sub = new Map((t.menu_subcategories ?? []).map(s => [s.id, { name: s.name, cat: cat.get(s.category_id) ?? '' }]));
  const invoice = index(t.invoices, i => i.invoice_number);
  const out: Tables = { ...t };
  if (t.bookings) out.bookings = t.bookings.map(b => ({ customer: customer.get(b.customer_id) ?? '', ...b }));
  if (t.quotations) out.quotations = t.quotations.map(q => ({ customer: customer.get(q.customer_id) ?? '', ...q }));
  if (t.menu_items) out.menu_items = t.menu_items.map(d => ({ category: sub.get(d.subcategory_id)?.cat ?? '', subcategory: sub.get(d.subcategory_id)?.name ?? '', ...d }));
  if (t.payments) out.payments = t.payments.map(p => ({ invoice: invoice.get(p.invoice_id) ?? '', ...p }));
  return out;
}

// One workbook: a sheet per list, in the usual order, skipping lists the database doesn't have.
export const everythingSheets = (t: Tables): XSheet[] => {
  const named = withNames(t);
  return TABLES.filter(x => named[x.table]).map(x => rowsToSheet(x.sheet, named[x.table]));
};

// Same shape as the backups made from the database directly: { project, taken_at, tables }.
export const backupJson = (t: Tables, takenAt: string, project = '') => JSON.stringify({ project, taken_at: takenAt, tables: t }, null, 1);

export const fileStamp = (iso: string) => iso.slice(0, 10);

// "Today", "Yesterday", "5 days ago"; empty when never.
export function ageText(iso: string, now = Date.now()): string {
  if (!iso) return '';
  const days = Math.floor((now - new Date(iso).getTime()) / 86400000);
  return days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`;
}

// A backup older than a week, or none at all, is flagged.
export const backupStale = (at: string, now = Date.now()) => !at || now - new Date(at).getTime() > 7 * 86400000;
