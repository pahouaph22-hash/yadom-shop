'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase/client';
import { useShop } from '@/components/Providers';
import { LangCurrency } from '@/components/ShopChrome';
import { WaybillFiles } from '@/components/ShipmentBox';
import { carrierLabel } from '@/lib/carriers';
import { CHANNEL_LABEL } from '@/components/channels';
import { dt, pickLang } from '@/lib/format';

function Receipt() {
  const sp = useSearchParams();
  const no = sp.get('no') || '';
  const phone = sp.get('phone') || '';
  const { t, lang, fmt, settings, channels } = useShop();
  const [o, setO] = useState(undefined);
  useEffect(() => {
    getSupabase().rpc('track_order', { p_order_no: no, p_phone: phone }).then(({ data }) => setO(data || null));
  }, [no, phone]);

  if (o === undefined) return <p className="p-10 text-center text-ink-soft">…</p>;
  if (o === null) return <p className="p-10 text-center text-red-700">{t('notFound')}</p>;
  const balance = Number(o.total) - Number(o.paid);
  const storeName = pickLang(settings.store_name, lang) || 'ຢາດົມຫອມລາວ';
  const phoneCh = channels.filter((c) => ['phone', 'whatsapp', 'address', 'facebook'].includes(c.type)).slice(0, 4);

  return (
    <div className="mx-auto max-w-3xl p-4 print:max-w-none print:p-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 no-print">
        <Link href={`/order?no=${encodeURIComponent(no)}&phone=${encodeURIComponent(phone)}`} className="btn-ghost btn-sm">← {t('back')}</Link>
        <div className="flex items-center gap-2">
          <LangCurrency />
          <button onClick={() => window.print()} className="btn-primary btn-sm">🖨 {t('printSave')}</button>
        </div>
      </div>

      <article className="overflow-hidden rounded-xl border border-line bg-white print:rounded-none print:border-0">
        <div className="ikat h-4" aria-hidden="true" />
        <header className="flex flex-wrap items-start justify-between gap-4 p-6">
          <div>
            <p className="font-display text-2xl font-bold text-jade">{storeName}</p>
            <ul className="mt-1 text-xs text-ink-soft">
              {phoneCh.map((c) => <li key={c.id}>{c.label || CHANNEL_LABEL[c.type]}: {c.value}</li>)}
            </ul>
          </div>
          <div className="text-right">
            <p className="font-display text-xl font-bold">{t('receipt')}</p>
            <p className="text-lg font-bold tracking-wide">{o.order_no}</p>
            <p className="text-xs text-ink-faint">{dt(o.created_at)}</p>
            <p className="mt-1 inline-block rounded-full bg-jade-mist px-2 py-0.5 text-xs font-semibold text-jade">{t(`st_${o.status}`)}</p>
          </div>
        </header>

        <section className="grid gap-4 border-t border-line p-6 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs text-ink-faint">{t('billTo')}</p>
            <p className="font-semibold">{o.ship_name}</p>
            <p>{o.ship_phone}</p>
            <p className="whitespace-pre-line text-ink-soft">{o.ship_address}</p>
          </div>
          {o.shipments?.length > 0 && (
            <div>
              {o.shipments.map((s) => (
                <div key={s.id} className="mb-2">
                  <p className="text-xs text-ink-faint">{t('carrier')}</p>
                  <p className="font-semibold">{carrierLabel(s, lang)}</p>
                  {s.tracking_no && <p>{t('trackingNo')}: <b className="text-base">{s.tracking_no}</b></p>}
                  {s.branch && <p>{t('pickupBranch')}: <b>{s.branch}</b></p>}
                  {s.branch_phone && <p>{t('branchPhone')}: {s.branch_phone}</p>}
                </div>
              ))}
            </div>
          )}
        </section>

        <table className="tbl border-t border-line">
          <thead><tr><th>{t('products')}</th><th className="text-right">{t('qty')}</th><th className="text-right">{t('price')}</th><th className="text-right">{t('total')}</th></tr></thead>
          <tbody>
            {(o.items || []).map((i, k) => (
              <tr key={k}><td>{i.name}</td><td className="text-right">{i.qty}</td><td className="text-right">{fmt(i.unit_price)}</td><td className="text-right">{fmt(i.line_total)}</td></tr>
            ))}
          </tbody>
          <tfoot className="text-sm">
            <tr><td colSpan={3} className="text-right">{t('subtotal')}</td><td className="text-right">{fmt(o.subtotal)}</td></tr>
            {Number(o.discount) > 0 && <tr><td colSpan={3} className="text-right">{t('discount')}</td><td className="text-right">−{fmt(o.discount)}</td></tr>}
            <tr><td colSpan={3} className="text-right">{t('shipping')}</td><td className="text-right">{fmt(o.shipping_fee)}</td></tr>
            <tr className="text-base font-bold"><td colSpan={3} className="text-right">{t('total')}</td><td className="text-right">{fmt(o.total)}</td></tr>
            <tr><td colSpan={3} className="text-right">{t('paidAmount')}</td><td className="text-right text-jade">{fmt(o.paid)}</td></tr>
            {balance > 0 && <tr className="font-semibold text-red-700"><td colSpan={3} className="text-right">{t('balance')}</td><td className="text-right">{fmt(balance)}</td></tr>}
          </tfoot>
        </table>

        {o.shipments?.some((s) => s.files?.length) && (
          <section className="border-t border-line p-6">
            <p className="mb-1 font-semibold">{t('waybill')}</p>
            <p className="mb-3 text-xs text-ink-soft">{t('pickupHint')}</p>
            {o.shipments.map((s) => <WaybillFiles key={s.id} files={s.files} t={t} />)}
          </section>
        )}
        <p className="border-t border-line p-4 text-center text-sm text-ink-soft">{t('thankYou')} · {storeName}</p>
      </article>
    </div>
  );
}

export default function Page() {
  return <Suspense><Receipt /></Suspense>;
}
