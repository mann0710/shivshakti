import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { fetchAll } from '../lib/fetchAll';
import { todayIST } from '../lib/ist';
import { Range, addDays } from '../lib/reports/model';
import { ReportInput } from '../lib/reports/input';
import { SeasonalOrder, useHasPosPayments } from './useSeasonalOrders';
import { useSeasonalPreorders } from './useSeasonalPreorders';
import { useSeasonalItems } from './useSeasonalItems';
import { useSeasonalOccasions } from './useSeasonalOccasions';
import { useBookings } from './useBookings';
import { useInvoices } from './useInvoices';
import { useBookingValue } from './useBookingValue';
import { Payment } from '../types';

// IST day boundaries as UTC timestamps.
const istStart = (day: string) => new Date(`${day}T00:00:00+05:30`).toISOString();

// Bills made in the range, plus (once the POS payments migration has run) older bills paid in it.
const useOrdersInRange = (r: Range) => {
  const ledger = useHasPosPayments();
  return useQuery({
    queryKey: ['seasonal_orders', 'range', r.from, r.to, ledger],
    queryFn: () => fetchAll<SeasonalOrder>((from, to) => {
      const [start, end] = [istStart(r.from), istStart(addDays(r.to, 1))];
      const q = supabase.from('seasonal_orders').select('*');
      return (ledger
        ? q.or(`and(created_at.gte.${start},created_at.lt.${end}),paid_at.gte.${start}`)
        : q.gte('created_at', start).lt('created_at', end)
      ).order('created_at').range(from, to);
    }),
  });
};

// Bills with money due; cancelled bills are marked settled (is_paid) so they drop out.
const useUnpaidOrders = () => useQuery({
  queryKey: ['seasonal_orders', 'unpaid'],
  queryFn: () => fetchAll<SeasonalOrder>((from, to) => supabase.from('seasonal_orders').select('*').eq('is_paid', false).order('created_at').range(from, to)),
});

const usePaymentsInRange = (r: Range) => useQuery({
  queryKey: ['payments', 'range', r.from, r.to],
  queryFn: () => fetchAll<Payment>((from, to) => supabase.from('payments').select('*')
    .gte('payment_date', r.from).lte('payment_date', r.to).order('payment_date').range(from, to)),
});

// Everything the Reports tab needs for one date range.
export const useReportData = (range: Range, occasionId: string) => {
  const orders = useOrdersInRange(range);
  const unpaid = useUnpaidOrders();
  const preorders = useSeasonalPreorders();
  const items = useSeasonalItems();
  const occasions = useSeasonalOccasions(false);
  const bookings = useBookings();
  const invoices = useInvoices();
  const payments = usePaymentsInRange(range);
  const bookingValue = useBookingValue();

  const parts = [orders, unpaid, preorders, items, occasions, bookings, invoices, payments];
  const loading = parts.some(p => p.isLoading);
  const error = parts.find(p => p.error)?.error as Error | undefined;

  const input = useMemo<ReportInput>(() => ({
    range, today: todayIST(), occasionId,
    orders: orders.data ?? [], unpaidOrders: unpaid.data ?? [], preorders: preorders.data ?? [],
    items: items.data ?? [], occasions: occasions.data ?? [], bookings: bookings.data ?? [],
    invoices: invoices.data ?? [], payments: payments.data ?? [], bookingValue,
  }), [range, occasionId, orders.data, unpaid.data, preorders.data, items.data, occasions.data, bookings.data, invoices.data, payments.data, bookingValue]);

  return { input, loading, error };
};
