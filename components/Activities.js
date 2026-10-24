'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useShop } from './Providers';
import { withBase } from '@/lib/base';
import { STORY, EVENTS, PRODUCT_PHOTOS, CAPTIONS } from '@/lib/activities';
import { channelHref } from './channels';
import AwardVideo from './AwardVideo';

const L = (o, lang) => (o ? o[lang] || o.lo || o.en : '');
export const img = (name, small) => withBase(`/activities/${name}${small ? '-sm' : ''}.webp`);

const MONTHS = {
  lo: ['ມັງກອນ', 'ກຸມພາ', 'ມີນາ', 'ເມສາ', 'ພຶດສະພາ', 'ມິຖຸນາ', 'ກໍລະກົດ', 'ສິງຫາ', 'ກັນຍາ', 'ຕຸລາ', 'ພະຈິກ', 'ທັນວາ'],
  th: ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
export function fmtDate(iso, lang) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${(MONTHS[lang] || MONTHS.en)[m - 1]} ${y}`;
}

const TXT = {
  activities: { lo: 'ກິດຈະກຳ ແລະ ຄວາມເຄື່ອນໄຫວ', th: 'กิจกรรมและความเคลื่อนไหว', en: 'Activities & news' },
  products: { lo: 'ຜະລິດຕະພັນຂອງພວກເຮົາ', th: 'ผลิตภัณฑ์ของเรา', en: 'Our product' },
  photos: { lo: 'ຮູບ', th: 'รูป', en: 'photos' },
  follow: { lo: 'ຕິດຕາມຄວາມເຄື່ອນໄຫວທາງເພຈ', th: 'ติดตามความเคลื่อนไหวทางเพจ', en: 'Follow us on Facebook' },
  followSub: { lo: 'ຂ່າວສານ, ໂປຣໂມຊັນ ແລະ ກິດຈະກຳໃໝ່ໆ', th: 'ข่าวสาร โปรโมชัน และกิจกรรมใหม่ ๆ', en: 'News, promotions and upcoming events' },
  shop: { lo: 'ເລືອກຊື້ສິນຄ້າ', th: 'เลือกซื้อสินค้า', en: 'Shop now' },
  close: { lo: 'ປິດ', th: 'ปิด', en: 'Close' },
};

function Lightbox({ list, index, onClose, onMove, lang }) {
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowRight') onMove(1); if (e.key === 'ArrowLeft') onMove(-1); };
    window.addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = ''; };
  }, [onClose, onMove]);
  const name = list[index];
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink/95 text-white" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-3 text-sm">
        <span className="opacity-70">{index + 1} / {list.length}</span>
        <button className="rounded-full bg-white/10 px-3 py-1.5 hover:bg-white/20" onClick={onClose}>✕ {L(TXT.close, lang)}</button>
      </div>
      <div className="relative flex flex-1 items-center justify-center px-2 pb-4" onClick={(e) => e.stopPropagation()}>
        <img src={img(name)} alt={L(CAPTIONS[name], lang)} className="max-h-[78vh] max-w-full rounded-lg object-contain shadow-2xl" />
        {list.length > 1 && <>
          <button aria-label="previous" onClick={() => onMove(-1)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-3 text-xl hover:bg-white/30 md:left-6">‹</button>
          <button aria-label="next" onClick={() => onMove(1)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/15 p-3 text-xl hover:bg-white/30 md:right-6">›</button>
        </>}
      </div>
      <p className="px-4 pb-6 text-center text-sm opacity-90" onClick={(e) => e.stopPropagation()}>{L(CAPTIONS[name], lang)}</p>
    </div>
  );
}

function useLightbox() {
  const [box, setBox] = useState(null);
  const open = useCallback((list, i) => setBox({ list, i }), []);
  const close = useCallback(() => setBox(null), []);
  const move = useCallback((d) => setBox((b) => b && { ...b, i: (b.i + d + b.list.length) % b.list.length }), []);
  return { box, open, close, move };
}

function Thumb({ name, onClick, className = '', lang, priority }) {
  return (
    <button type="button" onClick={onClick} className={`group relative block overflow-hidden rounded-xl bg-jade-wash ${className}`}>
      <img src={img(name, true)} alt={L(CAPTIONS[name], lang)} loading={priority ? 'eager' : 'lazy'}
        className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
      <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/70 to-transparent p-2 pt-8 text-left text-xs font-medium text-white opacity-0 transition group-hover:opacity-100">
        {L(CAPTIONS[name], lang)}
      </span>
    </button>
  );
}

function EventBlock({ ev, lang, open, flip }) {
  const rest = ev.photos.filter((p) => p !== ev.cover && p !== ev.banner);
  return (
    <article className="scroll-mt-24" id={ev.id}>
      {ev.banner && (
        <button type="button" onClick={() => open(ev.photos, 0)} className="feature-banner mb-8 block w-full">
          <img src={img(ev.banner)} alt={L(CAPTIONS[ev.banner], lang)} width="1942" height="809" className="w-full" />
        </button>
      )}
      {ev.video && <AwardVideo caption={L(ev.video, lang)} className="mx-auto mb-8 max-w-3xl" />}
      <div className={`grid items-start gap-6 md:grid-cols-2 md:gap-10 ${flip ? 'md:[&>*:first-child]:order-2' : ''}`}>
        <Thumb name={ev.cover} lang={lang} onClick={() => open(ev.photos, 0)} className="aspect-[4/3] shadow-lg" priority />
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="rounded-full bg-saffron px-2.5 py-1 text-ink">{L(ev.tag, lang)}</span>
            {ev.date && <span className="rounded-full bg-jade-mist px-2.5 py-1 text-jade">📅 {fmtDate(ev.date, lang)}</span>}
            <span className="rounded-full bg-white px-2.5 py-1 text-ink-soft ring-1 ring-line">📍 {L(ev.place, lang)}</span>
          </div>
          <h3 className="mt-3 font-display text-2xl font-bold leading-snug text-ink md:text-3xl">{L(ev.title, lang)}</h3>
          <p className="mt-3 leading-relaxed text-ink-soft">{L(ev.body, lang)}</p>
          <div className={`mt-5 grid gap-2 ${rest.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
            {rest.slice(0, rest.length >= 4 ? 6 : 3).map((p, i) => (
              <Thumb key={p} name={p} lang={lang} onClick={() => open(ev.photos, ev.photos.indexOf(p))}
                className={`aspect-square ${i === 0 && rest.length >= 4 ? 'col-span-2 row-span-2 aspect-auto' : ''}`} />
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-faint">📷 {ev.photos.length} {L(TXT.photos, lang)}</p>
        </div>
      </div>
    </article>
  );
}

export default function Activities() {
  const { lang, channels } = useShop();
  const { box, open, close, move } = useLightbox();
  const fb = channels.find((c) => c.type === 'facebook');
  const fbHref = fb ? channelHref(fb) : 'https://www.facebook.com/search/top?q=' + encodeURIComponent('ຢາດົມຫອມລາວ yadom hormlao');

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-jade text-white">
        <img src={img('iya-day2-b')} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-20 blur-sm" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-4 py-14 md:grid-cols-[1.3fr_1fr] md:py-20">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-saffron">{L(STORY.kicker, lang)}</p>
            <h1 className="mt-3 font-display text-4xl font-bold leading-tight sm:text-5xl">{L(STORY.title, lang)}</h1>
            <p className="mt-5 max-w-xl leading-relaxed text-jade-mist">{L(STORY.body, lang)}</p>
            <p className="mt-5 inline-flex items-start gap-2 rounded-xl bg-saffron/95 px-4 py-3 text-sm font-semibold text-ink">🏆 {L(STORY.award, lang)}</p>
          </div>
          <div className="mx-auto grid w-full max-w-sm grid-cols-2 gap-3">
            <Thumb name="product-blue" lang={lang} onClick={() => open(PRODUCT_PHOTOS, 0)} className="col-span-2 aspect-[4/3] ring-4 ring-saffron" priority />
            <Thumb name="iya-team-girls" lang={lang} onClick={() => open(['iya-team-girls'], 0)} className="aspect-square" priority />
            <Thumb name={STORY.poster} lang={lang} onClick={() => open([STORY.poster], 0)} className="aspect-square bg-white" priority />
          </div>
        </div>
      </section>
      <div className="ikat h-6" aria-hidden="true" />

      {/* Facts */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {STORY.facts.map((f) => (
            <li key={f.en} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-4 shadow-sm">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-jade-mist text-xl" aria-hidden>{f.icon}</span>
              <span className="text-sm font-semibold leading-snug text-ink">{L(f, lang)}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Timeline */}
      <section className="mx-auto max-w-6xl px-4 pb-6">
        <h2 className="font-display text-3xl font-bold text-ink">{L(TXT.activities, lang)}</h2>
        <div className="mt-8 space-y-16">
          {EVENTS.map((ev, i) => <EventBlock key={ev.id} ev={ev} lang={lang} open={open} flip={i % 2 === 1} />)}
        </div>
      </section>

      {/* Product strip */}
      <section className="mx-auto mt-16 max-w-6xl px-4">
        <div className="grid items-center gap-6 overflow-hidden rounded-3xl bg-saffron-pale p-6 md:grid-cols-[1fr_1.2fr] md:p-10">
          <div>
            <h2 className="font-display text-3xl font-bold text-ink">{L(TXT.products, lang)}</h2>
            <p className="mt-3 text-ink-soft">{L(STORY.facts[3], lang)} · {L(STORY.award, lang)}</p>
            <Link href="/#products" className="btn-primary mt-5 inline-flex px-6 py-3">{L(TXT.shop, lang)} →</Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {PRODUCT_PHOTOS.map((p, i) => <Thumb key={p} name={p} lang={lang} onClick={() => open(PRODUCT_PHOTOS, i)} className="aspect-square shadow" />)}
          </div>
        </div>
      </section>

      {/* Follow */}
      <section className="mx-auto mt-10 max-w-6xl px-4">
        <a href={fbHref} target="_blank" rel="noopener noreferrer"
          className="flex flex-wrap items-center gap-4 rounded-3xl bg-[#1877F2] p-6 text-white transition hover:brightness-110 md:p-8">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-3xl font-bold text-[#1877F2]" aria-hidden>f</span>
          <span className="flex-1">
            <span className="block text-lg font-bold">{L(TXT.follow, lang)}</span>
            <span className="block text-sm opacity-90">Page ຢາດົມຫອມລາວ Yadom Hormlao · {L(TXT.followSub, lang)}</span>
          </span>
          <span className="text-2xl" aria-hidden>→</span>
        </a>
      </section>

      {box && <Lightbox list={box.list} index={box.i} onClose={close} onMove={move} lang={lang} />}
    </>
  );
}
