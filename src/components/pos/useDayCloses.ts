import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { DayClose, DayClosePayload } from '../../lib/dayClose';

const KEY = ['seasonal_day_closes'];

// Recent day closes, newest first (reopened ones included).
export const useDayCloses = (enabled: boolean) =>
  useQuery({
    queryKey: KEY,
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from('seasonal_day_closes').select('*').order('closed_at', { ascending: false }).limit(60);
      if (error) throw error;
      return (data ?? []) as DayClose[];
    },
  });

export const useCloseDay = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: DayClosePayload) => {
      const { data, error } = await supabase.from('seasonal_day_closes').insert(row).select().single();
      if (error) throw error;
      return data as DayClose;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};

// Reopening keeps the row for the record; the next close writes a new one.
export const useReopenDay = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('seasonal_day_closes').update({ reopened_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
};
