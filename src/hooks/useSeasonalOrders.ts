import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { fetchAll } from '../lib/fetchAll';
import { LineUnit } from '../lib/units';
import type { Payment, PayMode } from '../lib/payments';

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
  payment_mode: PayMode | 'mixed' | null;
  year: number;
  notes?: string;
  created_at: string;
  // After the POS payments migration.
  payments?: Payment[];
  paid_amount?: number;
  paid_at?: string | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
}

export type SeasonalOrderPayload = Omit<SeasonalOrder, 'id' | 'created_at' | 'bill_no'>;

export const POS_MIGRATION_FILE = 'supabase/migrations/20261107_pos_payments_dayclose.sql';
export const POS_ORDER_FIELDS = ['payments', 'paid_amount', 'paid_at', 'cancelled_at', 'cancel_reason'] as const;

// Payment history, cancelled bills and the day close table are in place.
export const useHasPosPayments = () => useQuery({
  queryKey: ['schema_status', 'pos_payments'],
  staleTime: Infinity,
  queryFn: async () => {
    const [orders, preorders, closes] = await Promise.all([
      supabase.from('seasonal_orders').select(POS_ORDER_FIELDS.join(',')).limit(1),
      supabase.from('seasonal_preorders').select('payments').limit(1),
      supabase.from('seasonal_day_closes').select('id').limit(1),
    ]);
    return !orders.error && !preorders.error && !closes.error;
  },
}).data === true;

// Leaves out the given fields until their migration has been run.
export const omitFields = <T extends object>(row: T, fields: readonly string[]): T => {
  const out: any = { ...row };
  fields.forEach(f => delete out[f]);
  return out;
};

const useFitOrder = () => {
  const ready = useHasPosPayments();
  return <T extends object>(row: T): T => (ready ? row : omitFields(row, POS_ORDER_FIELDS));
};

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
  const fit = useFitOrder();
  return useMutation({
    mutationFn: async (order: SeasonalOrderPayload) => {
      const { data, error } = await supabase
        .from('seasonal_orders')
        .insert(fit(order))
        .select()
        .single();
      if (error) throw error;
      return data as SeasonalOrder;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seasonal_orders'] }),
  });
};

export const useUpdateSeasonalOrder = () => {
  const qc = useQueryClient();
  const fit = useFitOrder();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SeasonalOrderPayload> & { id: string }) => {
      const { error } = await supabase
        .from('seasonal_orders')
        .update(fit(updates))
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seasonal_orders'] }),
  });
};

// Only for test bills; real bills are cancelled and keep their number.
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
