'use client';
import Link from 'next/link';
import { useShop } from './Providers';
import ProductCard from './ProductCard';
import { pickLang } from '@/lib/format';
import { ChannelIcon, channelHref, CHANNEL_LABEL } from './channels';
import { img } from './Activities';
import { HeroScrollCue } from './GlassHeader';
import { withBase } from '@/lib/base';

export default function Home({ products, loading, loadError }) {
  const { t, lang, settings, channels, currency } = useShop();
  const name = pickLang(settings.store_name, lang) || 'ຢາດົມຫອມລາວ';
  return (
    <>
      <section className="hero" aria-label={name}>
        <div className="hero-bg hidden md:block" role="img" aria-label="ຢາດົມຫອມລາວ" style={{ backgroundImage: `url(${withBase('/hero/hero-desktop.webp')})` }} />
        <div className="hero-bg md:hidden" role="img" aria-label="ຢາດົມຫອມລາວ" style={{ backgroundImage: `url(${withBase('/hero/hero-mobile.webp')})`, backgroundPosition: 'center 40%' }} />
        <HeroScrollCue />
        <div className="hero-copy">
          <div className="max-w-2xl">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-xs font-semibold tracking-wide text-white/90 backdrop-blur" style={{ background: 'rgba(255,255,255,.12)' }}>🏆 IYA 2024 · LAO HERBAL INHALANT</p>
            <h1 className="font-display text-5xl font-bold leading-[1.1] text-white sm:text-6xl md:text-7xl">{name}</h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-white/80 md:text-lg">{pickLang(settings.store_tagline, lang)}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href="#products" className="hero-btn bg-white text-ink hover:bg-jade-mist">{t('shopNow')} →</a>
            <Link href="/activities" className="hero-btn text-white" style={{ background: 'rgba(255,255,255,.14)', backdropFilter: 'blur(10px)' }}>{t('ourJourney')}</Link>
          </div>
        </div>
      </section>
      <div className="ikat h-6" aria-hidden="true" />

      <section className="reveal mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-6 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border-l-4 border-saffron pl-4">
              <p className="font-display text-lg font-bold text-jade">{t(`whyUs${i}t`)}</p>
              <p className="mt-1 text-sm text-ink-soft">{t(`whyUs${i}`)}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="products" className="reveal mx-auto max-w-6xl scroll-mt-24 px-4 py-6">
        <h2 className="font-display text-3xl font-bold text-ink">{t('ourProducts')}</h2>
        {currency === 'THB' && <p className="mt-1 text-xs text-ink-faint">{t('thbNote')}</p>}
        {loadError && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{loadError}</p>}
        {loading ? (
          <p className="mt-6 text-ink-soft">…</p>
        ) : products.length === 0 && !loadError ? (
          <p className="mt-6 rounded-xl border border-dashed border-line p-10 text-center text-ink-soft">—</p>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
        )}
      </section>

      <section className="reveal mx-auto mt-16 max-w-6xl px-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-3xl font-bold text-ink">{t('ourJourney')}</h2>
            <p className="mt-1 max-w-xl text-ink-soft">{t('ourJourneySub')}</p>
          </div>
          <Link href="/activities" className="btn-ghost">{t('seeActivities')} →</Link>
        </div>
        <Link href="/activities" className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-4" aria-label={t('seeActivities')}>
          {['iya-guest', 'product-blue', 'aromdee-front-2', 'iya-team-girls', 'aromdee-meeting'].map((n, i) => (
            <span key={n} className={`group relative overflow-hidden rounded-2xl bg-jade-wash ${i === 0 ? 'col-span-2 row-span-2 aspect-square md:aspect-auto' : 'aspect-square'}`}>
              <img src={img(n, true)} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
              {i === 0 && <span className="absolute left-3 top-3 rounded-full bg-saffron px-3 py-1 text-xs font-bold text-ink">🏆 IYA 2024</span>}
            </span>
          ))}
        </Link>
      </section>

      <section className="reveal mx-auto mt-12 max-w-6xl px-4">
        <div className="grid gap-6 rounded-2xl bg-saffron-pale p-6 md:grid-cols-[1fr_auto] md:items-center md:p-10">
          <div>
            <h2 className="font-display text-2xl font-bold text-ink">{t('whyUs3t')}</h2>
            <p className="mt-2 max-w-lg text-ink-soft">{t('whyUs3')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {channels.slice(0, 3).map((c) => (
              <a key={c.id} href={channelHref(c) || '#'} target="_blank" rel="noopener noreferrer" className="btn-primary">
                <ChannelIcon type={c.type} /> {c.label || CHANNEL_LABEL[c.type]}
              </a>
            ))}
            <Link href="/contact" className="btn-ghost">{t('sendMessage')}</Link>
          </div>
        </div>
      </section>
    </>
  );
}
