import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, audit } from '@/lib/supabase/admin';

// Magic link lands here. Exchange the code for a session, then make sure the
// user has a profile. Profiles are only ever created from a matching invite.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const site = process.env.NEXT_PUBLIC_SITE_URL!;
  const supabase = await createClient();

  // Two ways in. token_hash comes from the email template and works on any
  // device (the champion can open the link on their phone). code is the PKCE
  // flow, which only works in the browser that requested the link.
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const code = url.searchParams.get('code');

  let error: { message: string } | null = null;
  if (tokenHash && type) {
    ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as 'magiclink' | 'email' }));
  } else if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else {
    return NextResponse.redirect(`${site}/?err=Sign-in+link+is+missing+or+expired`);
  }
  if (error) return NextResponse.redirect(`${site}/?err=${encodeURIComponent(error.message)}`);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.redirect(`${site}/no-access`);

  const admin = createAdminClient();
  const { data: existing } = await admin.from('profiles').select('id, org_id, role').eq('id', user.id).maybeSingle();

  if (!existing) {
    const email = user.email.toLowerCase();
    const { data: invite } = await admin
      .from('invites')
      .select('*')
      .eq('email', email)
      .is('accepted_at', null)
      .maybeSingle();

    if (!invite) {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${site}/no-access`);
    }

    const { error: pErr } = await admin.from('profiles').insert({
      id: user.id,
      org_id: invite.org_id,
      email,
      full_name: invite.full_name,
      role: invite.role,
      status: 'active',
      business_area_id: invite.business_area_id,
      manager_name: invite.manager_name,
      joined_network_at: new Date().toISOString().slice(0, 10),
    });
    if (pErr) return NextResponse.redirect(`${site}/?err=${encodeURIComponent(pErr.message)}`);

    await admin.from('invites').update({ accepted_at: new Date().toISOString() }).eq('id', invite.id);
    await audit(invite.org_id, user.id, 'champion.accepted_invite', { type: 'invite', id: invite.id });
    await admin.from('engagement_events').insert({ org_id: invite.org_id, profile_id: user.id, event_type: 'login' });
    return NextResponse.redirect(`${site}/${invite.role === 'admin' ? 'admin' : 'home'}`);
  }

  await admin.from('engagement_events').insert({ org_id: existing.org_id, profile_id: user.id, event_type: 'login' });
  return NextResponse.redirect(`${site}/${existing.role === 'admin' ? 'admin' : 'home'}`);
}
