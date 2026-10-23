'use client';
import Link from 'next/link';
import { useState } from 'react';
import { PageHead, Alert, Empty, useLoad, CTYPE_TH } from '@/components/admin/ui';
import { kip, d } from '@/lib/format';
import { exportCSV, exportXLSX } from '@/lib/exporter';

const COLS = [
  { key: 'name', label: 'ชื่อ' }, { key: 'phone', label: 'เบอร์โทร' }, { key: 'email', label: 'อีเมล' },
  { key: 'address', label: 'ที่อยู่' }, { key: 'province', label: 'แขวง' }, { key: (c) => CTYPE_TH[c.type], label: 'ประเภท' },
  { key: 'orders_count', label: 'จำนวนคำสั่งซื้อ' }, { key: 'total_spent', label: 'ยอดซื้อสะสม' }, { key: 'net_paid', label: 'ชำระสุทธิ' },
  { key: (c) => d(c.last_order_at), label: 'สั่งซื้อล่าสุด' }, { key: (c) => d(c.created_at), label: 'เริ่มเป็นลูกค้า' },
  { key: (c) => (c.user_id ? 'สมาชิก' : '-'), label: 'สมาชิก' }, { key: (c) => d(c.member_since), label: 'สมัครเมื่อ' },
  { key: 'village', label: 'บ้าน' }, { key: 'district', label: 'เมือง' }, { key: 'gender', label: 'เพศ' }, { key: 'birth_date', label: 'วันเกิด' },
  { key: 'whatsapp', label: 'WhatsApp' }, { key: 'facebook', label: 'Facebook' }, { key: 'referral_source', label: 'รู้จักจาก' },
  { key: (c) => (c.marketing_ok ? 'ยินยอม' : '-'), label: 'รับข่าวสาร' },
];

export default function CustomersPage() {
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [mem, setMem] = useState('');
  const [sort, setSort] = useState('last_order_at');
  const [rows, , error] = useLoad((sb) => {
    let x = sb.from('customer_stats').select('*').order(sort, { ascending: false, nullsFirst: false }).limit(2000);
    if (type) x = x.eq('type', type);
    return x;
  }, [type, sort]);
  const list = (rows || []).filter((c) => (!q || `${c.name} ${c.phone} ${c.email || ''}`.toLowerCase().includes(q.toLowerCase()))
    && (!mem || (mem === 'member' ? c.user_id : !c.user_id)));
  return (
    <>
      <PageHead title="สมาชิก / ลูกค้า" sub={`${list.length} ราย · สมาชิก ${(rows || []).filter((c) => c.user_id).length} ราย`}>
        <button className="btn-ghost" onClick={() => exportCSV(`customers-${Date.now()}.csv`, list, COLS)}>ส่งออก CSV</button>
        <button className="btn-ghost" onClick={() => exportXLSX(`customers-${Date.now()}.xlsx`, [{ name: 'Customers', rows: list, cols: COLS }])}>ส่งออก Excel</button>
        <Link href="/admin/customers/edit?id=new" className="btn-primary">+ เพิ่มลูกค้า</Link>
      </PageHead>
      <div className="mb-4 flex flex-wrap gap-3">
        <input className="input max-w-xs" placeholder="ค้นหาชื่อ / เบอร์ / อีเมล" value={q} onChange={(e) => setQ(e.target.value)} aria-label="ค้นหา" />
        <select className="input w-auto" value={type} onChange={(e) => setType(e.target.value)} aria-label="ประเภทลูกค้า">
          <option value="">ทุกประเภท</option>{Object.entries(CTYPE_TH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input w-auto" value={mem} onChange={(e) => setMem(e.target.value)} aria-label="สมาชิก">
          <option value="">สมาชิกและไม่ใช่สมาชิก</option><option value="member">เฉพาะสมาชิก</option><option value="guest">ลูกค้าที่ไม่ได้สมัคร (เก่า/หน้าร้าน)</option>
        </select>
        <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="เรียงตาม">
          <option value="last_order_at">สั่งซื้อล่าสุด</option><option value="total_spent">ยอดซื้อสะสมสูงสุด</option>
          <option value="orders_count">จำนวนคำสั่งซื้อมากสุด</option><option value="created_at">ลูกค้าใหม่ล่าสุด</option><option value="member_since">สมัครสมาชิกล่าสุด</option>
        </select>
      </div>
      <Alert error={error} />
      {rows === null ? <p className="text-ink-soft">กำลังโหลด…</p> : list.length === 0 ? <Empty>ยังไม่มีลูกค้า — ลูกค้าจะถูกเพิ่มอัตโนมัติเมื่อมีคำสั่งซื้อ</Empty> : (
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>ลูกค้า</th><th>สมาชิก</th><th>ประเภท</th><th className="text-right">คำสั่งซื้อ</th><th className="text-right">ยอดซื้อสะสม</th><th>สั่งล่าสุด</th></tr></thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id}>
                  <td><Link href={`/admin/customers/edit?id=${c.id}`} className="font-semibold text-jade hover:underline">{c.name}</Link><div className="text-xs text-ink-faint">{c.phone}{c.province ? ` · ${c.province}` : ''}</div></td>
                  <td className="text-xs">{c.user_id ? <span className="rounded bg-jade-mist px-1.5 py-0.5 text-jade">สมาชิก · {d(c.member_since)}</span> : '—'}
                    {c.user_id && <div className="mt-1 text-ink-faint">{c.email_verified_at ? '✓อีเมล' : '✗อีเมล'} · {c.phone_verified_at ? '✓เบอร์' : '✗เบอร์'}</div>}</td>
                  <td className="text-xs">{CTYPE_TH[c.type]}</td>
                  <td className="text-right">{c.orders_count}</td>
                  <td className="text-right font-semibold">{kip(c.total_spent)}</td>
                  <td className="text-xs">{d(c.last_order_at) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
