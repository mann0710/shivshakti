import React from 'react';
import { Report, Table, Stat, fmtCell, isNum } from '../../../lib/reports';
import { card, cardTitle, empty, NAVY, DANGER, SUCCESS, MUTED } from '../../ui/styles';

const TONE: Record<NonNullable<Stat['tone']>, string> = { good: SUCCESS, bad: DANGER, warn: '#E65100' };

// Renders any report: headline tiles, then each table with its total row.
const ReportView: React.FC<{ report: Report }> = ({ report }) => (
  <div>
    <div style={{ fontSize: 12, color: MUTED, marginBottom: 10 }}>{report.note}</div>
    <div className="g4" style={{ marginBottom: 14 }}>
      {report.stats.map(s => (
        <div key={s.label} style={{ background: '#fff', border: '0.5px solid #E5E5E0', borderRadius: 12, padding: '12px 14px', minWidth: 0 }}>
          <div style={{ fontSize: 11, color: MUTED, marginBottom: 4 }}>{s.label}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: s.tone ? TONE[s.tone] : '#1A1A18', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {fmtCell(s.value, s.fmt) || '—'}
          </div>
          {s.sub && <div style={{ fontSize: 11, color: '#AAAAAA', marginTop: 2 }}>{s.sub}</div>}
        </div>
      ))}
    </div>
    {report.tables.map(t => <ReportTable key={t.title} t={t} />)}
  </div>
);

const ReportTable: React.FC<{ t: Table }> = ({ t }) => {
  const align = (c: Table['cols'][number]): React.CSSProperties => ({ textAlign: isNum(c.fmt) ? 'right' : 'left', whiteSpace: isNum(c.fmt) ? 'nowrap' : undefined });
  return (
    <div style={card}>
      <div style={{ ...cardTitle, color: NAVY, display: 'flex', justifyContent: 'space-between' }}>
        <span>{t.title}</span>{t.rows.length > 0 && <span style={{ fontWeight: 400, color: MUTED, fontSize: 12 }}>{t.rows.length} rows</span>}
      </div>
      {t.rows.length === 0 ? <div style={{ ...empty, padding: '18px 12px' }}>{t.empty}</div> : (
        <div className="table-wrap report-table">
          <table>
            <thead><tr>{t.cols.map(c => <th key={c.key} style={align(c)}>{c.label}</th>)}</tr></thead>
            <tbody>
              {t.rows.map((r, i) => <tr key={i}>{t.cols.map(c => <td key={c.key} style={align(c)}>{fmtCell(r[c.key], c.fmt)}</td>)}</tr>)}
            </tbody>
            {t.total && <tfoot><tr>{t.cols.map(c => <td key={c.key} style={align(c)}>{fmtCell(t.total![c.key], c.fmt)}</td>)}</tr></tfoot>}
          </table>
        </div>
      )}
    </div>
  );
};

export default ReportView;
