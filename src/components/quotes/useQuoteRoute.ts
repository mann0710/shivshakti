import { useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import type { Quotation } from '../../hooks/useQuotations';
import type { Booking } from '../../types';
import type { useQuoteForm } from '../../hooks/useQuoteForm';
import { currentRoute, useRecordRoute } from '../../hooks/useRoute';

type Form = ReturnType<typeof useQuoteForm>;

// Keeps the editor and /quotations/<id> in step: a pasted link, refresh, Back or Forward opens or closes the editor.
export function useQuoteRoute(f: Form, openEdit: (q: Quotation) => void, openCreate: (b: Booking) => void) {
  const route = useRecordRoute('quotations');
  const handled = useRef<string | undefined>(undefined);
  const wasOpen = useRef(false);

  // Address → editor. The id may be a quote or a booking (its quote, else a new one).
  useEffect(() => {
    if (route.id === handled.current) return;
    if (!route.id) { handled.current = undefined; if (f.showForm) f.resetForm(); return; }
    if (route.id === f.editingId) { handled.current = route.id; return; }
    if (!f.quotationsFetched) return;
    const q = f.quotations.find(x => x.id === route.id) ?? f.quotations.find(x => x.booking_id === route.id);
    const b = q ? undefined : f.bookings.find(x => x.id === route.id);
    if (!q && !b && !f.bookingsFetched) return;
    handled.current = route.id;
    if (q) openEdit(q);
    else if (b) openCreate(b);
    else { toast.error('That quotation was not found. It may have been deleted.'); route.open(undefined, true); }
  }, [route.id, f.quotationsFetched, f.bookingsFetched]); // eslint-disable-line react-hooks/exhaustive-deps

  // Editor → address: opening from the list or a new quote's first save adds a history entry; an option switch or a delete replaces it.
  useEffect(() => {
    const at = currentRoute().page === 'quotations' ? currentRoute().id : undefined;
    if (f.showForm && f.editingId && f.editingId !== at) { handled.current = f.editingId; route.open(f.editingId, !!at); }
    else if (!f.showForm && wasOpen.current && at) { handled.current = undefined; route.open(undefined, true); }
    wasOpen.current = f.showForm;
  }, [f.showForm, f.editingId]); // eslint-disable-line react-hooks/exhaustive-deps

  return route;
}
