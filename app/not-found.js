import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <div className="ikat mx-auto mb-6 h-6 w-40 rounded" aria-hidden="true" />
      <h1 className="font-display text-3xl font-bold text-jade">404</h1>
      <p className="mt-2 text-ink-soft">ບໍ່ພົບໜ້ານີ້ · ไม่พบหน้านี้ · Page not found</p>
      <Link href="/" className="btn-primary mt-6">ຢາດົມຫອມລາວ</Link>
    </div>
  );
}
