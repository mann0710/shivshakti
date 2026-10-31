import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface SeasonalOccasion {
  id: string;
  name: string;
  is_active: boolean;
  start_date?: string | null;
  end_date?: string | null;
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
        .insert({ name, is_active: false })
        .select()
        .single();
      if (error) throw error;
      return data as SeasonalOccasion;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seasonal_occasions'] }),
  });
};

export const useUpdateSeasonalOccasion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: { id: string; name?: string; is_active?: boolean; start_date?: string | null; end_date?: string | null }) => {
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

// Starts or ends seasons; each occasion's sweets go on or come off the counter with it.
export const useSetSeason = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ on = [], off = [] }: { on?: string[]; off?: string[] }) => {
      const steps: [string[], boolean][] = [[off, false], [on, true]];
      for (const [ids, is_active] of steps) {
        if (!ids.length) continue;
        const occ = await supabase.from('seasonal_occasions').update({ is_active }).in('id', ids);
        if (occ.error) throw occ.error;
        const items = await supabase.from('seasonal_items').update({ is_active }).in('occasion_id', ids);
        if (items.error) throw items.error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seasonal_occasions'] });
      qc.invalidateQueries({ queryKey: ['seasonal_items'] });
    },
  });
};
