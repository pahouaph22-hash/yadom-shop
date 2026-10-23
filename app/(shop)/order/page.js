'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import OrderView from '@/components/OrderView';

function Inner() {
  const sp = useSearchParams();
  return <OrderView orderNo={sp.get('no') || ''} phone={sp.get('phone') || ''} isNew={sp.get('new') === '1'} />;
}

export default function Page() {
  return <div className="mx-auto max-w-3xl px-4 py-10"><Suspense><Inner /></Suspense></div>;
}
