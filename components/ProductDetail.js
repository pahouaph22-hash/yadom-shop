'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useShop } from './Providers';
import { InhalerArt } from './ProductCard';
import { productName, productDesc } from '@/lib/format';

export default function ProductDetail({ p }) {
  const { t, lang, fmt, addToCart } = useShop();
  const [img, setImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [done, setDone] = useState(false);
  const out = p.stock <= 0;
  const ws = p.price_wholesale != null && qty >= p.wholesale_min_qty;
  const unit = ws ? p.price_wholesale : p.price_retail;
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/#products" className="text-sm text-ink-soft hover:text-jade">← {t('back')}</Link>
      <div className="mt-4 grid gap-8 md:grid-cols-2">
        <div>
          <div className="aspect-square overflow-hidden rounded-2xl bg-jade-mist">
            {p.images?.length ? <img src={p.images[img]} alt={productName(p, lang)} className="h-full w-full object-cover" /> : <InhalerArt className="h-full w-full" />}
          </div>
          {p.images?.length > 1 && (
            <div className="mt-3 flex gap-2">
              {p.images.map((src, i) => (
                <button key={src} onClick={() => setImg(i)} className={`h-16 w-16 overflow-hidden rounded-lg border-2 ${i === img ? 'border-saffron' : 'border-transparent'}`}>
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <h1 className="font-display text-4xl font-bold text-ink">{productName(p, lang)}</h1>
          {p.size_label && <p className="mt-1 text-ink-faint">{p.size_label}</p>}
          <dl className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-jade-wash p-4"><dt className="text-xs text-ink-soft">{t('retail')}</dt><dd className="text-2xl font-bold text-jade">{fmt(p.price_retail)}</dd></div>
            {p.price_wholesale != null && (
              <div className="rounded-xl bg-saffron-pale p-4"><dt className="text-xs text-ink-soft">{t('wholesale')} · {p.wholesale_min_qty}+</dt><dd className="text-2xl font-bold text-saffron-deep">{fmt(p.price_wholesale)}</dd></div>
            )}
          </dl>
          <p className="mt-6 whitespace-pre-line leading-relaxed text-ink-soft">{productDesc(p, lang)}</p>
          <p className={`mt-4 text-sm ${out ? 'text-red-700' : 'text-ink-faint'}`}>{out ? t('outOfStock') : t('inStock', { n: p.stock })}</p>
          {!out && (
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="label">{t('qty')}</span>
                <input type="number" min={1} max={p.stock} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(p.stock, Number(e.target.value) || 1)))} className="input w-28" />
              </label>
              <button className="btn-primary px-6 py-3" onClick={() => { addToCart(p, qty); setDone(true); setTimeout(() => setDone(false), 1500); }}>
                {done ? `✓ ${t('added')}` : `${t('addToCart')} · ${fmt(unit * qty)}`}
              </button>
              {done && <Link href="/cart" className="btn-ghost">{t('checkout')}</Link>}
            </div>
          )}
          {ws && <p className="mt-2 text-sm font-medium text-saffron-deep">✓ {t('wholesaleApplied')}</p>}
        </div>
      </div>
    </div>
  );
}
