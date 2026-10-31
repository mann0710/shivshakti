import toast from 'react-hot-toast';
import { Quotation } from '../hooks/useQuotations';
import { quotationDoc, Doc } from './docs/quotationDoc';
import { shareDoc, pdfBlob, ShareResult } from './docs/output';
import { ensureLogo } from './docs/context';
import { formatDateIST } from './ist';
import { SHOP } from './shop';
import { optionTitle, totalText, quoteDays, quoteGuests } from './quoteOptions';
import { openChoiceLabels } from './quoteChoices';

// Every distinct occasion date for multi-day quotations, else the booking date.
export const quotationDates = (q: Quotation): string => {
  const days = q.is_multi_day ? (q.event_days || []).map(d => d.date).filter(Boolean) : [];
  const dates: string[] = days.length ? Array.from(new Set(days)).sort() : [q.booking?.event_date].filter(Boolean);
  return dates.map(d => formatDateIST(d, 'dd-MM-yyyy')).join(', ');
};

// "Wed 25 Nov", or "13 Sep to 15 Sep" for several days.
const whenText = (q: Quotation) => {
  const days = quoteDays(q);
  if (!days.length) return '';
  return days.length === 1 ? formatDateIST(days[0], 'EEE d MMM') : `${formatDateIST(days[0], 'd MMM')} to ${formatDateIST(days[days.length - 1], 'd MMM')}`;
};

// Friendly WhatsApp text; with several options it lists each option's total.
export const quotationMessage = (q: Quotation, options: Quotation[] = []): string => {
  const first = String(q.customer?.name || '').trim().split(/\s+/)[0];
  const hello = first ? `Namaste ${first} ji` : 'Namaste';
  const event = q.booking?.event_type ? `your ${q.booking.event_type}` : 'your event';
  const when = whenText(q);
  const guests = quoteGuests(q);
  const sign = `— ${SHOP.name}`;
  if (options.length > 1) {
    return [`${hello}, here are ${options.length} menu options for ${event}${when ? ` on ${when}` : ''}:`,
      ...options.map(o => `${optionTitle(o)}: ${totalText(o)}`),
      `Please tell us which option you prefer. ${sign}`].join('\n');
  }
  const picks = openChoiceLabels(q).map(l => l.toLowerCase());
  const which = optionTitle(q) ? ` (${optionTitle(q)})` : '';
  return `${hello}, here is the quotation${which} for ${event}${when ? ` on ${when}` : ''}: ${totalText(q)}${guests > 0 ? ` for ${guests} guests` : ''}.`
    + `${picks.length ? ` Please tell us which ${picks.join(' and ')} you prefer.` : ''} ${sign}`;
};

// "98•••• 4821" — enough to recognise the saved number.
export const maskPhone = (phone?: string | null) => {
  const d = String(phone || '').replace(/\D/g, '').slice(-10);
  return d.length === 10 ? `${d.slice(0, 2)}•••• ${d.slice(6)}` : String(phone || '');
};

export const quotePdf = (q: Quotation, withPrices = true, options?: Quotation[]) => () => quotationDoc(q, { withPrices, options });

// Phones: the share sheet with the PDF attached; null when the phone can't share files.
async function shareSheet(make: () => Doc, text: string): Promise<ShareResult | null> {
  await ensureLogo();
  const doc = make();
  const blob = await pdfBlob(doc);
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const file = blob && new File([blob], doc.fileName, { type: 'application/pdf' });
  if (!file || !nav.canShare?.({ files: [file] })) return null;
  try { await nav.share({ files: [file], text, title: doc.fileName }); return 'shared'; } catch (e: any) { return e?.name === 'AbortError' ? 'cancelled' : null; }
}

// Real PDF from the PDF service; computers open the saved number's WhatsApp chat (PDF saved to attach).
export async function shareQuotation(q: Quotation, withPrices = true, options?: Quotation[], text?: string, phone = false): Promise<ShareResult | null> {
  const make = quotePdf(q, withPrices, options);
  const message = text ?? quotationMessage(q, options);
  try {
    const sheet = phone ? await shareSheet(make, message) : null;
    const res = sheet ?? await shareDoc(make, message, q.customer?.phone);
    if (res === 'shared') toast.success('Quotation shared');
    else if (res === 'cancelled') toast('Share cancelled');
    return res;
  } catch (e: any) {
    toast.error(e?.message || 'Couldn\'t send to WhatsApp');
    return null;
  }
}
