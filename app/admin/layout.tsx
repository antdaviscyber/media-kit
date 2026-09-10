import Link from 'next/link';
import { requireAdmin } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireAdmin();
  const supabase = await createClient();
  const { data: org } = await supabase.from('orgs').select('name').eq('id', profile.org_id).single();

  return (
    <div className="shell">
      <nav className="nav">
        <div className="brand">cyfr<span>.</span></div>
        <Link href="/admin">Network health</Link>
        <Link href="/admin/champions">Champions</Link>
        <Link href="/admin/at-risk">At risk</Link>
        <Link href="/admin/culture">Culture</Link>
        <Link href="/admin/snippets">Policy snippets</Link>
        <Link href="/admin/champions/import">Import champions</Link>
        <Link href="/home">View as champion</Link>
        <div className="foot">
          {org?.name}<br />{profile.email}
        </div>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
