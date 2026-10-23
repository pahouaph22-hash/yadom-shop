'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase/client';
import { errMsg } from '@/lib/format';

export const STATUS_TH = {
  received: 'รับคำสั่งซื้อ', pending_payment: 'รอชำระเงิน', paid: 'ชำระแล้ว', shipping: 'กำลังจัดส่ง',
  delivered: 'ส่งมอบสำเร็จ', cancelled: 'ยกเลิก', refunded: 'คืนเงินแล้ว',
};
const STATUS_CLS = {
  received: 'bg-violet-50 text-violet-700', pending_payment: 'bg-saffron-pale text-saffron-deep', paid: 'bg-emerald-50 text-emerald-700',
  shipping: 'bg-sky-50 text-sky-700', delivered: 'bg-jade text-white', cancelled: 'bg-slate-100 text-slate-500', refunded: 'bg-rose-50 text-rose-700',
};
export function StatusBadge({ s }) {
  return <span className={`chip ${STATUS_CLS[s] || ''}`}><span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />{STATUS_TH[s] || s}</span>;
}
export const CTYPE_TH = { retail: 'ทั่วไป', regular: 'ลูกค้าประจำ', wholesale: 'ขายส่ง' };
export const PM_TH = { cash: 'เงินสด', bank_transfer: 'โอนเงิน', bcel_one: 'BCEL One', ldb: 'LDB', qr: 'QR', cod: 'เก็บปลายทาง', other: 'อื่น ๆ' };
export const CHANNEL_TH = { web: 'เว็บไซต์', shop: 'หน้าร้าน', event: 'ออกบูธ/งานแสดงสินค้า', facebook: 'Facebook', whatsapp: 'WhatsApp', tiktok: 'TikTok', phone: 'โทรศัพท์', other: 'อื่น ๆ' };
export const EXP_TH = { inventory: 'ซื้อวัตถุดิบ/สินค้าเข้าสต็อก', packaging: 'บรรจุภัณฑ์', shipping: 'ค่าขนส่ง', marketing: 'การตลาด/โฆษณา', rent: 'ค่าเช่า', salary: 'ค่าแรง', utilities: 'ค่าน้ำ-ไฟ-เน็ต', equipment: 'อุปกรณ์', fees: 'ค่าธรรมเนียม', other: 'อื่น ๆ' };

export function PageHead({ title, children, sub }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">{title}</h1>
        {sub && <p className="mt-1 text-sm text-ink-soft">{sub}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function Alert({ error, ok }) {
  if (error) return <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>;
  if (ok) return <p role="status" className="mb-4 rounded-lg bg-jade-mist p-3 text-sm text-jade">{ok}</p>;
  return null;
}

// Load data with a function (sb) => query; returns [data, reload, error, loading]
export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ data: null, error: '', loading: true });
  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    const { data, error } = await fn(getSupabase());
    setState({ data, error: error ? errMsg(error) : '', loading: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { run(); }, [run]);
  return [state.data, run, state.error, state.loading];
}

export function Empty({ children }) {
  return <p className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-soft">{children}</p>;
}

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="btn-ghost btn-sm" aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const STAT_TONE = {
  jade: ['bg-jade-mist/60 border-jade/15', 'text-jade', 'bg-jade text-white'],
  gold: ['bg-saffron-pale/70 border-saffron/25', 'text-saffron-deep', 'bg-saffron text-ink'],
  red: ['bg-rose-50 border-rose-200/60', 'text-rose-700', 'bg-rose-600 text-white'],
  ink: ['bg-white border-line/80', 'text-ink', 'bg-indigo-dye text-white'],
  sky: ['bg-sky-50 border-sky-200/60', 'text-sky-800', 'bg-sky-600 text-white'],
};
export function Stat({ label, value, tone = 'jade', href, icon, hint }) {
  const [bg, fg, ic] = STAT_TONE[tone] || STAT_TONE.jade;
  const body = (
    <div className="flex items-start gap-3">
      {icon && <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base ${ic}`} aria-hidden="true">{icon}</span>}
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink-soft">{label}</p>
        <p className={`num mt-0.5 truncate text-xl font-bold md:text-2xl ${fg}`}>{value}</p>
        {hint && <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>}
      </div>
    </div>
  );
  const cls = `block rounded-2xl border p-4 ${bg}`;
  return href ? <Link href={href} className={`${cls} transition hover:-translate-y-0.5 hover:shadow-md`}>{body}</Link> : <div className={cls}>{body}</div>;
}

export function SecTitle({ icon, tone = 'jade', children, actions }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h2 className="sec-title">{icon && <span className={`sec-icon tone-${tone}`} aria-hidden="true">{icon}</span>}{children}</h2>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
