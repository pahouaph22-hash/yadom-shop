'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useShop } from '@/components/Providers';
import { getSupabase } from '@/lib/supabase/client';
import { errMsg } from '@/lib/format';
import { withBase } from '@/lib/base';

export default function RegisterPage() {
  const { t } = useShop();
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [state, setState] = useState({});
  async function submit(e) {
    e.preventDefault();
    setState({ busy: true });
    const { data, error } = await getSupabase().auth.signUp({
      email: f.email.trim(), password: f.password,
      options: { data: { full_name: f.name }, emailRedirectTo: `${window.location.origin}${withBase('/login/')}` },
    });
    if (error) setState({ error: errMsg(error) });
    else if (data.session) window.location.href = withBase('/account/');
    else setState({ ok: true });
  }
  return (
    <div className="px-4">
      <form onSubmit={submit} className="card mx-auto mt-12 max-w-sm space-y-4 p-6">
        <h1 className="font-display text-2xl font-bold">{t('register')}</h1>
        <label className="block"><span className="label">{t('fullName')}</span><input required maxLength={120} className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label className="block"><span className="label">{t('email')}</span><input required type="email" autoComplete="email" className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        <label className="block"><span className="label">{t('password')}</span><input required minLength={8} type="password" autoComplete="new-password" className="input" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></label>
        {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
        {state.ok && <p role="status" className="rounded-lg bg-jade-mist p-3 text-sm text-jade">{t('checkEmail')}</p>}
        <button disabled={state.busy} className="btn-primary w-full">{t('register')}</button>
        <p className="text-center text-sm text-ink-soft">{t('haveAccount')} <Link href="/login" className="font-semibold text-jade">{t('login')}</Link></p>
      </form>
    </div>
  );
}
