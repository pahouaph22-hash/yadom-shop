'use client';
import Link from 'next/link';
import { useShop } from './Providers';
import { getSupabase } from '@/lib/supabase/client';
import { withBase } from '@/lib/base';

// Shown on customer pages when the browser is signed in with a staff/admin account
export default function StaffSessionNotice({ next = '/login' }) {
  const { t, user } = useShop();
  async function switchAccount() {
    try { await getSupabase().rpc('log_auth_event', { p_event: 'logout' }); } catch { /* ignore */ }
    await getSupabase().auth.signOut();
    window.location.href = withBase(next.endsWith('/') ? next : `${next}/`);
  }
  return (
    <div className="card h-fit space-y-3 border-2 border-indigo-dye/30 p-5">
      <h2 className="font-display text-xl font-bold">{t('staffSessionTitle')}</h2>
      <p className="text-sm text-ink-soft">{user?.email}</p>
      <p className="text-sm">{t('staffSessionHint')}</p>
      <div className="flex flex-wrap gap-2">
        <button onClick={switchAccount} className="btn-primary">{t('switchToCustomer')}</button>
        <Link href="/admin" className="btn-ghost">{t('goBackOffice')}</Link>
      </div>
    </div>
  );
}
