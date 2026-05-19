import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface SeasonalOrderItem {
  item_id: string;
  item_name: string;
  weight: number;
  weight_unit: 'gm' | 'ltr';
  price: number;
  qty: number;
  line_total: number;
}

export interface SeasonalOrder {
  id: string;
  occasion_id?: string;
  customer_name: string;
  phone: string;
  items: SeasonalOrderItem[];
  subtotal: number;
  discount_amount: number;
  discount_type: 'amount' | 'percentage';
  total_amount: number;
  is_paid: boolean;
  payment_mode: 'cash' | 'upi' | null;
  year: number;
  notes?: string;
  created_at: string;
}

type SeasonalOrderPayload = Omit<SeasonalOrder, 'id' | 'created_at'>;

export const useSeasonalOrders = (year?: number) =>
  useQuery({
    queryKey: ['seasonal_orders', year],
    queryFn: async () => {
      let q = supabase.from('seasonal_orders').select('*').order('created_at', { ascending: false });
      if (year) q = q.eq('year', year);
      const { data, error } = await q;
      if (error) throw error;
      return data as SeasonalOrder[];
    },
  });

export const useCreateSeasonalOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (order: SeasonalOrderPayload) => {
      const { data, error } = await supabase
        .from('seasonal_orders')
        .insert(order)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['seasonal_orders'] });
      qc.invalidateQueries({ queryKey: ['seasonal_orders', vars.year] });
    },
  });
};

export const useUpdateSeasonalOrderPaid = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_paid, payment_mode }: { id: string; is_paid: boolean; payment_mode: 'cash' | 'upi' | null }) => {
      const { error } = await supabase
        .from('seasonal_orders')
        .update({ is_paid, payment_mode })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seasonal_orders'] }),
  });
};

export const useDeleteSeasonalOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('seasonal_orders').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seasonal_orders'] }),
  });
};
