// What the owner can change on every printed document (Data Center → Documents).

export interface PayStep { pct: number; label: string; when: string }

export interface DocSettings {
  accent: string;
  address: string;
  upi_id: string;
  bank: string;
  contact_name: string;
  quote_valid_days: number;
  schedule: PayStep[];
  extras: string[];
  terms: string[];
  quote_qr: boolean;
  invoice_menu: boolean;
  invoice_payments: boolean;
  invoice_qr: boolean;
  slip_stub: boolean;
  bill_footer: string;
}

export const ACCENTS: { name: string; color: string; text: string }[] = [
  { name: 'Leaf green', color: '#8DC63F', text: '#4A7A1C' },
  { name: 'Saffron', color: '#E8750A', text: '#A84F00' },
  { name: 'Red', color: '#C62828', text: '#C62828' },
  { name: 'Navy', color: '#1E1B6E', text: '#1E1B6E' },
];

export const DEFAULT_DOC_SETTINGS: DocSettings = {
  accent: '#8DC63F',
  address: '',
  upi_id: '',
  bank: '',
  contact_name: 'Mann Sheth',
  quote_valid_days: 15,
  schedule: [
    { pct: 10, label: 'To confirm', when: 'On booking' },
    { pct: 70, label: 'Advance', when: 'One month before the event' },
    { pct: 20, label: 'Balance', when: 'On the event day' },
  ],
  extras: ['Bone china crockery', 'P.R.O. service girls', 'V.I.P. boys', 'Display themes', 'Water bottles', 'Transportation'],
  terms: [
    'No deposit or fixed charge is payable by the caterer; any such charges at the party plot or hall are borne by the party.',
    'Faraskhana, decoration, light connections and kitchen facility are arranged and paid for by the party.',
  ],
  quote_qr: true,
  invoice_menu: true,
  invoice_payments: true,
  invoice_qr: true,
  slip_stub: true,
  bill_footer: 'Thank you! Visit again.',
};

const lines = (v: unknown, fallback: string[]) =>
  Array.isArray(v) ? v.map(String).map(s => s.trim()).filter(Boolean) : fallback;

// Saved values over defaults, ignoring anything malformed.
export function mergeDocSettings(raw?: Partial<DocSettings> | null): DocSettings {
  const d = DEFAULT_DOC_SETTINGS;
  const r = raw && typeof raw === 'object' ? raw : {};
  const steps = Array.isArray(r.schedule)
    ? r.schedule.map(s => ({ pct: Number(s?.pct) || 0, label: String(s?.label ?? ''), when: String(s?.when ?? '') })).filter(s => s.pct > 0)
    : d.schedule;
  return {
    ...d,
    ...Object.fromEntries(Object.entries(r).filter(([k, v]) => k in d && typeof v === typeof (d as any)[k] && !Array.isArray(v))),
    schedule: steps,
    extras: lines(r.extras, d.extras),
    terms: lines(r.terms, d.terms),
  } as DocSettings;
}

export const accentText = (accent: string) => ACCENTS.find(a => a.color.toLowerCase() === accent.toLowerCase())?.text ?? accent;

// Splits a total by the schedule; the last step takes the rounding remainder.
export function scheduleAmounts(total: number, steps: PayStep[]): number[] {
  const out = steps.map(s => Math.round((total * s.pct) / 100));
  const full = steps.reduce((s, x) => s + x.pct, 0) === 100;
  if (full && out.length) out[out.length - 1] = total - out.slice(0, -1).reduce((a, b) => a + b, 0);
  return out;
}
