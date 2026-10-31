import { rateCard, rateCardHtml, currentSeason } from './rateCard';
import { DEFAULT_DOC_SETTINGS } from './settings';

const ctx = { settings: DEFAULT_DOC_SETTINGS, logo: 'data:image/png;base64,AA' };
const diwali = { id: 'd', name: 'Diwali', is_active: true, start_date: '2026-10-25', end_date: '2026-11-08' };
const rakhi = { id: 'r', name: 'Rakhi', is_active: true, start_date: '2026-08-01', end_date: '2026-08-09' };
const sweet = (name: string, rate: number, extra: object = {}) =>
  ({ id: name, name, rate, unit: 'kg' as const, category: null, occasion_id: null, is_active: true, pack_prices: null, ...extra });
const items = [
  sweet('Kaju Katli', 980), sweet('Kaju Cassata', 1200), sweet('Mohanthal', 600, { is_active: false }),
  sweet('Magas', 600, { occasion_id: 'd' }), sweet('Kaju Anjir Roll', 1100, { occasion_id: 'd', pack_prices: { 250: 300 } }),
  sweet('Basundi', 400, { unit: 'ltr' }), sweet('Kesar Peda', 25, { unit: 'pc' }), sweet('Ghevar', 700, { occasion_id: 'r' }),
];

describe('sweets rate card', () => {
  it('picks the season on the counter, or none', () => {
    expect(currentSeason([rakhi, diwali], '2026-10-31')?.id).toBe('d');
    expect(currentSeason([rakhi, diwali], '2026-12-31')).toBeUndefined();
  });

  it('groups POS sweets: season specials first, dearest first, prices from the per-kg rate', () => {
    const card = rateCard(items, [rakhi, diwali], '2026-10-31');
    expect(card.season).toBe('Diwali 2026');
    expect(card.groups.map(g => g.title)).toEqual(['Diwali specials', 'All-year favourites', 'Rakhi specials']);
    expect(card.groups[0].tables[0].rows).toEqual([{ name: 'Kaju Anjir Roll', prices: [1100, 550, 300] }, { name: 'Magas', prices: [600, 300, 150] }]);
    const allYear = card.groups[1].tables;
    expect(allYear.map(t => [t.unit, t.head])).toEqual([['kg', ['1 kg', '500 g', '250 g']], ['ltr', ['1 ltr', '500 ml', '250 ml']], ['pc', ['Per piece']]]);
    expect(allYear[0].rows.map(r => r.name)).toEqual(['Kaju Cassata', 'Kaju Katli']);
  });

  it('prints an A5 card with the season, escaped names and the WhatsApp footer', () => {
    const html = rateCardHtml([...items, sweet('Barfi <b>', 500)], [diwali], '2026-10-31', ctx);
    expect(html).toContain('size: A5 portrait');
    expect(html).toContain('<span class="rc-season">Diwali 2026</span>');
    expect(html).toContain('Fresh every day · pack prices include the box');
    expect(html).toContain('<td>Kaju Anjir Roll</td><td class="r"><b>₹1,100</b></td><td class="r">₹550</td><td class="r">₹300</td>');
    expect(html).toContain('<td class="r" colspan="3"><b>₹25</b></td>');
    expect(html).toContain('Barfi &lt;b&gt;');
    expect(html).not.toContain('Mohanthal');
    expect(html).toContain('+91 98795 29967');
    expect(html).toContain(`alt="${DEFAULT_DOC_SETTINGS.sweets_name} logo"`);
  });

  it('has no season line or specials when no season is on', () => {
    const html = rateCardHtml(items.filter(i => !i.occasion_id), [diwali], '2026-12-31', ctx);
    expect(html).not.toContain('class="rc-season"');
    expect(html).toContain('All-year favourites');
    expect(rateCardHtml([], [], '2026-12-31', ctx)).toContain('No sweets are on the POS yet.');
  });
});
