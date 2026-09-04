import { useEffect, useState } from 'react';
import { api, type AnalyticsSummary } from '../api';

const money = (v: string) => `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getAnalyticsSummary().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <p style={{ color: 'red' }}>{error}</p>;
  if (!data) return <p>Loading…</p>;

  const feeShiftingYes = data.fee_shifting_split.find((f) => f.fee_shifting_eligible)?.count ?? 0;
  const feeShiftingNo = data.fee_shifting_split.find((f) => !f.fee_shifting_eligible)?.count ?? 0;

  return (
    <div>
      <h2>Analytics</h2>
      {data.total_cases < 5 && (
        <p style={{ color: '#888', fontStyle: 'italic', marginTop: -8 }}>
          Only {data.total_cases} case(s) in the system right now — these numbers will look
          sparse until real case volume builds up. The math is correct regardless.
        </p>
      )}

      <div style={{ display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
        <StatCard label="Total cases" value={data.total_cases} />
        <StatCard label="Blocked cases" value={data.total_blocked} warn={data.total_blocked > 0} />
        <StatCard label="Overdue tasks" value={data.total_overdue_tasks} warn={data.total_overdue_tasks > 0} />
        <StatCard label="Fee-shifting eligible" value={`${feeShiftingYes} / ${feeShiftingYes + feeShiftingNo}`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, marginBottom: 32 }}>
        <BreakdownList title="By court type" rows={data.by_court.map((r) => ({ label: r.court_type, count: r.count }))} />
        <BreakdownList title="By case state" rows={data.by_state.map((r) => ({ label: r.current_state.replace(/_/g, ' '), count: r.count }))} />
        <BreakdownList title="By case type" rows={data.by_type.map((r) => ({ label: r.case_type.replace(/_/g, ' '), count: r.count }))} />
      </div>

      <h3>Portfolio financials</h3>
      <p style={{ color: '#888', fontSize: 13, marginTop: -8 }}>
        Only counts cases with a recorded gross recovery ({data.financials.cases_with_financials} of {data.total_cases}).
      </p>
      <table style={{ borderCollapse: 'collapse' }}>
        <tbody>
          <FinRow label="Total gross recovery" value={data.financials.total_gross_recovery} />
          <FinRow label="Total net to clients" value={data.financials.total_net_to_client} />
          <FinRow label="Total confirmed costs" value={data.financials.total_costs_confirmed} />
          <FinRow label="Total pending (unconfirmed) costs" value={data.financials.total_costs_pending} />
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ label, value, warn }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, minWidth: 140 }}>
      <div style={{ fontSize: 12, color: '#666', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 600, color: warn ? '#b00' : undefined }}>{value}</div>
    </div>
  );
}

function BreakdownList({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  return (
    <div>
      <h4 style={{ marginBottom: 8 }}>{title}</h4>
      {rows.length === 0 && <p style={{ color: '#888' }}>No data.</p>}
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {rows.map((r) => (
          <li key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #eee', textTransform: 'capitalize' }}>
            <span>{r.label}</span>
            <span>{r.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FinRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td style={{ padding: '4px 24px 4px 0', color: '#666' }}>{label}</td>
      <td style={{ padding: 4, fontWeight: 600 }}>{money(value)}</td>
    </tr>
  );
}
