// src/api.ts — thin fetch wrapper attaching the Bearer token and handling
// 401 by forcing logout (token expired/invalid server-side).
import { getToken } from './auth';

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;
const STORAGE_KEY = 'vls_dashboard_token';

export class ApiError extends Error {
  status: number;
  body: any;
  constructor(status: number, body: any) {
    super(body?.error ?? `API error ${status}`);
    this.status = status;
    this.body = body;
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem(STORAGE_KEY);
    window.location.href = '/';
    throw new ApiError(401, { error: 'session_expired' });
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

// ---------------------------------------------------------------------------
// Typed shapes matching the API's response shapes.
// ---------------------------------------------------------------------------

export interface Case {
  id: number;
  case_type: string;
  cause_of_action: string | null;
  is_first_party: boolean;
  fee_shifting_eligible: boolean;
  court_type: 'jp' | 'district' | 'pre_suit';
  current_state: string;
  service_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface CaseEvent {
  id: number;
  case_id: number;
  event_type: string;
  source: string;
  confirmed: boolean;
  created_at: string;
}

export interface SettlementBreakdown {
  case_id: number;
  case_type: string;
  is_first_party: boolean;
  fee_shifting_eligible: boolean;
  gross_recovery: string | null;
  contingency_pct: string | null;
  contingency_fee_amount: string | null;
  fees_sought: string | null;
  fees_awarded: string | null;
  costs_confirmed: string;
  costs_pending: string;
  costs_recoverable: string;
  net_to_client: string;
}

export const api = {
  listCases: () => apiFetch<Case[]>('/cases'),
  getCase: (id: number) => apiFetch<Case>(`/cases/${id}`),
  getCaseEvents: (id: number) => apiFetch<CaseEvent[]>(`/cases/${id}/events`),
  getBreakdown: (id: number) =>
    apiFetch<SettlementBreakdown>(`/financials/breakdown/${id}`).catch((e) => {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }),
  getBlockedCases: () => apiFetch<any[]>('/cases/status/blocked'),
};
