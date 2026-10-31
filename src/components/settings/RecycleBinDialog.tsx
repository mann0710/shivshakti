import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import { useConfirm } from '../ui/ConfirmDialog';
import { BinEntry, BinGroup, KIND_NAME, binText, childNote, daysLeft, groupBin } from '../../lib/recycleBin';
import { useBinActions, useRecycleBin } from '../../hooks/useRecycleBin';
import '../../styles/settings-data.css';

const PAGE = 40;
const when = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

// Settings › Data › Recycle bin: deleted rows for 30 days (Excel imports 7) with Restore and Delete now.
const RecycleBinDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { data: bin = [], isLoading, error } = useRecycleBin();
  const { restore, forget, emptyBin, undoImport } = useBinActions();
  const { confirm, dialog } = useConfirm();
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const busy = restore.isPending || forget.isPending || emptyBin.isPending || undoImport.isPending;

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groupBin(bin).filter(g => !q || `${binText(g.entry).title} ${binText(g.entry).line}`.toLowerCase().includes(q));
  }, [bin, query]);

  const fail = (e: any) => toast.error(e?.message || 'Could not do that', { duration: 8000 });
  const nameOf = (e: BinEntry) => binText(e).title;

  const putBack = async ({ entry }: BinGroup) => {
    if (entry.kind === 'import') {
      const steps = (entry.data?.steps ?? []).length;
      if (!(await confirm({ title: `Undo ${entry.label}?`, message: `The ${steps} change${steps === 1 ? '' : 's'} it made are put back as they were.`, confirmLabel: 'Undo' }))) return;
      undoImport.mutateAsync(entry).then(() => toast.success('Undone')).catch(fail);
      return;
    }
    restore.mutateAsync({ entry, bin }).then(n => toast.success(`${nameOf(entry)} is back${n > 1 ? ` with ${n - 1} more` : ''}`)).catch(fail);
  };

  const dropOne = async ({ entry, children }: BinGroup) => {
    if (!(await confirm({ title: `Delete ${nameOf(entry)} for good?`, message: `${children.length ? `It and ${childNote(children).replace(/^with /, '')} ` : 'It '}can't be brought back after this.`, confirmLabel: 'Delete now', danger: true }))) return;
    forget.mutateAsync({ entry, bin }).then(() => toast.success('Deleted for good')).catch(fail);
  };

  const dropAll = async () => {
    if (!(await confirm({ title: 'Empty the recycle bin?', message: `All ${bin.length} things in it are deleted for good.`, confirmLabel: 'Empty bin', danger: true }))) return;
    emptyBin.mutateAsync().then(() => toast.success('Recycle bin emptied')).catch(fail);
  };

  return (
    <Modal title="Recycle bin" onClose={onClose} width={560} busy={busy}
      footer={<>
        {bin.length > 0 && <button type="button" className="st-danger-link" onClick={dropAll} disabled={busy}>Empty bin…</button>}
        <button type="button" className="ui-btn primary" onClick={onClose}>Close</button>
      </>}>
      <p className="st-sub">Deleted things stay here for 30 days. Excel imports and sheet edits can be undone for 7 days.</p>
      {bin.length > 8 && (
        <label className="st-field full" style={{ marginBottom: 10 }}>
          <span className="st-sr">Search the recycle bin</span>
          <input type="search" value={query} placeholder="Search by name or number" onChange={e => { setQuery(e.target.value); setLimit(PAGE); }} />
        </label>
      )}
      <div className="bin-list">
        {isLoading && <div className="bin-row"><span className="bin-main"><b>Loading…</b></span></div>}
        {error && <div className="bin-row"><span className="bin-main"><b>The recycle bin isn't set up yet</b><small>Run the database update shown under Data.</small></span></div>}
        {!isLoading && !error && !groups.length && (
          <div className="bin-row"><span className="bin-main"><b>{query ? `Nothing matches "${query}"` : 'Nothing deleted yet'}</b>
            <small>Deleted dishes, quotes, pre-bookings and customers appear here</small></span></div>
        )}
        {groups.slice(0, limit).map(g => {
          const t = binText(g.entry);
          const left = daysLeft(g.entry);
          return (
            <div key={g.entry.id} className="bin-row">
              <span className="bin-main">
                <b>{t.title}</b>
                <small>{[t.line, childNote(g.children)].filter(Boolean).join(' · ')}</small>
                <small className={left <= 3 ? 'warn' : ''}>{g.entry.kind === 'import' ? 'Saved' : 'Deleted'} {when(g.entry.deleted_at)}{g.entry.deleted_by ? ` by ${g.entry.deleted_by}` : ''} · {left} day{left === 1 ? '' : 's'} left</small>
              </span>
              <span className="bin-acts">
                <button type="button" className="ui-btn" onClick={() => putBack(g)} disabled={busy} aria-label={`${g.entry.kind === 'import' ? 'Undo' : 'Restore'} ${KIND_NAME[g.entry.kind] ?? ''} ${t.title}`}>
                  {g.entry.kind === 'import' ? 'Undo' : 'Restore'}
                </button>
                <button type="button" className="st-link danger" onClick={() => dropOne(g)} disabled={busy} aria-label={`Delete ${t.title} now`}>Delete now</button>
              </span>
            </div>
          );
        })}
      </div>
      {groups.length > limit && <button type="button" className="st-link" onClick={() => setLimit(groups.length)}>Show all {groups.length}</button>}
      {dialog}
    </Modal>
  );
};

export default RecycleBinDialog;
