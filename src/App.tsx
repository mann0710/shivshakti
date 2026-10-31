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
import { Page, Role, canOpen, homeFor, isPage, navPage } from './components/navItems';
import MobileNav from './components/MobileNav';
import { setNavIntent, NavIntent } from './hooks/useNavIntent';
import { leaveThen } from './hooks/useLeaveGuard';
import { useAuth } from './hooks/useAuth';
import { usePosFull } from './hooks/usePosFull';
import { useDocContextSync } from './hooks/useDocSettings';
import LoginScreen from './components/LoginScreen';
import SetPasswordDialog from './components/settings/SetPasswordDialog';
import { fromAuthLink } from './lib/supabase';

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
  const [posFull] = usePosFull();
  const auth = useAuth();
  const signOut = async () => { await auth.signOut(); queryClient.clear(); };

  const remember = (page: Page) => { try { localStorage.setItem('currentPage', page); } catch { /* storage blocked */ } };

  // Each page is a history entry, so the phone Back button returns to the previous screen.
  useEffect(() => {
    // An email sign-in link keeps its address until the auth client has read it.
    if (!fromAuthLink) window.history.replaceState({ page: currentPage }, '', `#${currentPage}`);
    const onPop = (e: PopStateEvent) => {
      const page = e.state?.page ?? hashPage();
      if (isPage(page)) { setCurrentPage(page); remember(page); setShowMobileMenu(false); }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const navigate = (page: Page, intent?: NavIntent) => leaveThen(() => {
    setNavIntent(page, intent);
    if (page !== currentPage) window.history.pushState({ page }, '', `#${page}`);
    setCurrentPage(page);
    remember(page);
    setShowMobileMenu(false);
  });

  // Counter and kitchen logins only reach their own screens.
  const role: Role = auth.role;
  const page: Page = canOpen(role, currentPage) ? currentPage : homeFor(role);

  const renderPage = () => {
    switch (page) {
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
      <div className={`app-layout${page === 'seasonal_billing' && posFull ? ' pos-full' : ''}`}>
        <Sidebar currentPage={navPage(page)} role={role} onNavigate={navigate} email={auth.email} onSignOut={signOut} />
        <main className="app-main">
          {renderPage()}
        </main>
      </div>

      <MobileNav current={navPage(page)} role={role} open={showMobileMenu} email={auth.email}
        onToggle={setShowMobileMenu} onNavigate={navigate} onSignOut={signOut} />
      {auth.needsPassword && <SetPasswordDialog email={auth.email} onClose={auth.passwordSet} />}
      {toaster}
    </QueryClientProvider>
  );
}

export default App;
