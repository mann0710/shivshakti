import React, { useEffect, useMemo, useState } from 'react';
import { REPORTS, ReportId, Preset, Range, presetRange, rangeLabel } from '../../lib/reports';
import { printReport, downloadCsv } from '../../lib/reports/export';
import { useReportData } from '../../hooks/useReportData';
import { useStoredState } from '../../hooks/useStoredState';
import { SeasonalOccasion } from '../../hooks/useSeasonalOccasions';
import RangeBar from './reports/RangeBar';
import ReportView from './reports/ReportView';
import { btnPrimary, btnGhost, empty, segBtn, segWrap, DANGER } from '../ui/styles';

// Sweets + catering reports for any period, each printable / PDF and CSV.
const ReportsTab: React.FC<{ occasions: SeasonalOccasion[]; report?: ReportId }> = ({ occasions, report: asked }) => {
  const [prefs, setPrefs] = useStoredState<{ id: ReportId; preset: Preset }>('shivshakti.reportPrefs', () => ({ id: 'sales', preset: 'month' }));
  // A link that names a report opens on it.
  useEffect(() => { if (asked) setPrefs(p => ({ ...p, id: asked })); }, [asked, setPrefs]);
  const [range, setRange] = useState<Range>(() => presetRange(prefs.preset === 'custom' ? 'month' : prefs.preset));
  const [occasionId, setOccasionId] = useState('');
  const def = REPORTS.find(r => r.id === prefs.id) ?? REPORTS[0];
  const { input, loading, error } = useReportData(range, occasionId);
  const report = useMemo(() => (loading ? null : def.build(input)), [def, input, loading]);

  return (
    <div>
      <div className="report-picker" style={{ ...segWrap, marginBottom: 12, overflowX: 'auto' }} role="tablist" aria-label="Report">
        {REPORTS.map(r => (
          <button key={r.id} type="button" role="tab" aria-selected={def.id === r.id} style={{ ...segBtn(def.id === r.id), whiteSpace: 'nowrap' }}
            onClick={() => setPrefs(p => ({ ...p, id: r.id }))}>
            {r.icon} {r.label}
          </button>
        ))}
      </div>

      <RangeBar preset={prefs.preset} range={range} occasionId={occasionId} occasions={occasions} disabled={!def.ranged}
        onChange={(preset, r) => { setRange(r); setPrefs(p => ({ ...p, preset })); }} onOccasion={setOccasionId} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{report?.title ?? def.label}</div>
          <div style={{ fontSize: 12, color: '#6B6B66' }}>{def.ranged ? rangeLabel(range) : 'As of today'}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" style={btnGhost} disabled={!report} onClick={() => report && downloadCsv(report, range)}>⬇ CSV / Excel</button>
          <button type="button" style={btnPrimary} disabled={!report} onClick={() => report && printReport(report, range)}>🖨 Print / PDF</button>
        </div>
      </div>

      {error ? <div style={{ ...empty, color: DANGER }}>Could not load report data: {error.message}</div>
        : !report ? <div style={empty}>Loading report…</div>
        : <ReportView report={report} />}
    </div>
  );
};

export default ReportsTab;
