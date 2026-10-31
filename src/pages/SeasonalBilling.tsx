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
import { useNavIntent } from '../hooks/useNavIntent';

type Tab = 'pos' | 'orders' | 'preorders' | 'close' | 'reports';

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

// Phones: leave the POS for Home (the app handles the hash change like a Back press).
const leavePos = (onNavigate?: (page: Page) => void) => (onNavigate ? onNavigate('dashboard') : window.location.assign('#dashboard'));

// Sweet-shop billing: counter, bills, pre-bookings, day close and reports.
const SeasonalBilling: React.FC<{ onNavigate?: (page: Page) => void }> = ({ onNavigate }) => {
  // Links from Sweets today can open Reports or Pre-bookings directly.
  const intent = useNavIntent('seasonal_billing');
  const [tab, setTab] = useState<Tab>(() => (intent?.id === 'reports' ? 'reports' : intent?.id === 'preorders' ? 'preorders' : 'pos'));
  const [year, setYear] = useState(currentYear);
  const [edit, setEdit] = useState<EditTarget | null>(null);
  const { data: occasions = [] } = useSeasonalOccasions(false);
  const { data: orders = [] } = useSeasonalOrders(year);
  const { data: preorders = [] } = useSeasonalPreorders(year);
  const { data: dc } = useDataCenter();

  const unpaid = unpaidCount(orders, preorders);
  const openPre = preorders.filter(isOpenPreorder).length;

  const startEdit = (target: EditTarget) => { setEdit(target); setTab('pos'); };
  const endEdit = (kind: 'bill' | 'preorder') => { setEdit(null); setTab(kind === 'bill' ? 'orders' : 'preorders'); };

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
            className={`ui-tab${tab === key ? ' on' : ''}`} onClick={() => setTab(key)}>
            <span className="pos-tab-long">{label}</span><span className="pos-tab-short">{short}</span>
            {count > 0 && <span className="count">{count}</span>}
          </button>
        ))}
      </div>

      <div className="page-content">
        <MigrationBanner />
        {tab === 'pos' && (
          <PosTab key={edit ? (edit.kind === 'bill' ? edit.order.id : edit.preorder.id) : 'new'}
            occasions={occasions} edit={edit} gst={dc?.gst_number} onEditDone={endEdit} />
        )}
        {tab === 'orders' && (
          <OrdersTab orders={orders} preorders={preorders} occasions={occasions} gst={dc?.gst_number} onEdit={order => startEdit({ kind: 'bill', order })} />
        )}
        {tab === 'preorders' && (
          <PreordersTab preorders={preorders} occasions={occasions} gst={dc?.gst_number} onEdit={preorder => startEdit({ kind: 'preorder', preorder })} />
        )}
        {tab === 'close' && <DayCloseTab />}
        {tab === 'reports' && <ReportsTab occasions={occasions} />}
      </div>
    </div>
  );
};

export default SeasonalBilling;
