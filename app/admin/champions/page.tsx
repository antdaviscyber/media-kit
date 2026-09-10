import Link from 'next/link';
import { requireAdmin } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';

function ago(iso: string | null) {
  if (!iso) return 'Never';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

export default async function Champions() {
  const profile = await requireAdmin();
  const supabase = await createClient();
  const [{ data: champions }, { data: invites }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, email, status, job_title, manager_name, last_engaged_at, engagement_expectation, business_areas(name), profile_tags(tags(name))')
      .eq('org_id', profile.org_id)
      .eq('role', 'champion')
      .order('full_name'),
    supabase.from('invites').select('id, email, full_name, business_areas(name)').eq('org_id', profile.org_id).is('accepted_at', null).order('created_at'),
  ]);

  return (
    <>
      <h1>Champions</h1>
      <p className="muted">
        {champions?.length ?? 0} in the network, {invites?.length ?? 0} invited and not yet signed in.{' '}
        <Link href="/admin/champions/import">Import more</Link>
      </p>

      <div className="card" style={{ marginBottom: 24 }}>
        {champions && champions.length > 0 ? (
          <table>
            <thead><tr><th>Name</th><th>Business area</th><th>Reports to</th><th>Tags</th><th>Status</th><th>Last engaged</th></tr></thead>
            <tbody>
              {champions.map((c) => {
                const area = Array.isArray(c.business_areas) ? c.business_areas[0] : c.business_areas;
                return (
                  <tr key={c.id}>
                    <td><strong>{c.full_name ?? c.email}</strong><br /><span className="muted">{c.email}{c.job_title ? `, ${c.job_title}` : ''}</span></td>
                    <td>{area?.name ?? <span className="muted">Not set</span>}</td>
                    <td>{c.manager_name ?? <span className="muted">Not set</span>}</td>
                    <td>{(c.profile_tags ?? []).map((pt) => { const t = Array.isArray(pt.tags) ? pt.tags[0] : pt.tags; return t ? <span key={t.name} className="pill inactive" style={{ marginRight: 4 }}>{t.name}</span> : null; })}</td>
                    <td><span className={`pill ${c.status}`}>{c.status}</span>{c.engagement_expectation !== 'full' ? <><br /><span className="muted small">{c.engagement_expectation === 'none' ? 'not expected to engage' : 'light touch'}</span></> : null}</td>
                    <td>{ago(c.last_engaged_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="muted">No champions have signed in yet. Import a list to send invitations.</p>
        )}
      </div>

      {invites && invites.length > 0 ? (
        <>
          <h2>Waiting to sign in</h2>
          <div className="card">
            <table>
              <thead><tr><th>Name</th><th>Email</th><th>Business area</th></tr></thead>
              <tbody>
                {invites.map((i) => {
                  const area = Array.isArray(i.business_areas) ? i.business_areas[0] : i.business_areas;
                  return (
                    <tr key={i.id}>
                      <td>{i.full_name ?? <span className="muted">Unknown</span>}</td>
                      <td>{i.email}</td>
                      <td>{area?.name ?? <span className="muted">Not set</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </>
  );
}
