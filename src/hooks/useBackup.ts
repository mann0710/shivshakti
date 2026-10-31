import { useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { fetchAll } from '../lib/fetchAll';
import { TABLES, Tables, backupJson, everythingSheets, fileStamp } from '../lib/backup';
import { downloadBlob, downloadXlsx } from '../lib/xlsx';

const missing = (e: any) => ['42P01', 'PGRST205', '42501'].includes(e?.code) || /does not exist|could not find the table|permission denied/i.test(e?.message ?? '');

// Every table in full; a list this login can't read (or that doesn't exist yet) is left out.
async function readAll(onStep: (done: number) => void): Promise<Tables> {
  const out: Tables = {};
  let done = 0;
  for (const { table } of TABLES) {
    try { out[table] = await fetchAll((from, to) => supabase.from(table).select('*').range(from, to)); }
    catch (e) { if (!missing(e)) throw e; }
    onStep(++done);
  }
  return out;
}

// Settings › Data: "Download everything" as Excel and the weekly JSON backup copy.
export function useBackup(onBackedUp: (at: string) => void) {
  const [busy, setBusy] = useState<'' | 'excel' | 'backup'>('');
  const [step, setStep] = useState(0);

  const run = async (kind: 'excel' | 'backup') => {
    setBusy(kind); setStep(0);
    try {
      const tables = await readAll(setStep);
      const at = new Date().toISOString();
      if (kind === 'excel') {
        downloadXlsx(everythingSheets(tables), `shivshakti_everything_${fileStamp(at)}.xlsx`);
        toast.success('Saved in Downloads: one Excel file, a sheet per list');
      } else {
        const project = new URL(process.env.REACT_APP_SUPABASE_URL || 'http://local').hostname.split('.')[0];
        downloadBlob(new Blob([backupJson(tables, at, project)], { type: 'application/json' }), `shivshakti-backup-${fileStamp(at)}.json`);
        onBackedUp(at);
        toast.success('Backup saved in Downloads. Keep it somewhere safe, like Google Drive.');
      }
    } catch (e: any) { toast.error(e?.message || 'Could not read the data'); }
    finally { setBusy(''); }
  };

  return { busy, progress: busy ? `${step} of ${TABLES.length} lists…` : '', excel: () => run('excel'), backup: () => run('backup') };
}
