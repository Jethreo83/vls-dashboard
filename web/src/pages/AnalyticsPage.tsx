import { useEffect, useState } from 'react';
import { api, type AnalyticsSummary } from '../api';

const money = (v: string) => `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getAnalyticsSummary().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <p style={{ color: 'var(--vls-danger)' }}>{error}</p>;
  if (!data) return <p>Loading…</p>;

  const feeShiftingYes = data.fee_shifting_split.find((f) => f.fee_shifting_eligible)?.count ?? 0;
  const feeShiftingNo = data.fee_shifting_split.find((f) => !f.fee_shifting_eligible)?.count ?? 0;

  return (
    <div>
      {data.total_cases < 5 && (
        <p style={{ color: 'var(--vls-gray)', fontStyle: 'italic', marginBottom: 20, fontSize: 13.5 }}>
          Only {data.total_cases} case(s) in the system right now — these numbers will look
          sparse until real case volume builds up. The math is correct regardless.
        </p>
      )}

      <div className="vls-cards">
        <div className="vls-card"><div className="label">Total Cases</div><div className="value">{data.total_cases}</div></div>
        <div className="vls-card"><div className="label">Blocked Cases</div><div className={`value ${data.total_blocked > 0 ? 'warn' : ''}`}>{data.total_blocked}</div></div>
        <div className="vls-card"><div className="label">Overdue Tasks</div><div className={`value ${data.total_overdue_tasks > 0 ? 'warn' : ''}`}>{data.total_overdue_tasks}</div></div>
        <div className="vls-card"><div className="label">Fee-Shifting Eligible</div><div className="value">{feeShiftingYes} / {feeShiftingYes + feeShiftingNo}</div></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 32 }}>
        <BreakdownCard title="By court type" rows={data.by_court.map((r) => ({ label: r.court_type, count: r.count }))} />
        <BreakdownCard title="By case state" rows={data.by_state.map((r) => ({ label: r.current_state.replace(/_/g, ' '), count: r.count }))} />
        <BreakdownCard title="By case type" rows={data.by_type.map((r) => ({ label: r.case_type.replace(/_/g, ' '), count: r.count }))} />
      </div>

      <h3 style={{ fontSize: 15, color: 'var(--vls-maroon)', marginBottom: 4 }}>Portfolio Financials</h3>
      <p style={{ color: 'var(--vls-gray)', fontSize: 12.5, marginBottom: 14 }}>
        Only counts cases with a recorded gross recovery ({data.financials.cases_with_financials} of {data.total_cases}).
      </p>
      <div className="vls-card" style={{ maxWidth: 420 }}>
        <FinRow label="Total gross recovery" value={data.financials.total_gross_recovery} />
        <FinRow label="Total net to clients" value={data.financials.total_net_to_client} />
        <FinRow label="Total confirmed costs" value={data.financials.total_costs_confirmed} />
        <FinRow label="Total pending costs" value={data.financials.total_costs_pending} last />
      </div>
    </div>
  );
}

function BreakdownCard({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  return (
    <div className="vls-card">
      <div className="label" style={{ marginBottom: 10 }}>{title}</div>
      {rows.length === 0 && <p style={{ color: 'var(--vls-gray)', fontSize: 13 }}>No data.</p>}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {rows.map((r) => (
          <li key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid var(--vls-gray-light)', textTransform: 'capitalize', fontSize: 13.5 }}>
            <span>{r.label}</span>
            <span style={{ fontWeight: 700, color: 'var(--vls-maroon)' }}>{r.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FinRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: last ? 'none' : '1px solid var(--vls-gray-light)' }}>
      <span style={{ color: 'var(--vls-gray)', fontSize: 13.5 }}>{label}</span>
      <span style={{ fontWeight: 700, color: 'var(--vls-maroon)' }}>{money(value)}</span>
    </div>
  );
}
