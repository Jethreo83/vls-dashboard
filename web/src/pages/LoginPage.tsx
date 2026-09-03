import { useAuth } from '../auth';

export default function LoginPage() {
  const { loading, error } = useAuth();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16 }}>
      <h1>VLS Dashboard</h1>
      <p style={{ color: '#666' }}>Sign in with your @vlslawfirm.com Google account.</p>
      <div id="google-signin-button" />
      {loading && <p>Signing in…</p>}
      {error && <p style={{ color: 'red', maxWidth: 400, textAlign: 'center' }}>{error}</p>}
    </div>
  );
}
