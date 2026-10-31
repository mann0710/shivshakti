import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { recordImportUndo } from '../../hooks/useRecycleBin';
import { useHasTeamBin } from '../../hooks/useSchemaStatus';
import type { UndoStep } from '../../lib/recycleBin';
import type { Write } from '../../lib/importPlan';

// Saves an import or pasted list in batches and keeps its undo in the recycle bin.

export const UNDO_HINT = 'undo from Settings › Data › Recycle bin';
const ADD_BATCH = 200;
const CHANGE_BATCH = 10;

// crypto.randomUUID needs https or localhost; the shop's LAN tablets may use plain http.
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// Runs of the same table and kind: adds go in one request, changes a few at a time.
async function apply(writes: Write[], steps: UndoStep[], onProgress?: (share: number) => void) {
  for (let i = 0; i < writes.length;) {
    const w = writes[i];
    const size = w.old ? CHANGE_BATCH : ADD_BATCH;
    let j = i;
    while (j < writes.length && j - i < size && writes[j].table === w.table && !!writes[j].old === !!w.old) j++;
    const run = writes.slice(i, j);
    if (w.old) {
      const results = await Promise.all(run.map(x => supabase.from(x.table).update(x.values).eq('id', x.id)));
      results.forEach((r, k) => { if (!r.error) steps.push({ table: run[k].table, id: run[k].id, values: run[k].old }); });
      const failed = results.find(r => r.error);
      if (failed) throw failed.error;
    } else {
      const { error } = await supabase.from(w.table).insert(run.map(x => x.values));
      if (error) throw error;
      run.forEach(x => steps.push({ table: x.table, id: x.id }));
    }
    i = j;
    onProgress?.(i / writes.length);
  }
}

// Saves, records the undo (also for a save that stopped part way) and refreshes the lists.
// Before the recycle-bin update (no deleted_items table) it saves without an undo.
export function useSaveImport(keys: string[][]) {
  const qc = useQueryClient();
  const canUndo = useHasTeamBin();
  const save = async (writes: Write[], label: string, onProgress?: (share: number) => void) => {
    const steps: UndoStep[] = [];
    try {
      await apply(writes, steps, onProgress);
      if (canUndo) await recordImportUndo(label, steps);
    } catch (e) {
      if (canUndo && steps.length) await recordImportUndo(`${label} (stopped part way)`, steps).catch(() => undefined);
      throw e;
    } finally {
      [...keys, ['deleted_items']].forEach(queryKey => qc.invalidateQueries({ queryKey }));
    }
  };
  return { save, canUndo, saved: canUndo ? `Saved · ${UNDO_HINT}` : 'Saved' };
}

export function errorText(e: unknown, fallback = 'Could not save'): string {
  const message = typeof e === 'object' && e !== null ? (e as { message?: unknown }).message : undefined;
  return typeof message === 'string' && message ? message : fallback;
}
