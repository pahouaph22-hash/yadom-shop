'use client';
import { Fragment, useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { PageHead, Alert, Empty } from '@/components/admin/ui';
import { dt, errMsg } from '@/lib/format';
import { exportCSV } from '@/lib/exporter';

const ENTITY_TH = { products: 'สินค้า', orders: 'คำสั่งซื้อ', order_items: 'รายการในคำสั่งซื้อ', payments: 'ชำระ/คืนเงิน', customers: 'ลูกค้า', expenses: 'ค่าใช้จ่าย', settings: 'ตั้งค่าร้าน', contact_channels: 'ช่องทางติดต่อ', contact_messages: 'ข้อความ', profiles: 'ผู้ใช้/สิทธิ์', auth: 'เข้า/ออกระบบ', admin_allowlist: 'รายชื่อแอดมิน' };
const ACTION_TH = { insert: 'เพิ่ม', update: 'แก้ไข', delete: 'ลบ', login: 'เข้าสู่ระบบ', logout: 'ออกจากระบบ' };
const RESTORABLE = ['expenses', 'contact_channels', 'customers', 'contact_messages'];
const GENERATED = { customers: ['phone_norm'] };
const PAGE = 100;

export default function AuditPage() {
  const [f, setF] = useState({ entity: '', action: '', actor: '', q: '', from: '', to: '' });
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState(null);
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(null);
  const [msg, setMsg] = useState({});

  function build(sb) {
    let q = sb.from('audit_log').select('*', { count: 'exact' }).order('at', { ascending: false });
    if (f.entity) q = q.eq('entity', f.entity);
    if (f.action) q = q.eq('action', f.action);
    if (f.actor) q = q.ilike('actor_email', `%${f.actor}%`);
    if (f.q.trim()) q = q.eq('entity_id', f.q.trim());
    if (f.from) q = q.gte('at', `${f.from}T00:00:00+07:00`);
    if (f.to) q = q.lte('at', `${f.to}T23:59:59+07:00`);
    return q;
  }
  useEffect(() => {
    build(getSupabase()).range(page * PAGE, page * PAGE + PAGE - 1).then(({ data, count: c, error }) => {
      if (error) setMsg({ error: errMsg(error) }); else { setRows(data); setCount(c || 0); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, page]);

  async function restore(a) {
    if (!window.confirm('กู้คืนข้อมูลที่ถูกลบรายการนี้?')) return;
    const row = { ...a.old_data };
    (GENERATED[a.entity] || []).forEach((k) => delete row[k]);
    const { error } = await getSupabase().from(a.entity).insert(row);
    setMsg(error ? { error: errMsg(error) } : { ok: 'กู้คืนแล้ว (การกู้คืนถูกบันทึกในประวัติด้วย)' });
  }

  const set = (k) => (e) => { setPage(0); setF({ ...f, [k]: e.target.value }); };
  return (
    <>
      <PageHead title="ประวัติการดำเนินงาน" sub={`${count} รายการ · บันทึกอัตโนมัติ แก้ไขหรือลบไม่ได้`}>
        <button className="btn-ghost" onClick={async () => {
          const { data, error } = await build(getSupabase()).limit(20000);
          if (error) return setMsg({ error: errMsg(error) });
          exportCSV(`audit-${Date.now()}.csv`, data, [
            { key: (a) => dt(a.at), label: 'เวลา' }, { key: 'actor_email', label: 'ผู้ดำเนินการ' }, { key: 'actor_role', label: 'สิทธิ์' },
            { key: 'action', label: 'การกระทำ' }, { key: 'entity', label: 'ข้อมูล' }, { key: 'entity_id', label: 'รหัส' },
            { key: (a) => (a.changed_fields || []).join(' '), label: 'ฟิลด์ที่เปลี่ยน' }, { key: 'old_data', label: 'ก่อนแก้ไข' }, { key: 'new_data', label: 'หลังแก้ไข' }, { key: 'note', label: 'หมายเหตุ' },
          ]);
        }}>ส่งออก CSV</button>
      </PageHead>
      <Alert {...msg} />
      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
        <select className="input" value={f.entity} onChange={set('entity')} aria-label="ข้อมูล"><option value="">ทุกประเภทข้อมูล</option>{Object.entries(ENTITY_TH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select className="input" value={f.action} onChange={set('action')} aria-label="การกระทำ"><option value="">ทุกการกระทำ</option>{Object.entries(ACTION_TH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <input className="input" placeholder="อีเมลผู้ดำเนินการ" value={f.actor} onChange={set('actor')} />
        <input className="input" placeholder="รหัสรายการ (ID)" value={f.q} onChange={set('q')} />
        <input type="date" className="input" value={f.from} onChange={set('from')} aria-label="จากวันที่" />
        <input type="date" className="input" value={f.to} onChange={set('to')} aria-label="ถึงวันที่" />
      </div>
      {rows === null ? <p className="text-ink-soft">กำลังโหลด…</p> : rows.length === 0 ? <Empty>ไม่พบรายการ</Empty> : (
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>เวลา</th><th>ผู้ดำเนินการ</th><th>การกระทำ</th><th>รายละเอียด</th><th></th></tr></thead>
            <tbody>
              {rows.map((a) => (
                <Fragment key={a.id}>
                  <tr>
                    <td className="whitespace-nowrap text-xs">{dt(a.at)}</td>
                    <td className="text-xs">{a.actor_email || (a.actor_role === 'anon' ? 'ลูกค้า (หน้าเว็บ)' : 'ระบบ')}<div className="text-ink-faint">{a.actor_role}</div></td>
                    <td><b>{ACTION_TH[a.action] || a.action}</b> {ENTITY_TH[a.entity] || a.entity}</td>
                    <td className="text-xs">{a.changed_fields?.join(', ')}{a.note && <div className="text-ink-soft">{a.note}</div>}<div className="text-ink-faint">{a.entity_id}</div></td>
                    <td className="whitespace-nowrap text-right">
                      {(a.old_data || a.new_data) && <button className="btn-ghost btn-sm" onClick={() => setOpen(open === a.id ? null : a.id)}>{open === a.id ? 'ซ่อน' : 'ก่อน/หลัง'}</button>}
                      {a.action === 'delete' && RESTORABLE.includes(a.entity) && <button className="btn-gold btn-sm ml-1" onClick={() => restore(a)}>กู้คืน</button>}
                    </td>
                  </tr>
                  {open === a.id && (
                    <tr><td colSpan={5} className="bg-jade-wash">
                      <div className="grid gap-3 md:grid-cols-2">
                        <div><p className="mb-1 text-xs font-semibold text-red-700">ก่อนแก้ไข</p><pre className="max-h-72 overflow-auto rounded bg-white p-2 text-xs">{a.old_data ? JSON.stringify(a.old_data, null, 2) : '—'}</pre></div>
                        <div><p className="mb-1 text-xs font-semibold text-jade">หลังแก้ไข</p><pre className="max-h-72 overflow-auto rounded bg-white p-2 text-xs">{a.new_data ? JSON.stringify(a.new_data, null, 2) : '—'}</pre></div>
                      </div>
                    </td></tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {count > PAGE && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <button disabled={page === 0} onClick={() => setPage(page - 1)} className="btn-ghost btn-sm">ก่อนหน้า</button>
          <span>หน้า {page + 1} / {Math.ceil(count / PAGE)}</span>
          <button disabled={(page + 1) * PAGE >= count} onClick={() => setPage(page + 1)} className="btn-ghost btn-sm">ถัดไป</button>
        </div>
      )}
    </>
  );
}
