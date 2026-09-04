import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Case } from '../api';

interface BlockedCase {
  id: number;
  case_type: string;
  court_type: string;
  current_state: string;
  block_reason: string;
}

export default function LegalDeadlinesPage() {
  const [blocked, setBlocked] = useState<BlockedCase[] | null>(null);
  const [preSuitCases, setPreSuitCases] = useState<Case[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.getBlockedCases(), api.listCases()])
      .then(([blockedRows, allCases]) => {
        setBlocked(blockedRows);
        setPreSuitCases(allCases.filter((c) => c.court_type === 'pre_suit'));
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p style={{ color: 'var(--vls-danger)' }}>Failed to load: {error}</p>;
  if (!blocked || !preSuitCases) return <p>Loading…</p>;

  return (
    <div>
      <p><Link to="/" className="vls-link">&larr; Back to cases</Link></p>
      <p style={{ color: 'var(--vls-gray)', fontSize: 13.5, marginTop: 12, marginBottom: 24 }}>
        This page surfaces what the case data already shows — blocked cases and
        pre-suit notice-period dates. It does not compute statute-of-limitations
        or procedural deadlines; those require attorney review.
      </p>

      <section>
        <h3 style={{ color: blocked.length > 0 ? 'var(--vls-danger)' : 'var(--vls-maroon)', fontSize: 15, marginBottom: 12 }}>
          Blocked Cases ({blocked.length})
        </h3>
        {blocked.length === 0 ? (
          <p style={{ color: 'var(--vls-gray)' }}>No blocked cases.</p>
        ) : (
          <table className="vls-table">
            <thead>
              <tr>
                <th>Case</th>
                <th>Court</th>
                <th>State</th>
                <th>Block Reason</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {blocked.map((b) => (
                <tr key={b.id}>
                  <td>#{b.id} — {b.case_type.replace(/_/g, ' ')}</td>
                  <td><span className="vls-badge court">{b.court_type}</span></td>
                  <td>{b.current_state.replace(/_/g, ' ')}</td>
                  <td style={{ color: 'var(--vls-danger)', fontWeight: 600 }}>{b.block_reason}</td>
                  <td><Link to={`/cases/${b.id}`} className="vls-link">View →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ marginTop: 32 }}>
        <h3 style={{ fontSize: 15, color: 'var(--vls-maroon)', marginBottom: 12 }}>Pre-Suit Cases (Notice Period Tracking)</h3>
        {preSuitCases.length === 0 ? (
          <p style={{ color: 'var(--vls-gray)' }}>No pre-suit cases.</p>
        ) : (
          <table className="vls-table">
            <thead>
              <tr>
                <th>Case</th>
                <th>State</th>
                <th>Demand Sent</th>
                <th>Earliest File Date</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {preSuitCases.map((c: any) => (
                <tr key={c.id}>
                  <td>#{c.id} — {c.case_type.replace(/_/g, ' ')}</td>
                  <td>{c.current_state.replace(/_/g, ' ')}</td>
                  <td>{c.demand_sent_date ?? '—'}</td>
                  <td>{c.earliest_file_date ?? '—'}</td>
                  <td><Link to={`/cases/${c.id}`} className="vls-link">View →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
