'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useShop } from './Providers';
import { carrierLabel } from '@/lib/carriers';
import { dt } from '@/lib/format';

export function WaybillFiles({ files, t }) {
  if (!files?.length) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {files.map((f) => (f.toLowerCase().endsWith('.pdf') ? (
        <a key={f} href={f} target="_blank" rel="noopener noreferrer" className="btn-ghost">📄 {t('waybill')} (PDF)</a>
      ) : (
        <a key={f} href={f} target="_blank" rel="noopener noreferrer" className="block" title={t('openImage')}>
          <img src={f} alt={t('waybill')} className="w-full rounded-lg border border-line bg-white object-contain" />
        </a>
      )))}
    </div>
  );
}

export default function ShipmentBox({ order, phone }) {
  const { t, lang } = useShop();
  const [copied, setCopied] = useState('');
  if (!order.shipments?.length) return null;
  return (
    <section className="card space-y-4 border-2 border-jade p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl font-bold">🚚 {t('shipmentTitle')}</h2>
        <Link href={`/receipt?no=${encodeURIComponent(order.order_no)}&phone=${encodeURIComponent(phone)}`} className="btn-gold btn-sm">🧾 {t('viewReceipt')}</Link>
      </div>
      <p className="rounded-lg bg-saffron-pale p-3 text-sm">{t('pickupHint')}</p>
      {order.shipments.map((s) => (
        <div key={s.id} className="space-y-3">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-ink-faint">{t('carrier')}</dt><dd className="font-semibold">{carrierLabel(s, lang)}</dd></div>
            {s.tracking_no && (
              <div><dt className="text-ink-faint">{t('trackingNo')}</dt>
                <dd className="flex items-center gap-2"><b className="text-lg tracking-wide">{s.tracking_no}</b>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => { navigator.clipboard?.writeText(s.tracking_no); setCopied(s.id); setTimeout(() => setCopied(''), 1500); }}>
                    {copied === s.id ? `✓ ${t('copied')}` : t('copy')}</button></dd></div>
            )}
            {s.branch && <div><dt className="text-ink-faint">{t('pickupBranch')}</dt><dd className="font-semibold">{s.branch}</dd></div>}
            {s.branch_phone && <div><dt className="text-ink-faint">{t('branchPhone')}</dt><dd><a className="text-jade underline" href={`tel:${s.branch_phone.replace(/[^\d+]/g, '')}`}>{s.branch_phone}</a></dd></div>}
            <div><dt className="text-ink-faint">{t('st_shipping')}</dt><dd>{dt(s.shipped_at)}</dd></div>
            {s.note && <div className="sm:col-span-2"><dt className="text-ink-faint">{t('note')}</dt><dd>{s.note}</dd></div>}
          </dl>
          <WaybillFiles files={s.files} t={t} />
        </div>
      ))}
    </section>
  );
}
