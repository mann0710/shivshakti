import { accentText } from './settings';
import { inr } from '../money';

// "Navy & Leaf" document look: one stylesheet for quotations, invoices, slips and reports.
export const NAVY = '#1E1B6E';

export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
export const money = (n: number) => inr(Math.round((Number(n) || 0) * 100) / 100);
export const cap = (s?: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

const FONTS = 'https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700&family=Noto+Sans:wght@400;500;600;700&family=Noto+Sans+Gujarati:wght@400;600&display=swap';

const BASE = `
@page { size: A4; margin: 14mm 0 15mm; }
@page :first { margin-top: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; background: #fff; }
body { font: 13px/1.45 'Noto Sans', 'Noto Sans Gujarati', Arial, sans-serif; color: #1C1C24; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.num, td, .amt { font-variant-numeric: tabular-nums; }
.wrap { padding: 0 13mm; }
.hdr { background: #F7F7F7; padding: 24px 13mm 20px; display: flex; justify-content: space-between; align-items: center; gap: 24px; }
.hdr img { width: 140px; height: 90px; object-fit: contain; }
.brand { display: flex; align-items: center; gap: 16px; }
.shop { display: flex; flex-direction: column; gap: 2px; font-size: 11.5px; color: #4A4A58; line-height: 1.45; }
.shop b { color: #1C1C24; }
.doc { text-align: right; display: flex; flex-direction: column; gap: 4px; }
.kind { font-family: Outfit, sans-serif; font-size: 12px; font-weight: 600; letter-spacing: 3px; color: var(--accent-text); text-transform: uppercase; }
.docno { font-family: Outfit, sans-serif; font-size: 30px; font-weight: 700; color: ${NAVY}; line-height: 1; }
.meta { font-size: 11.5px; color: #4A4A58; }
.rule { height: 4px; background: var(--accent); }
.lbl { font-size: 10.5px; font-weight: 600; letter-spacing: 1.5px; color: #5C5C6B; text-transform: uppercase; }
.muted { color: #5C5C6B; }
.big { font-family: Outfit, sans-serif; font-size: 24px; font-weight: 600; color: ${NAVY}; line-height: 1.15; }
.facts { display: grid; grid-template-columns: repeat(var(--cols, 2), minmax(0, 1fr)); gap: 12px 24px; }
.fact { display: flex; flex-direction: column; gap: 2px; }
.fact .v { font-size: 14.5px; font-weight: 600; }
.intro { display: grid; grid-template-columns: 230px minmax(0, 1fr); gap: 26px; margin-top: 24px; align-items: start; }
.intro .facts { border-left: 1px solid #E3E3EA; padding-left: 26px; }
section { margin-top: 24px; }
h2 { font-family: Outfit, sans-serif; font-size: 19px; font-weight: 600; color: ${NAVY}; margin: 0; }
.sec-h { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; border-bottom: 1px solid #E3E3EA; padding-bottom: 7px; margin-bottom: 12px; break-after: avoid; }
.sec-h span { font-size: 12px; color: #5C5C6B; }
.courses { columns: 2; column-gap: 34px; }
.course { break-inside: avoid; display: flex; flex-direction: column; gap: 3px; margin-bottom: 16px; }
.course-h { display: flex; justify-content: space-between; align-items: baseline; font-family: Outfit, sans-serif; font-size: 12.5px; font-weight: 600; letter-spacing: 1.5px; color: var(--accent-text); text-transform: uppercase; margin-bottom: 2px; }
.course-h span { font-family: 'Noto Sans', sans-serif; font-size: 11px; font-weight: 500; letter-spacing: 0; color: #5C5C6B; text-transform: none; }
.sub { font-size: 11px; font-weight: 600; color: #5C5C6B; margin-top: 4px; }
.dish { display: flex; justify-content: space-between; gap: 12px; font-size: 13.5px; padding: 2px 0; border-bottom: 1px dotted #E3E3EA; }
.dish .p { font-weight: 500; white-space: nowrap; }
.note { font-size: 11.5px; font-style: italic; color: #5C5C6B; padding: 1px 0 2px 10px; }
.note.with { color: #3D6B14; }
.meal { border: 1px solid #E3E3EA; border-radius: 10px; margin-top: 12px; overflow: hidden; }
.meal-h { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 14px; background: #F5F6FB; break-after: avoid; }
.meal-h b { font-size: 14px; color: ${NAVY}; }
.meal-b { padding: 12px 14px; }
.day-h { display: flex; justify-content: space-between; align-items: baseline; margin-top: 20px; font-family: Outfit, sans-serif; font-size: 16px; font-weight: 600; color: ${NAVY}; break-after: avoid; }
.save { font-size: 12px; color: #3D6B14; margin-top: 8px; }
.box { border: 1px solid #E3E3EA; border-radius: 10px; overflow: hidden; }
table.t { width: 100%; border-collapse: collapse; }
table.t th { background: #F5F6FB; font-size: 10.5px; font-weight: 600; letter-spacing: 1px; color: #5C5C6B; text-align: left; padding: 8px 12px; text-transform: uppercase; }
table.t td { padding: 9px 12px; border-top: 1px solid #E3E3EA; vertical-align: top; font-size: 13px; }
table.t td small { display: block; font-size: 11.5px; color: #5C5C6B; }
table.t tr { break-inside: avoid; }
thead { display: table-header-group; }
.r, table.t .r { text-align: right; white-space: nowrap; }
.keep { break-inside: avoid; }
.split { display: grid; grid-template-columns: minmax(0, 1fr) 290px; gap: 28px; align-items: start; break-inside: avoid; }
.sum { display: flex; flex-direction: column; font-size: 13px; }
.sum div { display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; }
.sum .line { border-top: 1px solid #E3E3EA; }
.sum .tot { border-top: 2px solid ${NAVY}; font-size: 15px; font-weight: 700; padding-top: 8px; margin-top: 2px; }
.good { color: #3D6B14; }
.sum .due { margin-top: 6px; padding: 12px 14px; background: ${NAVY}; color: #fff; border-radius: 8px; align-items: center; }
.due b { font-family: Outfit, sans-serif; font-size: 22px; }
.banner { margin-top: 14px; background: ${NAVY}; color: #fff; border-radius: 10px; padding: 18px 24px; display: flex; justify-content: space-between; align-items: center; gap: 20px; break-inside: avoid; }
.banner .lbl { color: #C9CCF2; }
.banner .sub2 { font-size: 13.5px; color: #E6E7F8; }
.banner .amt { font-family: Outfit, sans-serif; font-size: 32px; font-weight: 700; white-space: nowrap; }
.chip { display: inline-block; font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 12px; background: var(--accent); color: #13220A; margin-top: 6px; }
.steps { display: grid; grid-template-columns: repeat(var(--n, 3), minmax(0, 1fr)); break-inside: avoid; }
.step { display: flex; flex-direction: column; gap: 5px; padding-right: 16px; }
.step .dot { display: flex; align-items: center; gap: 8px; }
.step .dot i { width: 26px; height: 26px; border-radius: 13px; background: ${NAVY}; color: #fff; font-size: 12px; font-weight: 700; font-style: normal; display: flex; align-items: center; justify-content: center; }
.step .dot em { flex: 1; height: 2px; background: var(--accent); }
.step .a { font-family: Outfit, sans-serif; font-size: 21px; font-weight: 700; color: ${NAVY}; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chips span { font-size: 12.5px; padding: 5px 12px; border: 1px solid #D5D6E4; border-radius: 16px; }
ol.terms { margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.55; display: flex; flex-direction: column; gap: 4px; }
.close { display: grid; grid-template-columns: minmax(0, 1fr) 310px; gap: 24px; align-items: end; margin-top: 30px; break-inside: avoid; }
.signs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 28px; }
.signs div { border-top: 1px solid #1C1C24; padding-top: 6px; font-size: 12px; color: #4A4A58; }
.upi { border: 1px solid #E3E3EA; border-radius: 10px; padding: 12px; display: flex; gap: 12px; align-items: center; font-size: 12px; }
.upi svg { flex-shrink: 0; }
.end { margin: 28px 13mm 0; padding-top: 10px; border-top: 1px solid #E3E3EA; font-size: 11px; color: #5C5C6B; display: flex; justify-content: space-between; gap: 12px; }
@media screen { body { max-width: 210mm; margin: 0 auto; box-shadow: 0 0 0 1px #E3E3EA; } }
`;

// Full HTML document with the shared look; `css` adds per-document rules.
export function page(title: string, accent: string, body: string, css = ''): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONTS}" rel="stylesheet">
<style>:root{--accent:${esc(accent)};--accent-text:${esc(accentText(accent))}}${BASE}${css}</style></head><body>${body}</body></html>`;
}
