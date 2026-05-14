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

const queryClient = new QueryClient();

export type Page = 'dashboard' | 'bookings' | 'customers' | 'menus' | 'billing' | 'finance' | 'calendar';

const bottomNavItems: { page: Page; icon: string; label: string }[] = [
  { page: 'dashboard', icon: '🏠', label: 'Home' },
  { page: 'bookings',  icon: '📋', label: 'Bookings' },
  { page: 'customers', icon: '👥', label: 'Clients' },
  { page: 'billing',   icon: '🧾', label: 'Billing' },
  { page: 'menus',     icon: '🍽', label: 'Menus' },
  { page: 'finance',   icon: '📊', label: 'Finance' },
  { page: 'calendar',  icon: '📅', label: 'Calendar' },
];

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard onNavigate={setCurrentPage} />;
      case 'bookings':  return <Bookings />;
      case 'customers': return <Customers onNavigate={setCurrentPage} />;
      case 'menus':     return <Menus />;
      case 'billing':   return <Billing />;
      case 'finance':   return <Finance />;
      case 'calendar':  return <CalendarPage />;
      default:          return <Dashboard onNavigate={setCurrentPage} />;
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="app-layout">
        <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
        <main className="app-main">
          {renderPage()}
        </main>
      </div>

      {/* Bottom navigation — visible only on mobile via CSS */}
      <nav className="bottom-nav">
        {bottomNavItems.map(item => (
          <div
            key={item.page}
            className={`bn-item${currentPage === item.page ? ' active' : ''}`}
            onClick={() => setCurrentPage(item.page)}
          >
            <span className="bn-icon">{item.icon}</span>
            <span className="bn-label">{item.label}</span>
            {currentPage === item.page && <span className="bn-dot" />}
          </div>
        ))}
      </nav>

      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}

export default App;
