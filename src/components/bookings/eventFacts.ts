import type { Quotation } from '../../hooks/useQuotations';
import type { BookingView } from '../../lib/bookingBoard';
import { STAGES, STAGE_LABELS, Stage } from '../../lib/eventStage';
import { choiceGroups, pickedOf } from '../../lib/quoteChoices';
import { formatDateIST } from '../../lib/ist';
import { inr } from '../../lib/money';
import { waNumber } from '../../lib/quoteMath';
import { SHOP } from '../../lib/shop';

// What the event page says: the next-step banner, the stage list, the money summary and payment words.
export const PAY_MODES: [string, string][] = [['cash', 'Cash'], ['upi', 'UPI'], ['bank_transfer', 'Bank transfer'], ['cheque', 'Cheque']];
export const modeText = (m?: string | null) => PAY_MODES.find(([k]) => k === m)?.[1] ?? (m ? m.replace('_', ' ') : '');

const firstName = (v: BookingView) => (v.b.customer?.name ?? 'The customer').trim().split(/\s+/)[0];
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
const andList = (l: string[]) => (l.length > 1 ? `${l.slice(0, -1).join(', ')} and ${l[l.length - 1]}` : l[0] ?? 'their dishes');
const range = (lo: number, hi: number) => (Math.round(hi) > Math.round(lo) ? `${inr(Math.round(lo))} – ${inr(Math.round(hi))}` : inr(Math.round(lo)));

// "Choose any" groups still waiting for the customer's pick, across every meal.
export function openGroups(q: Pick<Quotation, 'is_multi_day' | 'event_days' | 'items'>) {
  const lists = q.is_multi_day && q.event_days?.length ? q.event_days.flatMap(d => d.meals.map(m => m.items ?? [])) : [q.items ?? []];
  return lists.flatMap(l => choiceGroups(l).filter(g => !pickedOf(g).length));
}

// Dishes still to pick, e.g. ["1 farsan"].
export const openPicks = (q: Pick<Quotation, 'is_multi_day' | 'event_days' | 'items'>) =>
  Array.from(new Map(openGroups(q).map(g => [g.meta.label, `${g.meta.pick} ${g.meta.label.toLowerCase()}`] as [string, string])).values());

export interface Banner { tone: 'warn' | 'ok' | 'danger'; text: string }

// One sentence on what happens next; `options` is how many quote options the customer chooses from.
export function nextBanner(v: BookingView, today: string, options = 1): Banner | null {
  const name = firstName(v);
  const due = Number(v.invoice?.balance_due) || 0;
  if (v.stage === 'cancelled') return { tone: 'danger', text: 'Lost or cancelled. To bring it back, use ⋯ More → Change status.' };
  if (v.invoice && due > 0) {
    const after = daysBetween(v.end, today);
    return after > 0 ? { tone: 'danger', text: `${inr(due)} still due, ${after} day${after > 1 ? 's' : ''} after the event.` }
      : { tone: 'warn', text: `Next: record payments as they come in. ${inr(due)} still due.` };
  }
  const final = 'then you accept. The price is final after that.';
  switch (v.next?.kind) {
    case 'pick': return { tone: 'warn', text: options > 1 ? `Next: ${name} picks one of the ${options} options, ${final}` : `Next: ${name} picks ${andList(openPicks(v.quote!))}, ${final}` };
    case 'accept': return { tone: 'warn', text: `Next: when ${name} agrees, accept ${v.quote?.quotation_number ?? 'the quote'}.` };
    case 'quote': return { tone: 'warn', text: `Next: make a quotation and send it to ${name}.` };
    case 'invoice': return { tone: 'warn', text: 'Next: create the invoice. It uses the accepted menu and price.' };
    case 'complete': return { tone: 'warn', text: 'Next: mark the event completed so your totals stay right.' };
    case 'close': return { tone: 'warn', text: v.stage === 'inquiry' ? 'The date has passed without a quote. Close it as lost.'
      : `The date has passed and nothing was agreed. Close it as lost, or accept the quote if ${name} went ahead.` };
  }
  return v.invoice ? { tone: 'ok', text: 'All paid. Nothing left to do.' } : null;
}

