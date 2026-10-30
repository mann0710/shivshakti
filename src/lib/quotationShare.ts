import toast from 'react-hot-toast';
import { Quotation } from '../hooks/useQuotations';
import { quotationDoc } from './docs/quotationDoc';
import { shareDoc, ShareResult } from './docs/output';
import { formatDateIST } from './ist';
import { inr } from './money';
import { SHOP } from './shop';

// Every distinct occasion date for multi-day quotations, else the booking date.
export const quotationDates = (q: Quotation): string => {
  const days = q.is_multi_day ? (q.event_days || []).map(d => d.date).filter(Boolean) : [];
  const dates: string[] = days.length ? Array.from(new Set(days)).sort() : [q.booking?.event_date].filter(Boolean);
  return dates.map(d => formatDateIST(d, 'dd-MM-yyyy')).join(', ');
};

const guestsOf = (q: Quotation): number =>
  q.guest_count || q.booking?.guest_count
  || Math.max(0, ...(q.event_days || []).flatMap(d => (d.meals || []).map(m => m.guest_count || 0)));

export const quotationMessage = (q: Quotation): string => {
  const guests = guestsOf(q);
  const dates = quotationDates(q);
  const lines: unknown[] = [
    q.customer?.name ? `Namaste ${q.customer.name},` : 'Namaste,',
    q.booking?.event_type ? `Event: ${q.booking.event_type}` : null,
    dates ? `Date: ${dates}` : null,
    guests > 0 ? `Guests: ${guests}` : null,
    `Total: ${inr(q.total_amount || 0)}`,
    '',
    `Quotation ${q.quotation_number} attached — ${SHOP.name}`,
  ];
  return lines.filter(l => typeof l === 'string').join('\n');
};

// Real PDF from the PDF service; phones get the share sheet, desktops a download + WhatsApp.
export async function shareQuotation(q: Quotation, withPrices = true, options?: Quotation[]): Promise<ShareResult | null> {
  try {
    const res = await shareDoc(() => quotationDoc(q, { withPrices, options }), quotationMessage(q), q.customer?.phone);
    if (res === 'shared') toast.success('Quotation shared');
    else if (res === 'whatsapp') toast.success('PDF downloaded — attach it in the WhatsApp chat', { duration: 5000 });
    else toast('Share cancelled');
    return res;
  } catch (e: any) {
    toast.error(e?.message || 'Could not share quotation');
    return null;
  }
}
