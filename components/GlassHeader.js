'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useShop } from './Providers';
import { LANGS } from '@/lib/i18n';
import { pickLang } from '@/lib/format';
import { withBase } from '@/lib/base';

const L = (o, lang) => o[lang] || o.lo;
const act = (n) => withBase(`/activities/${n}-sm.webp`);

const T = {
  discover: { lo: 'ຄົ້ນພົບ', th: 'ค้นพบ', en: 'Discover' },
  shop: { lo: 'ຊື້ສິນຄ້າ', th: 'ซื้อสินค้า', en: 'Shop' },
  help: { lo: 'ຊ່ວຍເຫຼືອ', th: 'ช่วยเหลือ', en: 'Help' },
  activities: { lo: 'ກິດຈະກຳ', th: 'กิจกรรม', en: 'Activities' },
  cart: { lo: 'ກະຕ່າ', th: 'ตะกร้า', en: 'Cart' },
  menu: { lo: 'ເມນູ', th: 'เมนู', en: 'Menu' },
  scroll: { lo: 'ເລື່ອນລົງ', th: 'เลื่อนลง', en: 'scroll down' },
  account: { lo: 'ບັນຊີ', th: 'บัญชี', en: 'Account' },
};

const DISCOVER = [
  { href: '/#products', img: 'product-blue', t: { lo: 'ຢາດົມຫອມລາວ', th: 'ยาดมหอมลาว', en: 'Ya Dom Hom Lao' },
    d: { lo: 'ສະໝຸນໄພລາວແທ້ ກິ່ນຫອມສົດຊື່ນ ໃຊ້ງ່າຍທຸກວັນ.', th: 'สมุนไพรลาวแท้ กลิ่นหอมสดชื่น ใช้ง่ายทุกวัน', en: 'Real Lao herbs, a fresh scent for every day.' } },
  { href: '/activities', img: 'iya-team-girls', t: { lo: 'ເລື່ອງລາວຂອງພວກເຮົາ', th: 'เรื่องราวของเรา', en: 'Our story' },
    d: { lo: 'ຈາກແນວຄິດນັກສຶກສາ ສູ່ແບຣນລາວ.', th: 'จากไอเดียนักศึกษา สู่แบรนด์ลาว', en: 'From a student idea to a Lao brand.' } },
  { href: '/activities#iya-2025', img: 'iya25-award-team', t: { lo: '🏆 IYA 2025', th: '🏆 IYA 2025', en: '🏆 IYA 2025' },
    d: { lo: 'ແຜນທຸລະກິດດີເດັ່ນ ທຶນ 10 ລ້ານກີບ.', th: 'แผนธุรกิจยอดเยี่ยม ทุน 10 ล้านกีบ', en: 'Best Business Plan, 10M Kip prize.' } },
  { href: '/activities#aromdee', img: 'aromdee-front-2', t: { lo: 'ຄູ່ຮ່ວມ ຫຼວງພະບາງ', th: 'พันธมิตร หลวงพระบาง', en: 'Luang Prabang partners' },
    d: { lo: 'ພົບປະຮ້ານ Aromdee ໃນເມືອງມໍລະດົກ.', th: 'พบปะร้าน Aromdee ในเมืองมรดกโลก', en: 'Meeting Aromdee in the heritage town.' } },
];
const SHOP = [
  { href: '/#products', img: 'product-yellow', t: { lo: 'ຂາຍຍ່ອຍ', th: 'ขายปลีก', en: 'Retail' },
    d: { lo: 'ສັ່ງອອນລາຍ ສົ່ງທົ່ວປະເທດ.', th: 'สั่งออนไลน์ ส่งทั่วประเทศ', en: 'Order online, delivered nationwide.' } },
  { href: '/contact', img: 'aromdee-meeting', t: { lo: 'ຂາຍສົ່ງ & ຮ້ານຄ້າ', th: 'ขายส่ง & ร้านค้า', en: 'Wholesale & stores' },
    d: { lo: 'ລາຄາພິເສດສຳລັບຮ້ານ ແລະ ຂອງທີ່ລະນຶກ.', th: 'ราคาพิเศษสำหรับร้านค้าและของฝาก', en: 'Special prices for shops and gifts.' } },
];
const HELP = [
  { href: '/track', i: '📦', t: { lo: 'ຕິດຕາມຄຳສັ່ງຊື້', th: 'ติดตามคำสั่งซื้อ', en: 'Track order' } },
  { href: '/account', i: '👤', t: { lo: 'ບັນຊີຂອງຂ້ອຍ', th: 'บัญชีของฉัน', en: 'My account' } },
  { href: '/cart', i: '🛒', t: { lo: 'ກະຕ່າສິນຄ້າ', th: 'ตะกร้าสินค้า', en: 'Cart' } },
  { href: '/contact', i: '✉', t: { lo: 'ຕິດຕໍ່ພວກເຮົາ', th: 'ติดต่อเรา', en: 'Contact us' } },
];
const MENUS = ['discover', 'shop', 'help'];
const PAD = 20;

