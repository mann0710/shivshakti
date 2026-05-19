import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface SeasonalOccasion {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export const useSeasonalOccasions = (activeOnly = false) =>
  useQuery({
    queryKey: ['seasonal_occasions', activeOnly],
    queryFn: async () => {
      let q = supabase.from('seasonal_occasions').select('*').order('name');
      if (activeOnly) q = q.eq('is_active', true);
      const { data, error } = await q;
      if (error) throw error;
      return data as SeasonalOccasion[];
    },
  });

export const useCreateSeasonalOccasion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('seasonal_occasions')
        .insert({ name, is_active: true })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seasonal_occasions'] }),
  });
};

export const useUpdateSeasonalOccasion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: { id: string; name?: string; is_active?: boolean }) => {
      const { id, ...rest } = updates;
      const { data, error } = await supabase
        .from('seasonal_occasions')
        .update(rest)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seasonal_occasions'] }),
  });
};

export const useDeleteSeasonalOccasion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('seasonal_occasions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seasonal_occasions'] }),
  });
};
