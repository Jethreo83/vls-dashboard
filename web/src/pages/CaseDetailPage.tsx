import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, type Case, type CaseEvent, type SettlementBreakdown } from '../api';

export default function CaseDetailPage() {
  const { id } = useParams();
  const caseId = Number(id);
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [events, setEvents] = useState<CaseEvent[] | null>(null);
  const [breakdown, setBreakdown] = useState<SettlementBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.getCase(caseId), api.getCaseEvents(caseId), api.getBreakdown(caseId)])
      .then(([c, e, b]) => {
        setCaseData(c);
        setEvents(e);
        setBreakdown(b);
      })
      .catch((e) => setError(e.message));
  }, [caseId]);

  if (error) return <p style={{ color: 'var(--vls-danger)' }}>Failed to load case: {error}</p>;
  if (!caseData) return <p>Loading…</p>;

  return (
    <div>
      <p><Link to="/" className="vls-link">&larr; Back to cases</Link></p>
      <h2 style={{ fontSize: 20, color: 'var(--vls-maroon)', marginTop: 12, marginBottom: 20 }}>
        Case #{caseData.id} — <span style={{ textTransform: 'capitalize' }}>{caseData.case_type.replace(/_/g, ' ')}</span>
      </h2>

      <section style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, color: 'var(--vls-gold-dark)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>Overview</h3>
        <div className="vls-card">
          <DetailRow label="Court type" value={caseData.court_type.toUpperCase()} />
          <DetailRow label="Current state" value={caseData.current_state.replace(/_/g, ' ')} />
          <DetailRow label="First party" value={caseData.is_first_party ? 'Yes' : 'No'} />
          <DetailRow label="Cause of action" value={caseData.cause_of_action?.replace(/_/g, ' ') ?? '—'} />
          <DetailRow label="Fee-shifting eligible" value={caseData.fee_shifting_eligible ? 'Yes' : 'No'} />
          <DetailRow
            label="Service date"
            value={caseData.service_date ?? <span style={{ color: 'var(--vls-danger)', fontWeight: 700 }}>Missing — blocked</span>}
            last
          />
        </div>
      </section>

      {breakdown && (
        <section style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, color: 'var(--vls-gold-dark)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>
            Settlement Breakdown
          </h3>
          <div className="vls-card">
            <DetailRow label="Gross recovery" value={`$${breakdown.gross_recovery ?? '—'}`} />
            {breakdown.contingency_pct && (
              <DetailRow
                label={`Contingency fee (${(Number(breakdown.contingency_pct) * 100).toFixed(2)}%)`}
                value={`$${breakdown.contingency_fee_amount}`}
              />
            )}
            {breakdown.fees_sought && (
              <DetailRow label="Fees sought / awarded" value={`$${breakdown.fees_sought} / $${breakdown.fees_awarded ?? '—'}`} />
            )}
            <DetailRow label="Costs (confirmed / pending)" value={`$${breakdown.costs_confirmed} / $${breakdown.costs_pending}`} />
            <DetailRow
              label="Net to client"
              value={<strong style={{ color: 'var(--vls-maroon)', fontSize: 16 }}>${breakdown.net_to_client}</strong>}
              last
            />
          </div>
        </section>
      )}

      <section>
        <h3 style={{ fontSize: 14, color: 'var(--vls-gold-dark)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 10 }}>
          Event History
        </h3>
        {events && events.length > 0 ? (
          <div className="vls-card">
            {events.map((e, i) => (
              <div
                key={e.id}
                style={{
                  padding: '10px 0',
                  borderBottom: i === events.length - 1 ? 'none' : '1px solid var(--vls-gray-light)',
                  fontSize: 13.5,
                }}
              >
                <strong style={{ color: 'var(--vls-ink)', textTransform: 'capitalize' }}>{e.event_type.replace(/_/g, ' ')}</strong>
                <span style={{ color: 'var(--vls-gray)' }}> — {new Date(e.created_at).toLocaleString()} ({e.source}{e.confirmed ? '' : ', unconfirmed'})</span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--vls-gray)' }}>No events recorded yet.</p>
        )}
      </section>
    </div>
  );
}

function DetailRow({ label, value, last }: { label: string; value: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: last ? 'none' : '1px solid var(--vls-gray-light)' }}>
      <span style={{ color: 'var(--vls-gray)', fontSize: 13.5 }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 600 }}>{value}</span>
    </div>
  );
}
