import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useDataCenter, useUpsertDataCenter } from '../../hooks/useDataCenter';
import { useDocSettings } from '../../hooks/useDocSettings';
import { useHasDocSettings } from '../../hooks/useSchemaStatus';
import { DocSettings } from '../../lib/docs/settings';
import { DataCenter } from '../../types';
import { undoToast } from '../pos/undoToast';

type DcKey = 'gst_number' | 'gst_rate';
export interface LastSave { label: string; undo: () => void }

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// Every setting saves on its own and offers Undo; there is no Save button.
export function useSettingsSave() {
  const { data: dc } = useDataCenter();
  const docs = useDocSettings();
  const docsReady = useHasDocSettings();
  const upsert = useUpsertDataCenter();
  const [last, setLast] = useState<LastSave | null>(null);
  // Latest document settings, ahead of the refetch, so quick changes don't undo each other.
  const live = useRef(docs);
  useEffect(() => { live.current = docs; }, [docs]);

  const commit = async (label: string, patch: Partial<DataCenter>, undoPatch: () => Partial<DataCenter>) => {
    try {
      await upsert.mutateAsync(patch);
      const undo = () => {
        upsert.mutateAsync(undoPatch()).then(() => { setLast(null); toast.success(`${label} put back`); })
          .catch((e: any) => toast.error(e?.message || 'Could not undo'));
      };
      setLast({ label, undo });
      undoToast(`${label} saved`, undo);
    } catch (e: any) { toast.error(e?.message || 'Could not save'); }
  };

  const saveDc = <K extends DcKey>(label: string, key: K, value: DataCenter[K]) => {
    const prev = dc?.[key] ?? null;
    if (same(prev, value)) return Promise.resolve();
    return commit(label, { [key]: value }, () => ({ [key]: prev }));
  };

  const saveDoc = <K extends keyof DocSettings>(label: string, key: K, value: DocSettings[K]) => {
    const prev = live.current[key];
    if (same(prev, value)) return Promise.resolve();
    live.current = { ...live.current, [key]: value };
    const write = (s: DocSettings) => ({ doc_settings: s as unknown as Record<string, unknown> });
    return commit(label, write(live.current), () => {
      live.current = { ...live.current, [key]: prev };
      return write(live.current);
    });
  };

  return { dc, docs, docsReady, saveDc, saveDoc, last, clearLast: () => setLast(null), saving: upsert.isPending };
}

export type SettingsApi = ReturnType<typeof useSettingsSave>;
