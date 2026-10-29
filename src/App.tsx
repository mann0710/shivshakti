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
import SeasonalOccasions from './pages/SeasonalOccasions';
import SeasonalDashboard from './pages/SeasonalDashboard';
import SeasonalCustomers from './pages/SeasonalCustomers';
import { Page, NAV_ITEMS, SECTIONS, PINNED, isPage } from './components/navItems';

const queryClient = new QueryClient();

export type { Page };

function App() {
  // Restore the last-viewed page on refresh (falls back to dashboard).
  const [currentPage, setCurrentPage] = useState<Page>(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem('currentPage'); } catch { /* storage blocked */ }
    return isPage(saved) ? saved : 'dashboard';
  });
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const navigate = (page: Page) => {
    setCurrentPage(page);
    try { localStorage.setItem('currentPage', page); } catch { /* storage blocked */ }
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
      case 'seasonal_dashboard':  return <SeasonalDashboard onNavigate={navigate} />;
      case 'seasonal_occasions':  return <SeasonalOccasions />;
      case 'seasonal_items':      return <SeasonalItems />;
      case 'seasonal_billing':    return <SeasonalBilling />;
      case 'seasonal_customers':  return <SeasonalCustomers />;
      default:                     return <Dashboard onNavigate={navigate} />;
    }
  };

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
        {PINNED.map(item => (
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

            {SECTIONS.map(section => {
              const items = NAV_ITEMS.filter(i => i.section === section);
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
