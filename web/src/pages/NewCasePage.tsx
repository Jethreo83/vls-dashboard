import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';

const CASE_TYPES = ['diminished_value', 'unpaid_repairs', 'rental', 'personal_injury', 'first_party_bad_faith_dtpa'] as const;
const CAUSES = ['negligence', 'dtpa', 'bad_faith', 'contract_chapter_38', 'other_contract'] as const;
const COURT_TYPES = ['pre_suit', 'jp', 'district'] as const;

export default function NewCasePage() {
  const { staff } = useAuth();
  const navigate = useNavigate();

  const [caseType, setCaseType] = useState<typeof CASE_TYPES[number]>('unpaid_repairs');
  const [cause, setCause] = useState<typeof CAUSES[number] | ''>('');
  const [isFirstParty, setIsFirstParty] = useState(false);
  const [courtType, setCourtType] = useState<typeof COURT_TYPES[number]>('pre_suit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staff) return;
    setSaving(true);
    setError(null);
    try {
      const created = await api.createCase({
        case_type: caseType,
        cause_of_action: cause || undefined,
        is_first_party: isFirstParty,
        court_type: courtType,
        created_by: staff.google_email,
      });
      navigate(`/cases/${created.id}`);
    } catch (e: any) {
      setError(e.body?.message ?? e.message);
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 480 }}>
      <p><Link to="/" className="vls-link">&larr; Back to cases</Link></p>
      <h2 style={{ fontSize: 20, color: 'var(--vls-maroon)', marginTop: 12, marginBottom: 20 }}>New Case</h2>

      <form onSubmit={handleSubmit} className="vls-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <label style={{ fontSize: 13.5 }}>
          Case type
          <select className="vls-select" value={caseType} onChange={(e) => setCaseType(e.target.value as any)} style={{ width: '100%', marginTop: 4 }}>
            {CASE_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </label>

        <label style={{ fontSize: 13.5 }}>
          Cause of action <span style={{ color: 'var(--vls-gray)' }}>(optional at intake)</span>
          <select className="vls-select" value={cause} onChange={(e) => setCause(e.target.value as any)} style={{ width: '100%', marginTop: 4 }}>
            <option value="">— not yet determined —</option>
            {CAUSES.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
          </select>
        </label>

        <label style={{ fontSize: 13.5 }}>
          Court track
          <select className="vls-select" value={courtType} onChange={(e) => setCourtType(e.target.value as any)} style={{ width: '100%', marginTop: 4 }}>
            {COURT_TYPES.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
          </select>
        </label>

        <label style={{ fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={isFirstParty} onChange={(e) => setIsFirstParty(e.target.checked)} />
          First-party claim
        </label>

        {error && <p style={{ color: 'var(--vls-danger)', fontSize: 13 }}>{error}</p>}

        <button type="submit" className="vls-btn" disabled={saving}>
          {saving ? 'Creating…' : 'Create Case'}
        </button>
      </form>
    </div>
  );
}
