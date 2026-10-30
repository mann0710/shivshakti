import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { fetchAll } from '../lib/fetchAll';
import { todayIST } from '../lib/ist';
import { useHasQuoteOptions } from './useSchemaStatus';

export interface QuotationLineItem {
  item_id: string;
  item_name: string;
  category_name: string;
  subcategory_name: string;
  amount: number;
  instruction?: string;
  served_with?: string;
  // Menu items picked in "Served with" (names kept in served_with for printing).
  served_ids?: string[];
  // "Choose any N" group this dish belongs to, and whether the customer picked it.
  choice?: ChoiceMeta;
  chosen?: boolean;
}

export interface ChoiceMeta { id: string; label: string; pick: number; included?: boolean }

export interface MealSlot {
  id: string;
  meal_type: string;
  ceremony_name?: string;
  time: string;
  guest_count: number;
  per_plate_amount: number;
  discount_amount: number;
  items: QuotationLineItem[];
  subtotal: number;
  per_plate_max?: number | null;
}

export interface EventDay {
  day_number: number;
  date: string;
  meals: MealSlot[];
  day_subtotal: number;
}

export interface Quotation {
  id: string;
  booking_id?: string;
  customer_id: string;
  customer?: any;
  booking?: any;
  quotation_number: string;
  items: QuotationLineItem[];
  per_plate_amount: number;
  guest_count: number;
  subtotal: number;
  discount_amount: number;
  discount_type: 'amount' | 'percentage';
  gst_rate: number;
  gst_amount: number;
  total_amount: number;
  extra_charges: { description: string; amount: number }[];
  transportation_charges: { description: string; amount: number }[];
  additional_discounts: { id: string; description: string; amount: number }[];
  notes?: string;
  food_type?: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  issue_date: string;
  is_multi_day?: boolean;
  event_days?: EventDay[];
  created_at: string;
  // After the quote-options migration.
  option_group?: string | null;
  option_label?: string | null;
  option_name?: string | null;
  per_plate_max?: number | null;
  total_max?: number | null;
}

type QuotationPayload = {
  customer_id: string;
  booking_id?: string | null;
  items: QuotationLineItem[];
  per_plate_amount: number;
  guest_count: number;
  subtotal: number;
  discount_amount: number;
  discount_type: 'amount' | 'percentage';
  gst_rate: number;
  gst_amount: number;
  total_amount: number;
  extra_charges: { description: string; amount: number }[];
  transportation_charges: { description: string; amount: number }[];
  additional_discounts: { id: string; description: string; amount: number }[];
  notes?: string;
  food_type?: string;
  status: string;
  is_multi_day?: boolean;
  event_days?: EventDay[];
  option_group?: string | null;
  option_label?: string | null;
  option_name?: string | null;
  per_plate_max?: number | null;
  total_max?: number | null;
};

export type { QuotationPayload };

const OPTION_FIELDS = ['option_group', 'option_label', 'option_name', 'per_plate_max', 'total_max'] as const;

// Drops option / range fields until the quote-options migration has been run.
const useFitQuote = () => {
  const ready = useHasQuoteOptions();
  return <T extends object>(row: T): T => {
    if (ready) return row;
    const out: any = { ...row };
    OPTION_FIELDS.forEach(f => delete out[f]);
    return out;
  };
};

export const useQuotations = () =>
  useQuery({
    queryKey: ['quotations'],
    queryFn: async () => {
      return fetchAll<Quotation>((from, to) => supabase
        .from('quotations').select('*, customer:customers(*), booking:bookings(*)')
        .order('created_at', { ascending: false }).range(from, to));
    },
  });

export const useCreateQuotation = () => {
  const qc = useQueryClient();
  const fit = useFitQuote();
  return useMutation({
    mutationFn: async (q: QuotationPayload) => {
      // quotation_number is assigned by a database trigger (migration 20261102_doc_numbers.sql)
      const { data, error } = await supabase
        .from('quotations')
        .insert(fit({ ...q, issue_date: todayIST() }))
        .select('*, customer:customers(*), booking:bookings(*)')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotations'] }),
  });
};

export const useUpdateQuotation = () => {
  const qc = useQueryClient();
  const fit = useFitQuote();
  return useMutation({
    mutationFn: async (q: Partial<QuotationPayload> & { id: string }) => {
      const { id, ...updates } = q;
      const { data, error } = await supabase
        .from('quotations')
        .update(fit(updates))
        .eq('id', id)
        .select('*, customer:customers(*), booking:bookings(*)')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotations'] }),
  });
};

export const useUpdateQuotationStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('quotations').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotations'] }),
  });
};

export const useDeleteQuotation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('quotations').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotations'] }),
  });
};
