'use client';
import { getSupabase } from './supabase/client';

export async function logout() {
  const sb = getSupabase();
  try { await sb.rpc('log_auth_event', { p_event: 'logout' }); } catch { /* still sign out */ }
  await sb.auth.signOut();
  window.location.href = '/';
}
