'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase/client';
import ProductDetail from '@/components/ProductDetail';

function Inner() {
  const id = useSearchParams().get('id');
  const [p, setP] = useState(undefined);
  useEffect(() => {
    getSupabase().rpc('shop_products').then(({ data }) => setP((data || []).find((x) => x.id === id) || null));
  }, [id]);
  if (p === undefined) return <p className="py-16 text-center text-ink-soft">…</p>;
  if (p === null) return <div className="py-16 text-center"><p className="text-ink-soft">404</p><Link href="/" className="btn-primary mt-4">←</Link></div>;
  return <ProductDetail p={p} />;
}

export default function Page() {
  return <Suspense><Inner /></Suspense>;
}
