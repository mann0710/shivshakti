// The Settings groups, every row they show (for search) and the status line under each group.

export type GroupId = 'business' | 'money' | 'documents' | 'catering' | 'sweets' | 'reminders' | 'team' | 'data';

export const GROUPS: { id: GroupId; title: string; sub: string }[] = [
  { id: 'business', title: 'Business', sub: 'Printed on every quotation, invoice and sweets bill.' },
  { id: 'money', title: 'Money & tax', sub: 'What goes on bills and how people pay.' },
  { id: 'documents', title: 'Documents', sub: 'How quotations, invoices and bills look.' },
  { id: 'catering', title: 'Catering', sub: 'Choices offered in bookings and quotes.' },
  { id: 'sweets', title: 'Sweets', sub: 'Counter and seasons.' },
  { id: 'reminders', title: 'Reminders on Home', sub: 'One tap sends each on WhatsApp.' },
  { id: 'team', title: 'Team & access', sub: 'Who can sign in and what they see.' },
  { id: 'data', title: 'Data', sub: 'Get data in and out, keep it safe.' },
];

const R = (group: GroupId, label: string, words = '') => ({ group, label, words });

export const SETTING_ROWS = [
  R('business', 'Name on catering documents', 'shop business'), R('business', 'Name on sweets bills', 'shop business'),
  R('business', 'Shop address', 'address'), R('business', 'Contact person', 'phone name'),
  R('business', 'GST number', 'gstin tax'), R('business', 'FSSAI licence number', 'food licence fssai'),
  R('business', 'FSSAI certificate', 'food licence upload fssai'), R('business', 'Logo', 'image upload'),
  R('money', 'GST on catering', 'gst registered rate tax bill of supply 5% 18%'), R('money', 'GST on sweets', 'gst tax counter bill'),
  R('money', 'UPI ID for QR codes', 'upi qr payment counter pos'), R('money', 'Usual payment plan', 'advance schedule balance'),
  R('money', 'Quotes are valid for', 'validity days quotation'),
  R('documents', 'Colour', 'color accent pdf'), R('documents', 'Menu layout', 'columns'), R('documents', 'Dish prices on quotes', 'price'),
  R('documents', 'Invoice: list every payment', 'payments'), R('documents', 'Invoice: UPI QR for the balance', 'upi qr'),
  R('documents', 'Invoice: menu as the last page', 'menu'), R('documents', 'Sweets bill footer', 'thank you'),
  R('documents', 'Terms on quotes', 'conditions'), R('documents', 'Charged extra on request', 'extras'),
  R('documents', 'Bank details for transfers', 'bank account ifsc neft'), R('documents', 'UPI QR on quotes', 'upi qr advance'),
  R('documents', 'Pre-booking slip: counter stub', 'tear-off slip'),
  R('catering', 'Event types', 'wedding vashtu occasion'), R('catering', 'Food styles', 'jain swaminarayan regular'),
  R('catering', 'Dish tags', 'jain onion garlic'), R('catering', 'Courses and their order', 'menu order'),
  R('sweets', 'Box sizes', 'pack sizes grams litre piece'), R('sweets', 'Seasons and dates', 'occasions diwali rakhi'),
  R('sweets', 'Print the bill after each sale', 'receipt printer'), R('sweets', 'Quick keys on the counter', 'pos'),
  R('sweets', 'Day close', 'cash drawer'),
  R('reminders', 'Payment due', 'whatsapp'), R('reminders', 'Quote with no reply', 'whatsapp follow up'),
  R('reminders', 'Pre-booking pickup', 'whatsapp'), R('reminders', 'Unpaid sweets bill', 'whatsapp due'),
  R('team', 'Signed in now', 'login email account role owner counter kitchen'), R('team', 'Add someone', 'invite login staff'), R('team', 'Your password', 'login change'),
  R('team', 'Team list for events', 'cooks helpers staff members'),
  R('data', 'Import from Excel', 'upload xlsx csv dishes sweets customers'), R('data', 'Download everything', 'export excel xlsx'), R('data', 'Backup copy', 'backup json'),
  R('data', 'Recycle bin', 'deleted restore'), R('data', 'Database updates', 'migration schema'),
];

// Groups with at least one row matching every word typed, and those rows' labels.
export function searchSettings(query: string): Map<GroupId, string[]> {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const out = new Map<GroupId, string[]>();
  if (!words.length) return out;
  const title = (id: GroupId) => GROUPS.find(g => g.id === id)!.title;
  SETTING_ROWS.forEach(r => {
    const hay = `${r.label} ${r.words} ${title(r.group)}`.toLowerCase();
    if (words.every(w => hay.includes(w))) out.set(r.group, [...(out.get(r.group) ?? []), r.label]);
  });
  return out;
}

export const GST_SLABS = [0, 5, 18];
export const gstLabel = (rate: number) => (rate === 0 ? 'Not GST-registered' : `GST ${rate}%`);
export const isOldSlab = (rate: number) => !GST_SLABS.includes(rate);

export interface StatusInput {
  gstNumber: string;
  gstRate: number;
  upiId: string;
  address: string;
  fssai: boolean;
  docsReady: boolean;
  eventTypes: number;
  teamMembers: number;
  logins: number;
  undated: string[];
  updates: number;
  reminders: number;
  backupStale: boolean;
}
export interface GroupNote { note: string; warn: boolean }

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// One line per group, warning about anything that prints wrong or is missing.
export function groupNotes(i: StatusInput): Record<GroupId, GroupNote> {
  const missing = [i.gstRate > 0 && !i.gstNumber.trim() ? 'GST number' : '', !i.address.trim() ? 'shop address' : '', !i.fssai ? 'FSSAI certificate' : ''].filter(Boolean);
  const money = [isOldSlab(i.gstRate) ? `GST ${i.gstRate}% is an old slab` : gstLabel(i.gstRate), i.upiId.trim() ? '' : 'no UPI ID yet'].filter(Boolean);
  return {
    business: missing.length ? { note: `${cap(missing[0])} missing${missing.length > 1 ? ` · ${missing.length - 1} more` : ''}`, warn: true } : { note: 'Address, GST number, FSSAI', warn: false },
    money: { note: money.join(' · '), warn: isOldSlab(i.gstRate) || !i.upiId.trim() },
    documents: i.docsReady ? { note: 'Colour, terms, what prints', warn: false } : { note: 'Needs a database update to save', warn: true },
    catering: { note: `${plural(i.eventTypes, 'event type')} · 3 food styles`, warn: false },
    sweets: i.undated.length ? { note: `${i.undated[0]} has no dates yet${i.undated.length > 1 ? ` (+${i.undated.length - 1})` : ''}`, warn: true } : { note: 'Box sizes · seasons and dates', warn: false },
    reminders: { note: i.reminders ? `${i.reminders} of 4 on · one tap sends on WhatsApp` : 'All off', warn: false },
    team: { note: [i.logins ? plural(i.logins, 'login') : '', `${plural(i.teamMembers, 'team member')} for events`].filter(Boolean).join(' · '), warn: false },
    data: i.updates ? { note: `${plural(i.updates, 'database update')} to run`, warn: true }
      : i.backupStale ? { note: 'No backup this week', warn: true } : { note: 'Backed up · database up to date', warn: false },
  };
}
