import React, { useMemo, useState } from 'react';
import { useCreditData, useHasCredit, CREDIT_MIGRATION_FILE } from '../../hooks/useCredit';
import { useMyRole } from '../../hooks/useMyRole';
import { useSeasonalCustomers } from '../../hooks/useSeasonalCustomers';
import { useStoredState } from '../../hooks/useStoredState';
import { Account } from '../../lib/credit/accounts';
import { Filter, Sort, counts, matches, search, sortAccounts, tabTotals, ageSplit } from '../../lib/credit/view';
import { Lang } from '../../lib/credit/types';
import { plural } from '../../lib/credit/dates';
import { creditStatementDoc } from '../../lib/docs/creditStatement';
import { downloadDoc } from '../../lib/docs/output';
import { inr } from '../../lib/money';
import CreditList from './CreditList';
import CreditPanel, { PanelAction } from './CreditPanel';
import ReceiveDialog from './ReceiveDialog';
import { PromiseDialog, CallDialog } from './FollowDialogs';
import { SettingsDialog, WriteOffDialog, OpeningDialog } from './AccountDialogs';
import { RemindDialog, RemindRound } from './RemindDialogs';
import { useCreditActions } from './useCreditActions';
import './credit.css';

type Who = { name: string; phone: string };
type Dialog = { k: PanelAction | 'opening' | 'round'; a?: Account } | null;

interface Props { onBill: (who: Who) => void; onCustomer: (id?: string) => void; search?: string }

const EMPTY: Record<Filter, string> = {
  today: 'Nobody to follow up today.', late: 'Nothing overdue.', promised: 'No open promises.', disputed: 'No disputes.',
  owing: 'Nobody owes you anything.', advance: 'Nobody has an advance with you.', settled: 'No settled accounts yet.',
};

