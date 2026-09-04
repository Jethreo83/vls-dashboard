import { useAuth } from '../auth';

export default function LoginPage() {
  const { loading, error } = useAuth();
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: 20,
        background: '#800020',
      }}
    >
      <img src="/vls-logo.jpg" alt="Victory Legal Solutions" style={{ width: 260, borderRadius: 6 }} />
      <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13.5 }}>Sign in with your @vlslawfirm.com Google account.</p>
      <div style={{ background: '#fff', borderRadius: 8, padding: 4 }}>
        <div id="google-signin-button" />
      </div>
      {loading && <p style={{ color: 'rgba(255,255,255,0.7)' }}>Signing in…</p>}
      {error && <p style={{ color: '#f8b4a3', maxWidth: 400, textAlign: 'center', fontSize: 13 }}>{error}</p>}
    </div>
  );
}