export interface StageRow { stage: Stage; title: string; sub: string; mark: 'done' | 'now' | '' }

// Inquiry → Paid, each with what happened and "now" on the current one.
export function stageRows(v: BookingView, quotes: Quotation[]): StageRow[] {
  const at = (STAGES as readonly Stage[]).indexOf(v.stage);
  const q = quotes.find(x => x.status === 'accepted') ?? quotes.find(x => x.status !== 'rejected');
  const adv = Number(v.b.advance_received) || 0;
  const inv = v.invoice;
  const sub: Record<string, string> = {
    inquiry: v.b.created_at ? `Booked ${formatDateIST(v.b.created_at, 'd MMM')}` : '',
    quoted: q ? `${q.quotation_number} ${q.status === 'draft' ? 'not sent yet' : q.status}${q.issue_date ? ` · ${formatDateIST(q.issue_date, 'd MMM')}` : ''}` : 'When a quotation is made',
    confirmed: at >= 2 ? (adv ? `Accepted · ${inr(adv)} advance${v.b.advance_mode ? ` by ${modeText(v.b.advance_mode)}` : ''}` : 'Quote accepted') : 'When the quote is accepted',
    invoiced: inv ? `${inv.invoice_number}${inv.issue_date ? ` · ${formatDateIST(inv.issue_date, 'd MMM')}` : ''}` : '',
    paid: v.stage === 'paid' ? 'Paid in full' : inv ? `${inr(Number(inv.balance_due))} still due` : '',
  };
  return STAGES.map((s, i) => ({ stage: s, title: STAGE_LABELS[s], sub: sub[s], mark: i < at || (i === at && s === 'paid') ? 'done' : i === at ? 'now' : '' }));
}

export interface MoneyRow { label: string; value: string; strong?: boolean }

// Before the invoice: advance to ask, advance received, and what is still to come.
export function moneyRows(v: BookingView, pct: number): MoneyRow[] {
  const q = v.quote && v.quote.status !== 'rejected' ? v.quote : undefined;
  const adv = Number(v.b.advance_received) || 0;
  if (!q && !adv) return [];
  const lo = Number(q?.total_amount) || 0;
  const hi = Math.max(lo, Number(q?.total_max) || 0);
  const how = [modeText(v.b.advance_mode), v.b.advance_date ? formatDateIST(v.b.advance_date, 'd MMM') : ''].filter(Boolean).join(', ');
  const rows: MoneyRow[] = [];
  if (q && q.status !== 'accepted' && pct > 0) rows.push({ label: `Advance to ask on accept (${pct}%)`, value: range((lo * pct) / 100, (hi * pct) / 100) });
  rows.push({ label: adv && how ? `Received so far · ${how}` : 'Received so far', value: inr(adv) });
  if (q) rows.push({ label: 'Still to come', value: range(Math.max(0, lo - adv), Math.max(0, hi - adv)), strong: true });
  return rows;
}

// WhatsApp link that reminds the customer of what is still due.
export function remindHref(v: BookingView): string | null {
  const phone = v.b.customer?.phone?.trim();
  const due = Number(v.invoice?.balance_due) || 0;
  if (!phone || !v.invoice || due <= 0) return null;
  const text = `Namaste ${firstName(v)}, a gentle reminder that ${inr(due)} is still due on invoice ${v.invoice.invoice_number} for your ${v.b.event_type} on ${formatDateIST(v.start, 'd MMM')}. Thank you. ${SHOP.name}`;
  return `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text)}`;
}

// Message sent with the invoice PDF.
export const invoiceText = (v: BookingView) => {
  const i = v.invoice!;
  const due = Number(i.balance_due) || 0;
  return `Dear ${v.b.customer?.name ?? 'Customer'},\nInvoice ${i.invoice_number}\nTotal: ${inr(i.total_amount)}\nBalance due: ${due > 0 ? inr(due) : 'Nil (fully paid)'}\n\n${SHOP.name}`;
};