// POS › Credit: who owes, follow-ups, and one customer's account with every action.
const CreditTab: React.FC<Props> = ({ onBill, onCustomer, search: startQ }) => {
  const { accounts, settings, today, loading, error } = useCreditData();
  const ready = useHasCredit();
  const { isOwner } = useMyRole();
  const { data: customers = [] } = useSeasonalCustomers();
  const act = useCreditActions();
  const [stored, setStored] = useStoredState<{ filter: Filter; sort: Sort }>('shivshakti.creditView', () => ({ filter: 'today', sort: 'follow' }));
  const [q, setQ] = useState(startQ ?? '');
  const [picked, setPicked] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [dlg, setDlg] = useState<Dialog>(null);

  const c = useMemo(() => counts(search(accounts, q)), [accounts, q]);
  // An empty "today" opens on everyone owing instead.
  const filter: Filter = stored.filter === 'today' && !c.today && c.owing ? 'owing' : stored.filter;
  // A search looks through everyone, whatever the filter.
  const rows = useMemo(() => sortAccounts(q.trim() ? search(accounts, q) : accounts.filter(a => matches(a, filter)), stored.sort), [accounts, q, filter, stored.sort]);
  const t = useMemo(() => tabTotals(accounts, today), [accounts, today]);
  const ages = useMemo(() => ageSplit(accounts.filter(a => a.owed > 0), today), [accounts, today]);
  const current = accounts.find(a => a.phone === picked) ?? rows[0];
  const dueToday = accounts.filter(a => matches(a, 'today') && a.owed > 0);
  const langOf = (a: Account): Lang => a.settings?.lang ?? settings.lang;
  const statement = (a: Account) => downloadDoc(() => creditStatementDoc(a, today));

  const onAction = (k: PanelAction, a = current) => {
    if (!a) return;
    if (k === 'statement') return void statement(a);
    if (k === 'advance') return void act.payFromAdvance(a);
    if (k === 'bill') return onBill({ name: a.name, phone: a.phone });
    if (k === 'customer') return onCustomer(customers.find(x => (x.phone ?? '').endsWith(a.phone))?.id);
    setDlg({ k, a });
  };

  const empty = (
    <div className="cr-empty">
      {accounts.length ? <b>{EMPTY[filter]}</b> : (
        <>
          <b>Nobody owes you anything yet.</b>
          <span>Pick <b>Credit</b> as the way to pay at the counter, or add an old balance from your paper register.</span>
          {ready && <button type="button" className="ui-btn primary" onClick={() => setDlg({ k: 'opening' })}>+ Add old balance</button>}
        </>
      )}
    </div>
  );

  const a = dlg?.a;
  return (
    <div className="cr-page" data-view={view}>
      {!ready && !loading && (
        <div className="pos-note">Credit limits, promises, call notes and old balances turn on after running <code>{CREDIT_MIGRATION_FILE}</code> in Supabase. Bills on credit already show here.</div>
      )}
      {error && <div className="pos-note" role="alert">Could not load everything. Pull down or reopen the tab to try again.</div>}
      <div className="cr-head">
        <span className="grow">{loading ? 'Loading…' : `${plural(t.people, 'customer')} owe ${inr(t.owed)}${t.advance ? ` · ${inr(t.advance)} advance with you` : ''}`}</span>
        {dueToday.length > 0 && <button type="button" className="ui-btn" onClick={() => setDlg({ k: 'round' })}>Remind all due today · {dueToday.length}</button>}
        {ready && <button type="button" className="ui-btn primary" onClick={() => setDlg({ k: 'opening' })}>+ Add old balance</button>}
      </div>
      <div className="cr-tiles">
        <div className="cr-tile"><small>To collect</small><b className="cr-red">{inr(t.owed)}</b><span>{plural(t.people, 'customer')}{t.oldest ? ` · oldest ${plural(t.oldest, 'day')}` : ''}</span></div>
        <div className="cr-tile"><small>Follow up today</small><b className="cr-amber">{plural(t.follow, 'customer')}</b><span>{inr(t.followOwed)}{t.broken ? ` · ${t.broken} missed promise${t.broken > 1 ? 's' : ''}` : ''} · disputed left out</span></div>
        <div className="cr-tile"><small>Given on credit this month</small><b>{inr(t.given)}</b><span>{plural(t.givenCount, 'bill')}</span></div>
        <div className="cr-tile"><small>Got back this month</small><b className="cr-green">{inr(t.got.total)}</b><span>Cash {inr(t.got.cash)} · UPI {inr(t.got.upi)}</span></div>
      </div>
      <div className="cr-layout">
        <CreditList rows={rows} counts={c} ages={ages} filter={filter} sort={stored.sort} q={q} selected={current?.phone} today={today} empty={empty}
          onFilter={f => setStored({ ...stored, filter: f })} onSort={s => setStored({ ...stored, sort: s })} onSearch={setQ}
          onSelect={x => { setPicked(x.phone); setView('detail'); }} onRemind={x => setDlg({ k: 'remind', a: x })} onReceive={x => setDlg({ k: 'receive', a: x })} />
        {current && <CreditPanel a={current} today={today} owner={isOwner} ready={ready} onAction={k => onAction(k)} onUndo={e => act.undo(current, e)} onBack={() => setView('list')} />}
      </div>

      {a && dlg?.k === 'receive' && <ReceiveDialog a={a} today={today} owner={isOwner} onClose={() => setDlg(null)} onReceive={r => act.receive(a, r)} />}
      {a && dlg?.k === 'promise' && <PromiseDialog a={a} today={today} onClose={() => setDlg(null)} onSave={(d, amt, n) => act.promise(a, d, amt, n)} />}
      {a && dlg?.k === 'call' && <CallDialog a={a} today={today} onClose={() => setDlg(null)} onSave={(o, n) => act.call(a, o, n)} onPromise={() => setDlg({ k: 'promise', a })} />}
      {a && dlg?.k === 'settings' && <SettingsDialog a={a} shop={settings} onClose={() => setDlg(null)} onSave={p => act.saveAccount(a, p)} />}
      {a && dlg?.k === 'writeoff' && <WriteOffDialog a={a} onClose={() => setDlg(null)} onSave={(amt, bad, why) => act.writeOff(a, amt, bad, why)} />}
      {a && dlg?.k === 'remind' && <RemindDialog a={a} lang={langOf(a)} textFor={act.reminderFor} onSend={act.remind} onStatement={() => statement(a)} onClose={() => setDlg(null)} />}
      {dlg?.k === 'round' && <RemindRound list={dueToday} textFor={act.reminderFor} langOf={langOf} onSend={act.remind} onClose={() => setDlg(null)} />}
      {dlg?.k === 'opening' && <OpeningDialog people={customers.map(x => ({ name: x.name, phone: x.phone ?? '' })).filter(x => x.phone)} today={today} shop={settings}
        onClose={() => setDlg(null)} onSave={o => act.addOpening(o)} />}
    </div>
  );
};

export default CreditTab;
