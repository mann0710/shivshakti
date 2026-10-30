import { useMemo } from 'react';
import { useInvoices } from './useInvoices';
import { useQuotations } from './useQuotations';
import { pickQuotation } from '../lib/quoteMath';
import { Booking } from '../types';

// What a booking is worth: its invoice total, else its chosen quotation, else the package estimate.
export const useBookingValue = () => {
  const { data: invoices = [] } = useInvoices();
  const { data: quotations = [] } = useQuotations();
  return useMemo(() => {
    const billed = new Map<string, number>();
    invoices.forEach(i => billed.set(i.booking_id, (billed.get(i.booking_id) ?? 0) + (Number(i.total_amount) || 0)));
    return (b: Pick<Booking, 'id' | 'estimated_cost'>) =>
      billed.get(b.id) ?? pickQuotation(quotations, b.id)?.total_amount ?? (Number(b.estimated_cost) || 0);
  }, [invoices, quotations]);
};
