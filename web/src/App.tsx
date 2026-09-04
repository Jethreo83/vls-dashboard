import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import LoginPage from './pages/LoginPage';
import CaseListPage from './pages/CaseListPage';
import CaseDetailPage from './pages/CaseDetailPage';
import LegalDeadlinesPage from './pages/LegalDeadlinesPage';

function AppShell() {
  const { token, staff, logout } = useAuth();

  if (!token) return <LoginPage />;

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottom: '1px solid #eee', paddingBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <h1 style={{ margin: 0, fontSize: 20 }}>VLS Dashboard</h1>
          <nav style={{ display: 'flex', gap: 16 }}>
            <Link to="/">Cases</Link>
            <Link to="/deadlines">Legal Deadlines</Link>
          </nav>
        </div>
        <div>
          <span style={{ marginRight: 16, color: '#666' }}>{staff?.google_email} ({staff?.role})</span>
          <button onClick={logout}>Sign out</button>
        </div>
      </header>
      <Routes>
        <Route path="/" element={<CaseListPage />} />
        <Route path="/cases/:id" element={<CaseDetailPage />} />
        <Route path="/deadlines" element={<LegalDeadlinesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
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
