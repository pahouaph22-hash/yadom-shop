import { getServerSupabase } from '@/lib/supabase/server';
import Home from '@/components/Home';

export default async function Page() {
  const sb = getServerSupabase();
  const { data, error } = await sb.rpc('shop_products');
  return <Home products={data || []} loadError={error ? error.message : null} />;
}
