'use client';
import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useShop } from '@/components/Providers';
import MemberFields, { EMPTY_MEMBER } from '@/components/MemberFields';
import StaffSessionNotice from '@/components/StaffSessionNotice';
import { getSupabase } from '@/lib/supabase/client';
import { logout } from '@/lib/logout';
import { withBase } from '@/lib/base';
import { dt, d, errMsg } from '@/lib/format';

const TABS = ['overview', 'orders', 'payments', 'profile', 'security'];
const TAB_KEY = { overview: 'tabOverview', orders: 'tabOrders', payments: 'tabPayments', profile: 'tabProfile', security: 'tabSecurity' };
const TAB_ICON = { overview: '◈', orders: '🛍', payments: '💳', profile: '👤', security: '🔒' };
const STATUS_CLS = {
  received: 'bg-indigo-dye/10 text-indigo-dye', pending_payment: 'bg-saffron-pale text-saffron-deep', paid: 'bg-jade-mist text-jade',
  shipping: 'bg-sky-100 text-sky-800', delivered: 'bg-jade text-white', cancelled: 'bg-red-50 text-red-700', refunded: 'bg-red-100 text-red-800',
};
const PROFILE_FIELDS = ['name', 'village', 'district', 'province', 'address', 'gender', 'birth_date', 'whatsapp'];

function Badge({ ok, t }) {
  return ok
    ? <span className="rounded-full bg-jade-mist px-2 py-0.5 text-xs font-semibold text-jade">✓ {t('verified')}</span>
    : <span className="rounded-full bg-saffron-pale px-2 py-0.5 text-xs font-semibold text-saffron-deep">{t('notVerified')}</span>;
}

function orderLink(o) {
  return `/order?no=${encodeURIComponent(o.order_no)}&phone=${encodeURIComponent(o.ship_phone || '')}`;
}

