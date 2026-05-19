import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { SeasonalOrderItem } from './useSeasonalOrders';

export type { SeasonalOrderItem };

export interface SeasonalPreorder {
  id: string;
  occasion_id?: string;
  customer_name: string;
  phone: string;
  items: SeasonalOrderItem[];
  subtotal: number;
  discount_amount: number;
  discount_type: 'amount' | 'percentage';
  total_amount: number;
  advance_paid: number;
  payment_mode: 'cash' | 'upi' | null;
  delivery_date?: string;
  status: 'pending' | 'confirmed' | 'delivered' | 'cancelled';
  year: number;
  notes?: string;
  created_at: string;
}

type SeasonalPreorderPayload = Omit<SeasonalPreorder, 'id' | 'created_at'>;

export const useSeasonalPreorders = (year?: number) =>
  useQuery({
    queryKey: ['seasonal_preorders', year],
    queryFn: async () => {
      let q = supabase.from('seasonal_preorders').select('*').order('created_at', { ascending: false });
      if (year) q = q.eq('year', year);
      const { data, error } = await q;
      if (error) throw error;
      return data as SeasonalPreorder[];
    },
  });

export const useCreateSeasonalPreorder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (order: SeasonalPreorderPayload) => {
      const { data, error } = await supabase
        .from('seasonal_preorders')
        .insert(order)
        .select()
        .single();
      if (error) throw error;
      return data;
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
