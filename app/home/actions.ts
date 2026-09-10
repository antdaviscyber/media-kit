'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function answerQuestion(questionId: string, answer: 'agree' | 'disagree' | 'not_sure') {
  const supabase = await createClient();
  const { error } = await supabase.rpc('answer_question', { p_question: questionId, p_answer: answer });
  if (error) return { ok: false, message: error.message };
  revalidatePath('/home');
  return { ok: true };
}

export async function logEvent(type: 'tip_viewed' | 'discussion_copied' | 'policy_snip_viewed', refType?: string, refId?: string) {
  const supabase = await createClient();
  await supabase.rpc('log_event', { p_type: type, p_ref_type: refType ?? null, p_ref_id: refId ?? null });
}
