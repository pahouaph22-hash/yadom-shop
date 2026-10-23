'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useShop } from '@/components/Providers';
import { getSupabase } from '@/lib/supabase/client';
import { logout } from '@/lib/logout';
import { dt } from '@/lib/format';

export default function AccountPage() {
  const { t, fmt, user, isStaff } = useShop();
  const [orders, setOrders] = useState(null);
  useEffect(() => {
    if (!user) return;
    getSupabase().from('orders').select('id,order_no,status,total,created_at,ship_phone').eq('user_id', user.id)
      .order('created_at', { ascending: false }).then(({ data }) => setOrders(data || []));
  }, [user]);
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">{t('myOrders')}</h1>
          <p className="text-sm text-ink-soft">{user?.email}</p>
        </div>
        <div className="flex gap-2">
          {isStaff && <Link href="/admin" className="btn-primary">{t('admin')}</Link>}
          <button onClick={logout} className="btn-ghost">{t('logout')}</button>
        </div>
      </div>
      {orders === null ? <p className="mt-8 text-ink-soft">…</p> : orders.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-line p-8 text-center text-ink-soft">{t('noOrders')}</p>
      ) : (
        <ul className="mt-6 divide-y divide-line rounded-xl border border-line bg-white">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/order/${o.order_no}?phone=${encodeURIComponent(o.ship_phone || '')}`} className="flex items-center justify-between gap-3 p-4 hover:bg-jade-wash">
                <span><span className="font-semibold">{o.order_no}</span><span className="block text-xs text-ink-faint">{dt(o.created_at)}</span></span>
                <span className="text-sm">{t(`st_${o.status}`)}</span>
                <span className="font-semibold">{fmt(o.total)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
