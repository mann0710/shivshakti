import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface SeasonalItem {
  id: string;
  name: string;
  weight: number;
  weight_unit: 'gm' | 'ltr';
  price: number;
  is_active: boolean;
  occasion_id?: string;
  created_at: string;
}

type SeasonalItemPayload = Omit<SeasonalItem, 'id' | 'created_at'>;

export const useSeasonalItems = () =>
  useQuery({
    queryKey: ['seasonal_items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seasonal_items')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return data as SeasonalItem[];
    },
  });

export const useCreateSeasonalItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: SeasonalItemPayload) => {
      const { data, error } = await supabase
        .from('seasonal_items')
        .insert(item)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seasonal_items'] }),
  });
};

export const useUpdateSeasonalItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: SeasonalItemPayload & { id: string }) => {
      const { data, error } = await supabase
        .from('seasonal_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seasonal_items'] }),
  });
};

export const useDeleteSeasonalItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('seasonal_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seasonal_items'] }),
  });
};
