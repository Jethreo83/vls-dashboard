// src/auth.tsx — auth context: holds the JWT, exposes login/logout,
// renders the Google Sign-In button, and persists the token in
// localStorage (acceptable for a staff-only internal tool; revisit if
// this needs to survive an XSS-hardening pass later).
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
const STORAGE_KEY = 'vls_dashboard_token';

export interface StaffSession {
  staff_user_id: number;
  google_email: string;
  role: 'attorney' | 'paralegal' | 'admin';
}

interface AuthContextValue {
  token: string | null;
  staff: StaffSession | null;
  loading: boolean;
  error: string | null;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function decodeJwtPayload(token: string): StaffSession | null {
  try {
    const [, payload] = token.split('.');
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const [staff, setStaff] = useState<StaffSession | null>(() => {
    const t = localStorage.getItem(STORAGE_KEY);
    return t ? decodeJwtPayload(t) : null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setStaff(null);
  };

  useEffect(() => {
    if (token) {
      // Basic client-side expiry check on load — server still re-verifies
      // on every request regardless, this just avoids a flash of stale UI.
      const payload = decodeJwtPayload(token) as (StaffSession & { exp?: number }) | null;
      if (payload?.exp && payload.exp * 1000 < Date.now()) {
        logout();
      }
    }
  }, []);

  const handleCredentialResponse = async (response: { credential: string }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: response.credential }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? body.error ?? `login failed (${res.status})`);
      }
      const body = await res.json();
      localStorage.setItem(STORAGE_KEY, body.token);
      setToken(body.token);
      setStaff(body.staff);
    } catch (e: any) {
      setError(e.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) return; // already logged in, no need to render the button
    const g = (window as any).google;
    if (!g?.accounts?.id) return;
    g.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse,
    });
    const el = document.getElementById('google-signin-button');
    if (el) {
      g.accounts.id.renderButton(el, { theme: 'outline', size: 'large' });
    }
  }, [token]);

  return (
    <AuthContext.Provider value={{ token, staff, loading, error, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export function getToken(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}
