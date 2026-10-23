'use client';
import { useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { PageHead, Alert } from '@/components/admin/ui';
import { errMsg } from '@/lib/format';
import { exportJSON, exportXLSX } from '@/lib/exporter';

const TABLES = ['settings', 'contact_channels', 'products', 'stock_movements', 'customers', 'orders', 'order_items', 'order_events', 'payments', 'expenses', 'contact_messages', 'profiles', 'audit_log'];

async function fetchAll(sb, table) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select('*').range(from, from + 999);
    if (error) throw new Error(`${table}: ${errMsg(error)}`);
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

export default function BackupPage() {
  const [state, setState] = useState({});
  async function run(kind) {
    setState({ busy: true, progress: '' });
    try {
      const sb = getSupabase();
      const data = {};
      for (const t of TABLES) {
        setState({ busy: true, progress: `กำลังดึง ${t}…` });
        data[t] = await fetchAll(sb, t);
      }
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
      if (kind === 'json') exportJSON(`yadom-backup-${stamp}.json`, { created_at: new Date().toISOString(), tables: data });
      else await exportXLSX(`yadom-backup-${stamp}.xlsx`, TABLES.map((t) => ({ name: t, rows: data[t] })));
      setState({ ok: `สำรองข้อมูลแล้ว: ${TABLES.map((t) => `${t} ${data[t].length}`).join(' · ')}` });
    } catch (e) {
      setState({ error: e.message });
    }
  }
  return (
    <>
      <PageHead title="สำรองข้อมูล" sub="ดาวน์โหลดข้อมูลทุกตารางเก็บไว้ในเครื่อง แนะนำให้ทำทุกสัปดาห์" />
      <Alert error={state.error} ok={state.ok} />
      <div className="grid gap-4 md:grid-cols-2">
        <section className="card p-5">
          <h2 className="font-semibold">ดาวน์โหลดสำเนาทั้งหมด</h2>
          <p className="mt-1 text-sm text-ink-soft">JSON ใช้สำหรับกู้คืนเข้าฐานข้อมูล · Excel ใช้เปิดดู/ตรวจสอบ</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button disabled={state.busy} onClick={() => run('json')} className="btn-primary">ดาวน์โหลด JSON</button>
            <button disabled={state.busy} onClick={() => run('xlsx')} className="btn-ghost">ดาวน์โหลด Excel</button>
          </div>
          {state.busy && <p className="mt-3 text-sm text-ink-soft">{state.progress}</p>}
        </section>
        <section className="card p-5 text-sm">
          <h2 className="font-semibold">การกู้คืนเมื่อเกิดปัญหา</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-ink-soft">
            <li>ลบผิดรายการ (ลูกค้า ค่าใช้จ่าย ช่องทางติดต่อ ข้อความ): ไปที่ “ประวัติการดำเนินงาน” กรองการกระทำ “ลบ” แล้วกด “กู้คืน”</li>
            <li>สินค้าที่ลบจะถูกซ่อนเท่านั้น กู้คืนได้จากหน้าสินค้า (ติ๊ก “แสดงสินค้าที่ลบแล้ว”)</li>
            <li>คำสั่งซื้อ การชำระเงิน และประวัติ ไม่สามารถลบได้ตั้งแต่แรก</li>
            <li>สำรองอัตโนมัติรายวัน: เปิด GitHub Action “nightly-backup” (ดู README) ระบบจะเก็บไฟล์ pg_dump ของทั้งฐานข้อมูลทุกคืน</li>
            <li>กู้คืนทั้งฐานข้อมูล: ใช้ไฟล์ pg_dump กับคำสั่งใน README หัวข้อ “Restore”</li>
          </ul>
        </section>
      </div>
    </>
  );
}
