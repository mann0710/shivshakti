import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { fetchAll } from '../lib/fetchAll';
import { BinEntry, IMPORT_DAYS, KEEP_DAYS, Ref, UndoStep, descendants, expired, parentRefs, restorePlan } from '../lib/recycleBin';

const KEY = ['deleted_items'];
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
// Long id lists go in batches so the request URL stays short.
const batches = <T,>(list: T[], size = 100) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));

// Runs `job` over `list` a few at a time.
async function inChunks<T>(list: T[], size: number, job: (x: T) => PromiseLike<{ error: unknown }>) {
  for (let i = 0; i < list.length; i += size) {
    const results = await Promise.all(list.slice(i, i + size).map(job));
    const failed = results.find(r => r.error);
    if (failed) throw failed.error;
  }
}

// Clears entries past their days; the bin lists only what can still come back.
export const useRecycleBin = (enabled = true) =>
  useQuery({
    queryKey: KEY,
    enabled,
    queryFn: async () => {
      await supabase.from('deleted_items').delete().lt('deleted_at', daysAgo(KEEP_DAYS));
      await supabase.from('deleted_items').delete().eq('kind', 'import').lt('deleted_at', daysAgo(IMPORT_DAYS));
      const rows = await fetchAll<BinEntry>((from, to) => supabase.from('deleted_items').select('*').order('deleted_at', { ascending: false }).range(from, to));
      return rows.filter(e => !expired(e));
    },
  });

async function existing(refs: Ref[]): Promise<Set<string>> {
  const found = new Set<string>();
  const byTable = new Map<string, string[]>();
  refs.forEach(r => byTable.set(r.table, [...(byTable.get(r.table) ?? []), r.id]));
  for (const [table, ids] of Array.from(byTable)) {
    const { data, error } = await supabase.from(table).select('id').in('id', ids);
    if (error) throw error;
    (data ?? []).forEach((r: { id: string }) => found.add(`${table}:${r.id}`));
  }
  return found;
}

// Undo copy of an Excel import, kept for 7 days.
export async function recordImportUndo(label: string, steps: UndoStep[]) {
  if (!steps.length) return;
  const { error } = await supabase.from('deleted_items').insert({ kind: 'import', label, data: { steps } });
  if (error) throw error;
}

export function useBinActions() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries();

  // Puts a row back with the parents it needs and everything deleted along with it.
  const restore = useMutation({
    mutationFn: async ({ entry, bin }: { entry: BinEntry; bin: BinEntry[] }) => {
      const have = await existing(parentRefs(entry, bin));
      const plan = restorePlan(entry, bin, r => have.has(`${r.table}:${r.id}`));
      if (plan.problem) throw new Error(plan.problem);
      for (const s of plan.steps) {
        const { error } = await supabase.from(s.table).upsert(s.values, { onConflict: 'id', ignoreDuplicates: true });
        if (error) throw error;
      }
      const { error } = await supabase.from('deleted_items').delete().in('id', plan.steps.map(s => s.binId));
      if (error) throw error;
      return plan.steps.length;
    },
    onSuccess: done,
  });

  const forget = useMutation({
    mutationFn: async ({ entry, bin }: { entry: BinEntry; bin: BinEntry[] }) => {
      const { error } = await supabase.from('deleted_items').delete().in('id', [entry.id, ...descendants(entry, bin).map(c => c.id)]);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  const emptyBin = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('deleted_items').delete().gte('deleted_at', '1970-01-01');
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  // Undoes an import newest step first: old values go back, added rows are removed (and kept out of the bin).
  const undoImport = useMutation({
    mutationFn: async (entry: BinEntry) => {
      const steps = [...((entry.data?.steps ?? []) as UndoStep[])].reverse();
      const started = new Date().toISOString();
      const added = new Map<string, string[]>();
      for (let i = 0; i < steps.length;) {
        const s = steps[i];
        let j = i;
        while (j < steps.length && steps[j].table === s.table && !!steps[j].values === !!s.values) j++;
        const run = steps.slice(i, j);
        if (s.values) await inChunks(run, 10, x => supabase.from(x.table).update(x.values!).eq('id', x.id));
        else {
          const ids = run.map(x => x.id);
          await inChunks(batches(ids), 1, list => supabase.from(s.table).delete().in('id', list));
          added.set(s.table, [...(added.get(s.table) ?? []), ...ids]);
        }
        i = j;
      }
      for (const [table, ids] of Array.from(added)) {
        await inChunks(batches(ids), 1, list => supabase.from('deleted_items').delete().eq('kind', table).in('row_id', list).gte('deleted_at', started));
      }
      const { error } = await supabase.from('deleted_items').delete().eq('id', entry.id);
      if (error) throw error;
    },
    onSuccess: done,
  });

  return { restore, forget, emptyBin, undoImport };
}
