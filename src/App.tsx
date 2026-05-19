import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Bookings from './pages/Bookings';
import Customers from './pages/Customers';
import Menus from './pages/Menus';
import Billing from './pages/Billing';
import Finance from './pages/Finance';
import CalendarPage from './pages/CalendarPage';
import DataCenter from './pages/DataCenter';
import MenuBuilder from './pages/MenuBuilder';
import Quotations from './pages/Quotations';
import SeasonalItems from './pages/SeasonalItems';
import SeasonalBilling from './pages/SeasonalBilling';

const queryClient = new QueryClient();

export type Page = 'dashboard' | 'bookings' | 'customers' | 'menus' | 'billing' | 'finance' | 'calendar' | 'datacenter' | 'menubuilder' | 'quotations' | 'seasonal_items' | 'seasonal_billing';

// 3 pinned items in bottom nav
const pinnedNav: { page: Page; icon: string; label: string }[] = [
  { page: 'dashboard',  icon: '🏠', label: 'Home' },
  { page: 'quotations', icon: '📝', label: 'Quotes' },
  { page: 'calendar',   icon: '📅', label: 'Calendar' },
];

// All pages shown in hamburger drawer
const allNavItems: { page: Page; icon: string; label: string; section: string }[] = [
  { page: 'dashboard',   icon: '🏠', label: 'Dashboard',          section: 'Main' },
  { page: 'customers',   icon: '👥', label: 'Customers',           section: 'Main' },
  { page: 'bookings',    icon: '📋', label: 'Bookings',            section: 'Main' },
  { page: 'quotations',  icon: '📝', label: 'Quotations',          section: 'Main' },
  { page: 'billing',     icon: '🧾', label: 'Billing',             section: 'Main' },
  { page: 'menubuilder', icon: '🏗', label: 'Menu Builder',        section: 'Operations' },
  { page: 'menus',       icon: '🍽', label: 'Packages',            section: 'Operations' },
  { page: 'finance',     icon: '📊', label: 'Finance & Analytics', section: 'Operations' },
  { page: 'calendar',    icon: '📅', label: 'Calendar',            section: 'Operations' },
  { page: 'datacenter',      icon: '⚙️', label: 'Data Center',         section: 'Settings' },
  { page: 'seasonal_items',   icon: '🪔', label: 'Festival Items',      section: 'Festival' },
  { page: 'seasonal_billing', icon: '🍬', label: 'Festival Billing',    section: 'Festival' },
];

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const navigate = (page: Page) => {
    setCurrentPage(page);
    setShowMobileMenu(false);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':   return <Dashboard onNavigate={navigate} />;
      case 'bookings':    return <Bookings />;
      case 'customers':   return <Customers onNavigate={navigate} />;
      case 'menus':       return <Menus />;
      case 'billing':     return <Billing />;
      case 'finance':     return <Finance />;
      case 'calendar':    return <CalendarPage />;
      case 'datacenter':  return <DataCenter />;
      case 'menubuilder': return <MenuBuilder />;
      case 'quotations':        return <Quotations />;
      case 'seasonal_items':   return <SeasonalItems />;
      case 'seasonal_billing': return <SeasonalBilling />;
      default:                  return <Dashboard onNavigate={navigate} />;
    }
  };

  // Group allNavItems by section for drawer
  const sections = ['Main', 'Operations', 'Festival', 'Settings'];

  return (
    <QueryClientProvider client={queryClient}>
      <div className="app-layout">
        <Sidebar currentPage={currentPage} onNavigate={navigate} />
        <main className="app-main">
          {renderPage()}
        </main>
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav className="bottom-nav">
        {pinnedNav.map(item => (
          <div
            key={item.page}
            className={`bn-item${currentPage === item.page ? ' active' : ''}`}
            onClick={() => navigate(item.page)}
          >
            <span className="bn-icon">{item.icon}</span>
            <span className="bn-label">{item.label}</span>
            {currentPage === item.page && <span className="bn-dot" />}
          </div>
        ))}
        {/* Hamburger */}
        <div
          className={`bn-item${showMobileMenu ? ' active' : ''}`}
          onClick={() => setShowMobileMenu(v => !v)}
        >
          <span className="bn-icon" style={{ fontSize: 18, lineHeight: 1 }}>☰</span>
          <span className="bn-label">More</span>
        </div>
      </nav>

      {/* ── Mobile full-nav drawer ── */}
      {showMobileMenu && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setShowMobileMenu(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200 }}
          />
          {/* Drawer slides up from bottom */}
          <div style={{
            position: 'fixed', bottom: 56, left: 0, right: 0, zIndex: 201,
            background: '#fff', borderRadius: '16px 16px 0 0',
            boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
            padding: '16px 12px 8px', maxHeight: '70vh', overflowY: 'auto',
          }}>
            {/* Handle bar */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E0E0DA', margin: '0 auto 16px' }} />

            {sections.map(section => {
              const items = allNavItems.filter(i => i.section === section);
              return (
                <div key={section} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#AAAAAA', letterSpacing: '0.07em', textTransform: 'uppercase', padding: '2px 8px 6px' }}>
                    {section}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {items.map(item => (
                      <div
                        key={item.page}
                        onClick={() => navigate(item.page)}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center',
                          gap: 4, padding: '10px 6px', borderRadius: 10, cursor: 'pointer',
                          background: currentPage === item.page ? '#FFF3E8' : '#F9F8F5',
                          border: currentPage === item.page ? '1px solid #E8750A' : '1px solid transparent',
                        }}
                      >
                        <span style={{ fontSize: 20 }}>{item.icon}</span>
                        <span style={{ fontSize: 11, fontWeight: currentPage === item.page ? 600 : 400, color: currentPage === item.page ? '#E8750A' : '#444440', textAlign: 'center', lineHeight: 1.2 }}>
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}

export default App;
