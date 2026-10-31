import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { fetchAll } from '../lib/fetchAll';
import { SaveItem, saveGroups } from '../lib/menuSheet';

export interface MenuCategory {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface MenuSubcategory {
  id: string;
  category_id: string;
  category?: MenuCategory;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface MenuItem {
  id: string;
  subcategory_id: string;
  subcategory?: MenuSubcategory & { category?: MenuCategory };
  name: string;
  default_price?: number | null;
  // Food styles the dish suits (see lib/foodStyles).
  food_styles?: string[] | null;
  is_active: boolean;
  created_at: string;
}

// ─── Categories ──────────────────────────────────────────────────────────────
export const useMenuCategories = () =>
  useQuery({
    queryKey: ['menu_categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_categories').select('*').order('name');
      if (error) throw error;
      return data as MenuCategory[];
    },
  });

export const useCreateCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from('menu_categories').insert({ name, is_active: true }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu_categories'] }),
  });
};

export const useUpdateCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MenuCategory> & { id: string }) => {
      const { data, error } = await supabase
        .from('menu_categories').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu_categories'] });
      qc.invalidateQueries({ queryKey: ['menu_subcategories'] });
      qc.invalidateQueries({ queryKey: ['menu_items_full'] });
    },
  });
};

export const useDeleteCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('menu_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu_categories'] });
      qc.invalidateQueries({ queryKey: ['menu_subcategories'] });
      qc.invalidateQueries({ queryKey: ['menu_items_full'] });
    },
  });
};

// ─── Subcategories ────────────────────────────────────────────────────────────
export const useMenuSubcategories = () =>
  useQuery({
    queryKey: ['menu_subcategories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_subcategories')
        .select('*, category:menu_categories(*)')
        .order('name');
      if (error) throw error;
      return data as (MenuSubcategory & { category: MenuCategory })[];
    },
  });

export const useCreateSubcategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, category_id }: { name: string; category_id: string }) => {
      const { data, error } = await supabase
        .from('menu_subcategories').insert({ name, category_id, is_active: true }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu_subcategories'] }),
  });
};

export const useUpdateSubcategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MenuSubcategory> & { id: string }) => {
      const { data, error } = await supabase
        .from('menu_subcategories').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu_subcategories'] });
      qc.invalidateQueries({ queryKey: ['menu_items_full'] });
    },
  });
};

export const useDeleteSubcategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('menu_subcategories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu_subcategories'] });
      qc.invalidateQueries({ queryKey: ['menu_items_full'] });
    },
  });
};

// ─── Items ────────────────────────────────────────────────────────────────────
export const useMenuItemsFull = () =>
  useQuery({
    queryKey: ['menu_items_full'],
    queryFn: async () => {
      type Row = MenuItem & { subcategory: MenuSubcategory & { category: MenuCategory } };
      return fetchAll<Row>((from, to) => supabase
        .from('menu_items')
        .select('*, subcategory:menu_subcategories(*, category:menu_categories(*))')
        .order('name')
        .range(from, to));
    },
  });

export const useCreateMenuItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ default_price, ...item }: { name: string; subcategory_id: string; default_price?: number | null }) => {
      // Price is only sent when set, so adding items still works before the price migration.
      const row = default_price ? { ...item, default_price } : item;
      const { data, error } = await supabase
        .from('menu_items').insert({ ...row, is_active: true }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu_items_full'] }),
  });
};

export const useUpdateMenuItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MenuItem> & { id: string }) => {
      const { data, error } = await supabase
        .from('menu_items').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu_items_full'] }),
  });
};

// Sheet save: identical patches go together, a few requests at a time; a failure carries the ids already saved.
export const useBulkUpdateMenuItems = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ items, onProgress }: { items: SaveItem[]; onProgress?: (done: number) => void }) => {
      const groups = saveGroups(items);
      const saved: string[] = [];
      for (let i = 0; i < groups.length; i += 6) {
        const results = await Promise.all(groups.slice(i, i + 6).map(async g => {
          const { error } = await supabase.from('menu_items').update(g.patch).in('id', g.ids);
          if (!error) saved.push(...g.ids);
          return error;
        }));
        onProgress?.(saved.length);
        const failed = results.find(Boolean);
        if (failed) throw Object.assign(new Error(failed.message || 'Could not save'), { saved });
      }
      return saved;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['menu_items_full'] }),
  });
};

export const useDeleteMenuItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('menu_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu_items_full'] }),
  });
};
