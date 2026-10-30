import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export type SchemaStatus = 'ready' | 'legacy';

export const PACK_MIGRATION_FILE = 'supabase/migrations/20261030_sessional_pack_sizes.sql';
export const PRICE_MIGRATION_FILE = 'supabase/migrations/20261101_prices_gstin.sql';

const missingColumn = (e: { code?: string; message?: string }) =>
  e.code === '42703' || e.code === 'PGRST204' || /column .* does not exist|could not find/i.test(e.message ?? '');

type Probe = PromiseLike<{ error: { code?: string; message?: string } | null }>;

// 'legacy' when any probed column is missing, so the app keeps working before a migration is run.
const useSchema = (key: string, probes: () => Probe[]) =>
  useQuery({
    queryKey: ['schema_status', key],
    staleTime: Infinity,
    queryFn: async (): Promise<SchemaStatus> => {
      for (const { error } of await Promise.all(probes())) {
        if (!error) continue;
        if (missingColumn(error)) return 'legacy';
        throw error;
      }
      return 'ready';
    },
  });

export const usePackSchema = () => useSchema('packs', () => [
  supabase.from('seasonal_items').select('rate, unit, pack_sizes, pack_prices, category').limit(1),
  supabase.from('data_center').select('pack_sizes').limit(1),
  supabase.from('seasonal_orders').select('bill_no').limit(1),
]);

export const useIsLegacySchema = () => usePackSchema().data === 'legacy';

// Menu item default price + customer GSTIN.
export const useHasPriceColumns = () => useSchema('prices', () => [
  supabase.from('menu_items').select('default_price').limit(1),
  supabase.from('customers').select('gstin').limit(1),
]).data === 'ready';
