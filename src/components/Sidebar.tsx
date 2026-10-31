import React from 'react';
import { Page, Role, ROLES, navFor, NavItem as Item } from './navItems';
import { useDocSettings } from '../hooks/useDocSettings';

interface Props {
  currentPage: Page;
  role: Role;
  onNavigate: (page: Page) => void;
  email?: string;
  onSignOut?: () => void;
}

const head: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#6B6B66', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '14px 10px 4px' };

const Sidebar: React.FC<Props> = ({ currentPage, role, onNavigate, email, onSignOut }) => {
  const logo = useDocSettings().logo_url || '/logo.png';
  const items = navFor(role);
  const group = (s: Item['section']) => items.filter(i => i.section === s);
  const link = (item: Item) => <NavItem key={item.page} item={item} active={currentPage === item.page} onClick={() => onNavigate(item.page)} />;
  const section = (s: Item['section'], title: string) => (group(s).length ? <><div style={head}>{title}</div>{group(s).map(link)}</> : null);
  return (
    <aside className="app-sidebar">
      <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #E5E5E0' }}>
        <img src={logo} alt="Shiv Shakti" style={{ height: 56, maxWidth: '100%', width: 'auto', objectFit: 'contain', display: 'block' }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      </div>
      <nav aria-label="Main" style={{ flex: 1, padding: '8px 8px 12px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {group('Main').map(link)}
        {section('Catering', 'Catering')}
        {section('Sweets', 'Sweets')}
        <span style={{ flex: 1, minHeight: 12 }} />
        {group('Settings').map(link)}
      </nav>
      <div style={{ padding: '10px 16px 14px', borderTop: '0.5px solid #E5E5E0', fontSize: 12, color: '#5A5A55' }}>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={email}>{email || 'Shiv Shakti'}</div>
        <div style={{ color: '#6B6B66' }}>{ROLES.find(r => r.id === role)?.label}</div>
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
