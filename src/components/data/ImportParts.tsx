import React, { useState } from 'react';
import type { Answers, Change, Decision, Detail, Skip, TileId } from '../../lib/importPlan';
import { plural } from '../../lib/importPlan';
import { KIND_IDS, KINDS, ImportKind, KindInfo } from './importKinds';
import '../../styles/import.css';

// Pieces of the Excel import screen: steps, file picker, tiles, decisions and the change list.

export const Steps: React.FC<{ file?: string; rows?: number; saving: boolean }> = ({ file, rows, saving }) => {
  const now = saving ? 3 : file ? 2 : 1;
  const step = (n: number, label: string) => (
    <li className={n < now ? 'done' : n === now ? 'now' : ''} aria-current={n === now ? 'step' : undefined}>
      <span className="im-dot" aria-hidden="true">{n < now ? '✓' : n}</span>{label}
    </li>
  );
  return (
    <ol className="im-steps" aria-label="Steps">
      {step(1, file ? `Upload · ${file}${rows !== undefined ? `, ${plural(rows, 'row')}` : ''}` : 'Upload')}
      <li className="im-dash" aria-hidden="true">—</li>
      {step(2, 'Check the changes')}
      <li className="im-dash" aria-hidden="true">—</li>
      {step(3, 'Save')}
    </ol>
  );
};

interface PickProps { kind: ImportKind; onKind: (k: ImportKind) => void; onFile: (f: File) => void; error: string }

export const UploadPanel: React.FC<PickProps> = ({ kind, onKind, onFile, error }) => {
  const [over, setOver] = useState(false);
  const info = KINDS[kind];
  return (
    <section className="im-panel im-upload" aria-label="Pick a file">
      <div className="im-kinds" role="group" aria-label="What to import">
        {KIND_IDS.map(k => (
          <button key={k} type="button" aria-pressed={k === kind} onClick={() => onKind(k)}>{KINDS[k].tab}</button>
        ))}
      </div>
      <label className={`im-drop${over ? ' over' : ''}`}
        onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }}>
        <input type="file" accept=".xlsx,.csv" className="im-sr" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
        <b>Drop your Excel file here, or <span className="im-pick">pick a file</span></b>
        <small>.xlsx or .csv · first row: {info.columns.map(c => c.label).join(', ')}</small>
      </label>
      {error && <p className="im-error" role="alert">{error}</p>}
    </section>
  );
};

interface TileProps { info: KindInfo; counts: Record<TileId, number>; on: TileId | null; onPick: (t: TileId | null) => void }

export const Tiles: React.FC<TileProps> = ({ info, counts, on, onPick }) => (
  <div className="im-tiles">
    {(Object.keys(info.tiles) as TileId[]).filter(t => counts[t] > 0 || !['moved', 'other'].includes(t)).map(t => (
      <button key={t} type="button" className={`im-tile ${t}`} aria-pressed={on === t} onClick={() => onPick(on === t ? null : t)}>
        <b>{counts[t].toLocaleString('en-IN')}</b><span>{info.tiles[t]}</span>
      </button>
    ))}
  </div>
);

const FIRST_FIXES = 8;

interface FixProps { decisions: Decision[]; open: number; answers: Answers; onAnswer: (id: string, yes: boolean) => void }

export const Decisions: React.FC<FixProps> = ({ decisions, open, answers, onAnswer }) => {
  const [all, setAll] = useState(false);
  const shown = all ? decisions : decisions.slice(0, FIRST_FIXES);
  return (
    <section className="im-fixes" aria-labelledby="im-fixes-h">
      <h2 id="im-fixes-h">{open ? `${plural(open, 'row needs', 'rows need')} a decision` : `All ${plural(decisions.length, 'decision')} made`}</h2>
      {shown.map(d => {
        const a = answers[d.id];
        return (
          <div key={d.id} className="im-fix">
            <span className="im-row">Row {d.row}</span>
            <span className="im-fix-text">{d.text}</span>
            <div className="im-fix-acts" role="group" aria-label={`Row ${d.row}`}>
              <button type="button" className={`ui-btn im-choice${a === undefined ? ' primary' : ''}`} aria-pressed={a === true} onClick={() => onAnswer(d.id, true)}>{d.yes}</button>
              <button type="button" className="ui-btn im-choice" aria-pressed={a === false} onClick={() => onAnswer(d.id, false)}>{d.no}</button>
            </div>
          </div>
        );
      })}
      {decisions.length > FIRST_FIXES && (
        <button type="button" className="im-link" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${decisions.length}`}</button>
      )}
    </section>
  );
};

const DetailText: React.FC<{ d: Detail; primary: string }> = ({ d, primary }) => (
  <span className="im-detail">
    {d.label !== primary && <small>{d.label}: </small>}
    {d.old && <><span className="im-old">{d.old}</span> → </>}<b>{d.next}</b>
  </span>
);

const FIRST_ROWS = 20;

interface TableProps { info: KindInfo; rows: Change[]; total: number; same: number; listingSame: boolean }

export const ChangeTable: React.FC<TableProps> = ({ info, rows, total, same, listingSame }) => {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, FIRST_ROWS);
  const note = [
    `Showing ${shown.length.toLocaleString('en-IN')} of ${plural(total, listingSame ? 'row' : 'change')}`,
    !listingSame && same ? `${plural(same, 'row is', 'rows are')} the same as today and ${same === 1 ? 'is' : 'are'} not listed` : '',
  ].filter(Boolean).join(' · ');
  return (
    <section className="im-panel im-changes" aria-label="Changes">
      <div className="im-scroll">
        <table className="im-table">
          <thead><tr><th scope="col">What happens</th>{info.heads.map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
          <tbody>
            {shown.map(c => (
              <tr key={`${c.row}-${c.name}`}>
                <td><span className={`im-chip ${c.tone}`}>{c.chip}</span></td>
                <td className="im-name">{c.name}</td>
                <td className="im-where">{c.where || '—'}</td>
                <td>{c.details.length ? c.details.map(d => <DetailText key={d.label} d={d} primary={info.primary} />) : '—'}</td>
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={4} className="im-none">Nothing to show here.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="im-table-foot">
        <span>{note}</span>
        {rows.length > FIRST_ROWS && <button type="button" className="im-link" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all ${rows.length.toLocaleString('en-IN')}`}</button>}
      </div>
    </section>
  );
};

export const Skipped: React.FC<{ list: Skip[] }> = ({ list }) => (
  <details className="im-panel im-skipped">
    <summary>{plural(list.length, 'row is', 'rows are')} left out</summary>
    <ul>{list.map(s => <li key={s.row}><b>Row {s.row}</b>{s.name ? ` · ${s.name}` : ''} — {s.why}</li>)}</ul>
  </details>
);
