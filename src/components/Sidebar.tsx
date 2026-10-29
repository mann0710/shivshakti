import React from 'react';
import { Page, NAV_ITEMS, SECTIONS, NavItem as Item } from './navItems';

interface Props {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  email?: string;
  onSignOut?: () => void;
}

const sectionLabel: React.CSSProperties = { fontSize: 10, fontWeight: 600, color: '#AAAAAA', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '12px 10px 4px' };

const Sidebar: React.FC<Props> = ({ currentPage, onNavigate, email, onSignOut }) => (
  <aside className="app-sidebar">
    <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #E5E5E0' }}>
      <img
        src="/logo.png"
        alt="Shiv Shakti"
        style={{ height: 56, width: 'auto', display: 'block' }}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    </div>

    <nav style={{ flex: 1, padding: '4px 8px 12px', overflowY: 'auto' }}>
      {SECTIONS.map(section => (
        <React.Fragment key={section}>
          <div style={sectionLabel}>{section}</div>
          {NAV_ITEMS.filter(i => i.section === section).map(item => (
            <NavItem key={item.page} item={item} active={currentPage === item.page} onClick={() => onNavigate(item.page)} />
          ))}
        </React.Fragment>
      ))}
    </nav>

    <div style={{ padding: '12px 16px', borderTop: '0.5px solid #E5E5E0', fontSize: 11, color: '#AAAAAA' }}>
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={email}>{email || 'Shiv Shakti · v1.2'}</div>
      {onSignOut && <button type="button" onClick={onSignOut} style={{ marginTop: 6, background: 'none', border: 'none', color: '#A32D2D', fontSize: 11, cursor: 'pointer', padding: 0 }}>Sign out</button>}
    </div>
  </aside>
);

const NavItem: React.FC<{ item: Item; active: boolean; onClick: () => void }> = ({ item, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-current={active ? 'page' : undefined}
    style={{
      display: 'flex', alignItems: 'center', gap: 9, width: '100%', textAlign: 'left', border: 'none',
      padding: '7px 10px', borderRadius: 8, cursor: 'pointer',
      fontSize: 13, marginBottom: 1,
      background: active ? '#FFFFFF' : 'transparent',
      color: active ? '#1A1A18' : '#666660',
      fontWeight: active ? 500 : 400,
      boxShadow: active ? '0 0 0 0.5px #E5E5E0' : 'none',
    }}
  >
    <span style={{ width: 6, height: 6, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
    {item.label}
  </button>
);

export default Sidebar;
