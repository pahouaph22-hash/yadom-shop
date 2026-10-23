'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useShop } from '@/components/Providers';
import { getSupabase } from '@/lib/supabase/client';
import { errMsg } from '@/lib/format';
import { withBase } from '@/lib/base';

export default function ForgotPage() {
  const { t } = useShop();
  const [email, setEmail] = useState('');
  const [state, setState] = useState({});
  async function submit(e) {
    e.preventDefault();
    setState({ busy: true });
    const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}${withBase('/reset-password/')}`,
    });
    // Same message whether or not the email exists, so the form can't be used to discover accounts
    if (error && !/not.*found/i.test(error.message)) setState({ error: errMsg(error) });
    else setState({ ok: true });
  }
  return (
    <div className="px-4">
      <form onSubmit={submit} className="card mx-auto mt-12 max-w-sm space-y-4 p-6">
        <h1 className="font-display text-2xl font-bold">{t('forgotTitle')}</h1>
        <p className="text-sm text-ink-soft">{t('forgotHint')}</p>
        <label className="block"><span className="label">{t('email')}</span>
          <input required type="email" autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
        {state.ok && <p role="status" className="rounded-lg bg-jade-mist p-3 text-sm text-jade">{t('linkSent')}</p>}
        <button disabled={state.busy || state.ok} className="btn-primary w-full">{t('sendLink')}</button>
        <p className="text-center text-sm"><Link href="/login" className="font-semibold text-jade">← {t('login')}</Link></p>
      </form>
    </div>
  );
}
