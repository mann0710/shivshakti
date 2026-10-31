import type { Customer } from '../types';
import type { XCell, XSheet } from './xlsx';
import { formatPhone, phoneKey } from './people';
import { Answers, BodyRow, Column, Detail, Plan, PlanBuilder, claims, countBy, firstRows, matchKey, readBody, textOf } from './importPlan';

// Catering customers import: matched by mobile, then by exact name; an empty cell never clears a saved value.

export const CUSTOMER_COLUMNS: Column[] = [
  { key: 'name', label: 'Name', names: ['name', 'customer', 'customer name', 'party', 'party name', 'client', 'full name'], required: true },
  { key: 'phone', label: 'Mobile', names: ['mobile', 'phone', 'mobile number', 'phone number', 'mobile no', 'phone no', 'contact', 'contact number', 'whatsapp', 'mob', 'cell'] },
  { key: 'email', label: 'Email', names: ['email', 'e mail', 'email id', 'mail'] },
  { key: 'address', label: 'Address', names: ['address', 'addr', 'location', 'area', 'city'] },
  { key: 'gstin', label: 'GSTIN', names: ['gstin', 'gst', 'gst no', 'gst number', 'gstin no'] },
];
const TABLE = 'customers';
type Field = 'name' | 'phone' | 'email' | 'address' | 'gstin';
const LABEL: Record<Field, string> = { name: 'Name', phone: 'Mobile', email: 'Email', address: 'Address', gstin: 'GSTIN' };

export const customerTemplate = (): XCell[][] => [CUSTOMER_COLUMNS.map(c => c.label), ['Ramesh Patel', '98250 12345', 'ramesh@example.com', 'Satellite, Ahmedabad', '']];

export function customerSheet(customers: Customer[]): XCell[][] {
  const rows = [...customers].sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
    .map(c => [c.name, formatPhone(c.phone), c.email ?? '', c.address ?? '', c.gstin ?? '']);
  return [CUSTOMER_COLUMNS.map(c => c.label), ...rows];
}

// Values compared the way people type them: emails in any case, GSTIN without spaces.
const norm: Record<Field, (s: string) => string> = {
  name: s => s.trim(), phone: s => phoneKey(s), email: s => s.trim().toLowerCase(), address: s => s.replace(/\s+/g, ' ').trim(), gstin: s => s.replace(/\s+/g, '').toUpperCase(),
};
const same = (f: Field, a: string, b: string) => (f === 'name' ? matchKey(a) === matchKey(b) : norm[f](a) === norm[f](b));

export function planCustomers(sheets: XSheet[], customers: Customer[], answers: Answers, newId: () => string): Plan {
  const body = readBody(sheets, CUSTOMER_COLUMNS);
  const b = new PlanBuilder(answers);
  if (body.missing.length) return b.finish(body, [TABLE]);
  const text = (r: BodyRow, k: Field) => textOf(body, r, k);
  const byPhone = claims(customers, c => phoneKey(c.phone));
  const byName = claims(customers, c => matchKey(c.name));
  const copies = countBy(customers, c => phoneKey(c.phone) || `name:${matchKey(c.name)}`);
  const first = firstRows(k => copies.get(k) ?? 0);

  body.rows.forEach(r => {
    const name = text(r, 'name');
    const typed = text(r, 'phone');
    const phone = phoneKey(typed);
    if (!name) { b.skip(r.row, typed, 'No name'); return; }
    const twice = first(phone || `name:${matchKey(name)}`, r.row);
    if (twice) { b.skip(r.row, name, `Listed twice; row ${twice} is used`); return; }
    if (typed && !phone) {
      const ok = b.ask({ id: `phone:${r.row}`, row: r.row, text: `Mobile "${typed}" for ${name} is not a 10-digit number.`, yes: 'Save without the mobile', no: 'Skip row' });
      if (ok === undefined) { b.wait(r.row, name, typed); return; }
      if (!ok) { b.skip(r.row, name, 'Skipped'); return; }
    }

    let saved = phone ? byPhone.find(phone) : undefined;
    const sameName = saved ? undefined : byName.find(matchKey(name));
    // Same name saved with another mobile: maybe a new number, maybe someone else.
    if (sameName && phone && phoneKey(sameName.phone) && phoneKey(sameName.phone) !== phone) {
      const ok = b.ask({ id: `same:${r.row}`, row: r.row, text: `"${name}" is already saved with mobile ${formatPhone(sameName.phone)}.`, yes: 'Same person — update it', no: 'Add as new customer' });
      if (ok === undefined) { b.wait(r.row, name, formatPhone(phone)); return; }
      if (ok) saved = sameName;
    } else saved = saved ?? sameName;
    if (saved) { byPhone.take(saved); byName.take(saved); }
    const match = saved;

    const next: Record<Field, string> = { name, phone, email: text(r, 'email'), address: text(r, 'address'), gstin: norm.gstin(text(r, 'gstin')) };
    if (!match) {
      b.insert(TABLE, newId(), { name, phone, email: next.email || null, address: next.address, gstin: next.gstin || null });
      b.change({ row: r.row, tile: 'new', tone: 'new', chip: 'New customer', name, where: formatPhone(phone) || '—', details: [] });
      return;
    }
    const values: Record<string, unknown> = {};
    const old: Record<string, unknown> = {};
    const details: Detail[] = [];
    (Object.keys(LABEL) as Field[]).forEach(f => {
      const was = String(match[f] ?? '');
      if (!next[f] || same(f, was, next[f])) return;
      values[f] = next[f];
      old[f] = match[f] ?? null;
      details.push({ label: LABEL[f], old: (f === 'phone' ? formatPhone(was) : was) || '—', next: f === 'phone' ? formatPhone(next[f]) : next[f] });
    });
    b.update(TABLE, match.id, values, old);
    const base = { row: r.row, name: match.name, where: formatPhone(match.phone) || '—', details };
    const filled = details.every(d => d.old === '—');
    if (details.length) b.change({ ...base, tile: 'changed', tone: filled ? 'added' : 'changed', chip: filled ? 'Details added' : 'Details changed' });
    else b.change({ ...base, tile: 'same', tone: 'same', chip: 'Same' });
  });
  return b.finish(body, [TABLE]);
}
