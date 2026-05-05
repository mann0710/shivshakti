import React from 'react';
import { Page } from '../App';

interface Props {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const navItems: { page: Page; label: string; color: string }[] = [
  { page: 'dashboard', label: 'Dashboard', color: '#E8750A' },
  { page: 'bookings', label: 'Bookings', color: '#378ADD' },
  { page: 'customers', label: 'Customers', color: '#639922' },
  { page: 'menus', label: 'Menus & Packages', color: '#7F77DD' },
  { page: 'billing', label: 'Billing', color: '#BA7517' },
  { page: 'finance', label: 'Finance & Analytics', color: '#0F6E56' },
  { page: 'calendar', label: 'Calendar', color: '#D4537E' },
];

const Sidebar: React.FC<Props> = ({ currentPage, onNavigate }) => {
  return (
    <aside style={{
      width: 210, minWidth: 210, background: '#FAFAF8',
      borderRight: '0.5px solid #E5E5E0', display: 'flex',
      flexDirection: 'column', height: '100vh'
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 18px 14px', borderBottom: '0.5px solid #E5E5E0' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#1A1A18' }}>🍽 CaterPro</div>
        <div style={{ fontSize: 11, color: '#888880', marginTop: 2 }}>Business Manager</div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#AAAAAA', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '8px 10px 4px' }}>Main</div>
        {navItems.slice(0, 3).map(item => (
          <NavItem key={item.page} item={item} active={currentPage === item.page} onClick={() => onNavigate(item.page)} />
        ))}
        <div style={{ fontSize: 10, fontWeight: 600, color: '#AAAAAA', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '12px 10px 4px' }}>Operations</div>
        {navItems.slice(3).map(item => (
          <NavItem key={item.page} item={item} active={currentPage === item.page} onClick={() => onNavigate(item.page)} />
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 16px', borderTop: '0.5px solid #E5E5E0', fontSize: 11, color: '#AAAAAA' }}>
        Sharma Caterers · v1.0
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
    {item.page === 'finance' && (
      <span style={{ marginLeft: 'auto', background: '#EAF3DE', color: '#3B6D11', fontSize: 9, padding: '1px 6px', borderRadius: 20, fontWeight: 600 }}>New</span>
    )}
  </div>
);

export default Sidebar;
