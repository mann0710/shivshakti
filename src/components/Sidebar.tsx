import React from 'react';
import { Page } from '../App';

interface Props {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const navItems: { page: Page; label: string; color: string }[] = [
  // Main (0-4)
  { page: 'dashboard',   label: 'Dashboard',          color: '#E8750A' },
  { page: 'customers',   label: 'Customers',           color: '#639922' },
  { page: 'bookings',    label: 'Bookings',            color: '#378ADD' },
  { page: 'quotations',  label: 'Quotations',          color: '#1ABC9C' },
  { page: 'billing',     label: 'Billing',             color: '#BA7517' },
  // Operations (5-8)
  { page: 'menubuilder', label: 'Menu Builder',        color: '#9B59B6' },
  { page: 'menus',       label: 'Packages',            color: '#7F77DD' },
  { page: 'finance',     label: 'Finance & Analytics', color: '#0F6E56' },
  { page: 'calendar',    label: 'Calendar',            color: '#D4537E' },
  // Settings (9)
  { page: 'datacenter',          label: 'Data Center',        color: '#888880' },
  // Sessional (10-13)
  { page: 'seasonal_dashboard',  label: 'Sessional Dashboard', color: '#7B1FA2' },
  { page: 'seasonal_occasions',  label: 'Occasions',           color: '#C0392B' },
  { page: 'seasonal_items',      label: 'Sessional Items',     color: '#E67E22' },
  { page: 'seasonal_billing',    label: 'Sessional Billing',   color: '#D4537E' },
  { page: 'seasonal_customers',  label: 'Sess. Customers',     color: '#00897B' },
];

const Sidebar: React.FC<Props> = ({ currentPage, onNavigate }) => {
  return (
    <aside className="app-sidebar">
      <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #E5E5E0' }}>
        <img
          src="/logo.png"
          alt="Shiv Shakti"
          style={{ height: 56, width: 'auto', display: 'block' }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      </div>

      <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#AAAAAA', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '8px 10px 4px' }}>Main</div>
        {navItems.slice(0, 5).map(item => (
          <NavItem key={item.page} item={item} active={currentPage === item.page} onClick={() => onNavigate(item.page)} />
        ))}
        <div style={{ fontSize: 10, fontWeight: 600, color: '#AAAAAA', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '12px 10px 4px' }}>Operations</div>
        {navItems.slice(5, 9).map(item => (
          <NavItem key={item.page} item={item} active={currentPage === item.page} onClick={() => onNavigate(item.page)} />
        ))}
        <div style={{ fontSize: 10, fontWeight: 600, color: '#AAAAAA', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '12px 10px 4px' }}>Settings</div>
        {navItems.slice(9, 10).map(item => (
          <NavItem key={item.page} item={item} active={currentPage === item.page} onClick={() => onNavigate(item.page)} />
        ))}
        <div style={{ fontSize: 10, fontWeight: 600, color: '#AAAAAA', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '12px 10px 4px' }}>Sessional</div>
        {navItems.slice(10).map(item => (
          <NavItem key={item.page} item={item} active={currentPage === item.page} onClick={() => onNavigate(item.page)} />
        ))}
      </nav>

      <div style={{ padding: '12px 16px', borderTop: '0.5px solid #E5E5E0', fontSize: 11, color: '#AAAAAA' }}>
        Shiv Shakti · v1.0
      </div>
    </aside>
  );
};

const NavItem: React.FC<{ item: typeof navItems[0]; active: boolean; onClick: () => void }> = ({ item, active, onClick }) => (
  <div
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', gap: 9,
      padding: '7px 10px', borderRadius: 8, cursor: 'pointer',
      fontSize: 13, marginBottom: 1,
      background: active ? '#FFFFFF' : 'transparent',
      color: active ? '#1A1A18' : '#666660',
      fontWeight: active ? 500 : 400,
      boxShadow: active ? '0 0 0 0.5px #E5E5E0' : 'none',
    }}
  >
    <div style={{ width: 6, height: 6, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
    {item.label}
  </div>
);

export default Sidebar;
