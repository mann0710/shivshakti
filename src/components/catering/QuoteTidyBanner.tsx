import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useBookings } from '../../hooks/useBookings';
import { Quotation, useUpdateQuotationStatus } from '../../hooks/useQuotations';
import { outOfStep, fixCounts } from '../../lib/quoteSync';
import { todayIST } from '../../lib/ist';
import { openChoiceLabels } from '../../lib/quoteChoices';

interface Props { quotations: Quotation[]; onSee?: (ids: string[]) => void }

// One tap brings every quote in line with its booking: confirmed → accepted, cancelled → declined, passed → expired.
const QuoteTidyBanner: React.FC<Props> = ({ quotations, onSee }) => {
  const { data: bookings = [] } = useBookings();
  const update = useUpdateQuotationStatus();
  const [busy, setBusy] = useState(false);
  const fixes = useMemo(() => outOfStep(quotations, bookings, todayIST(), q => openChoiceLabels(q).length > 0), [quotations, bookings]);
  if (!fixes.length) return null;
  const c = fixCounts(fixes);
  const n = fixes.length;
  const parts = [
    c.booked ? <>{c.booked} booking{c.booked > 1 ? 's are' : ' is'} confirmed or done → <b>accepted</b></> : null,
    c.cancelled ? <>{c.cancelled} booking{c.cancelled > 1 ? 's were' : ' was'} cancelled → <b>declined</b></> : null,
    c.passed ? <>{c.passed} inquir{c.passed > 1 ? 'ies' : 'y'} passed with no answer → <b>expired</b></> : null,
  ].filter(Boolean);
  const fixAll = async () => {
    setBusy(true);
    try {
      for (const f of fixes) await update.mutateAsync({ id: f.id, status: f.to });
      toast.success(`${n} quote${n > 1 ? 's' : ''} now match their booking`);
    } catch (e: any) { toast.error(e?.message ?? 'Could not update the quotes'); } finally { setBusy(false); }
  };
  return (
    <section aria-label="Tidy up" className="tidy-banner q-tidy">
      <div className="q-tidy-text">
        <b>{n} quote{n > 1 ? 's don\'t' : ' doesn\'t'} match their booking</b>
        <span className="q-dk">{parts.map((p, i) => <React.Fragment key={i}>{i > 0 && ' · '}{p}</React.Fragment>)}</span>
      </div>
      <div className="q-tidy-acts">
        {onSee && <button type="button" className="ui-btn q-dk" onClick={() => onSee(fixes.map(f => f.id))}>See the {n}</button>}
        <button type="button" className="ui-btn primary q-tidy-fix" disabled={busy} onClick={fixAll}>{busy ? 'Fixing…' : <>Fix all<span className="q-dk"> {n}</span></>}</button>
      </div>
    </section>
  );
};

export default QuoteTidyBanner;
