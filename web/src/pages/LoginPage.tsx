import { useAuth } from '../auth';
import { VlsMark } from '../VlsMark';

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
        background: 'linear-gradient(180deg, #680d1e 0%, #4a0916 100%)',
      }}
    >
      <VlsMark size={56} />
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: '-0.2px' }}>Victory Legal Solutions</h1>
        <p style={{ color: '#e6c288', fontSize: 12, letterSpacing: '1.5px', textTransform: 'uppercase', marginTop: 4, fontWeight: 600 }}>
          Dashboard
        </p>
      </div>
      <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13.5 }}>Sign in with your @vlslawfirm.com Google account.</p>
      <div style={{ background: '#fff', borderRadius: 8, padding: 4 }}>
        <div id="google-signin-button" />
      </div>
      {loading && <p style={{ color: 'rgba(255,255,255,0.7)' }}>Signing in…</p>}
      {error && <p style={{ color: '#f8b4a3', maxWidth: 400, textAlign: 'center', fontSize: 13 }}>{error}</p>}
    </div>
  );
}
