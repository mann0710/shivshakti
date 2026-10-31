import { sweetGroups, sweetChips, groupMeta, andList, ALL_YEAR } from './sweetGroups';

const diwali = { id: 'd', name: 'Diwali', is_active: true };
const rakhi = { id: 'r', name: 'Rakhi', is_active: false };
const item = (id: string, occasion_id: string | null, is_active = true, category: string | null = null) =>
  ({ id, name: id, category, occasion_id, is_active });

const items = [
  item('Magas', 'd'), item('Halwasan', 'd'),
  item('Kaju Katli', null), item('Mohanthal', 'gone', true, 'Barfi'),
  item('Gulabjamun', 'r', false), item('Malai Penda', 'r', false),
];

describe('sweet groups', () => {
  it('orders seasons on, all year, then seasons off', () => {
    const groups = sweetGroups(items, [rakhi, diwali]);
    expect(groups.map(g => g.title)).toEqual(['Diwali', 'All year', 'Rakhi']);
    expect(groups[1].items.map(i => i.id)).toEqual(['Kaju Katli', 'Mohanthal']);
  });
  it('filters by chip and search', () => {
    expect(sweetGroups(items, [rakhi, diwali], 'r').map(g => g.id)).toEqual(['r']);
    expect(sweetGroups(items, [rakhi, diwali], ALL_YEAR, 'barfi')[0].items.map(i => i.id)).toEqual(['Mohanthal']);
    expect(sweetGroups(items, [rakhi, diwali], 'd', 'katli')).toEqual([]);
  });
  it('counts the chips', () => {
    expect(sweetChips(items, [rakhi, diwali]).map(c => `${c.label} ${c.count}`)).toEqual(['All 6', 'Diwali 2', 'All year 2', 'Rakhi 2']);
  });
  it('says what is on the POS', () => {
    const [d, y, r] = sweetGroups(items, [rakhi, diwali]);
    expect(groupMeta(d)).toBe('2 sweets · on the POS');
    expect(groupMeta(y)).toBe('2 sweets · always on the POS');
    expect(groupMeta(r)).toBe('2 sweets · all hidden after the festival');
    expect(groupMeta({ ...d, items: [item('a', 'd'), item('b', 'd', false)] })).toBe('2 sweets · 1 on the POS');
  });
  it('joins names', () => {
    expect(andList(['Kaju Katli'])).toBe('Kaju Katli');
    expect(andList(['Kaju Katli', 'Mohanthal', 'Kaju Cassata'])).toBe('Kaju Katli, Mohanthal and Kaju Cassata');
  });
});
