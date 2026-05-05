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

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard onNavigate={setCurrentPage} />;
      case 'bookings': return <Bookings />;
      case 'customers': return <Customers onNavigate={setCurrentPage} />;
      case 'menus': return <Menus />;
      case 'billing': return <Billing />;
      case 'finance': return <Finance />;
      case 'calendar': return <CalendarPage />;
      default: return <Dashboard onNavigate={setCurrentPage} />;
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'Inter, system-ui, sans-serif', fontSize: 14, background: '#F5F5F0' }}>
        <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
        <main style={{ flex: 1, overflow: 'auto', background: '#F5F5F0' }}>
          {renderPage()}
        </main>
      </div>
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}

export default App;
