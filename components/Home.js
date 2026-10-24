'use client';
import Link from 'next/link';
import { useShop } from './Providers';
import ProductCard from './ProductCard';
import { pickLang } from '@/lib/format';
import { ChannelIcon, channelHref, CHANNEL_LABEL } from './channels';
import { img } from './Activities';
import { withBase } from '@/lib/base';
import AwardVideo from './AwardVideo';

export default function Home({ products, loading, loadError }) {
  const { t, lang, settings, channels, currency } = useShop();
  const name = pickLang(settings.store_name, lang) || 'ຢາດົມຫອມລາວ';
  return (
    <>
      <section className="hb" aria-label={name}>
        <h1 className="sr-only">{name} — {pickLang(settings.store_tagline, lang)}</h1>
        <div className="hb-frame">
          <img className="hb-img" src={withBase('/hero/cover-v2.webp')}
            srcSet={`${withBase('/hero/cover-v2-1200.webp')} 1200w, ${withBase('/hero/cover-v2.webp')} 1912w`}
            sizes="100vw" width="1912" height="823" fetchPriority="high"
            alt="ຢາດົມຫອມລາວ — ຫອມສະບາຍ ກິ່ນທຳມະຊາດ ດີຕໍ່ທ່ານ · ຫອມທຳມະຊາດ ຈາກໃຈລາວ" />
        </div>
        <div className="hb-row">
          <p className="hb-chip"><span aria-hidden="true">🏆</span> IYA 2025 · The Best of Business Plan</p>
          <div className="hb-btns">
            <a href="#products" className="hb-btn hb-btn-main">{t('shopNow')} <span aria-hidden="true">→</span></a>
            <Link href="/activities" className="hb-btn hb-btn-ghost">{t('ourJourney')}</Link>
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

      <section className="reveal mx-auto max-w-6xl px-4 pb-14 pt-2" aria-labelledby="dream-title">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-saffron-pale px-3 py-1 text-xs font-bold uppercase tracking-wider text-saffron-deep">🏆 IYA 2025 · The Best of Business Plan</p>
            <h2 id="dream-title" className="mt-3 font-display text-3xl font-bold text-ink md:text-4xl">{t('dreamTitle')}</h2>
            <p className="mt-2 max-w-2xl text-ink-soft">{t('dreamSub')}</p>
          </div>
          <Link href="/activities#iya-2025" className="hb-btn hb-btn-ghost">{t('seeActivities')} →</Link>
        </div>
        <Link href="/activities#iya-2025" className="feature-banner block" aria-label={t('dreamTitle')}>
          <img src={img('iya25-banner')} srcSet={`${img('iya25-banner', true)} 960w, ${withBase('/activities/iya25-banner-1200.webp')} 1200w, ${img('iya25-banner')} 1942w`}
            sizes="(max-width: 1200px) 100vw, 1152px" width="1942" height="809" loading="lazy" className="w-full" alt={t('dreamTitle')} />
        </Link>
        <div className="mt-6 grid gap-5 md:grid-cols-[1.35fr_1fr] md:items-center">
          <AwardVideo caption={t('awardVideo')} />
          <dl className="grid grid-cols-2 content-start gap-3">
          {[['🏆', 'dreamStat1v', 'dreamStat1'], ['💰', 'dreamStat2v', 'dreamStat2'], ['👥', 'dreamStat3v', 'dreamStat3'], ['📅', 'dreamStat4v', 'dreamStat4']].map(([ic, v, k]) => (
            <div key={k} className="rounded-2xl border border-line bg-white p-4 shadow-sm">
              <dt className="text-xs font-semibold text-ink-faint"><span aria-hidden="true">{ic}</span> {t(k)}</dt>
              <dd className="mt-1 text-lg font-bold text-jade md:text-xl">{t(v)}{k === 'dreamStat3' && <span className="mt-0.5 block text-xs font-medium text-ink-soft">{t('dreamStat3s')}</span>}</dd>
            </div>
          ))}
        </dl>
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
          {['iya25-award-team', 'product-blue', 'iya25-pitch', 'iya-guest', 'aromdee-front-2'].map((n, i) => (
            <span key={n} className={`group relative overflow-hidden rounded-2xl bg-jade-wash ${i === 0 ? 'col-span-2 row-span-2 aspect-square md:aspect-auto' : 'aspect-square'}`}>
              <img src={img(n, true)} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
              {i === 0 && <span className="absolute left-3 top-3 rounded-full bg-saffron px-3 py-1 text-xs font-bold text-ink">🏆 IYA 2025</span>}
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
