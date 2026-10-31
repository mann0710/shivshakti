import React from 'react';
import { Page } from './navItems';

const TABS: { page: Page; label: string }[] = [
  { page: 'seasonal_items', label: 'Sweet items' },
  { page: 'seasonal_occasions', label: 'Occasions' },
  { page: 'seasonal_customers', label: 'Sweets customers' },
];

// Tabs shared by the three sweets list pages; they sit under "Sweet items" in the sidebar.
const SweetsTabs: React.FC<{ current: Page; onNavigate?: (p: Page) => void }> = ({ current, onNavigate }) => (
  <nav aria-label="Sweets lists" className="page-tabs">
    {TABS.map(t => (
      <button key={t.page} type="button" aria-current={t.page === current ? 'page' : undefined}
        className={t.page === current ? 'on' : ''} onClick={() => onNavigate?.(t.page)}>{t.label}</button>
    ))}
  </nav>
);

export default SweetsTabs;
