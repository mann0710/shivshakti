import type { Customer } from '../types';
import type { SeasonalCustomer } from '../hooks/useSeasonalCustomers';
import { cleanPhone } from './money';

// One person across the catering (customers) and sweets (seasonal_customers) tables, joined by mobile.

export type Side = 'catering' | 'sweets';

export interface Person {
  key: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  gstin: string;
  notes: string;
  since: string;
  catering: Customer[];
  sweets: SeasonalCustomer[];
}

export const phoneKey = (p?: string | null) => { const d = cleanPhone(p ?? ''); return d.length === 10 ? d : ''; };
export const formatPhone = (p?: string | null) => { const d = phoneKey(p); return d ? `${d.slice(0, 5)} ${d.slice(5)}` : (p ?? '').trim(); };
export const nameKey = (n: string) => n.trim().toLowerCase().replace(/\s+/g, ' ');
const firstOf = (vals: (string | null | undefined)[]) => vals.map(v => (v ?? '').trim()).find(Boolean) ?? '';

type Group = { catering: Customer[]; sweets: SeasonalCustomer[] };

function toPerson(key: string, g: Group): Person {
  const all = [...g.catering, ...g.sweets];
  return {
    key,
    name: firstOf(all.map(r => r.name)),
    phone: phoneKey(firstOf(all.map(r => r.phone))) || firstOf(all.map(r => r.phone)),
    email: firstOf(g.catering.map(c => c.email)),
    address: firstOf(all.map(r => r.address)),
    gstin: firstOf(g.catering.map(c => c.gstin)),
    notes: firstOf(all.map(r => r.notes)),
    since: all.map(r => r.created_at).filter(Boolean).sort()[0] ?? '',
    catering: g.catering,
    sweets: g.sweets,
  };
}

// Records with the same 10-digit mobile become one person; records without one stay on their own.
export function mergePeople(catering: Customer[], sweets: SeasonalCustomer[]): Person[] {
  const groups = new Map<string, Group>();
  const slot = (key: string) => { if (!groups.has(key)) groups.set(key, { catering: [], sweets: [] }); return groups.get(key)!; };
  catering.forEach(c => slot(phoneKey(c.phone) || `c:${c.id}`).catering.push(c));
  sweets.forEach(s => slot(phoneKey(s.phone) || `s:${s.id}`).sweets.push(s));
  return Array.from(groups, ([key, g]) => toPerson(key, g)).sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}

// Saved more than once under different names, or twice in the same list.
export function isSavedTwice(p: Person): boolean {
  if (p.catering.length + p.sweets.length < 2) return false;
  const names = new Set([...p.catering, ...p.sweets].map(r => nameKey(r.name)));
  return names.size > 1 || p.catering.length > 1 || p.sweets.length > 1;
}

// Plain-English reason for the "saved twice" banner.
export function savedTwiceReason(p: Person): string {
  if (p.catering.length && p.sweets.length && p.catering.length + p.sweets.length === 2) return 'once for catering, once for sweets';
  const parts = [p.catering.length > 1 ? `${p.catering.length} times for catering` : '', p.sweets.length > 1 ? `${p.sweets.length} times for sweets` : ''].filter(Boolean);
  return parts.join(' and ') || 'under two names';
}

// Another person already saved with this mobile number.
export const personWithPhone = (people: Person[], phone: string, exceptKey?: string) => {
  const k = phoneKey(phone);
  return k ? people.find(p => p.key !== exceptKey && phoneKey(p.phone) === k) : undefined;
};

export const personByRecord = (people: Person[], id: string) =>
  people.find(p => p.catering.some(c => c.id === id) || p.sweets.some(s => s.id === id));

// Name, email or at least three digits of the mobile.
export function searchPeople<T extends Person>(people: T[], term: string): T[] {
  const t = term.trim().toLowerCase();
  if (!t) return people;
  const digits = t.replace(/\D/g, '');
  return people.filter(p =>
    p.name.toLowerCase().includes(t) ||
    p.email.toLowerCase().includes(t) ||
    [...p.catering, ...p.sweets].some(r => r.name.toLowerCase().includes(t)) ||
    (digits.length >= 3 && (p.phone.replace(/\D/g, '').includes(digits))));
}

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';

// Combined record that names every saved copy, for the combine step.
export interface RecordRef { side: Side; id: string; name: string }
export const recordsOf = (p: Person): RecordRef[] => [
  ...p.catering.map(c => ({ side: 'catering' as const, id: c.id, name: c.name })),
  ...p.sweets.map(s => ({ side: 'sweets' as const, id: s.id, name: s.name })),
];

// Distinct names a person was saved under, most used first.
export function namesOf(p: Person): string[] {
  const count = new Map<string, { name: string; n: number }>();
  recordsOf(p).forEach(r => {
    const k = nameKey(r.name);
    const cur = count.get(k);
    count.set(k, { name: cur?.name ?? r.name.trim(), n: (cur?.n ?? 0) + 1 });
  });
  return Array.from(count.values()).sort((a, b) => b.n - a.n || b.name.length - a.name.length).map(x => x.name);
}
