// Single source for the sidebar, the phone bottom bar and the "More" sheet.
export type Page = 'dashboard' | 'bookings' | 'customers' | 'menus' | 'billing' | 'finance' | 'calendar' | 'datacenter' | 'menubuilder' | 'quotations' | 'seasonal_items' | 'seasonal_billing' | 'seasonal_dashboard' | 'seasonal_occasions' | 'seasonal_customers';

export type Section = 'Main' | 'Catering' | 'Sweets' | 'Settings';

export interface NavItem { page: Page; label: string; section: Section }

export const NAV_ITEMS: NavItem[] = [
  { page: 'dashboard',          label: 'Home',         section: 'Main' },
  { page: 'customers',          label: 'Customers',    section: 'Main' },
  { page: 'bookings',           label: 'Bookings',     section: 'Main' },
  { page: 'quotations',         label: 'Quotations',   section: 'Main' },
  { page: 'billing',            label: 'Invoices',     section: 'Main' },
  { page: 'finance',            label: 'Money',        section: 'Main' },
  { page: 'menubuilder',        label: 'Menu Builder', section: 'Catering' },
  { page: 'menus',              label: 'Packages',     section: 'Catering' },
  { page: 'seasonal_dashboard', label: 'Sweets today', section: 'Sweets' },
  { page: 'seasonal_billing',   label: 'Sweets POS',   section: 'Sweets' },
  { page: 'seasonal_items',     label: 'Sweet items',  section: 'Sweets' },
  { page: 'datacenter',         label: 'Settings',     section: 'Settings' },
];

export const SECTIONS: Section[] = ['Main', 'Catering', 'Sweets', 'Settings'];

// Pages opened from tabs, not the sidebar: they light up their parent.
const PARENT: Partial<Record<Page, Page>> = { calendar: 'bookings', seasonal_occasions: 'seasonal_items', seasonal_customers: 'seasonal_items' };

// Pinned in the phone bottom bar (plus "More").
export const PINNED: { page: Page; label: string }[] = [
  { page: 'dashboard',        label: 'Home' },
  { page: 'seasonal_billing', label: 'POS' },
  { page: 'bookings',         label: 'Bookings' },
  { page: 'quotations',       label: 'Quotes' },
];

export const isPage = (p: string | null): p is Page => !!p && (p in PARENT || NAV_ITEMS.some(i => i.page === p));
export const navPage = (p: Page): Page => PARENT[p] ?? p;
