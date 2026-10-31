import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { XSheet, downloadXlsx, readTableFile } from '../../lib/xlsx';
import { IMPORT_DAYS } from '../../lib/recycleBin';
import { Answers, Plan, TileId, plural } from '../../lib/importPlan';
import { ImportKind, KINDS, Source, useCustomerSource, useDishSource, useSweetSource } from './importKinds';
import { errorText, useSaveImport } from './saveImport';
import { ChangeTable, Decisions, Skipped, Steps, Tiles, UploadPanel } from './ImportParts';

// Import from Excel: pick a file, check every change and answer the open questions, then save with a 7-day undo.

interface Props {
  kind: ImportKind;
  onClose: () => void;
  // Breadcrumb back to the page that opened it; defaults to the kind's own page.
  crumb?: string;
}

interface FlowProps { kind: ImportKind; crumb: string; onKind: (k: ImportKind) => void; onClose: () => void }
interface Picked { name: string; sheets: XSheet[] }

const SAVES: TileId[] = ['new', 'changed', 'moved', 'other'];
const today = () => new Date().toLocaleDateString('en-CA');

function counts(plan: Plan | null): Record<TileId, number> {
  const out: Record<TileId, number> = { new: 0, changed: 0, moved: 0, other: 0, same: 0, decide: 0 };
  plan?.changes.forEach(c => { if (c.tile !== 'decide') out[c.tile]++; });
  out.decide = plan?.open ?? 0;
  return out;
}

const Flow: React.FC<FlowProps & { source: Source }> = ({ kind, crumb, onKind, onClose, source }) => {
  const info = KINDS[kind];
  const { save, canUndo, saved } = useSaveImport(info.keys);
  const [file, setFile] = useState<Picked | null>(null);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState<Answers>({});
  const [filter, setFilter] = useState<TileId | null>(null);
  const [saving, setSaving] = useState<number | null>(null);

  const plan = useMemo(() => (file && source.ready ? source.plan(file.sheets, answers) : null), [file, source, answers]);
  const n = counts(plan);
  const toSave = SAVES.reduce((t, k) => t + n[k], 0);
  const listed = plan?.changes.filter(c => (filter ? c.tile === filter : SAVES.includes(c.tile))) ?? [];

  const pick = async (f: File) => {
    setError('');
    try {
      const sheets = await readTableFile(f);
      if (!sheets.some(s => s.rows.length)) throw new Error('This file is empty.');
      setFile({ name: f.name, sheets });
      setAnswers({});
      setFilter(null);
    } catch (e) { setError(errorText(e, 'Could not read this file.')); }
  };

  const download = (rows: () => ReturnType<Source['current']>, name: string) => {
    try { downloadXlsx([{ name: info.file, rows: rows() }], name); } catch (e) { toast.error(errorText(e, 'Could not make the file')); }
  };

  const run = async () => {
    if (!plan || !toSave) return;
    setSaving(0);
    try {
      await save(plan.writes, `${info.undo} · ${plural(toSave, 'change')}`, setSaving);
      toast.success(saved);
      onClose();
    } catch (e) {
      toast.error(errorText(e));
      setSaving(null);
    }
  };

  const body = () => {
    if (!file) return <UploadPanel kind={kind} onKind={onKind} onFile={pick} error={error} />;
    if (source.failed) return <p className="im-panel im-error" role="alert">Could not load today's {info.today}. Check the connection and open this page again.</p>;
    if (!plan) return <p className="im-panel im-wait">Loading today's {info.today}…</p>;
    if (plan.missing.length || !plan.rows) return (
      <section className="im-panel im-missing" role="alert">
        <b>{plan.missing.length ? `This file has no ${plan.missing.join(' or ')} column.` : 'This file has no rows under its headings.'}</b>
        <span>Put these headings in the first row: {info.columns.map(c => c.label).join(', ')}. The empty template has them.</span>
        <button type="button" className="ui-btn" onClick={() => setFile(null)}>Pick another file</button>
      </section>
    );
    return (
      <>
        <Tiles info={info} counts={n} on={filter} onPick={setFilter} />
        {plan.decisions.length > 0 && (
          <Decisions decisions={plan.decisions} open={plan.open} answers={answers} onAnswer={(id, yes) => setAnswers(a => ({ ...a, [id]: yes }))} />
        )}
        <ChangeTable key={filter ?? 'all'} info={info} rows={listed} total={filter ? listed.length : toSave} same={n.same} listingSame={filter === 'same'} />
        {plan.skipped.length > 0 && <Skipped list={plan.skipped} />}
      </>
    );
  };

  return (
    <div className="im-page">
      <div className="im-head">
        <div className="im-title">
          <button type="button" className="im-crumb" onClick={onClose} disabled={saving !== null}>{crumb} ›</button>
          <h1>Import from Excel</h1>
        </div>
        <div className="im-head-acts">
          <button type="button" className="ui-btn" disabled={!source.ready} onClick={() => download(source.current, `${info.file} ${today()}.xlsx`)}>Download current {info.list} (.xlsx)</button>
          <button type="button" className="ui-btn" onClick={() => download(info.template, `${info.file} template.xlsx`)}>Empty template</button>
        </div>
      </div>

      <Steps file={file?.name} rows={plan?.rows} saving={saving !== null} />
      {file && <button type="button" className="im-link im-change-file" onClick={() => setFile(null)} disabled={saving !== null}>Pick another file</button>}
      {body()}

      <div className="im-foot">
        <span>
          Nothing changes until you press Save.{' '}
          {canUndo
            ? <>A copy of today's {info.today} is kept, so you can <b>undo this import for {IMPORT_DAYS} days</b>.</>
            : <>Undo for imports comes with the database update listed in Settings › Data.</>}
          {plan && plan.open > 0 && ` ${plural(plan.open, 'row')} still waiting for a decision ${plan.open === 1 ? 'is' : 'are'} left out.`}
        </span>
        <div className="im-foot-acts">
          <button type="button" className="ui-btn" onClick={onClose} disabled={saving !== null}>Cancel</button>
          <button type="button" className="ui-btn primary" onClick={run} disabled={!toSave || saving !== null}>
            {saving !== null ? `Saving… ${Math.round(saving * 100)}%` : toSave ? `Save ${plural(toSave, 'change')}` : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Each kind's own data hooks run in their own component, so switching kind remounts cleanly.
const DishFlow: React.FC<FlowProps> = p => <Flow {...p} source={useDishSource()} />;
const SweetFlow: React.FC<FlowProps> = p => <Flow {...p} source={useSweetSource()} />;
const CustomerFlow: React.FC<FlowProps> = p => <Flow {...p} source={useCustomerSource()} />;
const FLOWS: Record<ImportKind, React.FC<FlowProps>> = { dishes: DishFlow, sweets: SweetFlow, customers: CustomerFlow };

const ImportScreen: React.FC<Props> = ({ kind: start, onClose, crumb }) => {
  const [kind, setKind] = useState(start);
  const Body = FLOWS[kind];
  return <Body kind={kind} crumb={crumb ?? KINDS[start].crumb} onKind={setKind} onClose={onClose} />;
};

export default ImportScreen;
