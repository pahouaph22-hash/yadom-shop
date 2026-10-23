'use client';
import { useState } from 'react';
import { useShop } from '@/components/Providers';
import { getSupabase } from '@/lib/supabase/client';
import { ChannelIcon, channelHref, CHANNEL_LABEL } from '@/components/channels';
import { errMsg } from '@/lib/format';

export default function ContactPage() {
  const { t, channels } = useShop();
  const [f, setF] = useState({ name: '', phone: '', email: '', subject: '', message: '' });
  const [state, setState] = useState({ busy: false, ok: false, error: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    if (!f.phone.trim() && !f.email.trim()) { setState({ error: t('phoneOrEmail') }); return; }
    setState({ busy: true });
    const { error } = await getSupabase().rpc('submit_contact', {
      p_name: f.name, p_phone: f.phone, p_email: f.email, p_subject: f.subject, p_message: f.message,
    });
    if (error) setState({ error: errMsg(error) });
    else { setState({ ok: true }); setF({ name: '', phone: '', email: '', subject: '', message: '' }); }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 md:grid-cols-2">
      <section>
        <h1 className="font-display text-3xl font-bold">{t('contactUs')}</h1>
        <ul className="mt-6 space-y-3">
          {channels.map((c) => {
            const href = channelHref(c);
            return (
              <li key={c.id}>
                <a href={href || undefined} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-4 rounded-xl border border-line bg-white p-4 hover:border-jade">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-jade text-white"><ChannelIcon type={c.type} /></span>
                  <span><span className="block text-sm text-ink-soft">{c.label || CHANNEL_LABEL[c.type]}</span><span className="font-semibold">{c.value}</span></span>
                </a>
              </li>
            );
          })}
        </ul>
      </section>
      <form onSubmit={submit} className="card space-y-4 p-6">
        <h2 className="font-display text-xl font-bold">{t('sendMessage')}</h2>
        <label className="block"><span className="label">{t('name')} *</span><input required maxLength={120} className="input" value={f.name} onChange={set('name')} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block"><span className="label">{t('phone')}</span><input inputMode="tel" maxLength={30} className="input" value={f.phone} onChange={set('phone')} /></label>
          <label className="block"><span className="label">{t('email')}</span><input type="email" maxLength={160} className="input" value={f.email} onChange={set('email')} /></label>
        </div>
        <label className="block"><span className="label">{t('subject')}</span><input maxLength={160} className="input" value={f.subject} onChange={set('subject')} /></label>
        <label className="block"><span className="label">{t('message')} *</span><textarea required maxLength={4000} rows={5} className="input" value={f.message} onChange={set('message')} /></label>
        {state.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
        {state.ok && <p role="status" className="rounded-lg bg-jade-mist p-3 text-sm text-jade">{t('messageSent')}</p>}
        <button disabled={state.busy} className="btn-primary w-full">{t('sendMessage')}</button>
      </form>
    </div>
  );
}
