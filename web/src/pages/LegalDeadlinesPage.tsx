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
        // Pre-suit cases with a demand sent — earliest_file_date is the
        // pressure point (60 days after demand, per vls-domain-rules).
        setPreSuitCases(
          allCases.filter((c) => c.court_type === 'pre_suit')
        );
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p style={{ color: 'red' }}>Failed to load: {error}</p>;
  if (!blocked || !preSuitCases) return <p>Loading…</p>;

  return (
    <div>
      <p><Link to="/">&larr; Back to cases</Link></p>
      <h2>Legal Deadlines</h2>
      <p style={{ color: '#666', fontSize: 14 }}>
        This page surfaces what the case data already shows — blocked cases and
        pre-suit notice-period dates. It does not compute statute-of-limitations
        or procedural deadlines; those require attorney review.
      </p>

      <section style={{ marginTop: 24 }}>
        <h3 style={{ color: blocked.length > 0 ? '#b00' : undefined }}>
          Blocked Cases ({blocked.length})
        </h3>
        {blocked.length === 0 ? (
          <p style={{ color: '#666' }}>No blocked cases.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #ccc' }}>
                <th style={{ padding: 8 }}>Case</th>
                <th style={{ padding: 8 }}>Court</th>
                <th style={{ padding: 8 }}>State</th>
                <th style={{ padding: 8 }}>Block Reason</th>
                <th style={{ padding: 8 }} />
              </tr>
            </thead>
            <tbody>
              {blocked.map((b) => (
                <tr key={b.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: 8 }}>#{b.id} — {b.case_type.replace(/_/g, ' ')}</td>
                  <td style={{ padding: 8, textTransform: 'uppercase' }}>{b.court_type}</td>
                  <td style={{ padding: 8 }}>{b.current_state.replace(/_/g, ' ')}</td>
                  <td style={{ padding: 8, color: '#b00' }}>{b.block_reason}</td>
                  <td style={{ padding: 8 }}><Link to={`/cases/${b.id}`}>View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ marginTop: 32 }}>
        <h3>Pre-Suit Cases (Notice Period Tracking)</h3>
        {preSuitCases.length === 0 ? (
          <p style={{ color: '#666' }}>No pre-suit cases.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #ccc' }}>
                <th style={{ padding: 8 }}>Case</th>
                <th style={{ padding: 8 }}>State</th>
                <th style={{ padding: 8 }}>Demand Sent</th>
                <th style={{ padding: 8 }}>Earliest File Date</th>
                <th style={{ padding: 8 }} />
              </tr>
            </thead>
            <tbody>
              {preSuitCases.map((c: any) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: 8 }}>#{c.id} — {c.case_type.replace(/_/g, ' ')}</td>
                  <td style={{ padding: 8 }}>{c.current_state.replace(/_/g, ' ')}</td>
                  <td style={{ padding: 8 }}>{c.demand_sent_date ?? '—'}</td>
                  <td style={{ padding: 8 }}>{c.earliest_file_date ?? '—'}</td>
                  <td style={{ padding: 8 }}><Link to={`/cases/${c.id}`}>View</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
