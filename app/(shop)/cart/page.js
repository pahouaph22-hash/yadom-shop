'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useShop, linePrice } from '@/components/Providers';
import { getSupabase } from '@/lib/supabase/client';
import { productName, errMsg, pickLang } from '@/lib/format';
import { PAY_METHODS } from '@/lib/i18n';
import { fullAddress } from '@/components/MemberFields';
import StaffSessionNotice from '@/components/StaffSessionNotice';

function getKey(cart) {
  const sig = cart.map((x) => `${x.id}:${x.qty}`).join('|');
  try {
    const saved = JSON.parse(sessionStorage.getItem('yd_checkout') || 'null');
    if (saved && saved.sig === sig) return saved.key;
    const key = crypto.randomUUID();
    sessionStorage.setItem('yd_checkout', JSON.stringify({ sig, key }));
    return key;
  } catch { return crypto.randomUUID(); }
}

export default function CartPage() {
  const { t, lang, fmt, cart, setQty, removeFromCart, clearCart, settings, currency, user, authReady, role, isStaff } = useShop();
  const router = useRouter();
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', province: '', payment_method: 'bank_transfer' });
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [member, setMember] = useState(null);
  useEffect(() => {
    if (!user) return;
    getSupabase().from('customers').select('*').eq('user_id', user.id).maybeSingle().then(({ data }) => {
      if (!data) return;
      setMember(data);
      setForm((f) => ({ ...f, name: data.name || '', phone: data.phone || '', email: data.email || user.email || '',
        address: fullAddress(data), province: data.province || '' }));
    });
  }, [user]);

  const lines = cart.map((x) => ({ ...x, ...linePrice(x) }));
  const subtotal = lines.reduce((s, x) => s + x.unit * x.qty, 0);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!/\d{6,}/.test(form.phone.replace(/\D/g, ''))) { setError(t('phone') + ' ?'); return; }
    setBusy(true);
    const key = getKey(cart);
    const { data, error: err } = await getSupabase().rpc('place_order', {
      p_customer: form,
      p_items: cart.map((x) => ({ product_id: x.id, qty: x.qty })),
      p_idempotency_key: key,
      p_note: note || null,
      p_options: {},
    });
    setBusy(false);
    if (err) { setError(errMsg(err)); return; }
    try { sessionStorage.removeItem('yd_checkout'); } catch { /* ignore */ }
    clearCart();
    router.push(`/order?no=${encodeURIComponent(data.order_no)}&phone=${encodeURIComponent(form.phone)}&new=1`);
  }

  if (!cart.length) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-lg text-ink-soft">{t('emptyCart')}</p>
        <Link href="/#products" className="btn-primary mt-6">{t('shopNow')}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1.3fr_1fr]">
      <section>
        <h1 className="font-display text-3xl font-bold">{t('cart')}</h1>
        <ul className="mt-6 divide-y divide-line rounded-xl border border-line bg-white">
          {lines.map((x) => (
            <li key={x.id} className="flex gap-4 p-4">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-jade-mist">{x.image && <img src={x.image} alt="" className="h-full w-full object-cover" />}</div>
              <div className="flex-1">
                <p className="font-semibold">{productName(x, lang)}</p>
                <p className="text-sm text-ink-soft">{fmt(x.unit)} {x.wholesale && <span className="ml-1 rounded bg-saffron-pale px-1.5 text-xs text-saffron-deep">{t('wholesale')}</span>}</p>
                {!x.wholesale && x.price_wholesale != null && (
                  <p className="text-xs text-ink-faint">{t('wholesaleFrom', { p: fmt(x.price_wholesale), n: x.wholesale_min_qty })}</p>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <button className="btn-ghost btn-sm" onClick={() => setQty(x.id, x.qty - 1)} aria-label="-">−</button>
                  <input aria-label={t('qty')} type="number" className="input w-20 py-1 text-center" value={x.qty} min={1} max={x.stock}
                    onChange={(e) => setQty(x.id, Number(e.target.value) || 1)} />
                  <button className="btn-ghost btn-sm" onClick={() => setQty(x.id, x.qty + 1)} aria-label="+">+</button>
                  <button className="ml-2 text-xs text-red-700 hover:underline" onClick={() => removeFromCart(x.id)}>{t('remove')}</button>
                </div>
              </div>
              <p className="font-semibold">{fmt(x.unit * x.qty)}</p>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-between rounded-xl bg-jade-wash p-4 text-lg font-bold">
          <span>{t('subtotal')}</span><span>{fmt(subtotal)}</span>
        </div>
        <p className="mt-2 text-sm text-ink-soft">{pickLang(settings.shipping_note, lang)}</p>
        {currency === 'THB' && <p className="mt-1 text-xs text-ink-faint">{t('thbNote')}</p>}
      </section>

      {!authReady ? <div className="card h-fit p-5 text-ink-soft">…</div> : !user ? (
        <div className="card h-fit space-y-4 border-2 border-saffron p-5">
          <h2 className="font-display text-xl font-bold">🔒 {t('memberOnly')}</h2>
          <p className="text-sm text-ink-soft">{t('memberOnlyHint')}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Link href="/login?next=/cart" className="btn-primary">{t('login')}</Link>
            <Link href="/register" className="btn-gold">{t('register')}</Link>
          </div>
        </div>
      ) : isStaff ? (
        <StaffSessionNotice next="/login" />
      ) : role === 'inactive' ? (
        <p className="card h-fit p-5 text-red-700">{t('accountInactive')}</p>
      ) : (
      <form onSubmit={submit} className="card h-fit space-y-4 p-5">
        <h2 className="font-display text-xl font-bold">{t('yourDetails')}</h2>
        {member && <p className="rounded-lg bg-jade-wash p-2 text-xs text-ink-soft">✓ {t('myProfile')} — {t('shipToOther')}</p>}
        <label className="block"><span className="label">{t('name')} *</span><input required maxLength={120} className="input" value={form.name} onChange={set('name')} autoComplete="name" /></label>
        <label className="block"><span className="label">{t('phone')} * (WhatsApp)</span><input required inputMode="tel" maxLength={30} className="input" value={form.phone} onChange={set('phone')} autoComplete="tel" placeholder="020 xxxx xxxx" /></label>
        <label className="block"><span className="label">{t('address')} *</span><textarea required minLength={5} maxLength={400} rows={3} className="input" value={form.address} onChange={set('address')} autoComplete="street-address" /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="label">{t('province')}</span><input maxLength={80} className="input" value={form.province} onChange={set('province')} /></label>
          <label className="block"><span className="label">{t('email')}</span><input type="email" maxLength={160} className="input" value={form.email} onChange={set('email')} autoComplete="email" /></label>
        </div>
        <label className="block"><span className="label">{t('paymentMethod')}</span>
          <select className="input" value={form.payment_method} onChange={set('payment_method')}>
            {PAY_METHODS.filter((m) => m !== 'cash').map((m) => <option key={m} value={m}>{t(`pm_${m}`)}</option>)}
          </select>
        </label>
        {pickLang(settings.payment_info, lang) && <p className="whitespace-pre-line rounded-lg bg-saffron-pale p-3 text-sm">{pickLang(settings.payment_info, lang)}</p>}
        <label className="block"><span className="label">{t('note')}</span><textarea maxLength={1000} rows={2} className="input" value={note} onChange={(e) => setNote(e.target.value)} /></label>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button disabled={busy} className="btn-gold w-full py-3 text-base">{busy ? t('placing') : `${t('placeOrder')} · ${fmt(subtotal)}`}</button>
      </form>
      )}
    </div>
  );
}
