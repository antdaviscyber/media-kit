'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, audit } from '@/lib/supabase/admin';

export async function nudge(formData: FormData) {
  const profileId = String(formData.get('profile_id'));
  const supabase = await createClient();
  await supabase.rpc('nudge_champion', { p_profile: profileId });
  // The email itself lands in slice 3; for now the nudge is recorded.
  revalidatePath('/admin/at-risk');
}

export async function markInactive(formData: FormData) {
  const me = await requireAdmin();
  const profileId = String(formData.get('profile_id'));
  const supabase = await createClient();
  const { error } = await supabase.from('profiles').update({ status: 'inactive' }).eq('id', profileId).eq('org_id', me.org_id);
  if (!error) await audit(me.org_id, me.id, 'champion.mark_inactive', { type: 'profile', id: profileId });
  revalidatePath('/admin/at-risk'); revalidatePath('/admin/champions'); revalidatePath('/admin');
}

export async function setExpectation(formData: FormData) {
  const me = await requireAdmin();
  const profileId = String(formData.get('profile_id'));
  const value = String(formData.get('value')) as 'full' | 'light' | 'none';
  const admin = createAdminClient();
  const { error } = await admin.from('profiles').update({ engagement_expectation: value }).eq('id', profileId).eq('org_id', me.org_id);
  if (!error) await audit(me.org_id, me.id, 'champion.set_expectation', { type: 'profile', id: profileId }, { value });
  revalidatePath('/admin/at-risk'); revalidatePath('/admin/champions'); revalidatePath('/admin');
}
