import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import LoadingScreen from './components/LoadingScreen';
import Sidebar from './components/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';
import NewQuotePage from './pages/NewQuotePage';
import OwnerDashboard from './pages/OwnerDashboard';
import SuperAdminOverview from './pages/SuperAdminOverview';
import {
  QuotesListPage, ContactsPage, CataloguePage,
  CommissionPage, PricingTiersPage, StaffPage,
  TenantsPage, MasterCataloguePage, BrandsPage,
  AllQuotesPage, AllContactsPage, AnalyticsPage, ActivityLogPage,
} from './pages/AllPages';

const DEFAULT_PAGE = { superadmin: 'overview', owner: 'dashboard', staff: 'new-quote' };

const AppShell = () => {
  const { user, profile, loading } = useAuth();
  const [activePage, setActivePage] = useState(null);

  useEffect(() => {
    if (profile?.role) setActivePage(DEFAULT_PAGE[profile.role] || 'new-quote');
  }, [profile]);

  if (loading) return <LoadingScreen message="Loading QuoteKaro..." />;
  if (!user || !profile) return <LoginPage />;

  const ownerStaff = ['owner', 'staff'];

  const renderPage = () => {
    switch (activePage) {
      case 'new-quote':    return <ProtectedRoute allowedRoles={ownerStaff}><NewQuotePage /></ProtectedRoute>;
      case 'quotes':       return <ProtectedRoute allowedRoles={ownerStaff}><QuotesListPage /></ProtectedRoute>;
      case 'contacts':     return <ProtectedRoute allowedRoles={ownerStaff}><ContactsPage /></ProtectedRoute>;
      case 'catalogue':    return profile.role === 'superadmin'
                             ? <ProtectedRoute allowedRoles={['superadmin']}><MasterCataloguePage /></ProtectedRoute>
                             : <ProtectedRoute allowedRoles={ownerStaff}><CataloguePage /></ProtectedRoute>;
      case 'dashboard':    return <ProtectedRoute allowedRoles={['owner']}><OwnerDashboard onNavigate={setActivePage} /></ProtectedRoute>;
      case 'commission':   return <ProtectedRoute allowedRoles={['owner']}><CommissionPage /></ProtectedRoute>;
      case 'tiers':        return <ProtectedRoute allowedRoles={['owner']}><PricingTiersPage /></ProtectedRoute>;
      case 'staff':        return <ProtectedRoute allowedRoles={['owner']}><StaffPage /></ProtectedRoute>;
      case 'overview':     return <ProtectedRoute allowedRoles={['superadmin']}><SuperAdminOverview onNavigate={setActivePage} /></ProtectedRoute>;
      case 'tenants':      return <ProtectedRoute allowedRoles={['superadmin']}><TenantsPage /></ProtectedRoute>;
      case 'brands':       return <ProtectedRoute allowedRoles={['superadmin']}><BrandsPage /></ProtectedRoute>;
      case 'all-quotes':   return <ProtectedRoute allowedRoles={['superadmin']}><AllQuotesPage /></ProtectedRoute>;
      case 'all-contacts': return <ProtectedRoute allowedRoles={['superadmin']}><AllContactsPage /></ProtectedRoute>;
      case 'analytics':    return <ProtectedRoute allowedRoles={['superadmin']}><AnalyticsPage /></ProtectedRoute>;
      case 'activity-log': return <ProtectedRoute allowedRoles={['superadmin']}><ActivityLogPage /></ProtectedRoute>;
      default:             return <LoadingScreen message="Loading..." />;
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#080f1e' }}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      <main style={{ flex: 1, overflowY: 'auto', minHeight: '100vh' }}>
        {activePage ? renderPage() : <LoadingScreen />}
      </main>
    </div>
  );
};

const App = () => (
  <AuthProvider>
    <AppShell />
  </AuthProvider>
);

export default App;
