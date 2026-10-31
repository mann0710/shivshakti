import React, { useMemo, useState } from 'react';
import { Navigate } from '../hooks/useNavIntent';
import { useSeasonalOccasions } from '../hooks/useSeasonalOccasions';
import { todayIST, formatDateIST } from '../lib/ist';
import { inr } from '../lib/money';
import { Range } from '../lib/reports/model';
import { Period, periodRange, seasonRange, receiptsIn, receivedSummary, debtsOf, comingIn, monthBars, fyStart, sumOf } from '../lib/moneyView';
import { spendsIn } from '../lib/spends';
import { useMoneyData, useSpends } from '../components/money/useMoneyData';
import { useCollect } from '../components/money/useCollect';
import { Tile, LoadError, Skeleton, useNow, istClock } from '../components/money/MoneyUi';
import { CollectCard, ComingIn } from '../components/money/MoneyCards';
import { MonthBars, PaymentsCard, ProfitCard } from '../components/money/MoneyCharts';
import PeriodPicker from '../components/money/PeriodPicker';
import SpendsTab from '../components/money/SpendsTab';
import { SpendModal, SpendPaste } from '../components/money/SpendDialogs';
import CaExportModal from '../components/money/CaExportModal';
import ReportsTab from '../components/sessional/ReportsTab';

type Tab = 'overview' | 'reports' | 'spends';
const TABS: [Tab, string][] = [['overview', 'Overview'], ['reports', 'Reports'], ['spends', 'Spends']];

// Money: what came in, who owes, what is coming, spends and the CA download; catering and sweets together.
const Finance: React.FC<{ onNavigate?: Navigate }> = ({ onNavigate }) => {
  const { data, loading, error, retry } = useMoneyData();
  const spendsQuery = useSpends();
  // undefined while loading, null until the spends update is run
  const spends = spendsQuery.data === undefined ? [] : spendsQuery.data;
  const { data: occasions = [] } = useSeasonalOccasions();
  const now = useNow();
  const today = todayIST();
  const [tab, setTab] = useState<Tab>('overview');
  const [period, setPeriod] = useState<Period>('year');
  const [custom, setCustom] = useState<Range>({ from: `${today.slice(0, 7)}-01`, to: today });
  const [dlg, setDlg] = useState<'spend' | 'paste' | 'ca' | null>(null);
  const collect = useCollect(data);

  const season = useMemo(() => seasonRange(occasions, today), [occasions, today]);
  const range = useMemo(() => periodRange(period, today, season, custom), [period, today, season, custom]);
  const receipts = useMemo(() => receiptsIn(data, range), [data, range]);
  const got = receivedSummary(receipts);
  const debts = useMemo(() => debtsOf(data, today), [data, today]);
  const coming = useMemo(() => comingIn(data, today), [data, today]);
  const bars = useMemo(() => monthBars(data, fyStart(range.to)), [data, range.to]);
  const owed = sumOf(debts, d => d.amount);
  const people = new Set(debts.map(d => `${d.name}|${d.phone}`)).size;
  const oldest = debts[0]?.days ?? 0;
  const goInvoices = onNavigate ? () => onNavigate('billing') : undefined;

  const links = (
    <span className="mn-phone-only" style={{ fontSize: 13, fontWeight: 600 }}>
      <button type="button" className="mx-link" onClick={() => setTab('reports')}>Reports</button> · <button type="button" className="mx-link" onClick={() => setTab('spends')}>Spends</button>
    </span>
  );

  return (
    <div className="mx-page">
      <div className="mx-head">
        <div className="mx-head-l">
          <h1>Money</h1>
          <nav aria-label="Money views" className="page-tabs">
            {TABS.map(([t, label]) => <button key={t} type="button" className={tab === t ? 'on' : ''} aria-current={tab === t ? 'page' : undefined} onClick={() => setTab(t)}>{label}</button>)}
          </nav>
          <span className="mx-sub">
            <span className="mx-wide-inline">Catering and sweets together · cancelled bookings left out · </span>
            As of {formatDateIST(today, 'EEE d MMM')}, {istClock(now)}
          </span>
        </div>
        {tab !== 'reports' && (
          <div className="mx-head-r">
            <PeriodPicker value={period} onChange={setPeriod} custom={custom} onCustom={setCustom} seasonName={season?.name} />
            <button type="button" className="ui-btn mn-desk-only" onClick={() => setDlg('ca')} disabled={loading}>Download for CA</button>
          </div>
        )}
      </div>

      {error && <LoadError onRetry={retry} />}
      {tab === 'reports' && <ReportsTab occasions={occasions} />}
      {tab === 'spends' && <SpendsTab spends={spends} range={range} bookings={data.bookings} invoices={data.invoices}
        onAdd={() => setDlg('spend')} onPaste={() => setDlg('paste')} />}
      {tab === 'overview' && (loading ? <><Skeleton rows={2} /><Skeleton rows={3} /></> : (
        <>
          <div className="mx-tiles">
            <Tile label="Received" value={inr(got.total)} tone="green" note={`Catering ${inr(got.catering)} · sweets ${inr(got.sweets)}`} />
            <Tile label="To collect" value={inr(owed)} tone="red" note={owed ? `${people} ${people === 1 ? 'person' : 'people'} · oldest ${oldest} days` : 'All money is in'} />
            <Tile label="Booked, not invoiced" value={inr(coming.booked.value)} note={`${coming.booked.count} confirmed event${coming.booked.count === 1 ? '' : 's'}`} onClick={goInvoices} />
            <Tile label="Past events, no invoice" value={inr(coming.past.value)} tone="amber" note={`${coming.past.count} events quoted · settle or invoice`} onClick={goInvoices} />
          </div>
          <div className="mn-split">
            <CollectCard debts={debts} onRemind={collect.remind} onRecord={collect.record} />
            <ComingIn c={coming} links={links} />
          </div>
          <div className="mn-split stretch">
            <MonthBars bars={bars} from={fyStart(range.to)} />
            <ProfitCard spends={spends && spendsIn(spends, range)} received={got.total} onAdd={() => setDlg('spend')} onPaste={() => setDlg('paste')} />
          </div>
          <PaymentsCard list={receipts} />
        </>
      ))}

      {dlg === 'spend' && <SpendModal bookings={data.bookings} onClose={() => setDlg(null)} />}
      {dlg === 'paste' && <SpendPaste bookings={data.bookings} onClose={() => setDlg(null)} />}
      {dlg === 'ca' && <CaExportModal data={data} spends={spends} onClose={() => setDlg(null)} />}
      {collect.ui}
    </div>
  );
};

export default Finance;
