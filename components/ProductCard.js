'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useShop } from './Providers';
import { productName } from '@/lib/format';

export function InhalerArt({ className = '' }) {
  // Generic herbal inhaler tube illustration used when a product has no photo
  return (
    <svg viewBox="0 0 120 160" className={className} aria-hidden="true">
      <rect x="0" y="0" width="120" height="160" fill="#E4EFE9" />
      <g transform="translate(60 84) rotate(-14)">
        <rect x="-15" y="-52" width="30" height="88" rx="10" fill="#0F4C3A" />
        <rect x="-15" y="-20" width="30" height="22" fill="#E0A526" />
        <path d="M-15 -14 l7.5 7.5 -7.5 7.5 M0 -14 l7.5 7.5 -7.5 7.5 M15 -14 l-7.5 7.5 7.5 7.5" stroke="#2C3A63" strokeWidth="2" fill="none" />
        <rect x="-10" y="36" width="20" height="18" rx="5" fill="#2E6B57" />
      </g>
      <path d="M18 132 q14 -22 30 -6 q-16 10 -30 6z" fill="#2E6B57" />
      <path d="M96 30 q12 16 -2 30 q-8 -16 2 -30z" fill="#2E6B57" opacity=".7" />
    </svg>
  );
}

export default function ProductCard({ p }) {
  const { t, lang, fmt, addToCart } = useShop();
  const [done, setDone] = useState(false);
  const out = p.stock <= 0;
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white">
      <Link href={`/product?id=${p.id}`} className="block aspect-[4/5] overflow-hidden bg-jade-mist">
        {p.images?.[0]
          ? <img src={p.images[0]} alt={productName(p, lang)} className="h-full w-full object-cover" loading="lazy" />
          : <InhalerArt className="h-full w-full" />}
      </Link>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <Link href={`/product?id=${p.id}`} className="font-display text-lg font-bold leading-snug text-ink hover:text-jade">{productName(p, lang)}</Link>
        {p.size_label && <p className="text-xs text-ink-faint">{p.size_label}</p>}
        <p className="mt-1 text-lg font-bold text-jade">{fmt(p.price_retail)}</p>
        {p.price_wholesale != null && (
          <p className="text-xs text-saffron-deep">{t('wholesaleFrom', { p: fmt(p.price_wholesale), n: p.wholesale_min_qty })}</p>
        )}
        <p className={`text-xs ${out ? 'text-red-700' : p.stock <= 10 ? 'text-saffron-deep' : 'text-ink-faint'}`}>
          {out ? t('outOfStock') : p.stock <= 10 ? t('lowStock', { n: p.stock }) : t('inStock', { n: p.stock })}
        </p>
        <button disabled={out} onClick={() => { addToCart(p, 1); setDone(true); setTimeout(() => setDone(false), 1500); }}
          className="btn-primary mt-auto w-full translate-y-0 pt-2.5">
          {done ? `✓ ${t('added')}` : t('addToCart')}
        </button>
      </div>
    </article>
  );
}
