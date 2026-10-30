import { DocContext } from './context';
import { PayStep, scheduleAmounts } from './settings';
import { esc, money } from './theme';
import { qrSvg, upiLink } from './qr';
import { SHOP } from '../shop';

export type Fact = [label: string, value: string | number | null | undefined];

// Logo + shop details on the left, document kind / number / dates on the right.
export function header(ctx: DocContext, kind: string, number: string, meta: string, shopName = 'Shiv Shakti Catering Service'): string {
  const s = ctx.settings;
  return `<header class="hdr">
  <div class="brand"><img src="${esc(ctx.logo)}" alt="${esc(SHOP.name)} logo">
    <div class="shop"><b>${esc(shopName)}</b>${s.address ? `<span>${esc(s.address)}</span>` : ''}
      <span class="num">+91 ${esc(SHOP.phone)} · ${esc(SHOP.email)}</span>
      ${ctx.gstNumber ? `<span class="num"><b>GSTIN</b> ${esc(ctx.gstNumber)}</span>` : ''}</div></div>
  <div class="doc"><span class="kind">${esc(kind)}</span><span class="docno">${esc(number)}</span><span class="meta num">${esc(meta)}</span></div>
</header><div class="rule"></div>`;
}

export const facts = (list: Fact[], cols = 2) =>
  `<div class="facts" style="--cols:${cols}">${list.filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([l, v]) => `<div class="fact"><span class="lbl">${esc(l)}</span><span class="v num">${esc(v)}</span></div>`).join('')}</div>`;

export const sectionHead = (title: string, note = '') => `<div class="sec-h"><h2>${esc(title)}</h2>${note ? `<span>${esc(note)}</span>` : ''}</div>`;

export interface SumRow { label: string; value: number; max?: number; sign?: '+' | '-'; cls?: string }

export const sumRows = (rows: SumRow[]) => rows.map(r =>
  `<div class="${r.cls ?? (r.sign === '-' ? 'good' : '')}"><span>${esc(r.label)}</span><span class="num">${r.sign === '-' ? '− ' : ''}${money(r.value)}${r.max && r.max > r.value ? ` – ${money(r.max)}` : ''}</span></div>`).join('');

// The navy closing price band.
export const banner = (label: string, detail: string, amount: number | string, chip = '') =>
  `<div class="banner"><div><div class="lbl">${esc(label)}</div><div class="sub2 num">${detail}</div>${chip ? `<span class="chip num">${esc(chip)}</span>` : ''}</div><div class="amt num">${typeof amount === 'number' ? money(amount) : esc(amount)}</div></div>`;

// Rupee amounts when the total is known, else just the percentages.
// Each step's amount; with several options, each option's amount sits under the percentage.
export interface StepOption { label: string; lo: number; hi: number }
export const paySteps = (total: number | null, steps: PayStep[], per: StepOption[] = []) => {
  const amounts = total === null ? steps.map(s => `${s.pct}%`) : scheduleAmounts(total, steps).map(money);
  const each = per.map(o => ({ label: o.label, lo: scheduleAmounts(o.lo, steps), hi: scheduleAmounts(Math.max(o.lo, o.hi), steps) }));
  return `<div class="steps" style="--n:${steps.length}">${steps.map((s, i) => `<div class="step">
  <div class="dot"><i>${i + 1}</i><em></em></div><span class="a num">${amounts[i]}</span>
  <b style="font-size:13px">${s.pct}% · ${esc(s.label)}</b><span class="muted" style="font-size:12px">${esc(s.when)}</span>${
    each.map(o => `<span class="num" style="font-size:12px">${esc(o.label)}: <b>${money(o.lo[i])}${o.hi[i] > o.lo[i] ? ` – ${money(o.hi[i])}` : ''}</b></span>`).join('')}</div>`).join('')}</div>`;
};

export const chips = (list: string[]) => `<div class="chips">${list.map(x => `<span>${esc(x)}</span>`).join('')}</div>`;
export const terms = (list: string[]) => `<ol class="terms">${list.map(t => `<li>${esc(t)}</li>`).join('')}</ol>`;

// UPI QR with the amount filled in; empty when no UPI ID is saved.
export function upiBox(ctx: DocContext, amount: number, title: string, note: string): string {
  const id = ctx.settings.upi_id.trim();
  if (!id) return '';
  return `<div class="upi">${qrSvg(upiLink(id, amount, note))}<div style="display:flex;flex-direction:column;gap:3px">
  <b>${esc(title)}</b><span class="muted">Scan with any UPI app</span><span class="muted">${esc(id)}</span>
  ${ctx.settings.bank ? `<span class="muted">${esc(ctx.settings.bank)}</span>` : ''}</div></div>`;
}

export const signatures = (left: string, right: string) => `<div class="signs"><div>${esc(left)}</div><div>${esc(right)}</div></div>`;

export const endLine = (ctx: DocContext, left: string) =>
  `<div class="end"><span>${esc(left)}</span><span class="num">${esc(ctx.settings.contact_name)} · +91 ${esc(SHOP.phone)}</span></div>`;

// Footer printed on every PDF page by the PDF service.
export const footerText = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(' · ');

// Compact logo strip for reports, registers and prep lists; `right` is trusted HTML.
export const slimHeader = (ctx: DocContext, kind: string, title: string, right: string) =>
  `<header class="hdr" style="padding:14px 13mm"><div class="brand"><img src="${esc(ctx.logo)}" alt="${esc(SHOP.name)} logo" style="width:86px;height:55px">
  <div><span class="kind">${esc(kind)}</span><div class="docno" style="font-size:24px">${esc(title)}</div></div></div>
  <div class="meta num" style="text-align:right">${right}</div></header><div class="rule"></div>`;

// Plain table in the document style; cells are trusted HTML.
export const docTable = (head: string[], rows: string[][], foot?: string[], rightFrom = 99) =>
  `<div class="box"><table class="t"><thead><tr>${head.map((h, i) => `<th class="${i >= rightFrom ? 'r' : ''}">${esc(h)}</th>`).join('')}</tr></thead>
  <tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td class="${i >= rightFrom ? 'r' : ''}">${c}</td>`).join('')}</tr>`).join('')}</tbody>
  ${foot ? `<tfoot><tr>${foot.map((c, i) => `<td class="${i >= rightFrom ? 'r' : ''}" style="font-weight:700;background:#EEF0FB">${c}</td>`).join('')}</tr></tfoot>` : ''}</table></div>`;
