import { useEffect, useState } from 'react';
import { api, type StaffUser } from '../api';
import { useAuth } from '../auth';

const ROLE_OPTIONS: StaffUser['role'][] = ['attorney', 'paralegal', 'admin'];

export default function StaffAdminPage() {
  const { staff } = useAuth();
  const [rows, setRows] = useState<StaffUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<StaffUser['role']>('paralegal');
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.listStaff().then(setRows).catch((e) => setError(e.message));
  };

  useEffect(load, []);

  if (staff?.role !== 'admin') {
    return <p style={{ color: 'var(--vls-danger)' }}>Admin access required.</p>;
  }

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api.provisionStaff({ google_email: newEmail.trim(), role: newRole });
      setNewEmail('');
      setNewRole('paralegal');
      load();
    } catch (e: any) {
      setError(e.body?.message ?? e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (row: StaffUser) => {
    // Confirm before deactivating an admin — the one place a mistake here
    // could lock someone (including yourself) out of the whole system.
    if (row.active && row.role === 'admin') {
      const ok = window.confirm(`Deactivate admin ${row.google_email}? They will lose all dashboard access immediately.`);
      if (!ok) return;
    }
    try {
      await api.setStaffActive(row.id, !row.active);
      load();
    } catch (e: any) {
      setError(e.body?.message ?? e.message);
    }
  };

  if (error) return <p style={{ color: 'var(--vls-danger)' }}>{error}</p>;
  if (!rows) return <p>Loading…</p>;

  const activeAdmins = rows.filter((r) => r.role === 'admin' && r.active).length;

  return (
    <div>
      <div className="vls-cards">
        <div className="vls-card"><div className="label">Total Staff</div><div className="value">{rows.length}</div></div>
        <div className="vls-card"><div className="label">Active</div><div className="value ok">{rows.filter((r) => r.active).length}</div></div>
        <div className="vls-card"><div className="label">Admins</div><div className={`value ${activeAdmins <= 1 ? 'warn' : ''}`}>{activeAdmins}</div></div>
      </div>

      {activeAdmins <= 1 && (
        <p style={{ color: 'var(--vls-danger)', fontSize: 13, marginBottom: 16 }}>
          Only {activeAdmins} active admin remains. Deactivating them would lock everyone out of staff management.
        </p>
      )}

      <form onSubmit={handleProvision} style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <input
          type="email"
          className="vls-input"
          placeholder="name@vlslawfirm.com"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          style={{ flex: 1, minWidth: 220 }}
        />
        <select className="vls-select" value={newRole} onChange={(e) => setNewRole(e.target.value as StaffUser['role'])}>
          {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <button type="submit" className="vls-btn" disabled={saving || !newEmail.trim()}>
          {saving ? 'Saving…' : 'Provision'}
        </button>
      </form>

      <table className="vls-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Created</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.google_email}</td>
              <td style={{ textTransform: 'capitalize' }}>{r.role}</td>
              <td>
                <span className={`vls-badge ${r.active ? 'ok' : 'blocked'}`}>{r.active ? 'Active' : 'Inactive'}</span>
              </td>
              <td>{new Date(r.created_at).toLocaleDateString()}</td>
              <td>
                <button
                  className="vls-signout"
                  onClick={() => handleToggleActive(r)}
                  disabled={r.google_email === staff.google_email}
                  title={r.google_email === staff.google_email ? "Can't deactivate your own account" : undefined}
                >
                  {r.active ? 'Deactivate' : 'Reactivate'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
