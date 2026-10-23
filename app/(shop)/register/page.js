'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useShop } from '@/components/Providers';
import MemberFields, { EMPTY_MEMBER } from '@/components/MemberFields';
import StaffSessionNotice from '@/components/StaffSessionNotice';
import { getSupabase } from '@/lib/supabase/client';
import { errMsg } from '@/lib/format';
import { withBase } from '@/lib/base';

export default function RegisterPage() {
  const { t, isStaff } = useShop();
  const [f, setF] = useState({ ...EMPTY_MEMBER, email: '', password: '' });
  const [state, setState] = useState({});
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function submit(e) {
    e.preventDefault();
    if (f.birth_date && (f.birth_date > new Date().toISOString().slice(0, 10) || f.birth_date < '1920-01-01')) {
      return setState({ error: t('badBirth') });
    }
    setState({ busy: true });
    const sb = getSupabase();
    const { data: taken } = await sb.rpc('member_phone_taken', { p_phone: f.phone });
    if (taken) return setState({ error: t('phoneTaken') });
    const meta = { ...f, full_name: f.name, account_type: 'customer' };
    delete meta.password; delete meta.email;
    const { data, error } = await sb.auth.signUp({
      email: f.email.trim(), password: f.password,
      options: { data: meta, emailRedirectTo: `${window.location.origin}${withBase('/login/')}` },
    });
    if (error) return setState({ error: errMsg(error) });
    if (data.session) window.location.href = withBase('/account/');
    else setState({ ok: true, email: f.email.trim() });
  }

  async function resend() {
    const { error } = await getSupabase().auth.resend({ type: 'signup', email: state.email,
      options: { emailRedirectTo: `${window.location.origin}${withBase('/login/')}` } });
    setState({ ...state, resent: error ? errMsg(error) : t('resent') });
  }

  if (isStaff) return <div className="mx-auto max-w-md px-4 py-12"><StaffSessionNotice next="/register" /></div>;
  if (state.ok) {
    return (
      <div className="px-4">
        <div className="card mx-auto my-12 max-w-md space-y-4 border-2 border-jade p-6 text-center">
          <p className="text-4xl">📧</p>
          <h1 className="font-display text-2xl font-bold text-jade">{t('regDoneTitle')}</h1>
          <p className="text-ink-soft">{t('regDoneBody', { email: state.email })}</p>
          <div className="flex flex-col gap-2">
            <Link href="/login" className="btn-primary">{t('login')}</Link>
            <button type="button" onClick={resend} className="btn-ghost">{t('resend')}</button>
            {state.resent && <p className="text-sm text-ink-soft">{state.resent}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4">
      <form onSubmit={submit} className="card mx-auto my-10 max-w-xl space-y-6 p-6">
        <div>
          <h1 className="font-display text-2xl font-bold">{t('register')}</h1>
          <p className="text-sm text-ink-soft">{t('memberOnlyHint')}</p>
        </div>
        <fieldset className="space-y-3">
          <legend className="mb-1 font-semibold text-jade">{t('accountSection')}</legend>
          <label className="block"><span className="label">{t('email')} *</span><input required type="email" autoComplete="email" className="input" value={f.email} onChange={set('email')} /></label>
          <label className="block"><span className="label">{t('password')} * (8+)</span><input required minLength={8} type="password" autoComplete="new-password" className="input" value={f.password} onChange={set('password')} /></label>
        </fieldset>
        <MemberFields f={f} set={set} />
        {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
        <button disabled={state.busy} className="btn-primary w-full py-3">{state.busy ? '…' : t('register')}</button>
        <p className="text-center text-sm text-ink-soft">{t('haveAccount')} <Link href="/login" className="font-semibold text-jade">{t('login')}</Link></p>
      </form>
    </div>
  );
}
