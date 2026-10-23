'use client';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabase/client';
import { errMsg } from '@/lib/format';

function StaffLogin() {
  const router = useRouter();
  const next = useSearchParams().get('next') || '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    const sb = getSupabase();
    const { error: err } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (err) { setBusy(false); setError(errMsg(err) === 'Invalid login credentials' ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : errMsg(err)); return; }
    const { data: staff } = await sb.rpc('is_staff');
    if (!staff) {
      await sb.auth.signOut();
      setBusy(false);
      setError('บัญชีนี้ไม่ใช่บัญชีพนักงาน หรือถูกปิดใช้งาน — บัญชีลูกค้าให้เข้าสู่ระบบที่หน้าร้าน');
      return;
    }
    await sb.rpc('log_auth_event', { p_event: 'login' });
    router.replace(next.startsWith('/admin') ? next : '/admin');
  }

  return (
    <div className="flex min-h-screen flex-col bg-jade-deep">
      <div className="ikat h-5" aria-hidden="true" />
      <div className="flex flex-1 items-center justify-center p-4">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6">
          <div>
            <p className="font-display text-xl font-bold text-jade">ຢາດົມຫອມລາວ</p>
            <h1 className="text-lg font-semibold">เข้าสู่ระบบพนักงาน</h1>
            <p className="text-xs text-ink-faint">สำหรับแอดมินและพนักงานร้านเท่านั้น · บัญชีพนักงานสร้างโดยแอดมิน</p>
          </div>
          <label className="block"><span className="label">อีเมล</span><input required type="email" autoComplete="username" className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className="block"><span className="label">รหัสผ่าน</span><input required type="password" autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button disabled={busy} className="btn-primary w-full">{busy ? 'กำลังตรวจสอบ…' : 'เข้าสู่ระบบ'}</button>
          <div className="flex justify-between text-sm">
            <Link href="/forgot" className="text-jade hover:underline">ลืมรหัสผ่าน?</Link>
            <Link href="/" className="text-ink-soft hover:underline">← หน้าร้าน</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Page() {
  return <Suspense><StaffLogin /></Suspense>;
}
