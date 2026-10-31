import React, { useState } from 'react';
import { useIsFetching } from '@tanstack/react-query';
import {
  useHasDocSettings, useHasPreorderColumns, useHasPriceColumns, useHasQuoteOptions, useHasTeamBin, useIsLegacySchema,
  DOC_SETTINGS_MIGRATION_FILE, PACK_MIGRATION_FILE, PREORDER_MIGRATION_FILE, PRICE_MIGRATION_FILE, QUOTE_OPTIONS_MIGRATION_FILE, TEAM_BIN_MIGRATION_FILE,
} from '../../hooks/useSchemaStatus';
import { useHasPosPayments, POS_MIGRATION_FILE } from '../../hooks/useSeasonalOrders';
import { useRecycleBin } from '../../hooks/useRecycleBin';
import { useBackup } from '../../hooks/useBackup';
import { groupBin } from '../../lib/recycleBin';
import { ageText, backupStale } from '../../lib/backup';
import { LinkBtn, Panel, Row } from './SettingsUi';
import { SettingsApi } from './useSettingsSave';
import RecycleBinDialog from './RecycleBinDialog';

// Database updates the app is waiting for, by migration file.
export function useDbUpdates() {
  const checks: [boolean, string][] = [
    [!useIsLegacySchema(), PACK_MIGRATION_FILE],
    [useHasPriceColumns(), PRICE_MIGRATION_FILE],
    [useHasPreorderColumns(), PREORDER_MIGRATION_FILE],
    [useHasDocSettings(), DOC_SETTINGS_MIGRATION_FILE],
    [useHasQuoteOptions(), QUOTE_OPTIONS_MIGRATION_FILE],
    [useHasPosPayments(), POS_MIGRATION_FILE],
    [useHasTeamBin(), TEAM_BIN_MIGRATION_FILE],
  ];
  const checking = useIsFetching({ queryKey: ['schema_status'] }) > 0;
  return { checking, pending: checking ? [] : checks.filter(([ok]) => !ok).map(([, file]) => file) };
}

// Settings › Data: import, download everything, the weekly backup copy, the recycle bin and database updates.
const DataGroup: React.FC<{ api: SettingsApi; onImport: () => void }> = ({ api, onImport }) => {
  const { checking, pending } = useDbUpdates();
  const ready = useHasTeamBin();
  const { data: bin = [] } = useRecycleBin(ready);
  const backup = useBackup(at => api.saveDoc('Backup date', 'last_backup_at', at));
  const [binOpen, setBinOpen] = useState(false);
  const last = api.docs.last_backup_at;
  const stale = backupStale(last);
  const inBin = groupBin(bin).length;

  return (
    <Panel id="data" title="Data" sub="Get data in and out, keep it safe.">
      <div className="st-rows">
        <Row label="Import from Excel" note="Dishes, sweets, customers · you check every change before it saves">
          <LinkBtn onClick={onImport}>Start</LinkBtn>
        </Row>
        <Row label="Download everything" note={backup.busy === 'excel' ? `Reading ${backup.progress}` : 'One file, a sheet per list'}>
          <LinkBtn onClick={backup.excel}>{backup.busy === 'excel' ? 'Working…' : 'Excel'}</LinkBtn>
        </Row>
        <Row label="Backup copy" warn={stale}
          note={backup.busy === 'backup' ? `Reading ${backup.progress}` : last ? `Last one ${ageText(last).toLowerCase()} · keep one each week` : 'None yet · keep one each week'}>
          <LinkBtn onClick={backup.backup} warn={stale}>{backup.busy === 'backup' ? 'Working…' : 'Download now'}</LinkBtn>
        </Row>
        <Row label="Recycle bin" note="Deleted things stay 30 days">
          {ready && <span className="st-value">{inBin ? `${inBin} item${inBin === 1 ? '' : 's'}` : 'Empty'}</span>}
          {ready && <LinkBtn onClick={() => setBinOpen(true)}>Open</LinkBtn>}
        </Row>
        <Row label="Database updates" warn={pending.length > 0}
          note={pending.length ? `Run in Supabase → SQL Editor: ${pending.join(', ')}` : 'New features that need the database are switched on'}>
          <span className={`st-value${pending.length ? ' warn' : ''}`}>{checking ? 'Checking…' : pending.length ? `${pending.length} to run` : 'Up to date'}</span>
        </Row>
      </div>
      {binOpen && <RecycleBinDialog onClose={() => setBinOpen(false)} />}
    </Panel>
  );
};

export default DataGroup;
