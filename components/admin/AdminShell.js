'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useShop } from '@/components/Providers';
import { logout } from '@/lib/logout';

// perm: required permission (admins have all). adminOnly: admins only.
export const NAV = [
  { href: '/admin', label: 'ภาพรวม', icon: '◈' },
  { href: '/admin/orders', label: 'คำสั่งซื้อ', icon: '🛍', perm: 'orders' },
  { href: '/admin/products', label: 'สินค้าและสต็อก', icon: '📦', perm: 'products' },
  { href: '/admin/customers', label: 'สมาชิก / ลูกค้า', icon: '👥', perm: 'customers' },
  { href: '/admin/messages', label: 'ข้อความลูกค้า', icon: '💬', perm: 'messages' },
  { href: '/admin/reports', label: 'รายงานยอดขาย', icon: '📈', perm: 'reports' },
  { href: '/admin/expenses', label: 'ค่าใช้จ่าย', icon: '🧾', perm: 'finance' },
  { href: '/admin/settings', label: 'ช่องทางติดต่อและตั้งค่า', icon: '⚙', perm: 'settings' },
  { href: '/admin/staff', label: 'พนักงานและสิทธิ์', icon: '🔑', adminOnly: true },
  { href: '/admin/audit', label: 'ประวัติการดำเนินงาน', icon: '🕘', perm: 'audit' },
  { href: '/admin/backup', label: 'สำรองข้อมูล', icon: '💾', adminOnly: true },
];

export default function AdminShell({ children }) {
  const path = usePathname();
  const router = useRouter();
  const { user, role, isAdmin, isStaff, authReady, can } = useShop();
  const [open, setOpen] = useState(false);

  // UX guard only — the data itself is protected by Row Level Security in Supabase
  useEffect(() => {
    if (!authReady) return;
    if (!user || !isStaff) router.replace(`/staff/login?next=${encodeURIComponent(path)}`);
  }, [authReady, user, isStaff, path, router]);
  if (!authReady || !isStaff) {
    return <AuthWait />;
  }
  const allowed = (n) => (n.adminOnly ? isAdmin : !n.perm || can(n.perm));
  const items = NAV.filter(allowed);
  const cur = path.replace(/\/$/, '') || '/';
  const section = [...NAV].sort((a, b) => b.href.length - a.href.length).find((n) => cur === n.href || cur.startsWith(n.href + '/'));
  const pageAllowed = !section || allowed(section);
  const p = path.replace(/\/$/, '') || '/';
  const active = (h) => (h === '/admin' ? p === '/admin' : p.startsWith(h));
  const nav = (
    <nav className="flex flex-col gap-0.5">
      {items.map((n) => (
        <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${active(n.href) ? 'bg-white text-jade' : 'text-jade-mist hover:bg-white/10'}`}>
          <span className="w-5 text-center" aria-hidden="true">{n.icon}</span>{n.label}
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
          <p>สิทธิ์: {role === 'admin' ? 'ผู้ดูแลระบบ (ทั้งหมด)' : 'พนักงาน'}</p>
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
        <main className="mx-auto max-w-7xl p-4 md:p-6">{pageAllowed ? children : (
          <div className="card mx-auto mt-10 max-w-md p-6 text-center">
            <p className="font-semibold">คุณไม่มีสิทธิ์เข้าหน้านี้</p>
            <p className="mt-1 text-sm text-ink-soft">ติดต่อแอดมินเพื่อขอสิทธิ์ที่จำเป็นสำหรับงานของคุณ</p>
            <Link href="/admin" className="btn-primary mt-4">กลับหน้าภาพรวม</Link>
          </div>
        )}</main>
      </div>
    </div>
  );
}

function AuthWait() {
  const [slow, setSlow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSlow(true), 8000); return () => clearTimeout(t); }, []);
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center text-ink-soft">
      <p>กำลังตรวจสอบสิทธิ์…</p>
      {slow && (
        <>
          <p className="max-w-sm text-sm">ใช้เวลานานผิดปกติ — ลองปิดแท็บอื่นของเว็บนี้ แล้วกดโหลดใหม่ หรือออกจากระบบแล้วเข้าใหม่</p>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={() => window.location.reload()}>โหลดใหม่</button>
            <button className="btn-ghost" onClick={logout}>ออกจากระบบ</button>
          </div>
        </>
      )}
    </div>
  );
}
