import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { fetchAll } from '../../lib/fetchAll';
import { Payment } from '../../types';
import { useBookings } from '../../hooks/useBookings';
import { useInvoices } from '../../hooks/useInvoices';
import { useQuotations } from '../../hooks/useQuotations';
import { useSeasonalOrders } from '../../hooks/useSeasonalOrders';
import { useSeasonalPreorders } from '../../hooks/useSeasonalPreorders';
import { MoneyData } from '../../lib/moneyView';
import { Spend, SpendDraft } from '../../lib/spends';

export const SPENDS_MIGRATION_FILE = 'supabase/migrations/20261109_spends.sql';

// Every catering payment with its mode and date; refreshed with the other payment queries.
const useAllPaymentRows = () => useQuery({
  queryKey: ['all_payments', 'rows'],
  queryFn: () => fetchAll<Payment>((from, to) => supabase.from('payments').select('*').order('payment_date').range(from, to)),
});

// Catering and sweets data behind Home, Money and the CA download.
export function useMoneyData() {
  const bookings = useBookings();
  const invoices = useInvoices();
  const payments = useAllPaymentRows();
  const quotes = useQuotations();
  const orders = useSeasonalOrders();
  const preorders = useSeasonalPreorders();
  const parts = [bookings, invoices, payments, quotes, orders, preorders];
  const loading = parts.some(p => p.isLoading);
  const error = parts.find(p => p.error)?.error as Error | undefined;
  const data = useMemo<MoneyData>(() => ({
    bookings: bookings.data ?? [], invoices: invoices.data ?? [], payments: payments.data ?? [], quotes: quotes.data ?? [],
    orders: orders.data ?? [], preorders: preorders.data ?? [],
  }), [bookings.data, invoices.data, payments.data, quotes.data, orders.data, preorders.data]);
  return { data, quotes: quotes.data ?? [], loading, error, retry: () => parts.forEach(p => p.refetch()) };
}

const missingTable = (e: { code?: string; message?: string }) => e.code === '42P01' || e.code === 'PGRST205' || /does not exist|could not find the table/i.test(e.message ?? '');

// null until the spends migration has been run.
export const useSpends = () => useQuery({
  queryKey: ['spends'],
  queryFn: async (): Promise<Spend[] | null> => {
    const { data, error } = await supabase.from('spends').select('*').order('spent_on', { ascending: false });
    if (error) { if (missingTable(error)) return null; throw error; }
    return (data ?? []).map(s => ({ ...s, amount: Number(s.amount) })) as Spend[];
  },
});

export const useAddSpends = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: SpendDraft[]) => {
      const { error } = await supabase.from('spends').insert(rows);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['spends'] }),
  });
};

export const useDeleteSpend = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('spends').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['spends'] }),
  });
};
