import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

// Small .xlsx reader / writer (one zip of XML files) plus CSV, for imports, exports and backups.

export type XCell = string | number | boolean | null | undefined;
export interface XSheet { name: string; rows: XCell[][] }

const xmlEsc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  // Control characters are not allowed in XML.
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''); // eslint-disable-line no-control-regex

// "A", "B" … "Z", "AA" for a 0-based column.
export const colName = (i: number): string => (i < 26 ? String.fromCharCode(65 + i) : colName(Math.floor(i / 26) - 1) + colName(i % 26));
// 0-based column of "AB12".
export const colIndex = (ref: string): number => ref.replace(/\d+/g, '').toUpperCase().split('').reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

// Excel sheet names: up to 31 characters, none of []:*?/\ and unique in the file.
export function sheetNames(names: string[]): string[] {
  const used = new Set<string>();
  return names.map(raw => {
    const base = (raw.replace(/[[\]:*?/\\]/g, ' ').trim() || 'Sheet').slice(0, 31);
    let name = base;
    for (let i = 2; used.has(name.toLowerCase()); i++) name = `${base.slice(0, 31 - String(i).length - 1)} ${i}`;
    used.add(name.toLowerCase());
    return name;
  });
}

const cellXml = (v: XCell, ref: string, head: boolean) => {
  const s = head ? ' s="1"' : '';
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${s}><v>${v}</v></c>`;
  if (typeof v === 'boolean') return `<c r="${ref}"${s} t="b"><v>${v ? 1 : 0}</v></c>`;
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xmlEsc(String(v))}</t></is></c>`;
};

function sheetXml(rows: XCell[][]): string {
  const widths: number[] = [];
  rows.forEach(r => r.forEach((v, i) => { widths[i] = Math.max(widths[i] ?? 8, Math.min(60, String(v ?? '').length + 2)); }));
  const cols = widths.length ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
  const data = rows.map((r, y) => `<row r="${y + 1}">${r.map((v, x) => cellXml(v, `${colName(x)}${y + 1}`, y === 0)).join('')}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols}<sheetData>${data}</sheetData></worksheet>`;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>`;

// A workbook with one sheet per list; the first row of each sheet is bold and stays in view.
export function writeXlsx(sheets: XSheet[]): Uint8Array {
  const names = sheetNames(sheets.map(s => s.name));
  const n = sheets.length;
  const range = Array.from({ length: n }, (_, i) => i + 1);
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${range.map(i => `<Override PartName="/xl/worksheets/sheet${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${range.map(i => `<sheet name="${xmlEsc(names[i - 1])}" sheetId="${i}" r:id="rId${i}"/>`).join('')}</sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${range.map(i => `<Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i}.xml"/>`).join('')}<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    'xl/styles.xml': strToU8(STYLES),
  };
  sheets.forEach((s, i) => { files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(s.rows)); });
  return zipSync(files, { level: 6 });
}

const parse = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml');
const all = (node: Document | Element, tag: string) => Array.from(node.getElementsByTagNameNS('*', tag));
const textOf = (node: Element) => all(node, 't').map(t => t.textContent ?? '').join('');

// Every sheet's cells as rows; numbers stay numbers, empty cells are null.
export function readXlsx(data: Uint8Array): XSheet[] {
  const zip = unzipSync(data);
  const file = (path: string) => (zip[path] ? strFromU8(zip[path]) : '');
  const shared = file('xl/sharedStrings.xml') ? all(parse(file('xl/sharedStrings.xml')), 'si').map(textOf) : [];
  const rels = new Map(all(parse(file('xl/_rels/workbook.xml.rels')), 'Relationship').map(r => [r.getAttribute('Id'), r.getAttribute('Target') ?? '']));
  return all(parse(file('xl/workbook.xml')), 'sheet').map(sh => {
    const rid = sh.getAttribute('r:id') ?? Array.from(sh.attributes).find(a => a.localName === 'id')?.value ?? '';
    const target = (rels.get(rid) ?? '').replace(/^\/?(xl\/)?/, '');
    const rows: XCell[][] = [];
    all(parse(file(`xl/${target}`)), 'row').forEach((row, y) => {
      const at = Number(row.getAttribute('r')) - 1;
      const line: XCell[] = [];
      all(row, 'c').forEach((c, x) => {
        const ref = c.getAttribute('r');
        const col = ref ? colIndex(ref) : x;
        const type = c.getAttribute('t');
        const v = all(c, 'v')[0]?.textContent ?? '';
        line[col] = type === 's' ? shared[Number(v)] ?? ''
          : type === 'inlineStr' ? textOf(c)
          : type === 'str' || type === 'e' ? v
          : type === 'b' ? v === '1'
          : v === '' ? null : Number(v);
      });
      rows[Number.isFinite(at) && at >= 0 ? at : y] = Array.from(line, v => (v === undefined ? null : v));
    });
    return { name: sh.getAttribute('name') ?? '', rows: Array.from(rows, r => r ?? []) };
  });
}

// RFC 4180 CSV: quoted fields may hold commas, quotes and line breaks.
export function readCsv(text: string): XCell[][] {
  const rows: XCell[][] = [];
  let row: XCell[] = [];
  let cell = '';
  let quoted = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// Reads an .xlsx or .csv file the user picked.
export async function readTableFile(file: File): Promise<XSheet[]> {
  const buf = new Uint8Array(await file.arrayBuffer());
  if (/\.csv$/i.test(file.name)) return [{ name: file.name.replace(/\.csv$/i, ''), rows: readCsv(strFromU8(buf)) }];
  try { return readXlsx(buf); } catch { throw new Error('This file is not an Excel (.xlsx) or CSV file. In Excel use File › Save as › Excel Workbook.'); }
}

export function downloadBlob(blob: Blob, fileName: string) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: fileName });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const downloadXlsx = (sheets: XSheet[], fileName: string) =>
  downloadBlob(new Blob([writeXlsx(sheets)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName);
