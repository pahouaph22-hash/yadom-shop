'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { translate } from '@/lib/i18n';
import { money } from '@/lib/format';

const Ctx = createContext(null);
export const useShop = () => useContext(Ctx);

function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function store(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

export default function Providers({ children, initialSettings = {}, initialChannels = [] }) {
  const [lang, setLangState] = useState('lo');
  const [currency, setCurrencyState] = useState('LAK');
  const [cart, setCart] = useState([]);
  const [settings, setSettings] = useState(initialSettings);
  const [channels, setChannels] = useState(initialChannels);
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [perms, setPerms] = useState([]);
  const [ready, setReady] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    setLangState(load('yd_lang', 'lo'));
    setCurrencyState(load('yd_currency', 'LAK'));
    setCart(load('yd_cart', []));
    setReady(true);
  }, []);
  useEffect(() => { if (ready) store('yd_cart', cart); }, [cart, ready]);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const refreshSettings = useCallback(async () => {
    const sb = getSupabase();
    const [{ data: s }, { data: c }] = await Promise.all([
      sb.from('settings').select('key,value'),
      sb.from('contact_channels').select('*').eq('is_active', true).order('sort'),
    ]);
    if (s) setSettings(Object.fromEntries(s.map((r) => [r.key, r.value])));
    if (c) setChannels(c);
  }, []);
  useEffect(() => { refreshSettings(); }, [refreshSettings]);

  useEffect(() => {
    const sb = getSupabase();
    const apply = async (session) => {
      // resolve the role before publishing the user, so guards never see "signed in but no role yet"
      let r = null;
      let p = [];
      if (session?.user) {
        const { data } = await sb.from('profiles').select('role, permissions, is_active').eq('id', session.user.id).maybeSingle();
        if (data) { r = data.is_active ? data.role : 'inactive'; p = data.permissions || []; }
      }
      setUser(session?.user ?? null);
      setRole(r);
      setPerms(p);
      setAuthReady(true);
    };
    // Supabase holds an auth lock while it runs this callback; calling another Supabase
    // method (our rpc) inside it deadlocks. So hand the work off to the next tick.
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      setTimeout(() => {
        apply(session).catch(() => { setUser(session?.user ?? null); setRole(null); setAuthReady(true); });
      }, 0);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo(() => {
    const rate = Number(settings.thb_rate) || 650;
    return {
      lang, currency, cart, settings, channels, user, role, ready, authReady, rate,
      isStaff: role === 'admin' || role === 'staff',
      isAdmin: role === 'admin',
      isCustomer: role === 'customer',
      perms,
      can: (perm) => role === 'admin' || (role === 'staff' && perms.includes(perm)),
      t: (k, v) => translate(lang, k, v),
      fmt: (lak) => money(lak, currency, rate),
      setLang: (l) => { setLangState(l); store('yd_lang', l); },
      setCurrency: (c) => { setCurrencyState(c); store('yd_currency', c); },
      refreshSettings,
      addToCart: (p, qty = 1) => setCart((c) => {
        const i = c.findIndex((x) => x.id === p.id);
        const max = p.stock ?? 9999;
        if (i >= 0) { const n = [...c]; n[i] = { ...n[i], qty: Math.min(max, n[i].qty + qty) }; return n; }
        return [...c, {
          id: p.id, sku: p.sku, name_lo: p.name_lo, name_th: p.name_th, name_en: p.name_en, image: p.images?.[0] || null,
          price_retail: Number(p.price_retail), price_wholesale: p.price_wholesale == null ? null : Number(p.price_wholesale),
          wholesale_min_qty: p.wholesale_min_qty, stock: p.stock, qty: Math.min(max, qty),
        }];
      }),
      setQty: (id, qty) => setCart((c) => c.map((x) => (x.id === id ? { ...x, qty: Math.max(1, Math.min(x.stock ?? 9999, qty)) } : x))),
      removeFromCart: (id) => setCart((c) => c.filter((x) => x.id !== id)),
      clearCart: () => setCart([]),
    };
  }, [lang, currency, cart, settings, channels, user, role, perms, ready, authReady, refreshSettings]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// Price for a cart line, mirroring the server rule (server is the source of truth)
export function linePrice(item) {
  const ws = item.price_wholesale != null && item.qty >= item.wholesale_min_qty;
  return { unit: ws ? item.price_wholesale : item.price_retail, wholesale: ws };
}
