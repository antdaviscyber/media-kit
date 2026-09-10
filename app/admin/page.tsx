import { requireAdmin } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';

export default async function NetworkHealth() {
  const profile = await requireAdmin();
  const supabase = await createClient();
  const [{ data: health }, { data: coverage }] = await Promise.all([
    supabase.from('v_network_health').select('*').eq('org_id', profile.org_id).maybeSingle(),
    supabase.from('v_area_coverage').select('*').eq('org_id', profile.org_id).order('business_area'),
  ]);

  const h = health ?? { active_champions: 0, inactive_champions: 0, invited_not_joined: 0, engaged_30d: 0, quiet_90d: 0, at_risk: 0 };

  return (
    <>
      <h1>Network health</h1>
      <p className="muted">How your champions network looks right now.</p>
      <div className="grid stats" style={{ marginBottom: 28 }}>
        <div className="card stat"><div className="n">{h.active_champions}</div><div className="l">Active champions</div></div>
        <div className="card stat"><div className="n">{h.engaged_30d}</div><div className="l">Engaged in the last 30 days</div></div>
        <div className={`card stat ${Number(h.at_risk) > 0 ? 'warn' : ''}`}><div className="n"><a href="/admin/at-risk" style={{ color: 'inherit' }}>{h.at_risk}</a></div><div className="l">At risk (quiet 30+ days)</div></div>
        <div className="card stat"><div className="n">{h.inactive_champions}</div><div className="l">Marked inactive</div></div>
      </div>

      <h2>Coverage by business area</h2>
      <div className="card">
        {coverage && coverage.length > 0 ? (
          <table>
            <thead><tr><th>Business area</th><th>Active champions</th><th>Engaged (30d)</th></tr></thead>
            <tbody>
              {coverage.map((c) => (
                <tr key={c.business_area_id}>
                  <td>{c.business_area}</td>
                  <td>{c.active_champions === 0 ? <span className="pill left">No champion</span> : c.active_champions}</td>
                  <td>{c.engaged_30d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">No business areas yet. They're created automatically when you import champions.</p>
        )}
      </div>
    </>
  );
}
