import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { fetchAll } from '../lib/fetchAll';
import { SeasonalOrderItem, useHasPosPayments, omitFields } from './useSeasonalOrders';
import { useHasPreorderColumns } from './useSchemaStatus';
import type { Payment } from '../lib/payments';

export type { SeasonalOrderItem };

export interface SeasonalPreorder {
  id: string;
  occasion_id?: string;
  customer_name: string;
  phone: string;
  address?: string;
  items: SeasonalOrderItem[];
  subtotal: number;
  discount_amount: number;
  discount_type: 'amount' | 'percentage';
  total_amount: number;
  advance_paid: number;
  payment_mode: 'cash' | 'upi' | null;
  delivery_date?: string;
  status: 'pending' | 'confirmed' | 'ready' | 'delivered' | 'cancelled';
  year: number;
  notes?: string;
  created_at: string;
  // After the fulfillment migration.
  fulfillment?: 'pickup' | 'delivery';
  delivered_at?: string | null;
  balance_paid?: number;
  balance_mode?: 'cash' | 'upi' | null;
  // After the POS payments migration.
  payments?: Payment[];
}

const NEW_FIELDS = ['fulfillment', 'delivered_at', 'balance_paid', 'balance_mode'] as const;

// Drops the newer fields until their migrations have been run.
const useFitRow = () => {
  const ready = useHasPreorderColumns();
  const ledger = useHasPosPayments();
  return <T extends object>(row: T): T => omitFields(row, [...(ready ? [] : NEW_FIELDS), ...(ledger ? [] : ['payments'])]);
};

export type SeasonalPreorderPayload = Omit<SeasonalPreorder, 'id' | 'created_at'>;

export const useSeasonalPreorders = (year?: number) =>
  useQuery({
    queryKey: ['seasonal_preorders', year],
    queryFn: async () => {
      return fetchAll<SeasonalPreorder>((from, to) => {
        let q = supabase.from('seasonal_preorders').select('*').order('created_at', { ascending: false });
        if (year) q = q.eq('year', year);
        return q.range(from, to);
      });
    },
  });

export const useCreateSeasonalPreorder = () => {
  const qc = useQueryClient();
  const fit = useFitRow();
  return useMutation({
    mutationFn: async (order: SeasonalPreorderPayload) => {
      const { data, error } = await supabase
        .from('seasonal_preorders')
        .insert(fit(order))
        .select()
        .single();
      if (error) throw error;
      return data as SeasonalPreorder;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seasonal_preorders'] }),
  });
};

export const useUpdateSeasonalPreorderStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: SeasonalPreorder['status'] }) => {
      const { error } = await supabase
        .from('seasonal_preorders')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seasonal_preorders'] }),
  });
};

export const useUpdateSeasonalPreorder = () => {
  const qc = useQueryClient();
  const fit = useFitRow();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SeasonalPreorderPayload> & { id: string }) => {
      const { error } = await supabase
        .from('seasonal_preorders')
        .update(fit(updates))
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seasonal_preorders'] }),
  });
};

export const useDeleteSeasonalPreorder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('seasonal_preorders').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seasonal_preorders'] }),
  });
};
