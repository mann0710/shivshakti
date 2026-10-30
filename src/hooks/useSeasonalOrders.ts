import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { fetchAll } from '../lib/fetchAll';
import { LineUnit } from '../lib/units';

// One bill line: a pack (or loose weight) of an item, priced at the time of sale.
export interface SeasonalOrderItem {
  item_id: string;
  item_name: string;
  weight: number;
  weight_unit: LineUnit;
  price: number;
  qty: number;
  line_total: number;
}

export interface SeasonalOrder {
  id: string;
  bill_no?: number | null;
  occasion_id?: string;
  customer_name: string;
  phone: string;
  address?: string;
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

export type SeasonalOrderPayload = Omit<SeasonalOrder, 'id' | 'created_at' | 'bill_no'>;

export const useSeasonalOrders = (year?: number) =>
  useQuery({
    queryKey: ['seasonal_orders', year],
    queryFn: async () => {
      return fetchAll<SeasonalOrder>((from, to) => {
        let q = supabase.from('seasonal_orders').select('*').order('created_at', { ascending: false });
        if (year) q = q.eq('year', year);
        return q.range(from, to);
      });
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
      return data as SeasonalOrder;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seasonal_orders'] }),
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

export const useUpdateSeasonalOrder = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SeasonalOrderPayload> & { id: string }) => {
      const { error } = await supabase
        .from('seasonal_orders')
        .update(updates)
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
