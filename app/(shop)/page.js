'use client';
import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import Home from '@/components/Home';
import { errMsg } from '@/lib/format';

export default function Page() {
  const [products, setProducts] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    getSupabase().rpc('shop_products').then(({ data, error: e }) => {
      if (e) setError(errMsg(e)); else setProducts(data || []);
    });
  }, []);
  return <Home products={products || []} loading={products === null && !error} loadError={error} />;
}