const Chevron = () => (
  <svg viewBox="0 0 8 5" aria-hidden="true"><path d="M1 1l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

export default function GlassHeader() {
  const { lang, setLang, currency, setCurrency, settings, cart, user, isStaff, t } = useShop();
  const path = usePathname();
  const isHome = path === '/';
  const [solid, setSolid] = useState(!isHome);
  const [sheet, setSheet] = useState(false);
  const [dItem, setDItem] = useState(0);
  const count = cart.reduce((s, x) => s + x.qty, 0);
  const name = pickLang(settings.store_name, lang) || 'ຢາດົມຫອມລາວ';
  const headerRef = useRef(null);
  const navRef = useRef(null);
  const ddRef = useRef(null);
  const ctl = useRef({ current: null, timer: null });

  // transparent over the hero, glass once scrolled (or on inner pages)
  useEffect(() => {
    if (!isHome) { setSolid(true); return; }
    const on = () => setSolid(window.scrollY > 40);
    on(); window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [isHome]);

  // morphing dropdown (vanilla DOM, mirrors the reference behaviour)
  useEffect(() => {
    const header = headerRef.current, nav = navRef.current, dd = ddRef.current;
    if (!header || !nav || !dd) return;
    const c = ctl.current;
    const panel = (id) => dd.querySelector(`[data-panel="${id}"]`);
    const trig = (id) => nav.querySelector(`[data-menu="${id}"]`);
    const panels = () => dd.querySelectorAll('.gh-panel');
    const place = (id) => {
      const p = panel(id), tr = trig(id); if (!p || !tr) return;
      const w = p.offsetWidth, h = p.offsetHeight;
      const hr = header.getBoundingClientRect(), trr = tr.getBoundingClientRect();
      let x = trr.left - PAD;
      x = Math.max(hr.left + 12, Math.min(x, hr.right - w - 12));
      x -= (dd.offsetParent || header).getBoundingClientRect().left;
      dd.style.setProperty('--x', `${x}px`); dd.style.setProperty('--w', `${w}px`); dd.style.setProperty('--h', `${h}px`);
    };
    const open = (id) => {
      clearTimeout(c.timer);
      if (c.current === id) return;
      const p = panel(id);
      if (!c.current) {
        dd.classList.add('instant', 'snap');
        panels().forEach((x) => { x.classList.add('snap'); x.removeAttribute('data-state'); });
        place(id);
        void dd.offsetWidth;
        dd.classList.remove('snap'); panels().forEach((x) => x.classList.remove('snap'));
        dd.classList.add('open');
        requestAnimationFrame(() => dd.classList.remove('instant'));
      } else {
        const dir = MENUS.indexOf(id) > MENUS.indexOf(c.current) ? 1 : -1;
        panel(c.current).dataset.state = dir > 0 ? 'exit-left' : 'exit-right';
        p.classList.add('snap'); p.dataset.state = dir > 0 ? 'exit-right' : 'exit-left';
        void p.offsetWidth; p.classList.remove('snap');
        place(id);
      }
      p.dataset.state = 'active';
      MENUS.forEach((m) => trig(m)?.setAttribute('aria-expanded', m === id ? 'true' : 'false'));
      c.current = id;
    };
    const close = () => {
      dd.classList.remove('open');
      if (c.current) panel(c.current)?.removeAttribute('data-state');
      MENUS.forEach((m) => trig(m)?.setAttribute('aria-expanded', 'false'));
      c.current = null;
    };
    const scheduleClose = (ms = 140) => { clearTimeout(c.timer); c.timer = setTimeout(close, ms); };
    c.close = close;

    const offs = [];
    const on = (el, ev, fn, opt) => { el.addEventListener(ev, fn, opt); offs.push(() => el.removeEventListener(ev, fn, opt)); };
    MENUS.forEach((m) => {
      const tr = trig(m); if (!tr) return;
      on(tr, 'pointerenter', (e) => { if (e.pointerType === 'mouse') open(m); });
      on(tr, 'click', () => (c.current === m ? close() : open(m)));
    });
    const story = nav.querySelector('#gh-plain');
    if (story) on(story, 'pointerenter', (e) => { if (e.pointerType === 'mouse') scheduleClose(60); });
    on(nav, 'pointerenter', () => clearTimeout(c.timer));
    on(nav, 'pointerleave', (e) => { if (e.pointerType === 'mouse') scheduleClose(); });
    on(nav, 'focusout', (e) => { if (!nav.contains(e.relatedTarget)) scheduleClose(0); });
    on(dd, 'click', (e) => { if (e.target.closest('a')) close(); });
    on(document, 'keydown', (e) => {
      if (e.key !== 'Escape') return;
      const was = c.current; close(); setSheet(false);
      if (was) trig(was)?.focus();
    });
    on(document, 'pointerdown', (e) => { if (!nav.contains(e.target)) close(); });
    on(window, 'resize', () => { if (c.current) place(c.current); });
    return () => { offs.forEach((f) => f()); clearTimeout(c.timer); };
  }, []);

  // close menus on navigation
  useEffect(() => { ctl.current.close?.(); setSheet(false); }, [path]);

  const accountLabel = !user ? t('login') : isStaff ? `🔑 ${t('staffAccount')}` : L(T.account, lang);

  return (
    <>
      <header ref={headerRef} className={`gh no-print ${solid || sheet ? 'is-solid' : ''}`} translate="no">
        <div className="gh-bar">
          <Link href="/" className="gh-logo" aria-label={name}>
            <img src={withBase('/brand/yadom-icon.svg')} alt="" />
            <span className="font-display">{name}</span>
          </Link>

          <nav ref={navRef} className="gh-nav" aria-label="Main">
            <ul className="gh-links">
              {MENUS.map((m) => (
                <li key={m}><button type="button" className="gh-trigger" data-menu={m} aria-expanded="false">{L(T[m], lang)} <Chevron /></button></li>
              ))}
              <li><Link id="gh-plain" className="gh-plain" href="/activities">{L(T.activities, lang)}</Link></li>
            </ul>

            <div ref={ddRef} className="gh-dd">
              <div className="gh-panel gh-p-discover" data-panel="discover">
                <div className="gh-dlist">
                  {DISCOVER.map((x, i) => (
                    <Link key={x.img} href={x.href} className={`gh-ditem ${dItem === i ? 'is-active' : ''}`}
                      onPointerEnter={() => setDItem(i)} onFocus={() => setDItem(i)}>
                      <strong>{L(x.t, lang)}</strong><span>{L(x.d, lang)}</span>
                    </Link>
                  ))}
                </div>
                <div className="gh-dmedia" aria-hidden="true">
                  {DISCOVER.map((x, i) => <img key={x.img} src={act(x.img)} alt="" className={dItem === i ? 'is-active' : ''} />)}
                </div>
              </div>
              <div className="gh-panel gh-p-shop" data-panel="shop">
                {SHOP.map((x) => (
                  <Link key={x.img} href={x.href} className="gh-card">
                    <img src={act(x.img)} alt="" /><strong>{L(x.t, lang)}</strong><span>{L(x.d, lang)}</span>
                  </Link>
                ))}
              </div>
              <div className="gh-panel gh-p-help" data-panel="help">
                {HELP.map((x) => <Link key={x.href} href={x.href} className="gh-rlink"><i aria-hidden>{x.i}</i>{L(x.t, lang)}</Link>)}
              </div>
            </div>
          </nav>

          <div className="gh-actions">
            <div className="gh-langs gh-desk" role="group" aria-label="Language">
              {LANGS.map((l) => <button key={l.code} type="button" aria-pressed={lang === l.code} onClick={() => setLang(l.code)}>{l.label}</button>)}
            </div>
            <button type="button" className="gh-pill gh-desk" aria-label={t('currency')} onClick={() => setCurrency(currency === 'LAK' ? 'THB' : 'LAK')}>{currency === 'LAK' ? '₭ LAK' : '฿ THB'}</button>
            <Link href={user ? '/account' : '/login'} className="gh-pill gh-desk">{accountLabel}</Link>
            <Link href="/cart" className="gh-cta" aria-label={`${L(T.cart, lang)} (${count})`}>{L(T.cart, lang)} <b>{count}</b></Link>
            <button type="button" className="gh-menu-btn" aria-label={L(T.menu, lang)} aria-expanded={sheet} onClick={() => setSheet(!sheet)}>
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d={sheet ? 'M4 4l8 8M12 4l-8 8' : 'M2 5.5h12M2 10.5h12'} stroke="#fff" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </button>
          </div>
        </div>

        <div className={`gh-sheet ${sheet ? 'open' : ''}`} onClick={(e) => { if (e.target.closest('a')) setSheet(false); }}>
          <h3>{L(T.discover, lang)}</h3>
          {DISCOVER.map((x) => <Link key={x.img} href={x.href}>{L(x.t, lang)}</Link>)}
          <h3>{L(T.shop, lang)}</h3>
          {SHOP.map((x) => <Link key={x.img} href={x.href}>{L(x.t, lang)}</Link>)}
          <h3>{L(T.help, lang)}</h3>
          {HELP.map((x) => <Link key={x.href} href={x.href}>{x.i} {L(x.t, lang)}</Link>)}
          <Link href={user ? '/account' : '/login'}>{accountLabel}</Link>
          <div className="mt-3 flex flex-wrap items-center gap-2 px-3 pb-2">
            <div className="gh-langs" role="group" aria-label="Language">
              {LANGS.map((l) => <button key={l.code} type="button" aria-pressed={lang === l.code} onClick={() => setLang(l.code)}>{l.label}</button>)}
            </div>
            <div className="gh-langs" role="group" aria-label={t('currency')}>
              {['LAK', 'THB'].map((c) => <button key={c} type="button" aria-pressed={currency === c} onClick={() => setCurrency(c)}>{c === 'LAK' ? '₭ LAK' : '฿ THB'}</button>)}
            </div>
          </div>
        </div>
      </header>
      {!isHome && <div className="h-[76px] no-print" aria-hidden="true" />}
    </>
  );
}

export function HeroScrollCue() {
  const { lang } = useShop();
  return <div className="scroll-cue" aria-hidden="true"><span>(</span><span>{L(T.scroll, lang)}</span><span>)</span></div>;
}

export function RevealObserver() {
  const path = usePathname();
  useEffect(() => {
    document.documentElement.classList.add('js-reveal');
    const els = [...document.querySelectorAll('.reveal:not(.in)')];
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    els.forEach((e) => io.observe(e));
    const t = setTimeout(() => document.querySelectorAll('.reveal:not(.in)').forEach((e) => io.observe(e)), 1200);
    return () => { io.disconnect(); clearTimeout(t); };
  }, [path]);
  return null;
}
