'use client';

import { useState, useTransition } from 'react';
import { answerQuestion, logEvent } from './actions';

type Props = {
  question: { id: string; text: string } | null;
  answered: 'agree' | 'disagree' | 'not_sure' | null;
  tip: string | null;
  discussion: { id: string; title: string; points: string[] } | null;
  snippet: { id: string; policy: string; leadIn: string | null; body: string } | null;
};

export default function DailyCard({ question, answered, tip, discussion, snippet }: Props) {
  const [choice, setChoice] = useState(answered);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  function pick(a: 'agree' | 'disagree' | 'not_sure') {
    if (!question) return;
    setChoice(a);
    start(async () => { await answerQuestion(question.id, a); });
  }

  async function copyPoints() {
    if (!discussion) return;
    const text = `${discussion.title}\n\n${discussion.points.map((p, i) => `${i + 1}. ${p}`).join('\n')}`;
    try { await navigator.clipboard.writeText(text); } catch { /* clipboard blocked, still count the intent */ }
    setCopied(true);
    await logEvent('discussion_copied', 'library_discussion_set', discussion.id);
  }

  return (
    <div className="grid" style={{ gap: 16 }}>
      {question ? (
        <section className="card daily">
          <div className="kicker">Question of the day</div>
          <p className="big">{question.text}</p>
          <div className="choices">
            {(['agree', 'disagree', 'not_sure'] as const).map((a) => (
              <button key={a} type="button" disabled={pending}
                className={`choice ${choice === a ? 'on' : ''}`} onClick={() => pick(a)}>
                {a === 'not_sure' ? 'Not sure' : a[0].toUpperCase() + a.slice(1)}
              </button>
            ))}
          </div>
          <p className="muted small">{choice ? 'Thanks. Your answer is anonymous; the security team only sees totals.' : 'One tap. Anonymous. Helps the security team see how things really are.'}</p>
        </section>
      ) : null}

      {snippet ? (
        <section className="card daily snip">
          <div className="kicker">{snippet.leadIn ?? 'From the policy'}</div>
          <p>{snippet.body}</p>
          <p className="muted small">{snippet.policy}</p>
        </section>
      ) : null}

      {tip ? (
        <section className="card daily">
          <div className="kicker">Tip of the day</div>
          <p>{tip}</p>
        </section>
      ) : null}

      {discussion ? (
        <section className="card daily">
          <div className="kicker">Raise this with your team</div>
          <strong>{discussion.title}</strong>
          <ol>{discussion.points.map((p) => <li key={p}>{p}</li>)}</ol>
          <button type="button" className="btn secondary" onClick={copyPoints}>{copied ? 'Copied' : 'Copy for your meeting'}</button>
        </section>
      ) : null}
    </div>
  );
}
