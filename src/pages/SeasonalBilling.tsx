import React, { useState } from 'react';
import { useSeasonalOrders } from '../hooks/useSeasonalOrders';
import { useSeasonalPreorders } from '../hooks/useSeasonalPreorders';
import { useSeasonalOccasions } from '../hooks/useSeasonalOccasions';
import { useDataCenter } from '../hooks/useDataCenter';
import PosTab, { EditTarget } from '../components/sessional/PosTab';
import OrdersTab from '../components/sessional/OrdersTab';
import PreordersTab from '../components/sessional/PreordersTab';
import ReportsTab from '../components/sessional/ReportsTab';
import DayCloseTab from '../components/pos/DayCloseTab';
import MigrationBanner from '../components/sessional/MigrationBanner';
import { isOpenPreorder } from '../lib/preorders';
import { unpaidCount } from '../lib/dues';
import type { Page } from '../components/navItems';
import { useNavIntent, canGoBack } from '../hooks/useNavIntent';
import { posStart, PosTabId as Tab } from '../lib/posIntent';

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

// Back to the screen that opened the POS, else Sweets today.
const leavePos = (onNavigate?: (page: Page) => void) => {
  if (canGoBack()) window.history.back();
  else if (onNavigate) onNavigate('seasonal_dashboard');
  else window.location.assign('#seasonal_dashboard');
};

// Sweet-shop billing: counter, bills, pre-bookings, day close and reports.
const SeasonalBilling: React.FC<{ onNavigate?: (page: Page) => void }> = ({ onNavigate }) => {
  // Links from other screens pick the tab, mode, customer or report.
  const intent = useNavIntent('seasonal_billing');
  const [start] = useState(() => posStart(intent));
  const [tab, setTab] = useState<Tab>(start.tab);
  // Bills and Pre-bookings stay mounted once opened, so filters and search survive an edit.
  const [seen, setSeen] = useState<Tab[]>([start.tab]);
  const open = (t: Tab) => { setTab(t); setSeen(s => (s.includes(t) ? s : [...s, t])); };
  const [year, setYear] = useState(currentYear);
  const [edit, setEdit] = useState<EditTarget | null>(null);
  const { data: occasions = [] } = useSeasonalOccasions(false);
  const { data: orders = [] } = useSeasonalOrders(year);
  const { data: preorders = [] } = useSeasonalPreorders(year);
  const { data: dc } = useDataCenter();

  const unpaid = unpaidCount(orders, preorders);
  const openPre = preorders.filter(isOpenPreorder).length;

  const startEdit = (target: EditTarget) => { setEdit(target); open('pos'); };
  const endEdit = (kind: 'bill' | 'preorder') => { setEdit(null); open(kind === 'bill' ? 'orders' : 'preorders'); };

  // [key, label, short label for phones, badge]
  const tabs: [Tab, string, string, number][] = [
    ['pos', edit ? 'Editing' : 'Counter', edit ? 'Editing' : 'Counter', 0],
    ['orders', 'Bills', 'Bills', unpaid],
    ['preorders', 'Pre-bookings', 'Pre-book', openPre],
    ['close', 'Day close', 'Close', 0],
    ['reports', 'Reports', 'Reports', 0],
  ];

  return (
    <div className={`sweets-pos${tab === 'pos' ? ' pos-screen' : ''}`}>
      <div className="page-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
          <button type="button" className="pos-back" aria-label="Leave the POS" onClick={() => leavePos(onNavigate)}>‹ Back</button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>Sweets POS</div>
            <div className="hide-sm" style={{ fontSize: 12, color: '#5A5A55', marginTop: 2 }}>Tap a box size to add it</div>
          </div>
        </div>
        {(tab === 'orders' || tab === 'preorders') && (
          <select style={{ border: '1px solid #D0D0CC', borderRadius: 8, padding: '5px 10px', minHeight: 44, fontSize: 13, background: '#fff' }}
            value={year} onChange={e => setYear(Number(e.target.value))} aria-label="Year">
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
      </div>

      <div className="ui-tabs" role="tablist">
        {tabs.map(([key, label, short, count]) => (
          <button key={key} role="tab" aria-selected={tab === key} aria-label={count ? `${label}, ${count}` : label}
            className={`ui-tab${tab === key ? ' on' : ''}`} onClick={() => open(key)}>
            <span className="pos-tab-long">{label}</span><span className="pos-tab-short">{short}</span>
            {count > 0 && <span className="count">{count}</span>}
          </button>
        ))}
      </div>

      <div className="page-content">
        <MigrationBanner />
        {tab === 'pos' && (
          <PosTab key={edit ? (edit.kind === 'bill' ? edit.order.id : edit.preorder.id) : 'new'}
            occasions={occasions} edit={edit} gst={dc?.gst_number} onEditDone={endEdit} start={start.tab === 'pos' ? start : undefined} />
        )}
        {seen.includes('orders') && (
          <div hidden={tab !== 'orders'}>
            <OrdersTab orders={orders} preorders={preorders} occasions={occasions} gst={dc?.gst_number} onEdit={order => startEdit({ kind: 'bill', order })}
              search={start.tab === 'orders' ? start.who?.phone || start.who?.name : undefined} />
          </div>
        )}
        {seen.includes('preorders') && (
          <div hidden={tab !== 'preorders'}>
            <PreordersTab preorders={preorders} occasions={occasions} gst={dc?.gst_number} onEdit={preorder => startEdit({ kind: 'preorder', preorder })}
              search={start.tab === 'preorders' ? start.who?.phone || start.who?.name : undefined} openId={start.openId} />
          </div>
        )}
        {tab === 'close' && <DayCloseTab />}
        {tab === 'reports' && <ReportsTab occasions={occasions} report={start.report} />}
      </div>
    </div>
  );
};

export default SeasonalBilling;
