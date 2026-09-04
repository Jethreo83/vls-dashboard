import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { VlsMark } from './VlsMark';
import LoginPage from './pages/LoginPage';
import CaseListPage from './pages/CaseListPage';
import CaseDetailPage from './pages/CaseDetailPage';
import LegalDeadlinesPage from './pages/LegalDeadlinesPage';
import TaskManagerPage from './pages/TaskManagerPage';
import AnalyticsPage from './pages/AnalyticsPage';

const NAV_ITEMS = [
  { to: '/', label: 'Cases' },
  { to: '/deadlines', label: 'Legal Deadlines' },
  { to: '/tasks', label: 'Tasks' },
  { to: '/analytics', label: 'Analytics' },
];

function AppShell() {
  const { token, staff, logout } = useAuth();
  const location = useLocation();

  if (!token) return <LoginPage />;

  return (
    <div className="vls-app">
      <aside className="vls-sidebar">
        <div className="vls-brand">
          <VlsMark size={30} />
          <div className="vls-brand-text">
            Victory Legal
            <span className="sub">Solutions Dashboard</span>
          </div>
        </div>
        <nav className="vls-nav">
          {NAV_ITEMS.map((item) => (
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
          <h1>{NAV_ITEMS.find((n) => n.to === location.pathname)?.label ?? 'Case'}</h1>
          <div>
            <span className="vls-user-chip">{staff?.google_email} · {staff?.role}</span>
            <button className="vls-signout" onClick={logout}>Sign out</button>
          </div>
        </div>
        <Routes>
          <Route path="/" element={<CaseListPage />} />
          <Route path="/cases/:id" element={<CaseDetailPage />} />
          <Route path="/deadlines" element={<LegalDeadlinesPage />} />
          <Route path="/tasks" element={<TaskManagerPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
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
