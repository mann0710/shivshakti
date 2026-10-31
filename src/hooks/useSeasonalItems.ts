import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { fetchAll } from '../lib/fetchAll';
import {
  SeasonalItem, SeasonalItemRow, ItemInput, normalizeItem, toRow, adjustRate, legacySize,
} from '../lib/itemCatalog';
import { MergeGroup, remapIds, remapLines } from '../lib/mergePlan';
import { DEFAULT_PACKS, PackDefaults, cleanSizes, UNITS, roundMoney } from '../lib/units';
import { useDataCenter, useUpsertDataCenter } from './useDataCenter';
import { usePackSchema } from './useSchemaStatus';

export type { SeasonalItem, ItemInput };

const KEY = ['seasonal_items'];

export const useSeasonalItems = () =>
  useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const rows = await fetchAll<SeasonalItemRow>((from, to) => supabase
        .from('seasonal_items').select('*').order('name', { ascending: true }).range(from, to));
      return rows.map(normalizeItem);
    },
  });

const useInvalidateItems = () => {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: KEY });
};

export const useSaveSeasonalItem = () => {
  const legacy = usePackSchema().data === 'legacy';
  const onSuccess = useInvalidateItems();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: ItemInput }) => {
      const row = toRow(input, legacy);
      const q = id
        ? supabase.from('seasonal_items').update(row).eq('id', id)
        : supabase.from('seasonal_items').insert(row);
      const { data, error } = await q.select().single();
      if (error) throw error;
      return normalizeItem(data as SeasonalItemRow);
    },
    onSuccess,
  });
};

export const useSetItemsActive = () => {
  const onSuccess = useInvalidateItems();
  return useMutation({
    mutationFn: async ({ ids, is_active }: { ids: string[]; is_active: boolean }) => {
      const { error } = await supabase.from('seasonal_items').update({ is_active }).in('id', ids);
      if (error) throw error;
    },
    onSuccess,
  });
};

export const useDeleteSeasonalItem = () => {
  const onSuccess = useInvalidateItems();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('seasonal_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess,
  });
};

export interface BulkPriceChange { mode: 'percent' | 'amount'; value: number; roundTo: number }

// Applies one price change to many items; manual pack prices move by the same rule.
export const useBulkUpdateRates = () => {
  const legacy = usePackSchema().data === 'legacy';
  const onSuccess = useInvalidateItems();
  return useMutation({
    mutationFn: async ({ items, change }: { items: SeasonalItem[]; change: BulkPriceChange }) => {
      const adjust = (n: number) => adjustRate(n, change.mode, change.value, change.roundTo);
      for (const item of items) {
        const packRow = legacySize(item);
        // Old one-row-per-pack items move their pack price; rate-based items move the rate.
        const price = packRow ? adjust(item.price) : adjust(item.rate);
        const rate = packRow ? roundMoney((price * UNITS[item.unit].factor) / packRow) : price;
        const row: Record<string, unknown> = { price };
        if (!legacy) {
          row.rate = rate;
          row.pack_prices = item.pack_prices
            ? Object.fromEntries(Object.entries(item.pack_prices).map(([k, v]) => [k, adjust(Number(v))]))
            : null;
        }
        const { error } = await supabase.from('seasonal_items').update(row).eq('id', item.id);
        if (error) throw error;
      }
      return items.length;
    },
    onSuccess,
  });
};

// Rewrites order lines that point at merged-away rows, then deletes those rows.
async function remapTable(table: 'seasonal_orders' | 'seasonal_preorders', map: Map<string, string>) {
  const { data, error } = await supabase.from(table).select('id, items');
  if (error) throw error;
  for (const r of (data ?? []) as { id: string; items: { item_id: string }[] }[]) {
    const next = remapLines(r.items ?? [], map);
    if (!next) continue;
    const { error: upErr } = await supabase.from(table).update({ items: next }).eq('id', r.id);
    if (upErr) throw upErr;
  }
}

export const useMergeDuplicateItems = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ plans, onProgress }: { plans: MergeGroup[]; onProgress?: (msg: string) => void }) => {
      for (let i = 0; i < plans.length; i++) {
        const p = plans[i];
        onProgress?.(`Updating ${p.update.name} (${i + 1}/${plans.length})`);
        const { error } = await supabase.from('seasonal_items').update(p.update).eq('id', p.keepId);
        if (error) throw error;
      }
      const map = remapIds(plans);
      if (map.size) {
        onProgress?.('Linking old bills to merged items');
        await remapTable('seasonal_orders', map);
        await remapTable('seasonal_preorders', map);
        onProgress?.('Removing duplicate rows');
        const { error } = await supabase.from('seasonal_items').delete().in('id', Array.from(map.keys()));
        if (error) throw error;
      }
      return plans.length;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['seasonal_orders'] });
      qc.invalidateQueries({ queryKey: ['seasonal_preorders'] });
    },
  });
};

// Shop-wide default pack sizes per unit, stored on the data_center row.
export const usePackDefaults = (): PackDefaults => {
  const { data } = useDataCenter();
  const saved = data?.pack_sizes;
  return useMemo(() => {
    const pick = (u: keyof PackDefaults) => (cleanSizes(saved?.[u]).length ? cleanSizes(saved?.[u]) : DEFAULT_PACKS[u]);
    return { kg: pick('kg'), ltr: pick('ltr'), pc: pick('pc') };
  }, [saved]);
};

export const useSavePackDefaults = () => {
  const upsert = useUpsertDataCenter();
  return useMutation({
    mutationFn: (pack_sizes: PackDefaults) => upsert.mutateAsync({ pack_sizes }),
  });
};

// Items on any bill or pre-booking: they keep their history, so they are hidden rather than deleted.
export const useSoldItemIds = () =>
  useQuery({
    queryKey: ['seasonal_sold_item_ids'],
    staleTime: 60_000,
    queryFn: async () => {
      const ids = new Set<string>();
      for (const table of ['seasonal_orders', 'seasonal_preorders'] as const) {
        const rows = await fetchAll<{ items: { item_id: string }[] | null }>((from, to) =>
          supabase.from(table).select('items').range(from, to));
        rows.forEach(r => (r.items ?? []).forEach(l => ids.add(l.item_id)));
      }
      return ids;
    },
  });
