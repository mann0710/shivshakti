import { Page, isPage } from '../components/navItems';

// One page and, optionally, the record open on it: /quotations/<id>, /pos/preorders/<id>.
export interface Route { page: Page | null; id?: string }

// Address names for each page.
const SLUG: Record<Page, string> = {
  dashboard: 'home', customers: 'customers', bookings: 'bookings', calendar: 'calendar', quotations: 'quotations',
  billing: 'invoices', finance: 'money', menubuilder: 'menu-builder', menus: 'packages', datacenter: 'settings',
  seasonal_dashboard: 'sweets', seasonal_billing: 'pos', seasonal_items: 'sweet-items',
  seasonal_occasions: 'occasions', seasonal_customers: 'sweets-customers',
};
const BY_SLUG = new Map(Object.entries(SLUG).map(([page, slug]) => [slug, page as Page]));

const decode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };

// An old #page link wins; a bare "/" or an unknown address has no page.
export function parseRoute(pathname: string, hash = ''): Route {
  const old = hash.replace(/^#\/?/, '');
  if (isPage(old)) return { page: old };
  const [slug = '', ...rest] = pathname.split('/').filter(Boolean).map(decode);
  const page = BY_SLUG.get(slug);
  return page ? { page, id: rest.join('/') || undefined } : { page: null };
}

export const pathFor = (page: Page, id?: string) =>
  `/${[SLUG[page], ...(id ? id.split('/') : [])].map(encodeURIComponent).join('/')}`;
