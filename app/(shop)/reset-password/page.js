'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useShop } from '@/components/Providers';
import { getSupabase } from '@/lib/supabase/client';
import { errMsg } from '@/lib/format';
import { withBase } from '@/lib/base';

export default function ResetPasswordPage() {
  const { t } = useShop();
  const [phase, setPhase] = useState('checking'); // checking | ready | invalid | done
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sb = getSupabase();
    let settled = false;
    const ok = () => { settled = true; setPhase('ready'); };
    // The email link signs the user in (the client exchanges the ?code= in the URL automatically)
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) ok();
    });
    sb.auth.getSession().then(({ data }) => { if (data.session) ok(); });
    const timer = setTimeout(() => { if (!settled) setPhase('invalid'); }, 6000);
    return () => { clearTimeout(timer); sub.subscription.unsubscribe(); };
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (pw !== pw2) return setError(t('passwordMismatch'));
    setBusy(true);
    const sb = getSupabase();
    const { error: err } = await sb.auth.updateUser({ password: pw });
    setBusy(false);
    if (err) return setError(errMsg(err));
    setPhase('done');
    try { await sb.rpc('log_auth_event', { p_event: 'login' }); } catch { /* not critical */ }
    const { data: staff } = await sb.rpc('is_staff');
    setTimeout(() => { window.location.href = withBase(staff ? '/admin/' : '/account/'); }, 1200);
  }

  return (
    <div className="px-4">
      <div className="card mx-auto mt-12 max-w-sm space-y-4 p-6">
        <h1 className="font-display text-2xl font-bold">{t('forgotTitle')}</h1>
        {phase === 'checking' && <p className="text-sm text-ink-soft">{t('checkingLink')}</p>}
        {phase === 'invalid' && (
          <>
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{t('linkInvalid')}</p>
            <Link href="/forgot" className="btn-primary w-full">{t('sendLink')}</Link>
          </>
        )}
        {phase === 'done' && <p role="status" className="rounded-lg bg-jade-mist p-3 text-sm text-jade">{t('passwordSaved')}</p>}
        {phase === 'ready' && (
          <form onSubmit={submit} className="space-y-4">
            <label className="block"><span className="label">{t('newPassword')}</span>
              <input required minLength={8} type="password" autoComplete="new-password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} /></label>
            <label className="block"><span className="label">{t('confirmPassword')}</span>
              <input required minLength={8} type="password" autoComplete="new-password" className="input" value={pw2} onChange={(e) => setPw2(e.target.value)} /></label>
            {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <button disabled={busy} className="btn-primary w-full">{t('savePassword')}</button>
          </form>
        )}
      </div>
    </div>
  );
}
