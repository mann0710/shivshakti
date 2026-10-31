import React from 'react';
import { Page, NAV_ITEMS, NavItem as Item } from './navItems';

interface Props {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  email?: string;
  onSignOut?: () => void;
}

const head: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#6B6B66', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '14px 10px 4px' };
const group = (s: Item['section']) => NAV_ITEMS.filter(i => i.section === s);

const Sidebar: React.FC<Props> = ({ currentPage, onNavigate, email, onSignOut }) => {
  const link = (item: Item) => <NavItem key={item.page} item={item} active={currentPage === item.page} onClick={() => onNavigate(item.page)} />;
  return (
    <aside className="app-sidebar">
      <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #E5E5E0' }}>
        <img src="/logo.png" alt="Shiv Shakti" style={{ height: 56, width: 'auto', display: 'block' }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      </div>
      <nav aria-label="Main" style={{ flex: 1, padding: '8px 8px 12px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {group('Main').map(link)}
        <div style={head}>Catering</div>
        {group('Catering').map(link)}
        <div style={head}>Sweets</div>
        {group('Sweets').map(link)}
        <span style={{ flex: 1, minHeight: 12 }} />
        {group('Settings').map(link)}
      </nav>
      <div style={{ padding: '10px 16px 14px', borderTop: '0.5px solid #E5E5E0', fontSize: 12, color: '#5A5A55' }}>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={email}>{email || 'Shiv Shakti'}</div>
        {onSignOut && <button type="button" onClick={onSignOut} style={{ marginTop: 4, background: 'none', border: 'none', color: '#8A4B00', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: '6px 0' }}>Sign out</button>}
      </div>
    </aside>
  );
};

const NavItem: React.FC<{ item: Item; active: boolean; onClick: () => void }> = ({ item, active, onClick }) => (
  <button type="button" onClick={onClick} aria-current={active ? 'page' : undefined}
    style={{
      display: 'block', width: '100%', textAlign: 'left', border: 'none', padding: '9px 10px', borderRadius: 8, cursor: 'pointer',
      fontSize: 14, marginBottom: 1, background: active ? '#FFF1E3' : 'transparent', color: active ? '#1A1A18' : '#4A4A45', fontWeight: active ? 600 : 400,
    }}>
    {item.label}
  </button>
);

export default Sidebar;
