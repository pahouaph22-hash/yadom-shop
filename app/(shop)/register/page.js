'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useShop } from '@/components/Providers';
import StaffSessionNotice from '@/components/StaffSessionNotice';
import { getSupabase } from '@/lib/supabase/client';
import { errMsg } from '@/lib/format';
import { withBase } from '@/lib/base';

export default function RegisterPage() {
  const { t, isStaff } = useShop();
  const [f, setF] = useState({ email: '', phone: '', password: '', password2: '' });
  const [state, setState] = useState({});
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    if (f.password !== f.password2) return setState({ error: t('passwordMismatch') });
    if (f.phone.replace(/\D/g, '').length < 8) return setState({ error: t('phone') + ' ?' });
    setState({ busy: true });
    const sb = getSupabase();
    const { data: taken } = await sb.rpc('member_phone_taken', { p_phone: f.phone });
    if (taken) return setState({ error: t('phoneTaken') });
    const { data, error } = await sb.auth.signUp({
      email: f.email.trim(), password: f.password,
      options: { data: { phone: f.phone.trim(), account_type: 'customer' }, emailRedirectTo: `${window.location.origin}${withBase('/account/')}` },
    });
    if (error) return setState({ error: /registered/i.test(error.message) ? t('haveAccount') + ' → ' + t('login') : errMsg(error) });
    if (data.session) window.location.href = withBase('/account/?welcome=1');
    else setState({ ok: true, email: f.email.trim() });
  }

  if (isStaff) return <div className="mx-auto max-w-md px-4 py-12"><StaffSessionNotice next="/register" /></div>;
  if (state.ok) {
    return (
      <div className="px-4">
        <div className="card mx-auto my-12 max-w-md space-y-4 border-2 border-jade p-6 text-center">
          <p className="text-4xl">📧</p>
          <h1 className="font-display text-2xl font-bold text-jade">{t('regDoneTitle')}</h1>
          <p className="text-ink-soft">{t('regDoneBody', { email: state.email })}</p>
          <Link href="/login" className="btn-primary w-full">{t('login')}</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4">
      <div className="mx-auto my-10 grid max-w-4xl overflow-hidden rounded-2xl border border-line bg-white md:grid-cols-2">
        <div className="relative hidden flex-col justify-between bg-jade p-8 text-white md:flex">
          <div>
            <p className="font-display text-3xl font-bold">ຢາດົມຫອມລາວ</p>
            <p className="mt-3 text-jade-mist">{t('memberOnlyHint')}</p>
          </div>
          <ul className="space-y-3 text-sm">
            {['whyUs1t', 'whyUs2t', 'whyUs3t'].map((k) => <li key={k} className="flex gap-2"><span className="text-saffron">◆</span>{t(k)}</li>)}
          </ul>
          <div className="ikat absolute inset-x-0 bottom-0 h-3" aria-hidden="true" />
        </div>
        <form onSubmit={submit} className="space-y-4 p-6 md:p-8">
          <div>
            <h1 className="font-display text-2xl font-bold">{t('register')}</h1>
            <p className="text-sm text-ink-soft">{t('registerHint')}</p>
          </div>
          <label className="block"><span className="label">{t('email')}</span>
            <input required type="email" autoComplete="email" className="input" value={f.email} onChange={set('email')} placeholder="name@gmail.com" /></label>
          <label className="block"><span className="label">{t('phone')} (WhatsApp)</span>
            <input required inputMode="tel" autoComplete="tel" maxLength={30} className="input" value={f.phone} onChange={set('phone')} placeholder="020 xxxx xxxx" /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="label">{t('password')} (8+)</span>
              <input required minLength={8} type="password" autoComplete="new-password" className="input" value={f.password} onChange={set('password')} /></label>
            <label className="block"><span className="label">{t('confirmPassword')}</span>
              <input required minLength={8} type="password" autoComplete="new-password" className="input" value={f.password2} onChange={set('password2')} /></label>
          </div>
          {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
          <button disabled={state.busy} className="btn-primary w-full py-3">{state.busy ? '…' : t('register')}</button>
          <p className="text-center text-sm text-ink-soft">{t('haveAccount')} <Link href="/login" className="font-semibold text-jade">{t('login')}</Link></p>
        </form>
      </div>
    </div>
  );
}
