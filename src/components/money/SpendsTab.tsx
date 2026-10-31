import React, { useMemo } from 'react';
import toast from 'react-hot-toast';
import { Booking, Invoice } from '../../types';
import { Range } from '../../lib/reports/model';
import { Spend, SCOPES, SPEND_MODES, byKind, spendsIn, spentTotal } from '../../lib/spends';
import { sumOf } from '../../lib/moneyView';
import { formatDateIST } from '../../lib/ist';
import { inr } from '../../lib/money';
import { CardHead, Empty } from './MoneyUi';
import { SPENDS_MIGRATION_FILE, useAddSpends, useDeleteSpend } from './useMoneyData';

interface Props { spends: Spend[] | null; range: Range; bookings: Booking[]; invoices: Invoice[]; onAdd: () => void; onPaste: () => void }

// Money → Spends: what went out in the period, by kind and per event, with Undo on delete.
const SpendsTab: React.FC<Props> = ({ spends, range, bookings, invoices, onAdd, onPaste }) => {
  const del = useDeleteSpend();
  const add = useAddSpends();
  const list = useMemo(() => spendsIn(spends ?? [], range), [spends, range]);
  const byId = useMemo(() => new Map(bookings.map(b => [b.id, b])), [bookings]);
  const perEvent = useMemo(() => Array.from(new Set(list.map(s => s.booking_id).filter(Boolean) as string[])).map(id => {
    const b = byId.get(id);
    const inv = invoices.find(i => i.booking_id === id);
    const spent = sumOf(list.filter(s => s.booking_id === id), s => s.amount);
    return { id, name: b ? `${b.customer?.name ?? 'Customer'} · ${b.event_type} ${formatDateIST(b.event_date, 'd MMM')}` : 'Event', billed: inv?.total_amount ?? 0, spent };
  }), [list, byId, invoices]);

  if (spends === null) {
    return <div className="mx-banner info"><span><b>A database update is waiting.</b> Spends need it. Ask whoever looks after the app to run {SPENDS_MIGRATION_FILE}.</span></div>;
  }
  const forText = (s: Spend) => (s.scope === 'event' ? (byId.get(s.booking_id ?? '') ? `${byId.get(s.booking_id!)!.customer?.name ?? 'Customer'} · ${byId.get(s.booking_id!)!.event_type}` : 'An event') : SCOPES.find(x => x[0] === s.scope)![1]);
  const remove = async (s: Spend) => {
    try {
      await del.mutateAsync(s.id);
      const { id, created_at, ...row } = s;
      toast(t => (
        <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>{inr(s.amount)} spend deleted
          <button type="button" className="mx-link" style={{ color: '#FFB869' }} onClick={() => { toast.dismiss(t.id); add.mutate([row]); }}>Undo</button></span>
      ));
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not delete'); }
  };

  return (
    <>
      <div className="mx-tiles">
        <div className="mx-tile"><span className="mx-tile-k">Spent</span><span className="mx-tile-v mx-red">{inr(spentTotal(list))}</span><span className="mx-tile-n">{list.length} spend{list.length === 1 ? '' : 's'}</span></div>
        {byKind(list).slice(0, 3).map(k => (
          <div key={k.kind} className="mx-tile"><span className="mx-tile-k">{k.kind}</span><span className="mx-tile-v">{inr(k.amount)}</span></div>
        ))}
      </div>
      {perEvent.length > 0 && (
        <section aria-label="Profit per event" className="mx-card">
          <CardHead title="Profit per event" right="Invoice total minus spends" />
          {perEvent.map(e => (
            <div key={e.id} className="mx-row mn-pay">
              <span className="mx-sub">{e.billed ? 'Billed' : 'No invoice'}</span>
              <span>{e.name}</span>
              <span className="mode mx-sub">− {inr(e.spent)}</span>
              <span className={`r ${!e.billed ? '' : e.billed - e.spent >= 0 ? 'mx-green' : 'mx-red'}`}>{e.billed ? inr(e.billed - e.spent) : '—'}</span>
            </div>
          ))}
        </section>
      )}
      <section aria-label="Spends" className="mx-card">
        <CardHead title="Spends" right={<span className="mx-acts">
          <button type="button" className="ui-btn primary" onClick={onAdd}>+ Add a spend</button>
          <button type="button" className="ui-btn" onClick={onPaste}>Paste from Excel</button></span>} />
        {!list.length && <Empty title="No spends in these dates" text="Note groceries, cooks, gas and rent to see profit." />}
        {list.map(s => (
          <div key={s.id} className="mx-row" style={{ gridTemplateColumns: '70px minmax(0, 1fr) auto 44px' }}>
            <span className="mx-sub">{formatDateIST(s.spent_on, 'd MMM')}</span>
            <span className="mx-two-line"><b>{s.kind}</b><span>{[forText(s), SPEND_MODES.find(m => m[0] === s.mode)?.[1], s.note].filter(Boolean).join(' · ')}</span></span>
            <b>{inr(s.amount)}</b>
            <button type="button" className="iv-x" aria-label={`Delete ${s.kind} ${inr(s.amount)}`} onClick={() => remove(s)} disabled={del.isPending}>×</button>
          </div>
        ))}
      </section>
      <p className="mx-sub">Spends count on the day they were paid.</p>
    </>
  );
};

export default SpendsTab;
