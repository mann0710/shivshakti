import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { todayIST } from '../lib/ist';

export interface QuotationLineItem {
  item_id: string;
  item_name: string;
  category_name: string;
  subcategory_name: string;
  amount: number;
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
  notes?: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  issue_date: string;
  created_at: string;
}

type QuotationPayload = {
  customer_id: string;
  booking_id?: string;
  items: QuotationLineItem[];
  per_plate_amount: number;
  guest_count: number;
  subtotal: number;
  discount_amount: number;
  discount_type: 'amount' | 'percentage';
  gst_rate: number;
  gst_amount: number;
  total_amount: number;
  notes?: string;
  status: string;
};

export const useQuotations = () =>
  useQuery({
    queryKey: ['quotations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quotations')
        .select('*, customer:customers(*), booking:bookings(*)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Quotation[];
    },
  });

export const useCreateQuotation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (q: QuotationPayload) => {
      const { data: latest } = await supabase
        .from('quotations').select('quotation_number').order('quotation_number', { ascending: false }).limit(1).maybeSingle();
      const nextNum = latest?.quotation_number
        ? (parseInt(latest.quotation_number.replace('QTN-', ''), 10) || 0) + 1 : 1;
      const quotation_number = `QTN-${String(nextNum).padStart(4, '0')}`;
      const { data, error } = await supabase
        .from('quotations')
        .insert({ ...q, quotation_number, issue_date: todayIST() })
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
  return useMutation({
    mutationFn: async (q: QuotationPayload & { id: string }) => {
      const { id, ...updates } = q;
      const { data, error } = await supabase
        .from('quotations')
        .update(updates)
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
