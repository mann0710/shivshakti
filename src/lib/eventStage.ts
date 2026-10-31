// Where a catering event stands, derived from its booking, quotes and invoice.

export const STAGES = ['inquiry', 'quoted', 'confirmed', 'invoiced', 'paid'] as const;
export type Stage = typeof STAGES[number] | 'cancelled';

export const STAGE_LABELS: Record<Stage, string> = {
  inquiry: 'Inquiry', quoted: 'Quoted', confirmed: 'Confirmed', invoiced: 'Invoiced', paid: 'Paid', cancelled: 'Cancelled',
};

interface BookingLike { status: string }
interface QuoteLike { status?: string }
interface InvoiceLike { status: string; balance_due: number }

export const eventStage = (b: BookingLike, quotes: QuoteLike[], invoice?: InvoiceLike | null): Stage => {
  if (b.status === 'cancelled') return 'cancelled';
  if (invoice) return invoice.status === 'paid' || invoice.balance_due <= 0 ? 'paid' : 'invoiced';
  // A draft that was never sent is still an inquiry; a confirmed booking waiting on its sent quote is still quoted.
  const sent = quotes.some(q => q.status === 'sent');
  const accepted = quotes.some(q => q.status === 'accepted');
  if (b.status === 'confirmed' || b.status === 'completed') return sent && !accepted ? 'quoted' : 'confirmed';
  return sent || accepted ? 'quoted' : 'inquiry';
};

// What to do next at each stage, shown under the progress bar.
export const NEXT_STEP: Record<Stage, string> = {
  inquiry: 'Make a quotation and share it',
  quoted: 'When the customer agrees, mark the quote Accepted',
  confirmed: 'Create the invoice',
  invoiced: 'Record payments as they come in',
  paid: 'All paid',
  cancelled: 'This event was cancelled',
};
