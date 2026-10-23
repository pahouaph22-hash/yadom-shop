'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useShop } from '@/components/Providers';
import { logout } from '@/lib/logout';

const NAV = [
  { href: '/admin', label: 'ภาพรวม' },
  { href: '/admin/orders', label: 'คำสั่งซื้อ' },
  { href: '/admin/products', label: 'สินค้าและสต็อก' },
  { href: '/admin/customers', label: 'ลูกค้า' },
  { href: '/admin/messages', label: 'ข้อความลูกค้า' },
  { href: '/admin/reports', label: 'รายงานยอดขาย' },
  { href: '/admin/expenses', label: 'ค่าใช้จ่าย', admin: true },
  { href: '/admin/settings', label: 'ช่องทางติดต่อและตั้งค่า', admin: true },
  { href: '/admin/audit', label: 'ประวัติการดำเนินงาน', admin: true },
  { href: '/admin/backup', label: 'สำรองข้อมูล', admin: true },
];

export default function AdminShell({ children }) {
  const path = usePathname();
  const router = useRouter();
  const { user, role, isAdmin, isStaff, authReady } = useShop();
  const [open, setOpen] = useState(false);

  // UX guard only — the data itself is protected by Row Level Security in Supabase
  useEffect(() => {
    if (!authReady) return;
    if (!user) router.replace(`/login?next=${encodeURIComponent(path)}`);
    else if (!isStaff) router.replace('/account');
  }, [authReady, user, isStaff, path, router]);
  if (!authReady || !isStaff) {
    return <div className="flex min-h-screen items-center justify-center text-ink-soft">กำลังตรวจสอบสิทธิ์…</div>;
  }
  const items = NAV.filter((n) => !n.admin || isAdmin);
  const active = (h) => (h === '/admin' ? path === '/admin' : path.startsWith(h));
  const nav = (
    <nav className="flex flex-col gap-0.5">
      {items.map((n) => (
        <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${active(n.href) ? 'bg-white text-jade' : 'text-jade-mist hover:bg-white/10'}`}>
          {n.label}
        </Link>
      ))}
    </nav>
  );
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="hidden flex-col bg-jade-deep p-4 lg:flex no-print">
        <Link href="/admin" className="mb-1 font-display text-xl font-bold text-white">ຢາດົມຫອມລາວ</Link>
        <div className="ikat ikat-thin mb-5 rounded" aria-hidden="true" />
        {nav}
        <div className="mt-auto space-y-2 pt-6 text-xs text-jade-mist">
          <p className="truncate">{user?.email}</p>
          <p>สิทธิ์: {role === 'admin' ? 'ผู้ดูแลระบบ' : 'พนักงาน'}</p>
          <div className="flex gap-2">
            <Link href="/" className="rounded border border-white/20 px-2 py-1 hover:bg-white/10">ดูหน้าร้าน</Link>
            <button onClick={logout} className="rounded border border-white/20 px-2 py-1 hover:bg-white/10">ออกจากระบบ</button>
          </div>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center gap-3 bg-jade-deep px-4 py-3 text-white lg:hidden no-print">
          <button onClick={() => setOpen(!open)} className="rounded border border-white/30 px-2 py-1" aria-expanded={open} aria-label="เมนู">☰</button>
          <span className="font-display font-bold">ຢາດົມຫອມລາວ · จัดการร้าน</span>
        </header>
        {open && <div className="bg-jade-deep p-3 lg:hidden">{nav}<button onClick={logout} className="mt-2 px-3 text-sm text-jade-mist">ออกจากระบบ</button></div>}
        <main className="mx-auto max-w-7xl p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
