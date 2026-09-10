import { requireAdmin } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { reviewSnippet } from './actions';

export default async function Snippets() {
  const me = await requireAdmin();
  const supabase = await createClient();
  const { data: rows } = await supabase.from('policy_snippets').select('id, policy_title, lead_in, body, status, created_by_ai, created_at')
    .eq('org_id', me.org_id).order('status').order('created_at', { ascending: false });
  const pending = (rows ?? []).filter((r) => r.status === 'pending');
  const approved = (rows ?? []).filter((r) => r.status === 'approved');

  return (
    <>
      <h1>Policy snippets</h1>
      <p className="muted">Short slices of your policies shown to champions when they log in. Nothing reaches a champion until you approve it. Edit the wording freely; it's yours.</p>

      <h2>Waiting for review ({pending.length})</h2>
      <div className="grid" style={{ marginBottom: 28 }}>
        {pending.length ? pending.map((r) => (
          <form key={r.id} action={reviewSnippet} className="card">
            <input type="hidden" name="id" value={r.id} />
            <div className="muted small" style={{ marginBottom: 8 }}>{r.policy_title}{r.created_by_ai ? ' · drafted by AI' : ''}</div>
            <div className="field"><label htmlFor={`li-${r.id}`}>Lead-in</label><input id={`li-${r.id}`} name="lead_in" type="text" defaultValue={r.lead_in ?? ''} placeholder="Did you know" /></div>
            <div className="field"><label htmlFor={`b-${r.id}`}>Snippet</label><textarea id={`b-${r.id}`} name="body" defaultValue={r.body} style={{ minHeight: 90, fontFamily: 'inherit' }} /></div>
            <button className="btn" name="decision" value="approved">Approve</button>{' '}
            <button className="btn secondary" name="decision" value="rejected">Reject</button>
          </form>
        )) : <div className="card"><p className="muted">Nothing waiting.</p></div>}
      </div>

      <h2>Approved ({approved.length})</h2>
      <div className="card">
        {approved.length ? (
          <table>
            <thead><tr><th>Policy</th><th>Snippet</th></tr></thead>
            <tbody>{approved.map((r) => <tr key={r.id}><td>{r.policy_title}</td><td>{r.body}</td></tr>)}</tbody>
          </table>
        ) : <p className="muted">None yet.</p>}
      </div>
    </>
  );
}
