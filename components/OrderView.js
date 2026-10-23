'use client';
import { useEffect, useState } from 'react';
import { useShop } from './Providers';
import { getSupabase } from '@/lib/supabase/client';
import OrderTimeline from './OrderTimeline';
import PaymentBox from './PaymentBox';
import { dt } from '@/lib/format';

export default function OrderView({ orderNo, phone, isNew }) {
  const { t, fmt } = useShop();
  const [order, setOrder] = useState(undefined);
  const load = () => getSupabase().rpc('track_order', { p_order_no: orderNo, p_phone: phone }).then(({ data }) => setOrder(data || null));
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [orderNo, phone]);

  if (order === undefined) return <p className="py-10 text-center text-ink-soft">…</p>;
  if (order === null) return <p className="rounded-lg bg-red-50 p-4 text-red-700">{t('notFound')}</p>;
  return (
    <div className="space-y-6">
      {isNew && (
        <div className="rounded-2xl bg-jade p-6 text-white">
          <p className="font-display text-2xl font-bold">✓ {t('orderPlaced')}</p>
          <p className="mt-2 text-jade-mist">{t('keepOrderNo')}</p>
        </div>
      )}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-ink-soft">{t('orderNo')}</p>
        <p className="font-display text-3xl font-bold tracking-wide">{order.order_no}</p>
        <p className="w-full text-sm text-ink-faint">{dt(order.created_at)}</p>
      </div>
      <OrderTimeline status={order.status} history={order.history} />
      {['received', 'pending_payment'].includes(order.status) || Number(order.paid) < Number(order.total)
        ? <PaymentBox order={order} phone={phone} onChanged={load} /> : null}
      <table className="tbl card overflow-hidden">
        <thead><tr><th>{t('products')}</th><th className="text-right">{t('qty')}</th><th className="text-right">{t('price')}</th><th className="text-right">{t('total')}</th></tr></thead>
        <tbody>
          {(order.items || []).map((i, k) => (
            <tr key={k}><td>{i.name}</td><td className="text-right">{i.qty}</td><td className="text-right">{fmt(i.unit_price)}</td><td className="text-right">{fmt(i.line_total)}</td></tr>
          ))}
        </tbody>
        <tfoot className="text-sm">
          <tr><td colSpan={3} className="text-right">{t('subtotal')}</td><td className="text-right">{fmt(order.subtotal)}</td></tr>
          {Number(order.discount) > 0 && <tr><td colSpan={3} className="text-right">{t('discount')}</td><td className="text-right">−{fmt(order.discount)}</td></tr>}
          <tr><td colSpan={3} className="text-right">{t('shipping')}</td><td className="text-right">{fmt(order.shipping_fee)}</td></tr>
          <tr className="font-bold"><td colSpan={3} className="text-right">{t('total')}</td><td className="text-right">{fmt(order.total)}</td></tr>
        </tfoot>
      </table>
    </div>
  );
}
