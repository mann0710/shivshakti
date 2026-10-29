import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export type SchemaStatus = 'ready' | 'legacy';

export const PACK_MIGRATION_FILE = 'supabase/migrations/20261030_sessional_pack_sizes.sql';

const missingColumn = (e: { code?: string; message?: string }) =>
  e.code === '42703' || e.code === 'PGRST204' || /column .* does not exist|could not find/i.test(e.message ?? '');

// Detects whether the pack-sizes migration has been run, so the app can keep working before it is.
export const usePackSchema = () =>
  useQuery({
    queryKey: ['schema_status', 'packs'],
    staleTime: Infinity,
    queryFn: async (): Promise<SchemaStatus> => {
      const checks = await Promise.all([
        supabase.from('seasonal_items').select('rate, unit, pack_sizes, pack_prices, category').limit(1),
        supabase.from('data_center').select('pack_sizes').limit(1),
        supabase.from('seasonal_orders').select('bill_no').limit(1),
      ]);
      for (const { error } of checks) {
        if (!error) continue;
        if (missingColumn(error)) return 'legacy';
        throw error;
      }
      return 'ready';
    },
  });

export const useIsLegacySchema = () => usePackSchema().data === 'legacy';
