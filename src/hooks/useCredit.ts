import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { fetchAll } from '../lib/fetchAll';
import { useSeasonalOrders, useUpdateSeasonalOrder } from './useSeasonalOrders';
import { useSeasonalPreorders, useUpdateSeasonalPreorder } from './useSeasonalPreorders';
import { useDocSettings } from './useDocSettings';
import { billLedger, preorderLedger } from '../lib/payments';
import { creditItems } from '../lib/credit/items';
import { accountsOf } from '../lib/credit/accounts';
import { Patch } from '../lib/credit/allocate';
import { CreditAccount, CreditEntry, CreditEntryPayload } from '../lib/credit/types';
import { todayIST } from '../lib/ist';

export const CREDIT_MIGRATION_FILE = 'supabase/migrations/20261112_credit_accounts.sql';

const missing = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || e.code === '42703' || /does not exist|could not find/i.test(e.message ?? ''));

// Credit tables and the bill pay-by column are in place.
export const useHasCredit = () => useQuery({
  queryKey: ['schema_status', 'credit'],
  staleTime: Infinity,
  queryFn: async () => {
    const [a, e, o] = await Promise.all([
      supabase.from('credit_accounts').select('phone').limit(1),
      supabase.from('credit_entries').select('id').limit(1),
      supabase.from('seasonal_orders').select('due_date').limit(1),
    ]);
    const err = a.error || e.error || o.error;
    if (err && !missing(err)) throw err;
    return !err;
  },
}).data === true;

// A table that is not there yet reads as empty.
const readAll = <T,>(table: string, order: string) => async (): Promise<T[]> => {
  try { return await fetchAll<T>((from, to) => supabase.from(table).select('*').order(order, { ascending: false }).range(from, to)); }
  catch (e: any) { if (missing(e)) return []; throw e; }
};

export const useCreditEntries = () => useQuery({ queryKey: ['credit_entries'], queryFn: readAll<CreditEntry>('credit_entries', 'at') });
export const useCreditAccounts = () => useQuery({ queryKey: ['credit_accounts'], queryFn: readAll<CreditAccount>('credit_accounts', 'updated_at') });

// Every customer's credit account, built from all bills, bookings and credit rows.
export function useCreditData() {
  const orders = useSeasonalOrders();
  const preorders = useSeasonalPreorders();
  const entries = useCreditEntries();
  const accs = useCreditAccounts();
  const settings = useDocSettings().credit;
  const today = todayIST();
  const items = useMemo(() => creditItems(orders.data ?? [], preorders.data ?? [], entries.data ?? [], settings.pay_days),
    [orders.data, preorders.data, entries.data, settings.pay_days]);
  const accounts = useMemo(() => accountsOf(items, entries.data ?? [], accs.data ?? [], settings, today),
    [items, entries.data, accs.data, settings, today]);
  return {
    accounts, items, settings, today, entries: entries.data ?? [],
    loading: orders.isLoading || preorders.isLoading || entries.isLoading || accs.isLoading,
    error: orders.error || preorders.error || entries.error || accs.error,
  };
}

const invalidate = (qc: ReturnType<typeof useQueryClient>) => qc.invalidateQueries({ queryKey: ['credit_entries'] });

export const useAddCreditEntry = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Partial<CreditEntryPayload> & Pick<CreditEntryPayload, 'phone' | 'name' | 'kind'> & { id?: string }) => {
      const { data, error } = await supabase.from('credit_entries').insert(row).select().single();
      if (error) throw error;
      return data as CreditEntry;
    },
    onSuccess: () => invalidate(qc),
  });
};

export const useUpdateCreditEntry = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<CreditEntry> & { id: string }) => {
      const { error } = await supabase.from('credit_entries').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(qc),
  });
};

export const useSaveCreditAccount = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (acc: CreditAccount) => {
      const { error } = await supabase.from('credit_accounts').upsert({ ...acc, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['credit_accounts'] }),
  });
};

// Writes each changed payments list back to its bill, booking or old balance.
export function useApplyPatches() {
  const bill = useUpdateSeasonalOrder();
  const booking = useUpdateSeasonalPreorder();
  const entry = useUpdateCreditEntry();
  return async (patches: Patch[]) => {
    for (const { item, payments } of patches) {
      if (item.type === 'bill') await bill.mutateAsync({ id: item.id, ...billLedger(item.total, payments, item.cancelled) });
      else if (item.type === 'preorder') await booking.mutateAsync({ id: item.id, ...preorderLedger(payments) });
      else await entry.mutateAsync({ id: item.id, payments });
    }
  };
}
