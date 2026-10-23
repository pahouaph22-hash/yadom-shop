'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useShop } from '@/components/Providers';
import MemberFields, { EMPTY_MEMBER } from '@/components/MemberFields';
import { getSupabase } from '@/lib/supabase/client';
import { logout } from '@/lib/logout';
import { dt, d, errMsg } from '@/lib/format';

export default function AccountPage() {
  const { t, fmt, user, isStaff, authReady } = useShop();
  const router = useRouter();
  const [orders, setOrders] = useState(null);
  const [member, setMember] = useState(undefined);
  const [edit, setEdit] = useState(null);
  const [msg, setMsg] = useState({});

  useEffect(() => {
    if (!authReady) return;
    if (!user) router.replace('/login?next=/account');
    else if (isStaff) router.replace('/admin');
  }, [authReady, user, isStaff, router]);

  async function load() {
    const sb = getSupabase();
    const [{ data: o }, { data: m }] = await Promise.all([
      sb.from('orders').select('id,order_no,status,total,created_at,ship_phone').eq('user_id', user.id).order('created_at', { ascending: false }),
      sb.from('customers').select('*').eq('user_id', user.id).maybeSingle(),
    ]);
    setOrders(o || []);
    setMember(m || null);
  }
  useEffect(() => { if (user && !isStaff) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user, isStaff]);

  const set = (k) => (e) => setEdit({ ...edit, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  async function save(e) {
    e.preventDefault();
    const { error } = await getSupabase().rpc('update_my_member', { p: edit });
    if (error) return setMsg({ error: errMsg(error) });
    setEdit(null); setMsg({ ok: t('saved') }); load();
  }

  if (!user || isStaff) return <p className="py-16 text-center text-ink-soft">…</p>;
  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 lg:grid-cols-[1fr_1.3fr]">
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold">{t('myProfile')}</h1>
          <button onClick={logout} className="btn-ghost btn-sm">{t('logout')}</button>
        </div>
        {msg.ok && <p className="mb-3 rounded-lg bg-jade-mist p-3 text-sm text-jade">{msg.ok}</p>}
        {member === undefined ? <p className="text-ink-soft">…</p> : edit ? (
          <form onSubmit={save} className="card space-y-5 p-5">
            <MemberFields f={edit} set={set} withPhone={false} />
            {msg.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{msg.error}</p>}
            <div className="flex gap-2">
              <button className="btn-primary flex-1">{t('save')}</button>
              <button type="button" className="btn-ghost" onClick={() => setEdit(null)}>{t('cancel')}</button>
            </div>
          </form>
        ) : (
          <div className="card space-y-2 p-5 text-sm">
            <p className="text-lg font-semibold">{member?.name || user.email}</p>
            <p>{user.email}</p>
            {member && <>
              <p>{t('phone')}: {member.phone}</p>
              <p>{t('addressSection')}: {[member.address, member.village && `${t('village')} ${member.village}`, member.district && `${t('district')} ${member.district}`, member.province].filter(Boolean).join(', ') || '—'}</p>
              {member.whatsapp && <p>WhatsApp: {member.whatsapp}</p>}
              {member.member_since && <p className="text-xs text-ink-faint">{t('memberSince')} {d(member.member_since)}</p>}
            </>}
            <button className="btn-ghost btn-sm mt-2" onClick={() => {
              setMsg({});
              setEdit({ ...EMPTY_MEMBER, ...Object.fromEntries(Object.entries(member || {}).map(([k, v]) => [k, v ?? ''])), marketing_ok: !!member?.marketing_ok });
            }}>{t('editProfile')}</button>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 font-display text-2xl font-bold">{t('myOrders')}</h2>
        {orders === null ? <p className="text-ink-soft">…</p> : orders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line p-8 text-center text-ink-soft">
            <p>{t('noOrders')}</p>
            <Link href="/#products" className="btn-primary mt-4">{t('shopNow')}</Link>
          </div>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-white">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/order?no=${o.order_no}&phone=${encodeURIComponent(o.ship_phone || '')}`} className="flex items-center justify-between gap-3 p-4 hover:bg-jade-wash">
                  <span><span className="font-semibold">{o.order_no}</span><span className="block text-xs text-ink-faint">{dt(o.created_at)}</span></span>
                  <span className="text-sm">{t(`st_${o.status}`)}</span>
                  <span className="font-semibold">{fmt(o.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
