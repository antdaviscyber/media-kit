import { requireProfile } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import DailyCard from './DailyCard';

export default async function Home() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: today } = await supabase.rpc('today_items').single<{
    question_id: string | null; tip_id: string | null; discussion_set_id: string | null; snippet_id: string | null; day: string;
  }>();

  const [q, t, d, s, mine, balance] = await Promise.all([
    today?.question_id ? supabase.from('library_questions').select('id, question').eq('id', today.question_id).single() : Promise.resolve({ data: null }),
    today?.tip_id ? supabase.from('library_tips').select('body').eq('id', today.tip_id).single() : Promise.resolve({ data: null }),
    today?.discussion_set_id ? supabase.from('library_discussion_sets').select('id, title, points').eq('id', today.discussion_set_id).single() : Promise.resolve({ data: null }),
    today?.snippet_id ? supabase.from('policy_snippets').select('id, policy_title, lead_in, body').eq('id', today.snippet_id).single() : Promise.resolve({ data: null }),
    today?.question_id ? supabase.from('question_responses').select('answer').eq('question_id', today.question_id).eq('day', today.day).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('v_credit_balances').select('balance').eq('profile_id', profile.id).maybeSingle(),
  ]);

  // Seeing the snippet counts as engagement; logged server-side so it can't be skipped.
  if (s.data) await supabase.rpc('log_event', { p_type: 'policy_snip_viewed', p_ref_type: 'policy_snippet', p_ref_id: s.data.id });

  const first = profile.full_name?.split(' ')[0] ?? 'there';

  return (
    <div className="shell">
      <nav className="nav">
        <div className="brand">cyfr<span>.</span></div>
        <a href="/home" className="active">Today</a>
        <div className="foot">{profile.email}<br />{balance.data?.balance ?? 0} credits</div>
      </nav>
      <main className="main">
        <h1>Morning, {first}.</h1>
        <p className="muted">Three minutes, then back to your day.</p>
        <DailyCard
          question={q.data ? { id: q.data.id, text: q.data.question } : null}
          answered={(mine.data?.answer as 'agree' | 'disagree' | 'not_sure' | undefined) ?? null}
          tip={t.data?.body ?? null}
          discussion={d.data ? { id: d.data.id, title: d.data.title, points: d.data.points } : null}
          snippet={s.data ? { id: s.data.id, policy: s.data.policy_title, leadIn: s.data.lead_in, body: s.data.body } : null}
        />
      </main>
    </div>
  );
}
