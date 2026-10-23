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
  received: 'bg-indigo-dye/10 text-indigo-dye', pending_payment: 'bg-saffron-pale text-saffron-deep', paid: 'bg-jade-mist text-jade',
  shipping: 'bg-sky-100 text-sky-800', delivered: 'bg-jade text-white', cancelled: 'bg-red-50 text-red-700', refunded: 'bg-red-100 text-red-800',
};
export function StatusBadge({ s }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLS[s] || ''}`}>{STATUS_TH[s] || s}</span>;
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

export function Stat({ label, value, tone = 'jade', href }) {
  const tones = { jade: 'text-jade', gold: 'text-saffron-deep', red: 'text-red-700', ink: 'text-ink' };
  const body = (
    <>
      <p className="text-xs text-ink-soft">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tones[tone]}`}>{value}</p>
    </>
  );
  return href ? <Link href={href} className="card block p-4 hover:border-jade">{body}</Link> : <div className="card p-4">{body}</div>;
}
