import { useEffect, useMemo } from 'react';
import { useDataCenter, useUpsertDataCenter } from './useDataCenter';
import { useHasDocSettings } from './useSchemaStatus';
import { DocSettings, mergeDocSettings } from '../lib/docs/settings';
import { setDocContext, ensureLogo } from '../lib/docs/context';

// Saved document settings merged over the defaults.
export const useDocSettings = () => {
  const { data: dc } = useDataCenter();
  return useMemo(() => mergeDocSettings(dc?.doc_settings as Partial<DocSettings> | undefined), [dc]);
};

// Keeps the document builders in step with the database; mounted once in the app shell.
export const useDocContextSync = () => {
  const { data: dc } = useDataCenter();
  const settings = useDocSettings();
  useEffect(() => {
    setDocContext({ settings, gstNumber: dc?.gst_number || undefined });
    ensureLogo();
  }, [settings, dc?.gst_number]);
};

export const useSaveDocSettings = () => {
  const upsert = useUpsertDataCenter();
  const ready = useHasDocSettings();
  return { ready, saving: upsert.isPending, save: (s: DocSettings) => upsert.mutateAsync({ doc_settings: s as unknown as Record<string, unknown> }) };
};
