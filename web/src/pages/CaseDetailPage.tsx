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

  if (error) return <p style={{ color: 'red' }}>Failed to load case: {error}</p>;
  if (!caseData) return <p>Loading…</p>;

  return (
    <div>
      <p><Link to="/">&larr; Back to cases</Link></p>
      <h2>Case #{caseData.id} — {caseData.case_type.replace(/_/g, ' ')}</h2>

      <section style={{ marginBottom: 24 }}>
        <h3>Overview</h3>
        <table>
          <tbody>
            <tr><td style={{ paddingRight: 16, color: '#666' }}>Court type</td><td>{caseData.court_type.toUpperCase()}</td></tr>
            <tr><td style={{ paddingRight: 16, color: '#666' }}>Current state</td><td>{caseData.current_state.replace(/_/g, ' ')}</td></tr>
            <tr><td style={{ paddingRight: 16, color: '#666' }}>First party</td><td>{caseData.is_first_party ? 'Yes' : 'No'}</td></tr>
            <tr><td style={{ paddingRight: 16, color: '#666' }}>Cause of action</td><td>{caseData.cause_of_action?.replace(/_/g, ' ') ?? '—'}</td></tr>
            <tr><td style={{ paddingRight: 16, color: '#666' }}>Fee-shifting eligible</td><td>{caseData.fee_shifting_eligible ? 'Yes' : 'No'}</td></tr>
            <tr><td style={{ paddingRight: 16, color: '#666' }}>Service date</td><td>{caseData.service_date ?? <span style={{ color: '#b00' }}>Missing — blocked</span>}</td></tr>
          </tbody>
        </table>
      </section>

      {breakdown && (
        <section style={{ marginBottom: 24 }}>
          <h3>Settlement Breakdown</h3>
          <table>
            <tbody>
              <tr><td style={{ paddingRight: 16, color: '#666' }}>Gross recovery</td><td>${breakdown.gross_recovery ?? '—'}</td></tr>
              {breakdown.contingency_pct && (
                <tr><td style={{ paddingRight: 16, color: '#666' }}>Contingency fee ({(Number(breakdown.contingency_pct) * 100).toFixed(2)}%)</td><td>${breakdown.contingency_fee_amount}</td></tr>
              )}
              {breakdown.fees_sought && (
                <tr><td style={{ paddingRight: 16, color: '#666' }}>Fees sought / awarded</td><td>${breakdown.fees_sought} / ${breakdown.fees_awarded ?? '—'}</td></tr>
              )}
              <tr><td style={{ paddingRight: 16, color: '#666' }}>Costs (confirmed / pending)</td><td>${breakdown.costs_confirmed} / ${breakdown.costs_pending}</td></tr>
              <tr style={{ fontWeight: 'bold' }}><td style={{ paddingRight: 16 }}>Net to client</td><td>${breakdown.net_to_client}</td></tr>
            </tbody>
          </table>
        </section>
      )}

      <section>
        <h3>Event History</h3>
        {events && events.length > 0 ? (
          <ul>
            {events.map((e) => (
              <li key={e.id}>
                <strong>{e.event_type.replace(/_/g, ' ')}</strong> — {new Date(e.created_at).toLocaleString()}
                {' '}({e.source}{e.confirmed ? '' : ', unconfirmed'})
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ color: '#666' }}>No events recorded yet.</p>
        )}
      </section>
    </div>
  );
}
