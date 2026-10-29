import React, { useState } from 'react';
import { useSeasonalOrders } from '../hooks/useSeasonalOrders';
import { useSeasonalPreorders } from '../hooks/useSeasonalPreorders';
import { useSeasonalOccasions } from '../hooks/useSeasonalOccasions';
import { useDataCenter } from '../hooks/useDataCenter';
import PosTab, { EditTarget } from '../components/sessional/PosTab';
import OrdersTab from '../components/sessional/OrdersTab';
import PreordersTab from '../components/sessional/PreordersTab';
import ReportsTab from '../components/sessional/ReportsTab';
import MigrationBanner from '../components/sessional/MigrationBanner';

type Tab = 'pos' | 'orders' | 'preorders' | 'reports';

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

// Sweet-shop billing: POS grid, bills, pre-bookings and reports.
const SeasonalBilling: React.FC = () => {
  const [tab, setTab] = useState<Tab>('pos');
  const [year, setYear] = useState(currentYear);
  const [edit, setEdit] = useState<EditTarget | null>(null);
  const { data: occasions = [] } = useSeasonalOccasions(false);
  const { data: orders = [] } = useSeasonalOrders(year);
  const { data: preorders = [] } = useSeasonalPreorders(year);
  const { data: dc } = useDataCenter();

  const unpaid = orders.filter(o => !o.is_paid).length;
  const openPre = preorders.filter(p => p.status === 'pending' || p.status === 'confirmed').length;

  const startEdit = (target: EditTarget) => { setEdit(target); setTab('pos'); };
  const endEdit = (kind: 'bill' | 'preorder') => { setEdit(null); setTab(kind === 'bill' ? 'orders' : 'preorders'); };

  const tabs: [Tab, string, number][] = [
    ['pos', edit ? '✏️ Editing' : '🧾 POS', 0],
    ['orders', 'Bills', unpaid],
    ['preorders', 'Pre-bookings', openPre],
    ['reports', 'Reports', 0],
  ];

  return (
    <div>
      <div className="page-topbar">
        <div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Sweets POS</div>
          <div style={{ fontSize: 11, color: '#888880', marginTop: 2 }}>Sessional billing · tap a pack size to add it</div>
        </div>
        {tab !== 'pos' && (
          <select style={{ border: '0.5px solid #D0D0CC', borderRadius: 7, padding: '5px 10px', fontSize: 13, background: '#fff' }}
            value={year} onChange={e => setYear(Number(e.target.value))} aria-label="Year">
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
      </div>

      <div className="ui-tabs" role="tablist">
        {tabs.map(([key, label, count]) => (
          <button key={key} role="tab" aria-selected={tab === key} className={`ui-tab${tab === key ? ' on' : ''}`} onClick={() => setTab(key)}>
            {label}{count > 0 && <span className="count">{count}</span>}
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
          <OrdersTab orders={orders} occasions={occasions} gst={dc?.gst_number} onEdit={order => startEdit({ kind: 'bill', order })} />
        )}
        {tab === 'preorders' && (
          <PreordersTab preorders={preorders} occasions={occasions} gst={dc?.gst_number} onEdit={preorder => startEdit({ kind: 'preorder', preorder })} />
        )}
        {tab === 'reports' && <ReportsTab year={year} orders={orders} preorders={preorders} occasions={occasions} />}
      </div>
    </div>
  );
};

export default SeasonalBilling;
