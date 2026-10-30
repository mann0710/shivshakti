import type { Quotation } from '../hooks/useQuotations';
import { inr } from './money';
import { optionTitle, totalText } from './quoteOptions';

// One enquiry in the list: a plain quote, or options A / B / C sharing option_group.
export interface QuoteGroup { key: string; options: Quotation[]; grouped: boolean }

const byLabel = (a: Quotation, b: Quotation) => (a.option_label || '').localeCompare(b.option_label || '') || a.created_at.localeCompare(b.created_at);

// Newest enquiry first; a lone leftover option shows as a plain quote.
export function groupQuotes(list: Quotation[]): QuoteGroup[] {
  const map = new Map<string, Quotation[]>();
  list.forEach(q => { const k = q.option_group || q.id; map.set(k, [...(map.get(k) ?? []), q]); });
  const newest = (g: Quotation[]) => g.reduce((m, q) => (q.created_at > m ? q.created_at : m), '');
  return Array.from(map.entries())
    .map(([key, qs]) => ({ key, options: [...qs].sort(byLabel), grouped: qs.length > 1 }))
    .sort((a, b) => newest(b.options).localeCompare(newest(a.options)));
}

export const acceptedOf = (g: QuoteGroup) => g.options.find(o => o.status === 'accepted');

// The accepted option's total, else lowest to highest across options.
export function groupTotal(g: QuoteGroup): string {
  const won = acceptedOf(g);
  if (won || !g.grouped) return totalText(won ?? g.options[0]);
  const lo = Math.min(...g.options.map(o => o.total_amount || 0));
  const hi = Math.max(...g.options.map(o => Math.max(o.total_max ?? 0, o.total_amount || 0)));
  return hi > lo ? `${inr(lo)} – ${inr(hi)}` : inr(lo);
}

// "Option B accepted", "Sent · customer picks 1 of 2", "Draft · customer picks 1 of 3".
export function groupStatus(g: QuoteGroup): { text: string; tone: 'accepted' | 'sent' | 'draft' | 'rejected' } {
  const won = acceptedOf(g);
  if (won) return { text: `${optionTitle(won)} accepted`, tone: 'accepted' };
  if (g.options.every(o => o.status === 'rejected')) return { text: 'All options declined', tone: 'rejected' };
  const sent = g.options.some(o => o.status === 'sent');
  return { text: `${sent ? 'Sent' : 'Draft'} · customer picks 1 of ${g.options.length}`, tone: sent ? 'sent' : 'draft' };
}
