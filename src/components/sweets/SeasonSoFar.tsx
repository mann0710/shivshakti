import React from 'react';
import { SeasonalOccasion } from '../../hooks/useSeasonalOccasions';
import { SoFar } from '../../lib/sweetsToday';
import { seasonTitle } from '../../lib/occasions';
import { formatSize } from '../../lib/units';
import { inr } from '../../lib/money';
import type { ReportId } from '../../lib/reports';
import '../../styles/sweets.css';

const REPORTS: [string, ReportId][] = [['Sales by day', 'sales'], ['Sweets sold', 'items'], ['Cash and UPI', 'payments'], ['Unpaid bills', 'dues'], ['Pre-bookings', 'preorders']];

interface Props { season?: SeasonalOccasion; data?: SoFar; onOccasions: () => void; onReports: (id: ReportId) => void }

// The running season's totals from its dates, next to the report links.
const SeasonSoFar: React.FC<Props> = ({ season, data, onOccasions, onReports }) => {
  const stat = (label: string, value: string) => <div className="sw-stat" key={label}><span>{label}</span><b>{value}</b></div>;
  const top = data?.top ?? [];
  return (
    <div className="sw-two stretch">
      <section className="sw-card sw-pad" aria-label="This season">
        {season && data ? (
          <>
            <h2 className="sw-h2">{seasonTitle(season)} so far</h2>
            <div className="sw-stats">
              {stat('Counter bills', `${data.bills.count} · ${inr(data.bills.total)}`)}
              {stat('Pre-bookings', `${data.bookings.count} · ${inr(data.bookings.total)}`)}
              {stat('Collected', inr(data.collected))}
            </div>
            {top.length > 0 && (
              <span className="sw-most">
                Most asked: {top.map((t, i) => {
                  const text = `${t.name} ${formatSize(t.amount, t.unit)}`;
                  return <React.Fragment key={t.key}>{i > 0 && ' · '}{i === 0 ? <b>{text}</b> : text}</React.Fragment>;
                })}
              </span>
            )}
          </>
        ) : (
          <>
            <h2 className="sw-h2">This season so far</h2>
            <span className="sw-sub">No season today. Give an occasion its dates and its bills and pre-bookings add up here.</span>
            <span><button type="button" className="ui-btn" onClick={onOccasions}>Set season dates</button></span>
          </>
        )}
      </section>
      <section className="sw-card sw-pad sw-reports" aria-label="Reports" style={{ gap: 0 }}>
        <h2 className="sw-h2" style={{ marginBottom: 8 }}>Reports</h2>
        {REPORTS.map(([label, id]) => <button key={id} type="button" onClick={() => onReports(id)}><span>{label}</span><span aria-hidden="true">→</span></button>)}
      </section>
    </div>
  );
};

export default SeasonSoFar;
