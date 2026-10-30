import { Report, Range, Table, Cell, fmtCell, isNum, rangeLabel } from './model';
import { esc, printHtml } from '../receipt';
import { inr } from '../money';
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

const htmlTable = (t: Table) => `<h2>${esc(t.title)}</h2>${!t.rows.length ? `<p class="e">${esc(t.empty)}</p>` : `<table>
<thead><tr>${t.cols.map(c => `<th class="${isNum(c.fmt) ? 'r' : ''}">${esc(c.label)}</th>`).join('')}</tr></thead>
<tbody>${t.rows.map(row => `<tr>${t.cols.map(c => `<td class="${isNum(c.fmt) ? 'r' : ''}">${esc(fmtCell(row[c.key], c.fmt))}</td>`).join('')}</tr>`).join('')}</tbody>
${t.total ? `<tfoot><tr>${t.cols.map(c => `<td class="${isNum(c.fmt) ? 'r' : ''}">${esc(fmtCell(t.total![c.key], c.fmt))}</td>`).join('')}</tr></tfoot>` : ''}
</table>`}`;

// Printable A4 page; the browser's print dialog also saves it as PDF.
export function reportHtml(r: Report, range: Range): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(reportFileName(r, range, 'pdf').replace('.pdf', ''))}</title>
<style>
  @page { size: A4; margin: 12mm; } * { box-sizing: border-box; }
  body { font: 11.5px/1.4 Arial, 'Noto Sans Gujarati', sans-serif; color: #1A1A18; margin: 0; }
  .top { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #1A237E; padding-bottom: 6px; margin-bottom: 4px; }
  h1 { font-size: 20px; margin: 0; color: #1A237E; } .shop { font-weight: 700; font-size: 13px; } .m { color: #666; font-size: 10.5px; }
  .note { color: #555; margin: 6px 0 10px; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
  .stat { border: 1px solid #D6D9EE; border-radius: 6px; padding: 7px 9px; background: #F7F8FD; }
  .stat .l { color: #666; font-size: 10px; text-transform: uppercase; letter-spacing: .4px; } .stat .v { font-size: 15px; font-weight: 800; margin-top: 2px; } .stat .s { color: #777; font-size: 10px; }
  .bad .v { color: #B3261E; } .good .v { color: #2E6B0F; } .warn .v { color: #B85C00; }
  h2 { font-size: 13px; margin: 14px 0 5px; color: #1A237E; } .e { color: #888; font-style: italic; }
  table { width: 100%; border-collapse: collapse; } thead { display: table-header-group; } tr { page-break-inside: avoid; }
  th { background: #1A237E; color: #fff; text-align: left; padding: 5px 6px; font-size: 10.5px; }
  td { padding: 4px 6px; border-bottom: 1px solid #E4E4E0; } tbody tr:nth-child(even) td { background: #FAFAF7; }
  tfoot td { font-weight: 800; background: #EEF0FB; border-top: 2px solid #1A237E; } .r { text-align: right; white-space: nowrap; }
  .foot { margin-top: 16px; color: #888; font-size: 10px; text-align: center; }
</style></head><body>
<div class="top"><div><div class="shop">${esc(SHOP.name)} · ${esc(SHOP.tagline)}</div><h1>${esc(r.title)}</h1></div>
<div class="m" style="text-align:right"><b>${esc(rangeLabel(range))}</b><br>Printed ${esc(new Date().toLocaleString('en-IN'))}</div></div>
<div class="note">${esc(r.note)}</div>
<div class="stats">${r.stats.map(s => `<div class="stat ${s.tone ?? ''}"><div class="l">${esc(s.label)}</div><div class="v">${esc(fmtCell(s.value, s.fmt, inr) || '—')}</div>${s.sub ? `<div class="s">${esc(s.sub)}</div>` : ''}</div>`).join('')}</div>
${r.tables.map(htmlTable).join('\n')}
<div class="foot">${esc(SHOP.name)} · ${SHOP.phone}</div>
</body></html>`;
}

export const printReport = (r: Report, range: Range) => printHtml(reportHtml(r, range));
