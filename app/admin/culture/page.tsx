import { requireAdmin } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';

const LABELS: Record<string, string> = {
  reporting_confidence: 'Reporting confidence',
  friction: 'Friction',
  trust_in_security: 'Trust in the security team',
  personal_responsibility: 'Personal responsibility',
  knowledge: 'Knowledge',
  champion_role: 'Champion role',
};

type Row = { dimension: string | null; business_area: string | null; responses: number; healthy_pct: number };

export default async function Culture({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireAdmin();
  const { days } = await searchParams;
  const window = Number(days ?? 90);
  const supabase = await createClient();
  const [{ data }, { data: split }] = await Promise.all([
    supabase.rpc('culture_scores', { p_days: window }),
    supabase.rpc('today_question_split'),
  ]);
  const rows = (data ?? []) as Row[];
  const overall = rows.find((r) => r.dimension === null && r.business_area === null);
  const byDim = rows.filter((r) => r.dimension !== null && r.business_area === null);
  const byArea = rows.filter((r) => r.dimension !== null && r.business_area !== null);
  const todaySplit = (split ?? []) as { answer: string; n: number }[];
  const todayTotal = todaySplit.reduce((a, b) => a + Number(b.n), 0);

  return (
    <>
      <h1>Culture</h1>
      <p className="muted">
        Built from the question of the day. Answers are anonymous; only totals are ever shown, and an area needs at least three answers before it appears.
        Showing the last {window} days. <a href="/admin/culture?days=30">30</a> · <a href="/admin/culture?days=90">90</a> · <a href="/admin/culture?days=365">365</a>
      </p>

      <div className="grid stats" style={{ marginBottom: 24 }}>
        <div className="card stat"><div className="n">{overall ? `${overall.healthy_pct}%` : '–'}</div><div className="l">Healthy answers overall</div></div>
        <div className="card stat"><div className="n">{overall?.responses ?? 0}</div><div className="l">Answers in the window</div></div>
        <div className="card stat"><div className="n">{todayTotal}</div><div className="l">Answered today's question so far</div></div>
      </div>

      <h2>By dimension</h2>
      <div className="card" style={{ marginBottom: 24 }}>
        {byDim.length ? byDim.map((r) => (
          <div key={r.dimension} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <strong>{LABELS[r.dimension!] ?? r.dimension}</strong>
              <span>{r.healthy_pct}% <span className="muted">({r.responses})</span></span>
            </div>
            <div className="bar"><span style={{ width: `${r.healthy_pct}%` }} /></div>
          </div>
        )) : <p className="muted">Not enough answers yet.</p>}
      </div>

      <h2>By business area</h2>
      <div className="card">
        {byArea.length ? (
          <table>
            <thead><tr><th>Dimension</th><th>Area</th><th>Healthy</th><th>Answers</th></tr></thead>
            <tbody>
              {byArea.map((r) => (
                <tr key={`${r.dimension}-${r.business_area}`}>
                  <td>{LABELS[r.dimension!] ?? r.dimension}</td>
                  <td>{r.business_area}</td>
                  <td>{r.healthy_pct}%</td>
                  <td>{r.responses}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="muted">Not enough answers per area yet.</p>}
      </div>
    </>
  );
}
