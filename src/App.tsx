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
import DataCenter from './pages/DataCenter';
import MenuBuilder from './pages/MenuBuilder';
import Quotations from './pages/Quotations';
import SeasonalItems from './pages/SeasonalItems';
import SeasonalBilling from './pages/SeasonalBilling';
import SeasonalOccasions from './pages/SeasonalOccasions';
import SeasonalDashboard from './pages/SeasonalDashboard';
import SeasonalCustomers from './pages/SeasonalCustomers';
import { Page, isPage, navPage } from './components/navItems';
import MobileNav from './components/MobileNav';
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
      case 'bookings':    return <Bookings key="bookings" onNavigate={navigate} />;
      case 'customers':   return <Customers onNavigate={navigate} />;
      case 'menus':       return <Menus />;
      case 'billing':     return <Billing onNavigate={navigate} />;
      case 'finance':     return <Finance onNavigate={navigate} />;
      case 'calendar':    return <Bookings key="calendar" onNavigate={navigate} startView="calendar" />;
      case 'datacenter':  return <DataCenter />;
      case 'menubuilder': return <MenuBuilder />;
      case 'quotations':        return <Quotations onNavigate={navigate} />;
      case 'seasonal_dashboard':  return <SeasonalDashboard onNavigate={navigate} />;
      case 'seasonal_occasions':  return <SeasonalOccasions onNavigate={navigate} />;
      case 'seasonal_items':      return <SeasonalItems onNavigate={navigate} />;
      case 'seasonal_billing':    return <SeasonalBilling onNavigate={navigate} />;
      case 'seasonal_customers':  return <SeasonalCustomers onNavigate={navigate} />;
      default:                     return <Dashboard onNavigate={navigate} />;
    }
  };

  const toaster = <Toaster position="bottom-center" containerClassName="app-toasts" toastOptions={{ duration: 6000 }} />;

  // Only signed-in staff get past this point.
  if (auth.access === 'checking') return <div style={{ padding: 40, textAlign: 'center', color: '#888880' }}>Loading…</div>;
  if (auth.access !== 'staff') {
    return (
      <>
        <LoginScreen notStaffEmail={auth.access === 'not_staff' ? auth.email : undefined} onSignOut={signOut} />
        {toaster}
      </>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <DocContextSync />
      <div className={`app-layout${currentPage === 'seasonal_billing' ? ' pos-full' : ''}`}>
        <Sidebar currentPage={navPage(currentPage)} onNavigate={navigate} email={auth.email} onSignOut={signOut} />
        <main className="app-main">
          {renderPage()}
        </main>
      </div>

      <MobileNav current={navPage(currentPage)} open={showMobileMenu} email={auth.email}
        onToggle={setShowMobileMenu} onNavigate={navigate} onSignOut={signOut} />
      {toaster}
    </QueryClientProvider>
  );
}

export default App;
