'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useShop } from './Providers';
import { LANGS } from '@/lib/i18n';
import { pickLang } from '@/lib/format';
import { ChannelIcon, channelHref, CHANNEL_LABEL } from './channels';

export function LangCurrency({ compact }) {
  const { lang, setLang, currency, setCurrency, t } = useShop();
  return (
    <div className="flex items-center gap-2">
      <div className="flex rounded-lg border border-line bg-white p-0.5" role="group" aria-label="Language">
        {LANGS.map((l) => (
          <button key={l.code} onClick={() => setLang(l.code)} aria-pressed={lang === l.code}
            className={`rounded-md px-2 py-1 text-xs font-semibold ${lang === l.code ? 'bg-jade text-white' : 'text-ink-soft hover:text-jade'}`}>
            {l.label}
          </button>
        ))}
      </div>
      <select aria-label={t('currency')} value={currency} onChange={(e) => setCurrency(e.target.value)}
        className={`rounded-lg border border-line bg-white px-2 py-1 text-xs font-semibold ${compact ? '' : ''}`}>
        <option value="LAK">₭ LAK</option>
        <option value="THB">฿ THB</option>
      </select>
    </div>
  );
}

export function Header() {
  const { t, lang, settings, cart, user, isStaff } = useShop();
  const [open, setOpen] = useState(false);
  const count = cart.reduce((s, x) => s + x.qty, 0);
  const name = pickLang(settings.store_name, lang) || 'ຢາດົມຫອມລາວ';
  const links = [
    { href: '/#products', label: t('products') },
    { href: '/track', label: t('track') },
    { href: '/contact', label: t('contact') },
  ];
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur no-print">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="font-display text-xl font-bold text-jade">{name}</Link>
        <nav className="ml-4 hidden gap-5 text-sm font-medium text-ink-soft md:flex">
          {links.map((l) => <Link key={l.href} href={l.href} className="hover:text-jade">{l.label}</Link>)}
        </nav>
        <div className="ml-auto hidden md:block"><LangCurrency /></div>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          {isStaff && <Link href="/admin" className="btn-ghost btn-sm hidden sm:inline-flex">{t('admin')}</Link>}
          <Link href={user ? '/account' : '/login'} className="hidden text-sm font-medium text-ink-soft hover:text-jade sm:block">
            {user ? t('account') : t('login')}
          </Link>
          <Link href="/cart" className="btn-primary btn-sm" aria-label={`${t('cart')} (${count})`}>
            {t('cart')} <span className="rounded-full bg-saffron px-1.5 text-ink">{count}</span>
          </Link>
          <button className="btn-ghost btn-sm md:hidden" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Menu">☰</button>
        </div>
      </div>
      {open && (
        <div className="border-t border-line px-4 py-3 md:hidden">
          <nav className="mb-3 flex flex-col gap-2 text-sm font-medium">
            {links.map((l) => <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.label}</Link>)}
            <Link href={user ? '/account' : '/login'} onClick={() => setOpen(false)}>{user ? t('account') : t('login')}</Link>
            {isStaff && <Link href="/admin">{t('admin')}</Link>}
          </nav>
          <LangCurrency />
        </div>
      )}
    </header>
  );
}

export function Footer() {
  const { t, lang, settings, channels } = useShop();
  return (
    <footer className="mt-16 no-print">
      <div className="ikat h-6" aria-hidden="true" />
      <div className="bg-jade-deep text-jade-mist">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-3">
          <div>
            <p className="font-display text-2xl font-bold text-white">{pickLang(settings.store_name, lang)}</p>
            <p className="mt-2 max-w-xs text-sm opacity-80">{pickLang(settings.store_tagline, lang)}</p>
          </div>
          <div className="md:col-span-2">
            <p className="mb-3 text-sm font-semibold text-saffron">{t('contactUs')}</p>
            {channels.length === 0 ? <p className="text-sm opacity-70">—</p> : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {channels.map((c) => {
                  const href = channelHref(c);
                  const inner = (<><ChannelIcon type={c.type} /><span><span className="block text-xs opacity-70">{c.label || CHANNEL_LABEL[c.type]}</span>{c.value}</span></>);
                  return (
                    <li key={c.id}>
                      {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 text-sm hover:text-white">{inner}</a>
                        : <span className="flex items-start gap-3 text-sm">{inner}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
        <p className="border-t border-white/10 py-4 text-center text-xs opacity-60">© {new Date().getFullYear()} {pickLang(settings.store_name, 'en')}</p>
      </div>
    </footer>
  );
}

export function ChatButton() {
  const { channels, t } = useShop();
  const c = channels.find((x) => x.type === 'whatsapp') || channels.find((x) => x.type === 'line') || channels.find((x) => x.type === 'facebook');
  if (!c) return null;
  return (
    <a href={channelHref(c)} target="_blank" rel="noopener noreferrer"
      className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-saffron px-4 py-3 text-sm font-semibold text-ink shadow-lg hover:bg-saffron-deep hover:text-white no-print">
      <ChannelIcon type={c.type} /> {t('chatNow')}
    </a>
  );
}
