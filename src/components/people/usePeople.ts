import { useMemo } from 'react';
import { useCustomers } from '../../hooks/useCustomers';
import { useSeasonalCustomers } from '../../hooks/useSeasonalCustomers';
import { useBookings } from '../../hooks/useBookings';
import { useInvoices } from '../../hooks/useInvoices';
import { useBookingValue } from '../../hooks/useBookingValue';
import { useSeasonalOrders } from '../../hooks/useSeasonalOrders';
import { useSeasonalPreorders } from '../../hooks/useSeasonalPreorders';
import { Person, isSavedTwice, mergePeople } from '../../lib/people';
import { InvoiceLite, Summary, recordsByPerson, summarize } from '../../lib/personHistory';
import { todayIST } from '../../lib/ist';

export type PersonRow = Person & { s: Summary; twice: boolean };

// Catering and sweets customers as one list, each with their history and dues.
export function usePeople() {
  const customers = useCustomers();
  const sweets = useSeasonalCustomers();
  const { data: bookings = [] } = useBookings();
  const { data: invoices = [] } = useInvoices();
  const { data: bills = [] } = useSeasonalOrders();
  const { data: preorders = [] } = useSeasonalPreorders();
  const valueOf = useBookingValue();

  const rows = useMemo<PersonRow[]>(() => {
    const people = mergePeople(customers.data ?? [], sweets.data ?? []);
    const records = recordsByPerson(people, bookings, bills, preorders);
    const byBooking = new Map<string, InvoiceLite>();
    invoices.forEach(i => {
      const cur = byBooking.get(i.booking_id);
      const due = (Number(cur?.balance_due) || 0) + (Number(i.balance_due) || 0);
      byBooking.set(i.booking_id, { booking_id: i.booking_id, balance_due: due, invoice_number: cur ? `${cur.invoice_number}, ${i.invoice_number}` : i.invoice_number });
    });
    const ctx = { invoices: byBooking, worth: valueOf, today: todayIST() };
    return people.map(p => ({ ...p, s: summarize(p, records.get(p.key), ctx), twice: isSavedTwice(p) }));
  }, [customers.data, sweets.data, bookings, invoices, bills, preorders, valueOf]);

  return { rows, isLoading: customers.isLoading || sweets.isLoading };
}
