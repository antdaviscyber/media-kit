import { requireAdmin } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { nudge, markInactive, setExpectation } from './actions';

export default async function AtRisk() {
  const me = await requireAdmin();
  const supabase = await createClient();
  const { data: rows } = await supabase.from('v_at_risk').select('*').eq('org_id', me.org_id).order('days_quiet', { ascending: false });

  return (
    <>
      <h1>Champions at risk</h1>
      <p className="muted">Active champions who are expected to engage and haven't for 30 days or more. Sponsors and light-touch champions are left out on purpose.</p>
      <div className="card">
        {rows && rows.length > 0 ? (
          <table>
            <thead><tr><th>Champion</th><th>Area</th><th>Ask first</th><th>Quiet for</th><th>Last nudged</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.profile_id}>
                  <td><strong>{r.full_name ?? r.email}</strong><br /><span className="muted">{r.email}</span></td>
                  <td>{r.business_area ?? <span className="muted">Not set</span>}</td>
                  <td>{r.mentor_name ? `${r.mentor_name} (mentor)` : r.manager_name ? `${r.manager_name} (manager)` : <span className="muted">Nobody set</span>}</td>
                  <td>{r.days_quiet === 9999 ? 'Never engaged' : `${r.days_quiet} days`}</td>
                  <td>{r.last_nudged_at ? new Date(r.last_nudged_at).toLocaleDateString('en-GB') : <span className="muted">Never</span>}</td>
                  <td className="row-actions">
                    <form action={nudge}><input type="hidden" name="profile_id" value={r.profile_id} /><button className="link-btn">Nudge</button></form>
                    {' · '}
                    <form action={setExpectation}><input type="hidden" name="profile_id" value={r.profile_id} /><input type="hidden" name="value" value="none" /><button className="link-btn">Mark as sponsor</button></form>
                    {' · '}
                    <form action={markInactive}><input type="hidden" name="profile_id" value={r.profile_id} /><button className="link-btn">Mark inactive</button></form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="muted">Nobody's gone quiet. Nice.</p>}
      </div>
    </>
  );
}
