import { canOpen, homeFor, navFor, pinnedFor } from './navItems';

describe('roles', () => {
  it('lets owners open everything', () => {
    expect(navFor('owner').map(i => i.page)).toContain('datacenter');
    expect(homeFor('owner')).toBe('dashboard');
  });

  it('keeps counter staff on the sweets screens', () => {
    expect(navFor('counter').map(i => i.label)).toEqual(['Sweets today', 'Sweets POS', 'Sweet items']);
    expect(canOpen('counter', 'finance')).toBe(false);
    expect(canOpen('counter', 'datacenter')).toBe(false);
    expect(canOpen('counter', 'seasonal_occasions')).toBe(true);
    expect(homeFor('counter')).toBe('seasonal_billing');
    expect(pinnedFor('counter').map(i => i.page)).toEqual(['seasonal_billing']);
  });

  it('shows the kitchen events and the make list only', () => {
    expect(navFor('kitchen').map(i => i.label)).toEqual(['Bookings', 'Sweets today']);
    expect(canOpen('kitchen', 'calendar')).toBe(true);
    expect(canOpen('kitchen', 'quotations')).toBe(false);
    expect(homeFor('kitchen')).toBe('bookings');
  });
});
