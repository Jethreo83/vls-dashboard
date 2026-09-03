import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Case } from '../api';

const STATE_LABELS: Record<string, string> = {
  intake: 'Intake',
  demand_sent: 'Demand Sent',
  notice_period_open: 'Notice Period Open',
  filed: 'Filed',
  served: 'Served',
  answered: 'Answered',
  motion_limited_discovery_filed: 'Motion for Discovery Filed',
  initial_disclosures_due: 'Initial Disclosures Due',
  discovery_open: 'Discovery Open',
  settled: 'Settled',
  dismissed: 'Dismissed',
  judgment: 'Judgment',
};

export default function CaseListPage() {
  const [cases, setCases] = useState<Case[] | null>(null);
  const [blockedIds, setBlockedIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.listCases(), api.getBlockedCases()])
      .then(([caseRows, blockedRows]) => {
        setCases(caseRows);
        setBlockedIds(new Set(blockedRows.map((b) => Number(b.id))));
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p style={{ color: 'red' }}>Failed to load cases: {error}</p>;
  if (!cases) return <p>Loading cases…</p>;

  return (
    <div>
      <h2>Cases ({cases.length})</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #ccc' }}>
            <th style={{ padding: 8 }}>ID</th>
            <th style={{ padding: 8 }}>Type</th>
            <th style={{ padding: 8 }}>Court</th>
            <th style={{ padding: 8 }}>State</th>
            <th style={{ padding: 8 }}>Fee-Shifting</th>
            <th style={{ padding: 8 }} />
          </tr>
        </thead>
        <tbody>
          {cases.map((c) => (
            <tr key={c.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: 8 }}>{c.id}</td>
              <td style={{ padding: 8 }}>{c.case_type.replace(/_/g, ' ')}</td>
              <td style={{ padding: 8, textTransform: 'uppercase' }}>{c.court_type}</td>
              <td style={{ padding: 8 }}>{STATE_LABELS[c.current_state] ?? c.current_state}</td>
              <td style={{ padding: 8 }}>{c.fee_shifting_eligible ? 'Yes' : 'No'}</td>
              <td style={{ padding: 8 }}>
                {blockedIds.has(c.id) && <span style={{ color: '#b00', marginRight: 8 }}>⚠ Blocked</span>}
                <Link to={`/cases/${c.id}`}>View</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