function OrderCard({ o, t, fmt }) {
  const due = Number(o.total) - Number(o.paid);
  const open = !['cancelled', 'refunded'].includes(o.status);
  return (
    <li className="rounded-xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold tracking-wide">{o.order_no}</p>
          <p className="text-xs text-ink-faint">{dt(o.created_at)}</p>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLS[o.status]}`}>{t(`st_${o.status}`)}</span>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-ink-soft">{o.items.map((i) => `${i.name} ×${i.qty}`).join(', ')}</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-2 border-t border-line pt-3">
        <div className="text-sm">
          <p className="text-lg font-bold">{fmt(o.total)}</p>
          {open && due > 0 && <p className="text-xs font-semibold text-red-700">{t('outstanding')} {fmt(due)}</p>}
        </div>
        <div className="flex gap-2">
          {open && due > 0 && <Link href={orderLink(o)} className="btn-gold btn-sm">{t('payOrder')}</Link>}
          <Link href={orderLink(o)} className="btn-ghost btn-sm">{t('details')}</Link>
        </div>
      </div>
    </li>
  );
}

function Account() {
  const { t, fmt, user, isStaff, authReady } = useShop();
  const router = useRouter();
  const sp = useSearchParams();
  const tab = TABS.includes(sp.get('tab')) ? sp.get('tab') : 'overview';
  const [data, setData] = useState(null);
  const [edit, setEdit] = useState(null);
  const [msg, setMsg] = useState({});
  const [filter, setFilter] = useState('');
  const [pw, setPw] = useState({ a: '', b: '' });

  useEffect(() => { if (authReady && !user) router.replace('/login?next=/account'); }, [authReady, user, router]);

  async function load() {
    const { data: a, error } = await getSupabase().rpc('my_activity');
    if (error) setMsg({ error: errMsg(error) }); else setData(a || { orders: [], transactions: [] });
  }
  useEffect(() => {
    if (!user || isStaff) return;
    (async () => {
      if (sp.get('verify') === 'email') {
        const { data: ok } = await getSupabase().rpc('mark_my_email_verified');
        if (ok) setMsg({ ok: t('emailVerifiedNow') });
      } else if (sp.get('welcome')) setMsg({ ok: t('welcome') });
      load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isStaff]);

  const member = data?.member || null;
  const orders = data?.orders || [];
  const txs = data?.transactions || [];
  const stats = useMemo(() => ({
    count: orders.filter((o) => o.status !== 'cancelled').length,
    spent: orders.filter((o) => !['cancelled', 'refunded'].includes(o.status)).reduce((s, o) => s + Number(o.total), 0),
    awaiting: orders.filter((o) => ['received', 'pending_payment'].includes(o.status) && Number(o.paid) < Number(o.total)).length,
    shipping: orders.filter((o) => o.status === 'shipping').length,
  }), [orders]);
  const completeness = member ? Math.round((PROFILE_FIELDS.filter((k) => member[k]).length / PROFILE_FIELDS.length) * 100) : 0;

  const go = (k) => router.replace(k === 'overview' ? '/account' : `/account?tab=${k}`, { scroll: false });
  const set = (k) => (e) => setEdit({ ...edit, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const startEdit = () => setEdit({ ...EMPTY_MEMBER, ...Object.fromEntries(Object.entries(member || {}).map(([k, v]) => [k, v ?? ''])), marketing_ok: !!member?.marketing_ok });

  async function saveProfile(e) {
    e.preventDefault();
    const { error } = await getSupabase().rpc('update_my_member', { p: edit });
    if (error) return setMsg({ error: errMsg(error) });
    setEdit(null); setMsg({ ok: t('saved') }); load();
  }
  async function sendVerify() {
    setMsg({});
    const { error } = await getSupabase().auth.signInWithOtp({
      email: user.email, options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}${withBase('/account/?tab=security&verify=email')}` },
    });
    setMsg(error ? { error: errMsg(error) } : { ok: t('linkSent') });
  }
  async function changePw(e) {
    e.preventDefault();
    if (pw.a !== pw.b) return setMsg({ error: t('passwordMismatch') });
    const { error } = await getSupabase().auth.updateUser({ password: pw.a });
    if (error) return setMsg({ error: errMsg(error) });
    setPw({ a: '', b: '' }); setMsg({ ok: t('passwordChanged') });
  }

  if (!user) return <p className="py-16 text-center text-ink-soft">…</p>;
  if (isStaff) return <div className="mx-auto max-w-md px-4 py-12"><StaffSessionNotice next="/login" /></div>;

  const displayName = member?.name || user.email.split('@')[0];
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
      {/* Member header */}
      <section className="relative overflow-hidden rounded-2xl bg-jade p-6 text-white md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-saffron font-display text-2xl font-bold text-ink">{displayName.slice(0, 1).toUpperCase()}</span>
            <div>
              <p className="text-sm text-jade-mist">{t('hello')}</p>
              <h1 className="font-display text-2xl font-bold md:text-3xl">{displayName}</h1>
              {member?.member_since && <p className="text-xs text-jade-mist">{t('memberSince')} {d(member.member_since)}</p>}
            </div>
          </div>
          <button onClick={logout} className="rounded-lg border border-white/30 px-3 py-1.5 text-sm hover:bg-white/10">{t('logout')}</button>
        </div>
        <div className="ikat absolute inset-x-0 bottom-0 h-2" aria-hidden="true" />
      </section>

      {(msg.ok || msg.error) && (
        <p role={msg.error ? 'alert' : 'status'} className={`mt-4 rounded-lg p-3 text-sm ${msg.error ? 'bg-red-50 text-red-700' : 'bg-jade-mist text-jade'}`}>{msg.error || msg.ok}</p>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-[210px_1fr]">
        {/* Tabs: horizontal scroll on mobile, sidebar on desktop */}
        <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:flex-col md:px-0" aria-label={t('account')}>
          {TABS.map((k) => (
            <button key={k} onClick={() => go(k)} aria-current={tab === k ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium ${tab === k ? 'bg-jade text-white' : 'bg-white text-ink-soft hover:bg-jade-wash md:bg-transparent'}`}>
              <span aria-hidden="true">{TAB_ICON[k]}</span>{t(TAB_KEY[k])}
              {k === 'orders' && stats.awaiting > 0 && <span className="ml-auto rounded-full bg-saffron px-1.5 text-xs text-ink">{stats.awaiting}</span>}
            </button>
          ))}
        </nav>

        <div className="min-w-0">
          {!data ? <p className="text-ink-soft">…</p> : (
            <>
              {tab === 'overview' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {[['statOrders', stats.count], ['statSpent', fmt(stats.spent)], ['statAwaiting', stats.awaiting], ['statShipping', stats.shipping]].map(([k, v]) => (
                      <div key={k} className="card p-4"><p className="text-xs text-ink-soft">{t(k)}</p><p className="mt-1 text-xl font-bold text-jade">{v}</p></div>
                    ))}
                  </div>
                  {completeness < 100 && (
                    <div className="card flex flex-wrap items-center gap-4 border-saffron p-4">
                      <div className="min-w-[200px] flex-1">
                        <p className="font-semibold">{t('completeProfile', { n: completeness })}</p>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-jade-mist"><div className="h-full rounded-full bg-saffron" style={{ width: `${completeness}%` }} /></div>
                        <p className="mt-2 text-xs text-ink-soft">{t('completeHint')}</p>
                      </div>
                      <button onClick={() => { go('profile'); startEdit(); }} className="btn-gold btn-sm">{t('fillNow')}</button>
                    </div>
                  )}
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="font-display text-xl font-bold">{t('recentOrders')}</h2>
                      {orders.length > 3 && <button onClick={() => go('orders')} className="text-sm text-jade hover:underline">{t('viewAll')}</button>}
                    </div>
                    {orders.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-line p-8 text-center text-ink-soft">
                        <p>{t('noOrders')}</p><Link href="/#products" className="btn-primary mt-4">{t('shopNow')}</Link>
                      </div>
                    ) : <ul className="grid gap-3 lg:grid-cols-2">{orders.slice(0, 4).map((o) => <OrderCard key={o.id} o={o} t={t} fmt={fmt} />)}</ul>}
                  </div>
                </div>
              )}

              {tab === 'orders' && (
                <div>
                  <div className="mb-4 flex flex-wrap gap-2">
                    {[['', t('all2')], ['open', t('inProgress')], ['delivered', t('st_delivered')], ['cancelled', t('st_cancelled')]].map(([k, l]) => (
                      <button key={k} onClick={() => setFilter(k)} className={filter === k ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}>{l}</button>
                    ))}
                  </div>
                  {(() => {
                    const list = orders.filter((o) => !filter || (filter === 'open' ? ['received', 'pending_payment', 'paid', 'shipping'].includes(o.status) : filter === 'cancelled' ? ['cancelled', 'refunded'].includes(o.status) : o.status === filter));
                    return list.length === 0
                      ? <p className="rounded-xl border border-dashed border-line p-8 text-center text-ink-soft">{t('noOrders')}</p>
                      : <ul className="grid gap-3 lg:grid-cols-2">{list.map((o) => <OrderCard key={o.id} o={o} t={t} fmt={fmt} />)}</ul>;
                  })()}
                </div>
              )}

              {tab === 'payments' && (
                txs.length === 0 ? <p className="rounded-xl border border-dashed border-line p-8 text-center text-ink-soft">{t('noTx')}</p> : (
                  <ol className="card divide-y divide-line">
                    {txs.map((x, i) => {
                      const sign = x.kind === 'refund' ? '−' : x.kind === 'payment' ? '+' : '';
                      const color = x.kind === 'refund' ? 'text-red-700' : x.kind === 'payment' ? 'text-jade' : 'text-ink-soft';
                      return (
                        <li key={i} className="flex flex-wrap items-center gap-3 p-4">
                          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${x.kind === 'refund' ? 'bg-red-50' : x.kind === 'payment' ? 'bg-jade-mist' : 'bg-saffron-pale'}`}>
                            {x.kind === 'refund' ? '↩' : x.kind === 'payment' ? '✓' : '📎'}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold">{t(`tx_${x.kind}`)}{x.kind === 'slip' && <span className="ml-2 text-xs font-normal">{t(`slip_${x.status}`)}</span>}
                              {x.method && <span className="ml-2 text-xs font-normal text-ink-faint">{t(`pm_${x.method}`)}</span>}</p>
                            <p className="text-xs text-ink-faint">{dt(x.at)} · <Link href={orderLink(x)} className="text-jade hover:underline">{x.order_no}</Link></p>
                            {x.review_note && <p className="text-xs text-ink-soft">{x.review_note}</p>}
                          </div>
                          {x.amount != null && <p className={`font-bold ${color}`}>{sign}{fmt(x.amount)}</p>}
                        </li>
                      );
                    })}
                  </ol>
                )
              )}

              {tab === 'profile' && (
                edit ? (
                  <form onSubmit={saveProfile} className="card space-y-6 p-5 md:p-6">
                    <MemberFields f={edit} set={set} withPhone={false} />
                    <div className="flex gap-2">
                      <button className="btn-primary flex-1">{t('save')}</button>
                      <button type="button" className="btn-ghost" onClick={() => setEdit(null)}>{t('cancel')}</button>
                    </div>
                  </form>
                ) : (
                  <div className="card p-5 md:p-6">
                    <dl className="grid gap-4 text-sm sm:grid-cols-2">
                      {[
                        ['fullName', member?.name], ['phone', member?.phone], ['email2', user.email], ['whatsapp', member?.whatsapp],
                        ['village', member?.village], ['district', member?.district], ['province', member?.province], ['address', member?.address],
                        ['gender', member?.gender && t(member.gender === 'other' ? 'otherGender' : member.gender)], ['birthDate', member?.birth_date && d(member.birth_date)],
                        ['facebook', member?.facebook], ['referral', member?.referral_source],
                      ].map(([k, v]) => (
                        <div key={k}><dt className="text-xs text-ink-faint">{t(k)}</dt><dd className={v ? 'font-medium' : 'text-ink-faint'}>{v || '—'}</dd></div>
                      ))}
                    </dl>
                    <button className="btn-primary mt-6" onClick={startEdit}>{t('editProfile')}</button>
                  </div>
                )
              )}

              {tab === 'security' && (
                <div className="space-y-4">
                  <div className="card space-y-2 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div><p className="text-xs text-ink-faint">{t('email2')}</p><p className="font-semibold">{user.email}</p></div>
                      <Badge ok={!!member?.email_verified_at} t={t} />
                    </div>
                    {!member?.email_verified_at && (<><button onClick={sendVerify} className="btn-ghost btn-sm">{t('verifyEmail')}</button><p className="text-xs text-ink-faint">{t('verifyEmailHint')}</p></>)}
                  </div>
                  <div className="card space-y-2 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div><p className="text-xs text-ink-faint">{t('phone')}</p><p className="font-semibold">{member?.phone || '—'}</p></div>
                      <Badge ok={!!member?.phone_verified_at} t={t} />
                    </div>
                    {!member?.phone_verified_at && <p className="text-xs text-ink-faint">{t('phoneVerifyHint')}</p>}
                  </div>
                  <form onSubmit={changePw} className="card space-y-3 p-5">
                    <p className="font-semibold">{t('changePassword')}</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input required minLength={8} type="password" autoComplete="new-password" className="input" placeholder={t('newPassword')} value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} />
                      <input required minLength={8} type="password" autoComplete="new-password" className="input" placeholder={t('confirmPassword')} value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} />
                    </div>
                    <button className="btn-primary btn-sm">{t('changePassword')}</button>
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AccountPage() {
  return <Suspense><Account /></Suspense>;
}
