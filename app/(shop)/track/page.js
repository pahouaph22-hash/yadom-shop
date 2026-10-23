'use client';
import { useState } from 'react';
import { useShop } from '@/components/Providers';
import OrderView from '@/components/OrderView';

export default function TrackPage() {
  const { t } = useShop();
  const [no, setNo] = useState('');
  const [phone, setPhone] = useState('');
  const [q, setQ] = useState(null);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">{t('track')}</h1>
      <p className="mt-1 text-ink-soft">{t('trackHint')}</p>
      <form className="mt-6 grid gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(e) => { e.preventDefault(); setQ({ no: no.trim().toUpperCase(), phone }); }}>
        <input required className="input" placeholder="YD261023-0001" value={no} onChange={(e) => setNo(e.target.value)} aria-label={t('orderNo')} />
        <input required className="input" inputMode="tel" placeholder={t('phone')} value={phone} onChange={(e) => setPhone(e.target.value)} aria-label={t('phone')} />
        <button className="btn-primary">{t('check')}</button>
      </form>
      {q && <div className="mt-8"><OrderView key={q.no + q.phone} orderNo={q.no} phone={q.phone} /></div>}
    </div>
  );
}
