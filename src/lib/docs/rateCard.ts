// A5 sweets rate card for the counter and WhatsApp: season specials, then all-year favourites.
import type { SeasonalItem } from '../itemCatalog';
import { DocContext, docContext } from './context';
import { page, esc, money, HEAD_FONT, NAVY } from './theme';
import { formatSize, packPrice, PriceUnit } from '../units';
import { hasDates, occasionOn, seasonTitle } from '../occasions';
import { ALL_YEAR, sweetGroups } from '../sweetGroups';
import { SHOP } from '../shop';

type Sweet = Pick<SeasonalItem, 'id' | 'name' | 'category' | 'occasion_id' | 'is_active' | 'unit' | 'rate' | 'pack_prices'>;
type Occ = { id: string; name: string; is_active: boolean; start_date?: string | null; end_date?: string | null };

export interface RateTable { unit: PriceUnit; head: string[]; rows: { name: string; prices: number[] }[] }
export interface RateGroup { title: string; tables: RateTable[] }
export interface RateCard { season: string; groups: RateGroup[] }

// Pack sizes printed per unit; a piece sweet shows one price.
const SIZES: Record<PriceUnit, number[]> = { kg: [1000, 500, 250], ltr: [1000, 500, 250], pc: [1] };
const UNIT_ORDER: PriceUnit[] = ['kg', 'ltr', 'pc'];

// The season on the counter today: by its dates, else one switched on without dates.
export const currentSeason = <T extends Occ>(occasions: T[], today: string): T | undefined =>
  occasionOn(occasions, today) ?? occasions.find(o => o.is_active && !hasDates(o));

const tablesOf = (items: Sweet[]): RateTable[] => UNIT_ORDER.map(unit => ({
  unit,
  head: unit === 'pc' ? ['Per piece'] : SIZES[unit].map(s => formatSize(s, unit)),
  rows: items.filter(i => i.unit === unit)
    .sort((a, b) => b.rate - a.rate || a.name.localeCompare(b.name))
    .map(i => ({ name: i.name, prices: SIZES[unit].map(s => packPrice(i.rate, s, unit, i.pack_prices)) })),
})).filter(t => t.rows.length);

// Sweets on the POS only, grouped: this season, all year, then other seasons still on sale.
export function rateCard(items: Sweet[], occasions: Occ[], today: string): RateCard {
  const season = currentSeason(occasions, today);
  const rank = (id: string) => (id === season?.id ? 0 : id === ALL_YEAR ? 1 : 2);
  const groups = sweetGroups(items.filter(i => i.is_active && i.rate > 0), occasions)
    .sort((a, b) => rank(a.id) - rank(b.id))
    .map(g => ({ title: g.occasion ? `${g.occasion.name} specials` : 'All-year favourites', tables: tablesOf(g.items) }));
  return { season: season ? seasonTitle(season) : '', groups };
}

const phoneText = (p: string) => (p.length === 10 ? `${p.slice(0, 5)} ${p.slice(5)}` : p);

const tableHtml = (t: RateTable) => `<table class="rc-t"><thead><tr><th>Sweet</th>${t.unit === 'pc'
  ? `<th class="r" colspan="3">${esc(t.head[0])}</th>` : t.head.map(h => `<th class="r">${esc(h)}</th>`).join('')}</tr></thead>
<tbody>${t.rows.map(r => `<tr><td>${esc(r.name)}</td>${t.unit === 'pc'
  ? `<td class="r" colspan="3"><b>${money(r.prices[0])}</b></td>` : r.prices.map((p, i) => `<td class="r">${i ? money(p) : `<b>${money(p)}</b>`}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

// Printable A5 card; long lists carry on to the next page with the column heads repeated.
export function rateCardHtml(items: Sweet[], occasions: Occ[], today: string, ctx: DocContext = docContext()): string {
  const card = rateCard(items, occasions, today);
  const shop = ctx.settings.sweets_name;
  const body = `<header class="rc-hdr"><img src="${esc(ctx.logo)}" alt="${esc(shop)} logo">
  <div class="rc-name">${card.season ? `<span class="rc-season">${esc(card.season)}</span>` : ''}<span class="rc-title">Sweets rate card</span>
  <span class="rc-sub">Fresh every day · pack prices include the box</span></div></header><div class="rc-leaf"></div>
<main class="rc-main">${card.groups.length ? card.groups.map(g => `<section class="rc-grp"><h2>${esc(g.title)}</h2>${g.tables.map(tableHtml).join('')}</section>`).join('')
    : '<p class="muted">No sweets are on the POS yet.</p>'}</main>
<footer class="rc-foot"><div><b>Pre-book on WhatsApp</b><span>Pick up from the shop or get it delivered</span></div><b class="rc-phone num">+91 ${esc(phoneText(SHOP.phone))}</b></footer>`;
  return page(`Sweets rate card${card.season ? ` - ${card.season}` : ''}`, ctx.settings.accent, body, `
@page { size: A5 portrait; margin: 10mm 0 12mm; } @page :first { margin-top: 0; }
@media screen { body { max-width: 148mm; } }
.rc-hdr { background: ${NAVY}; color: #fff; padding: 18px 9mm; display: flex; align-items: center; gap: 14px; }
.rc-hdr img { width: 84px; height: 56px; object-fit: contain; background: #fff; border-radius: 8px; padding: 4px; }
.rc-name { display: flex; flex-direction: column; gap: 2px; }
.rc-season { font-family: ${HEAD_FONT}; font-size: 12px; font-weight: 600; letter-spacing: 2.5px; color: #C8E6A0; text-transform: uppercase; }
.rc-title { font-family: ${HEAD_FONT}; font-size: 26px; font-weight: 700; line-height: 1.1; }
.rc-sub { font-size: 12px; color: #D7D6F0; }
.rc-leaf { height: 6px; background: var(--accent); }
.rc-main { padding: 16px 9mm 4px; display: flex; flex-direction: column; gap: 14px; }
.rc-grp { margin: 0; }
.rc-grp h2 { font-family: ${HEAD_FONT}; font-size: 13px; font-weight: 600; letter-spacing: 1.6px; color: var(--accent-text); text-transform: uppercase; margin: 0 0 4px; break-after: avoid; }
.rc-t { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
.rc-t th { font-size: 10.5px; font-weight: 600; color: #5C5C6B; text-align: left; padding: 4px 0; border-bottom: 1px solid #E3E3EA; }
.rc-t td { font-size: 13.5px; padding: 5px 0; border-bottom: 1px dotted #E3E3EA; }
.rc-t th.r, .rc-t td.r { text-align: right; width: 19%; white-space: nowrap; }
.rc-t td b { font-family: ${HEAD_FONT}; }
.rc-t tr { break-inside: avoid; }
.rc-foot { margin: 8px 9mm 0; background: #F7FBF1; border: 1.5px solid var(--accent); border-radius: 12px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; gap: 12px; break-inside: avoid; }
.rc-foot div { display: flex; flex-direction: column; gap: 2px; }
.rc-foot div b { font-family: ${HEAD_FONT}; font-size: 15px; color: ${NAVY}; }
.rc-foot div span { font-size: 12px; color: #4A4A58; }
.rc-phone { font-family: ${HEAD_FONT}; font-size: 17px; color: ${NAVY}; white-space: nowrap; }`);
}
