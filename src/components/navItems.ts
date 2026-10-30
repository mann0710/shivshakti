// Single source for the sidebar, the phone bottom bar and the "More" drawer.
export type Page = 'dashboard' | 'bookings' | 'customers' | 'menus' | 'billing' | 'finance' | 'calendar' | 'datacenter' | 'menubuilder' | 'quotations' | 'seasonal_items' | 'seasonal_billing' | 'seasonal_dashboard' | 'seasonal_occasions' | 'seasonal_customers';

export type Section = 'Main' | 'Operations' | 'Sessional' | 'Settings';

export interface NavItem { page: Page; icon: string; label: string; section: Section; color: string }

export const NAV_ITEMS: NavItem[] = [
  { page: 'dashboard',          icon: '🏠', label: 'Dashboard',           section: 'Main',       color: '#E8750A' },
  { page: 'customers',          icon: '👥', label: 'Customers',           section: 'Main',       color: '#639922' },
  { page: 'bookings',           icon: '📋', label: 'Bookings',            section: 'Main',       color: '#378ADD' },
  { page: 'quotations',         icon: '📝', label: 'Quotations',          section: 'Main',       color: '#1ABC9C' },
  { page: 'billing',            icon: '🧾', label: 'Billing',             section: 'Main',       color: '#BA7517' },
  { page: 'menubuilder',        icon: '🏗', label: 'Menu Builder',        section: 'Operations', color: '#9B59B6' },
  { page: 'menus',              icon: '🍽', label: 'Packages',            section: 'Operations', color: '#7F77DD' },
  { page: 'finance',            icon: '📊', label: 'Finance & Analytics', section: 'Operations', color: '#0F6E56' },
  { page: 'seasonal_dashboard', icon: '🏪', label: 'Sessional Dashboard', section: 'Sessional',  color: '#7B1FA2' },
  { page: 'seasonal_billing',   icon: '🍬', label: 'Sweets POS',          section: 'Sessional',  color: '#D4537E' },
  { page: 'seasonal_items',     icon: '🪔', label: 'Sessional Items',     section: 'Sessional',  color: '#E67E22' },
  { page: 'seasonal_occasions', icon: '🎊', label: 'Occasions',           section: 'Sessional',  color: '#C0392B' },
  { page: 'seasonal_customers', icon: '👤', label: 'Sess. Customers',     section: 'Sessional',  color: '#00897B' },
  { page: 'datacenter',         icon: '⚙️', label: 'Data Center',         section: 'Settings',   color: '#888880' },
];

export const SECTIONS: Section[] = ['Main', 'Operations', 'Sessional', 'Settings'];

// Pinned in the phone bottom bar (plus "More").
export const PINNED: { page: Page; icon: string; label: string }[] = [
  { page: 'dashboard',        icon: '🏠', label: 'Home' },
  { page: 'seasonal_billing', icon: '🍬', label: 'POS' },
  { page: 'quotations',       icon: '📝', label: 'Quotes' },
  { page: 'bookings',         icon: '📋', label: 'Bookings' },
];

// "calendar" still opens: it is Bookings in calendar view.
export const isPage = (p: string | null): p is Page => !!p && (p === 'calendar' || NAV_ITEMS.some(i => i.page === p));
export const navPage = (p: Page): Page => (p === 'calendar' ? 'bookings' : p);
