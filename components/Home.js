'use client';
import Link from 'next/link';
import { useShop } from './Providers';
import ProductCard, { InhalerArt } from './ProductCard';
import { pickLang } from '@/lib/format';
import { ChannelIcon, channelHref, CHANNEL_LABEL } from './channels';

export default function Home({ products, loading, loadError }) {
  const { t, lang, settings, channels, currency } = useShop();
  const heroImg = products.find((p) => p.images?.length)?.images[0];
  const name = pickLang(settings.store_name, lang) || 'ຢາດົມຫອມລາວ';
  return (
    <>
      <section className="relative overflow-hidden bg-jade text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-14 md:grid-cols-[1.2fr_1fr] md:py-20">
          <div>
            <h1 className="font-display text-5xl font-bold leading-[1.15] text-white sm:text-6xl md:text-7xl">{name}</h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-jade-mist">{pickLang(settings.store_tagline, lang)}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#products" className="btn-gold px-6 py-3 text-base">{t('shopNow')}</a>
              <Link href="/contact" className="btn border border-white/30 px-6 py-3 text-base text-white hover:bg-white/10">{t('contactUs')}</Link>
            </div>
            <p className="mt-4 text-sm text-jade-mist/80">{t('guestOk')}</p>
          </div>
          <div className="relative mx-auto w-full max-w-[220px] md:max-w-sm">
            <div className="aspect-[3/4] overflow-hidden rounded-t-full border-4 border-saffron bg-jade-mist">
              {heroImg ? <img src={heroImg} alt="" className="h-full w-full object-cover" /> : <InhalerArt className="h-full w-full" />}
            </div>
          </div>
        </div>
      </section>
      <div className="ikat h-6" aria-hidden="true" />

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-6 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border-l-4 border-saffron pl-4">
              <p className="font-display text-lg font-bold text-jade">{t(`whyUs${i}t`)}</p>
              <p className="mt-1 text-sm text-ink-soft">{t(`whyUs${i}`)}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="products" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-6">
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

      <section className="mx-auto mt-12 max-w-6xl px-4">
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
