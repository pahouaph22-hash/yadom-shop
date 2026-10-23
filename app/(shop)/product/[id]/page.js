import { notFound } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import ProductDetail from '@/components/ProductDetail';

export default async function Page({ params }) {
  const sb = getServerSupabase();
  const { data } = await sb.rpc('shop_products');
  const p = (data || []).find((x) => x.id === params.id);
  if (!p) notFound();
  return <ProductDetail p={p} />;
}
