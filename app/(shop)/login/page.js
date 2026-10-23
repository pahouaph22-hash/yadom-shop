'use client';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useShop } from '@/components/Providers';
import { getSupabase } from '@/lib/supabase/client';
import { errMsg } from '@/lib/format';

function LoginForm() {
  const { t } = useShop();
  const router = useRouter();
  const next = useSearchParams().get('next') || '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    const sb = getSupabase();
    const { error: err } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (err) { setBusy(false); setError(/confirm/i.test(err.message) ? t('emailNotConfirmed') : errMsg(err)); return; }
    const { data: staff } = await sb.rpc('is_staff');
    if (staff) {
      // Staff accounts sign in on the staff page only
      await sb.auth.signOut();
      setBusy(false);
      setError(t('staffAccountHere'));
      return;
    }
    await sb.rpc('log_auth_event', { p_event: 'login' });
    const dest = next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/admin') ? next : '/account';
    router.replace(dest);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card mx-auto mt-12 max-w-sm space-y-4 p-6">
      <h1 className="font-display text-2xl font-bold">{t('login')}</h1>
      <label className="block"><span className="label">{t('email')}</span><input required type="email" autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="block"><span className="label">{t('password')}</span><input required type="password" autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      <p className="-mt-2 text-right text-sm"><Link href="/forgot" className="text-jade hover:underline">{t('forgot')}</Link></p>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button disabled={busy} className="btn-primary w-full">{t('login')}</button>
      <p className="text-center text-sm text-ink-soft">{t('noAccount')} <Link href="/register" className="font-semibold text-jade">{t('register')}</Link></p>
    </form>
  );
}

export default function Page() {
  return <div className="px-4"><Suspense><LoginForm /></Suspense></div>;
}
