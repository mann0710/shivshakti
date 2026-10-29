import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Menu } from '../types';

// Active packages by default; the Packages page can include inactive ones to reactivate them.
export const useMenus = (includeInactive = false) =>
  useQuery({
    queryKey: ['menus', includeInactive],
    queryFn: async () => {
      let q = supabase.from('menus').select('*').order('name', { ascending: true });
      if (!includeInactive) q = q.eq('is_active', true);
      const { data, error } = await q;
      if (error) throw error;
      return data as Menu[];
    },
  });

export const useCreateMenu = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (menu: Partial<Menu>) => {
      const { data, error } = await supabase
        .from('menus')
        .insert(menu)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menus'] }),
  });
};

export const useUpdateMenu = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Menu> & { id: string }) => {
      const { data, error } = await supabase
        .from('menus')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menus'] }),
  });
};