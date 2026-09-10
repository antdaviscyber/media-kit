import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

async function sendLink(formData: FormData) {
  'use server';
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!email) redirect('/?err=Enter+your+work+email');
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });
  if (error) redirect(`/?err=${encodeURIComponent(error.message)}`);
  redirect('/?sent=1');
}

export default async function Login({ searchParams }: { searchParams: Promise<{ sent?: string; err?: string; code?: string; token_hash?: string; type?: string }> }) {
  const { sent, err, code, token_hash, type } = await searchParams;
  if (token_hash && type) redirect(`/auth/callback?token_hash=${encodeURIComponent(token_hash)}&type=${encodeURIComponent(type)}`);
  if (code) redirect(`/auth/callback?code=${encodeURIComponent(code)}`);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/admin');

  return (
    <main className="login">
      <div className="card">
        <div className="brand">cyfr<span>.</span></div>
        <p className="muted">Your security champions network, in one place.</p>
        {sent ? (
          <div className="notice ok">Check your inbox. The sign-in link is valid for one hour.</div>
        ) : null}
        {err ? <div className="notice err">{err}</div> : null}
        <form action={sendLink}>
          <div className="field">
            <label htmlFor="email">Work email</label>
            <input id="email" name="email" type="email" autoComplete="email" required placeholder="you@company.com" />
          </div>
          <button className="btn" type="submit">Send sign-in link</button>
        </form>
        <p className="muted" style={{ marginTop: 18, fontSize: '0.85rem' }}>
          No passwords. If your organisation hasn't added you as a champion yet, ask your security team.
        </p>
      </div>
    </main>
  );
}
