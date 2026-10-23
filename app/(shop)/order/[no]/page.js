import OrderView from '@/components/OrderView';

export default function Page({ params, searchParams }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <OrderView orderNo={decodeURIComponent(params.no)} phone={searchParams.phone || ''} isNew={searchParams.new === '1'} />
    </div>
  );
}
