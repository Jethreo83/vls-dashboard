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

  if (error) return <p style={{ color: 'var(--vls-danger)' }}>Failed to load cases: {error}</p>;
  if (!cases) return <p>Loading cases…</p>;

  const blockedCount = cases.filter((c) => blockedIds.has(c.id)).length;
  const feeShiftingCount = cases.filter((c) => c.fee_shifting_eligible).length;

  return (
    <div>
      <div className="vls-cards">
        <div className="vls-card"><div className="label">Total Cases</div><div className="value">{cases.length}</div></div>
        <div className="vls-card"><div className="label">Blocked</div><div className={`value ${blockedCount > 0 ? 'warn' : ''}`}>{blockedCount}</div></div>
        <div className="vls-card"><div className="label">Fee-Shifting</div><div className="value">{feeShiftingCount} / {cases.length}</div></div>
        <div className="vls-card"><div className="label">Showing</div><div className="value">{filtered.length}</div></div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          className="vls-input"
          placeholder="Search by ID, type, or state…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ minWidth: 220 }}
        />
        <select className="vls-select" value={courtFilter} onChange={(e) => setCourtFilter(e.target.value)}>
          <option value="all">All courts</option>
          <option value="pre_suit">Pre-suit</option>
          <option value="jp">JP</option>
          <option value="district">District</option>
        </select>
        <select className="vls-select" value={feeFilter} onChange={(e) => setFeeFilter(e.target.value)}>
          <option value="all">Fee-shifting: any</option>
          <option value="yes">Fee-shifting: yes</option>
          <option value="no">Fee-shifting: no</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, color: 'var(--vls-gray)' }}>
          <input type="checkbox" checked={blockedOnly} onChange={(e) => setBlockedOnly(e.target.checked)} />
          Blocked only
        </label>
      </div>

      <table className="vls-table">
        <thead>
          <tr>
            <th className="sortable" onClick={() => toggleSort('id')}>ID{sortArrow('id')}</th>
            <th className="sortable" onClick={() => toggleSort('case_type')}>Type{sortArrow('case_type')}</th>
            <th className="sortable" onClick={() => toggleSort('court_type')}>Court{sortArrow('court_type')}</th>
            <th className="sortable" onClick={() => toggleSort('current_state')}>State{sortArrow('current_state')}</th>
            <th className="sortable" onClick={() => toggleSort('fee_shifting_eligible')}>Fee-Shifting{sortArrow('fee_shifting_eligible')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {filtered.map((c) => (
            <tr key={c.id}>
              <td>{c.id}</td>
              <td style={{ textTransform: 'capitalize' }}>{c.case_type.replace(/_/g, ' ')}</td>
              <td><span className="vls-badge court">{c.court_type}</span></td>
              <td>{STATE_LABELS[c.current_state] ?? c.current_state}</td>
              <td>{c.fee_shifting_eligible ? 'Yes' : 'No'}</td>
              <td>
                {blockedIds.has(c.id) && <span className="vls-badge blocked" style={{ marginRight: 8 }}>⚠ Blocked</span>}
                <Link to={`/cases/${c.id}`} className="vls-link">View →</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length === 0 && <p style={{ color: 'var(--vls-gray)', marginTop: 12 }}>No cases match these filters.</p>}
    </div>
  );
}
