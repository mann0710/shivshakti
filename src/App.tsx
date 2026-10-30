import React, { useEffect, useState } from 'react';
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
import { setNavIntent, NavIntent } from './hooks/useNavIntent';
import { useAuth } from './hooks/useAuth';
import { useDocContextSync } from './hooks/useDocSettings';
import LoginScreen from './components/LoginScreen';

const queryClient = new QueryClient();

export type { Page };

const hashPage = () => window.location.hash.replace('#', '');

// Keeps printed documents in step with Data Center settings.
const DocContextSync: React.FC = () => { useDocContextSync(); return null; };

function App() {
  // URL hash first (#quotations), then the last-viewed page, then the dashboard.
  const [currentPage, setCurrentPage] = useState<Page>(() => {
    let saved: string | null = hashPage();
    if (!isPage(saved)) { try { saved = localStorage.getItem('currentPage'); } catch { saved = null; } }
    return isPage(saved) ? saved : 'dashboard';
  });
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const auth = useAuth();
  const signOut = async () => { await auth.signOut(); queryClient.clear(); };

  const remember = (page: Page) => { try { localStorage.setItem('currentPage', page); } catch { /* storage blocked */ } };

  // Each page is a history entry, so the phone Back button returns to the previous screen.
  useEffect(() => {
    window.history.replaceState({ page: currentPage }, '', `#${currentPage}`);
    const onPop = (e: PopStateEvent) => {
      const page = e.state?.page ?? hashPage();
      if (isPage(page)) { setCurrentPage(page); remember(page); setShowMobileMenu(false); }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const navigate = (page: Page, intent?: NavIntent) => {
    setNavIntent(page, intent);
    if (page !== currentPage) window.history.pushState({ page }, '', `#${page}`);
    setCurrentPage(page);
    remember(page);
    setShowMobileMenu(false);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':   return <Dashboard onNavigate={navigate} />;
      case 'bookings':    return <Bookings onNavigate={navigate} />;
      case 'customers':   return <Customers onNavigate={navigate} />;
      case 'menus':       return <Menus />;
      case 'billing':     return <Billing onNavigate={navigate} />;
      case 'finance':     return <Finance />;
      case 'calendar':    return <CalendarPage onNavigate={navigate} />;
      case 'datacenter':  return <DataCenter />;
      case 'menubuilder': return <MenuBuilder />;
      case 'quotations':        return <Quotations onNavigate={navigate} />;
      case 'seasonal_dashboard':  return <SeasonalDashboard onNavigate={navigate} />;
      case 'seasonal_occasions':  return <SeasonalOccasions />;
      case 'seasonal_items':      return <SeasonalItems />;
      case 'seasonal_billing':    return <SeasonalBilling />;
      case 'seasonal_customers':  return <SeasonalCustomers />;
      default:                     return <Dashboard onNavigate={navigate} />;
    }
  };

  // Only signed-in staff get past this point.
  if (auth.access === 'checking') return <div style={{ padding: 40, textAlign: 'center', color: '#888880' }}>Loading…</div>;
  if (auth.access !== 'staff') {
    return (
      <>
        <LoginScreen notStaffEmail={auth.access === 'not_staff' ? auth.email : undefined} onSignOut={signOut} />
        <Toaster position="top-right" />
      </>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <DocContextSync />
      <div className="app-layout">
        <Sidebar currentPage={currentPage} onNavigate={navigate} email={auth.email} onSignOut={signOut} />
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
            <button type="button" onClick={signOut}
              style={{ width: '100%', margin: '4px 0 8px', padding: '10px', borderRadius: 10, border: '0.5px solid #F0C4C4', background: '#FCEBEB', color: '#A32D2D', fontSize: 12, cursor: 'pointer' }}>
              Sign out {auth.email && `(${auth.email})`}
            </button>
          </div>
        </>
      )}

      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}

export default App;
