import { useEffect, useMemo, useState } from 'react';
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

type SortKey = 'id' | 'case_type' | 'court_type' | 'current_state' | 'fee_shifting_eligible';
type SortDir = 'asc' | 'desc';

export default function CaseListPage() {
  const [cases, setCases] = useState<Case[] | null>(null);
  const [blockedIds, setBlockedIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [courtFilter, setCourtFilter] = useState<string>('all');
  const [feeFilter, setFeeFilter] = useState<string>('all');
  const [blockedOnly, setBlockedOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('id');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  useEffect(() => {
    Promise.all([api.listCases(), api.getBlockedCases()])
      .then(([caseRows, blockedRows]) => {
        setCases(caseRows);
        setBlockedIds(new Set(blockedRows.map((b) => Number(b.id))));
      })
      .catch((e) => setError(e.message));
  }, []);

  const filtered = useMemo(() => {
    if (!cases) return [];
    let rows = cases;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((c) =>
        String(c.id).includes(q) ||
        c.case_type.toLowerCase().includes(q) ||
        (STATE_LABELS[c.current_state] ?? c.current_state).toLowerCase().includes(q)
      );
    }
    if (courtFilter !== 'all') {
      rows = rows.filter((c) => c.court_type === courtFilter);
    }
    if (feeFilter !== 'all') {
      const want = feeFilter === 'yes';
      rows = rows.filter((c) => c.fee_shifting_eligible === want);
    }
    if (blockedOnly) {
      rows = rows.filter((c) => blockedIds.has(c.id));
    }

    const sorted = [...rows].sort((a, b) => {
      let av: any = a[sortKey];
      let bv: any = b[sortKey];
      if (typeof av === 'boolean') { av = av ? 1 : 0; bv = bv ? 1 : 0; }
      if (typeof av === 'string') { av = av.toLowerCase(); bv = bv.toLowerCase(); }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [cases, search, courtFilter, feeFilter, blockedOnly, sortKey, sortDir, blockedIds]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortArrow = (key: SortKey) => (sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '');

  if (error) return <p style={{ color: 'red' }}>Failed to load cases: {error}</p>;
  if (!cases) return <p>Loading cases…</p>;

  return (
    <div>
      <h2>Cases ({filtered.length} of {cases.length})</h2>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search by ID, type, or state…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: 6, minWidth: 220 }}
        />
        <select value={courtFilter} onChange={(e) => setCourtFilter(e.target.value)} style={{ padding: 6 }}>
          <option value="all">All courts</option>
          <option value="pre_suit">Pre-suit</option>
          <option value="jp">JP</option>
          <option value="district">District</option>
        </select>
        <select value={feeFilter} onChange={(e) => setFeeFilter(e.target.value)} style={{ padding: 6 }}>
          <option value="all">Fee-shifting: any</option>
          <option value="yes">Fee-shifting: yes</option>
          <option value="no">Fee-shifting: no</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={blockedOnly} onChange={(e) => setBlockedOnly(e.target.checked)} />
          Blocked only
        </label>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #ccc' }}>
            <th style={{ padding: 8, cursor: 'pointer' }} onClick={() => toggleSort('id')}>ID{sortArrow('id')}</th>
            <th style={{ padding: 8, cursor: 'pointer' }} onClick={() => toggleSort('case_type')}>Type{sortArrow('case_type')}</th>
            <th style={{ padding: 8, cursor: 'pointer' }} onClick={() => toggleSort('court_type')}>Court{sortArrow('court_type')}</th>
            <th style={{ padding: 8, cursor: 'pointer' }} onClick={() => toggleSort('current_state')}>State{sortArrow('current_state')}</th>
            <th style={{ padding: 8, cursor: 'pointer' }} onClick={() => toggleSort('fee_shifting_eligible')}>Fee-Shifting{sortArrow('fee_shifting_eligible')}</th>
            <th style={{ padding: 8 }} />
          </tr>
        </thead>
        <tbody>
          {filtered.map((c) => (
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
      {filtered.length === 0 && <p style={{ color: '#666', marginTop: 12 }}>No cases match these filters.</p>}
    </div>
  );
}
