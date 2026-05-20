import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface SeasonalCustomer {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
  created_at: string;
}

type SeasonalCustomerPayload = Omit<SeasonalCustomer, 'id' | 'created_at'>;

export const useSeasonalCustomers = () =>
  useQuery({
    queryKey: ['seasonal_customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seasonal_customers')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return data as SeasonalCustomer[];
    },
  });

export const useCreateSeasonalCustomer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (customer: SeasonalCustomerPayload) => {
      const { data, error } = await supabase
        .from('seasonal_customers')
        .insert(customer)
        .select()
        .single();
      if (error) throw error;
      return data as SeasonalCustomer;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seasonal_customers'] }),
  });
};

export const useUpdateSeasonalCustomer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: SeasonalCustomerPayload & { id: string }) => {
      const { data, error } = await supabase
        .from('seasonal_customers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as SeasonalCustomer;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seasonal_customers'] }),
  });
};

export const useDeleteSeasonalCustomer = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('seasonal_customers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seasonal_customers'] }),
  });
};
