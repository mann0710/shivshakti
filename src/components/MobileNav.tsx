import React from 'react';
import Modal from './ui/Modal';
import { Page, Role, SECTIONS, ROLES, navFor, pinnedFor } from './navItems';

interface Props {
  current: Page;
  role: Role;
  open: boolean;
  email?: string;
  onToggle: (open: boolean) => void;
  onNavigate: (page: Page) => void;
  onSignOut: () => void;
}

// Phone bottom bar plus the "More" sheet with every page, grouped like the sidebar.
const MobileNav: React.FC<Props> = ({ current, role, open, email, onToggle, onNavigate, onSignOut }) => {
  const items = navFor(role);
  // Pages outside the bar light up "More", so the bar always shows where you are.
  const inMore = !pinnedFor(role).some(i => i.page === current);
  const tile = (page: Page, label: string) => (
    <button key={page} type="button" className={`more-tile${current === page ? ' on' : ''}`} onClick={() => onNavigate(page)}>{label}</button>
  );
  return (
    <>
      <nav className="bottom-nav" aria-label="Main">
        {pinnedFor(role).map(item => (
          <button key={item.page} type="button" className={`bn-item${current === item.page ? ' active' : ''}`} aria-current={current === item.page ? 'page' : undefined} onClick={() => onNavigate(item.page)}>
            {item.label}
          </button>
        ))}
        <button type="button" className={`bn-item${open || inMore ? ' active' : ''}`} aria-expanded={open} onClick={() => onToggle(!open)}>More</button>
      </nav>
      {open && (
        <Modal title="More" onClose={() => onToggle(false)}>
          {SECTIONS.filter(section => items.some(i => i.section === section)).map(section => (
            <div key={section} style={{ marginBottom: 12 }}>
              <div className="more-head">{section === 'Main' ? 'Business' : section}</div>
              <div className="more-grid">{items.filter(i => i.section === section).map(i => tile(i.page, i.label))}</div>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderTop: '1px solid #F0EFEA', paddingTop: 12 }}>
            <span style={{ fontSize: 13, color: '#5A5A55', overflow: 'hidden', textOverflow: 'ellipsis' }}>{email} · {ROLES.find(r => r.id === role)?.label}</span>
            <button type="button" className="ui-btn" onClick={onSignOut}>Sign out</button>
          </div>
        </Modal>
      )}
    </>
  );
};

export default MobileNav;
