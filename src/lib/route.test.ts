import { parseRoute, pathFor } from './route';
import { closeRoute, currentRoute, goTo } from '../hooks/useRoute';

describe('parseRoute', () => {
  it('reads a page and the record open on it', () => {
    expect(parseRoute('/quotations')).toEqual({ page: 'quotations', id: undefined });
    expect(parseRoute('/quotations/abc-123')).toEqual({ page: 'quotations', id: 'abc-123' });
    expect(parseRoute('/invoices/i1/')).toEqual({ page: 'billing', id: 'i1' });
    expect(parseRoute('/settings/credit')).toEqual({ page: 'datacenter', id: 'credit' });
    expect(parseRoute('/pos/preorders/p1')).toEqual({ page: 'seasonal_billing', id: 'preorders/p1' });
  });

  it('keeps old #page links working', () => {
    expect(parseRoute('/', '#quotations')).toEqual({ page: 'quotations' });
    expect(parseRoute('/settings/catering', '#menubuilder')).toEqual({ page: 'menubuilder' });
  });

  it('has no page for "/", unknown paths and email sign-in links', () => {
    expect(parseRoute('/')).toEqual({ page: null });
    expect(parseRoute('/nope/1')).toEqual({ page: null });
    expect(parseRoute('/', '#access_token=x&type=recovery')).toEqual({ page: null });
    expect(parseRoute('/bookings', '#access_token=x')).toEqual({ page: 'bookings', id: undefined });
  });

  it('round-trips every address it writes, odd ids included', () => {
    expect(pathFor('seasonal_billing', 'preorders/p 1')).toBe('/pos/preorders/p%201');
    expect(parseRoute(pathFor('seasonal_billing', 'preorders/p 1')).id).toBe('preorders/p 1');
    expect(parseRoute(pathFor('dashboard'))).toEqual({ page: 'dashboard', id: undefined });
    expect(parseRoute('/quotations/%E0%A4%')).toEqual({ page: 'quotations', id: '%E0%A4%' });
  });
});

describe('history', () => {
  beforeEach(() => window.history.replaceState(null, '', '/quotations'));

  it('pushes records it opens and closes them with Back', async () => {
    goTo('quotations', 'q1');
    expect(window.location.pathname).toBe('/quotations/q1');
    expect(window.history.state).toEqual({ inApp: true });
    const back = new Promise(r => window.addEventListener('popstate', r, { once: true }));
    closeRoute('quotations');
    await back;
    expect(currentRoute()).toEqual({ page: 'quotations', id: undefined });
  });

  it('closes a pasted link by replacing it with the list', () => {
    window.history.replaceState(null, '', '/invoices/i9');
    closeRoute('billing');
    expect(window.location.pathname).toBe('/invoices');
  });
});
