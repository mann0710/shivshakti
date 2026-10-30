import { Report, Range, Table, Cell, Fmt, fmtCell, isNum, rangeLabel } from './model';
import { printHtml } from '../receipt';
import { esc, page } from '../docs/theme';
import { slimHeader, sectionHead } from '../docs/parts';
import { DocContext, docContext } from '../docs/context';
import { SHOP } from '../shop';

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const reportFileName = (r: Report, range: Range, ext: string) => `${slug(r.title)}_${range.from}_to_${range.to}.${ext}`;

// CSV keeps raw numbers so Excel / Sheets can total them.
const csvCell = (v: Cell) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csvTable = (t: Table) => [
  [t.title], t.cols.map(c => c.label),
  ...t.rows.map(r => t.cols.map(c => r[c.key])),
  ...(t.total ? [t.cols.map(c => t.total![c.key])] : []),
  [],
].map(line => line.map(csvCell).join(',')).join('\n');

export function reportCsv(r: Report, range: Range): string {
  const head = [[`${SHOP.name} - ${r.title}`], [`Period: ${range.from} to ${range.to}`], [r.note], [],
    ['Summary'], ...r.stats.map(s => [s.label, s.value, s.sub ?? '']), []]
    .map(line => line.map(csvCell).join(',')).join('\n');
  return `${head}\n${r.tables.map(csvTable).join('\n')}`;
}

export function downloadCsv(r: Report, range: Range) {
  // BOM so Excel opens Gujarati / ₹ correctly.
  const blob = new Blob(['﻿', reportCsv(r, range)], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = reportFileName(r, range, 'csv');
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const cell = (v: Cell, fmt?: Fmt) => esc(fmtCell(v, fmt));
const htmlTable = (t: Table) => {
  const right = (i: number) => (isNum(t.cols[i].fmt) ? 'r' : '');
  return `<section>${sectionHead(t.title, t.rows.length ? `${t.rows.length} rows` : '')}${!t.rows.length ? `<p class="muted">${esc(t.empty)}</p>` : `<div class="box"><table class="t">
<thead><tr>${t.cols.map((c, i) => `<th class="${right(i)}">${esc(c.label)}</th>`).join('')}</tr></thead>
<tbody>${t.rows.map(row => `<tr>${t.cols.map((c, i) => `<td class="${right(i)}">${cell(row[c.key], c.fmt)}</td>`).join('')}</tr>`).join('')}</tbody>
${t.total ? `<tfoot><tr>${t.cols.map((c, i) => `<td class="${right(i)}" style="font-weight:700;background:#EEF0FB">${cell(t.total![c.key], c.fmt)}</td>`).join('')}</tr></tfoot>` : ''}
</table></div>`}</section>`;
};

const TONES: Record<string, string> = { bad: '#B3261E', good: '#3D6B14', warn: '#B85C00' };

// Printable A4 report in the document style; the print dialog also saves it as PDF.
export function reportHtml(r: Report, range: Range, ctx: DocContext = docContext()): string {
  const tiles = `<div class="tiles">${r.stats.map(s => `<div class="tile"><span class="muted" style="font-size:11px">${esc(s.label)}</span>
  <b class="num" style="color:${s.tone ? TONES[s.tone] : '#1E1B6E'}">${esc(fmtCell(s.value, s.fmt) || '—')}</b>${s.sub ? `<span class="muted num" style="font-size:11px">${esc(s.sub)}</span>` : ''}</div>`).join('')}</div>`;
  const body = `${slimHeader(ctx, 'Report', r.title, `<b>${esc(rangeLabel(range))}</b><br>Printed ${esc(new Date().toLocaleString('en-IN'))}`)}
<div class="wrap"><p class="muted" style="margin:14px 0 0">${esc(r.note)}</p>${tiles}${r.tables.map(htmlTable).join('')}</div>
<div class="end"><span>${esc(SHOP.name)} · ${esc(r.title)}</span><span>CSV copy available from the app</span></div>`;
  return page(reportFileName(r, range, 'pdf').replace('.pdf', ''), ctx.settings.accent, body, `
@page { margin: 12mm 0; } @page :first { margin-top: 0; }
.tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-top: 14px; break-inside: avoid; }
.tile { border: 1px solid #E3E3EA; border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 2px; }
.tile b { font-family: Outfit, sans-serif; font-size: 19px; }
section { margin-top: 18px; } table.t td { padding: 5px 10px; font-size: 12px; } table.t th { padding: 6px 10px; }`);
}

export const printReport = (r: Report, range: Range) => printHtml(reportHtml(r, range));
