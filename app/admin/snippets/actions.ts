'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { audit } from '@/lib/supabase/admin';

export async function reviewSnippet(formData: FormData) {
  const me = await requireAdmin();
  const id = String(formData.get('id'));
  const decision = String(formData.get('decision')) as 'approved' | 'rejected';
  const body = String(formData.get('body') ?? '').trim();
  const leadIn = String(formData.get('lead_in') ?? '').trim() || null;
  const supabase = await createClient();
  const { error } = await supabase.from('policy_snippets')
    .update({ status: decision, body: body || undefined, lead_in: leadIn, reviewed_by: me.id, reviewed_at: new Date().toISOString() })
    .eq('id', id).eq('org_id', me.org_id);
  if (!error) await audit(me.org_id, me.id, `snippet.${decision}`, { type: 'policy_snippet', id });
  revalidatePath('/admin/snippets');
}
