import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import LoginPage from './pages/LoginPage';
import CaseListPage from './pages/CaseListPage';
import CaseDetailPage from './pages/CaseDetailPage';
import NewCasePage from './pages/NewCasePage';
import LegalDeadlinesPage from './pages/LegalDeadlinesPage';
import TaskManagerPage from './pages/TaskManagerPage';
import AnalyticsPage from './pages/AnalyticsPage';
import StaffAdminPage from './pages/StaffAdminPage';

const NAV_ITEMS = [
  { to: '/', label: 'Cases' },
  { to: '/deadlines', label: 'Legal Deadlines' },
  { to: '/tasks', label: 'Tasks' },
  { to: '/analytics', label: 'Analytics' },
];

const ADMIN_NAV_ITEM = { to: '/staff', label: 'Staff' };

function AppShell() {
  const { token, staff, logout } = useAuth();
  const location = useLocation();

  if (!token) return <LoginPage />;

  const navItems = staff?.role === 'admin' ? [...NAV_ITEMS, ADMIN_NAV_ITEM] : NAV_ITEMS;

  return (
    <div className="vls-app">
      <aside className="vls-sidebar">
        <div className="vls-brand-logo">
          <img src="/vls-logo.jpg" alt="Victory Legal Solutions" />
        </div>
        <nav className="vls-nav">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={location.pathname === item.to ? 'active' : ''}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="vls-main">
        <div className="vls-topbar">
          <h1>{navItems.find((n) => n.to === location.pathname)?.label ?? 'Case'}</h1>
          <div>
            <span className="vls-user-chip">{staff?.google_email} · {staff?.role}</span>
            <button className="vls-signout" onClick={logout}>Sign out</button>
          </div>
        </div>
        <Routes>
          <Route path="/" element={<CaseListPage />} />
          <Route path="/cases/new" element={<NewCasePage />} />
          <Route path="/cases/:id" element={<CaseDetailPage />} />
          <Route path="/deadlines" element={<LegalDeadlinesPage />} />
          <Route path="/tasks" element={<TaskManagerPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/staff" element={<StaffAdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </BrowserRouter>
  );
}
