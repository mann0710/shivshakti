import React from 'react';
import { MakePlan, amountText, datesShort } from '../../lib/sweetsToday';
import { dayName } from '../../lib/occasions';
import { printHtml } from '../../lib/receipt';
import { page, esc } from '../../lib/docs/theme';
import { slimHeader, docTable } from '../../lib/docs/parts';
import { docContext } from '../../lib/docs/context';
import '../../styles/sweets.css';

const DAYS = 10;

// Kitchen print of the same table.
function makeHtml(plan: MakePlan): string {
  const ctx = docContext();
  const head = ['Sweet', ...plan.dates.map(dayName), 'Total'];
  const rows = plan.rows.map(r => [
    `<b>${esc(r.name)}</b>${r.packs ? ` <small>${esc(r.packs)}</small>` : ''}`,
    ...plan.dates.map(d => amountText(r.byDate[d], r.unit)),
    `<b>${amountText(r.total, r.unit)}</b>`,
  ]);
  const right = `From pre-bookings, next ${DAYS} days<br>Printed ${esc(new Date().toLocaleString('en-IN'))}`;
  return page('What to make', ctx.settings.accent, `${slimHeader(ctx, 'Kitchen', 'What to make', right)}<div class="wrap">${docTable(head, rows, undefined, 1)}</div>`);
}

// Booked sweets by delivery day, in kg, so the kitchen knows the batch sizes.
const MakeList: React.FC<{ plan: MakePlan }> = ({ plan }) => {
  const cols = { gridTemplateColumns: `minmax(140px, 1fr) ${plan.dates.map(() => '80px').join(' ')} 80px` };
  const width = { minWidth: 160 + 90 * (plan.dates.length + 1) };
  const forDays = (byDate: Record<string, number>) => {
    const days = Object.keys(byDate).sort();
    return days.length === 1 ? `for ${datesShort(days)}` : datesShort(days);
  };

  return (
    <section className="sw-card" aria-label="What to make">
      <div className="sw-card-head">
        <h2>What to make · next {DAYS} days</h2>
        {plan.rows.length > 0 && (
          <button type="button" className="ui-btn" onClick={() => printHtml(makeHtml(plan))}>
            <span className="sw-desk">Print for the kitchen</span><span className="sw-phone">Print</span>
          </button>
        )}
      </div>
      {plan.rows.length === 0 ? <div className="sw-empty">Nothing booked to make in the next {DAYS} days.</div> : (
        <>
          <div className="table-wrap" role="table" aria-label="Sweets to make by day">
            <div className="sw-make-row head" role="row" style={{ ...cols, ...width }}>
              <span role="columnheader">Sweet</span>
              {plan.dates.map(d => <span key={d} role="columnheader">{dayName(d)}</span>)}
              <span role="columnheader">Total</span>
            </div>
            {plan.rows.map(r => (
              <div key={r.key} className="sw-make-row" role="row" style={{ ...cols, ...width }}>
                <span role="cell">{r.name} {r.packs && <small>{r.packs}</small>}<small className="sw-phone">{forDays(r.byDate)}</small></span>
                {plan.dates.map(d => <span key={d} className="d sw-muted" role="cell">{amountText(r.byDate[d], r.unit)}</span>)}
                <span className="t" role="cell">{amountText(r.total, r.unit)}</span>
              </div>
            ))}
          </div>
          <span className="sw-make-note">From pre-bookings only. Add expected counter sales per sweet to plan the full batch.</span>
        </>
      )}
    </section>
  );
};

export default MakeList;
