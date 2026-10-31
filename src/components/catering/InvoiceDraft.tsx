import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Invoice } from '../../types';
import { useRecalculateTotals, useUpdateEventDays } from '../../hooks/useInvoices';
import { useUpdateBooking } from '../../hooks/useBookings';
import { daysSubtotal, offerSavings, parseDiscount } from '../../lib/invoiceEdit';
import { ChargeRow } from './InvoiceChargeList';

export interface InvoiceDraft { days: any[]; guests: number | null; extras: ChargeRow[]; transport: ChargeRow[]; discount: string; gst: number }
export type SaveState = 'saved' | 'saving' | 'error';

const PCT = /(\d+(?:\.\d+)?%)$/;

// The editable copy of a saved invoice.
export function draftOf(inv: Invoice): InvoiceDraft {
  const days = (inv.event_days ?? []) as any[];
  const manual = inv.additional_discounts ?? [];
  const legacy = Math.max(0, (inv.discount_amount || 0) - (inv.is_multi_day ? offerSavings(days) : 0));
  const discount = manual.length === 1 && PCT.test(manual[0].description) ? PCT.exec(manual[0].description)![1]
    : manual.length ? String(manual.reduce((s, d) => s + (d.amount || 0), 0) || '') : legacy ? String(legacy) : '';
  return {
    days, guests: null, discount, gst: inv.gst_rate || 0,
    extras: [...(inv.extra_charges ?? [])],
    transport: inv.transportation_charges?.length ? [...inv.transportation_charges] : inv.transportation_charge > 0 ? [{ description: 'Transport', amount: inv.transportation_charge }] : [],
  };
}

const kept = (rows: ChargeRow[]) => rows.filter(r => r.description.trim() || r.amount > 0).map(r => ({ description: r.description.trim(), amount: r.amount }));

// Each change saves by itself a moment after typing stops; leaving saves straight away.
export function useInvoiceDraft(inv: Invoice, plateRate: number) {
  const updateDays = useUpdateEventDays();
  const recalc = useRecalculateTotals();
  const updateBooking = useUpdateBooking();
  const [draft, setDraft] = useState(() => draftOf(inv));
  const [status, setStatus] = useState<SaveState>('saved');
  const latest = useRef(draft);
  const ctx = useRef({ inv, plateRate });
  ctx.current = { inv, plateRate };
  const pending = useRef(false);
  const timer = useRef<number>();
  const chain = useRef<Promise<void>>(Promise.resolve());

  const save = async (d: InvoiceDraft) => {
    const { inv: i, plateRate: rate } = ctx.current;
    const multi = !!i.is_multi_day && d.days.length > 0;
    let base = i.subtotal;
    if (multi) { base = daysSubtotal(d.days); await updateDays.mutateAsync({ invoiceId: i.id, event_days: d.days, subtotal: base }); }
    else if (d.guests !== null && rate > 0) {
      base = rate * d.guests;
      await updateDays.mutateAsync({ invoiceId: i.id, subtotal: base });
      if (d.guests > 0 && d.guests !== i.booking?.guest_count) await updateBooking.mutateAsync({ id: i.booking_id, guest_count: d.guests });
    }
    const manual = parseDiscount(d.discount, base);
    await recalc.mutateAsync({
      invoiceId: i.id, discount_amount: (multi ? offerSavings(d.days) : 0) + manual, discount_type: 'amount',
      apply_gst: d.gst > 0, gst_rate: d.gst || undefined, transportation_charges: kept(d.transport), extra_charges: kept(d.extras),
      additional_discounts: manual > 0 ? [{ id: 'discount', description: d.discount.includes('%') ? `Discount ${d.discount}` : 'Discount', amount: manual }] : [],
    });
  };

  const flush = useCallback((): Promise<void> => {
    window.clearTimeout(timer.current);
    if (!pending.current) return chain.current;
    pending.current = false;
    const snap = latest.current;
    chain.current = chain.current.then(() => save(snap)).then(
      () => { if (!pending.current) setStatus('saved'); },
      (e: unknown) => { setStatus('error'); toast.error(e instanceof Error ? e.message : 'Could not save the invoice'); },
    );
    return chain.current;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const change = (patch: Partial<InvoiceDraft>) => {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    setDraft(next);
    pending.current = true;
    setStatus('saving');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 900);
  };

  useEffect(() => () => { flush(); }, [flush]);

  return { draft, change, status, flush, retry: () => { pending.current = true; flush(); } };
}
