'use client';
import Link from 'next/link';
import { useState } from 'react';
import { PageHead, Alert, Empty, useLoad } from '@/components/admin/ui';
import { kip } from '@/lib/format';
import { exportCSV } from '@/lib/exporter';

export default function ProductsPage() {
  const [showDeleted, setShowDeleted] = useState(false);
  const [q, setQ] = useState('');
  const [rows, , error] = useLoad((sb) => {
    let x = sb.from('products').select('*').order('sort').order('created_at');
    if (!showDeleted) x = x.is('deleted_at', null);
    return x;
  }, [showDeleted]);
  const list = (rows || []).filter((p) => !q || `${p.name_lo} ${p.name_th || ''} ${p.name_en || ''} ${p.sku}`.toLowerCase().includes(q.toLowerCase()));
  const stockValue = list.filter((p) => !p.deleted_at).reduce((s, p) => s + p.stock * (Number(p.unit_cost) + Number(p.packaging_cost)), 0);
  return (
    <>
      <PageHead title="สินค้าและสต็อก" sub={`มูลค่าสต็อกตามต้นทุน ${kip(stockValue)}`}>
        <button className="btn-ghost" onClick={() => exportCSV(`products-${Date.now()}.csv`, list, [
          { key: 'sku', label: 'SKU' }, { key: 'name_lo', label: 'ชื่อ (ลาว)' }, { key: 'name_th', label: 'ชื่อ (ไทย)' },
          { key: 'price_retail', label: 'ราคาปลีก' }, { key: 'price_wholesale', label: 'ราคาส่ง' }, { key: 'wholesale_min_qty', label: 'ขั้นต่ำขายส่ง' },
          { key: 'unit_cost', label: 'ต้นทุน' }, { key: 'packaging_cost', label: 'ค่าบรรจุภัณฑ์' }, { key: 'stock', label: 'คงเหลือ' },
          { key: (p) => (p.deleted_at ? 'ลบแล้ว' : p.is_active ? 'เปิดขาย' : 'ปิดขาย'), label: 'สถานะ' },
        ])}>ส่งออก CSV</button>
        <Link href="/admin/products/edit?id=new" className="btn-primary">+ เพิ่มสินค้า</Link>
      </PageHead>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input className="input max-w-xs" placeholder="ค้นหาชื่อหรือ SKU" value={q} onChange={(e) => setQ(e.target.value)} aria-label="ค้นหา" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} /> แสดงสินค้าที่ลบแล้ว</label>
      </div>
      <Alert error={error} />
      {rows === null ? <p className="text-ink-soft">กำลังโหลด…</p> : list.length === 0 ? <Empty>ยังไม่มีสินค้า — กด “เพิ่มสินค้า” เพื่อเริ่ม</Empty> : (
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead><tr><th></th><th>สินค้า</th><th className="text-right">ราคาปลีก</th><th className="text-right">ราคาส่ง</th><th className="text-right">ต้นทุนรวม/ชิ้น</th><th className="text-right">คงเหลือ</th><th>สถานะ</th></tr></thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className={p.deleted_at ? 'opacity-50' : ''}>
                  <td className="w-12">{p.images?.[0] ? <img src={p.images[0]} alt="" className="h-10 w-10 rounded object-cover" /> : <div className="h-10 w-10 rounded bg-jade-mist" />}</td>
                  <td><Link href={`/admin/products/edit?id=${p.id}`} className="font-semibold text-jade hover:underline">{p.name_lo}</Link><div className="text-xs text-ink-faint">{p.sku}{p.size_label ? ` · ${p.size_label}` : ''}</div></td>
                  <td className="text-right">{kip(p.price_retail)}</td>
                  <td className="text-right">{p.price_wholesale != null ? <>{kip(p.price_wholesale)}<div className="text-xs text-ink-faint">≥ {p.wholesale_min_qty}</div></> : '—'}</td>
                  <td className="text-right">{kip(Number(p.unit_cost) + Number(p.packaging_cost))}</td>
                  <td className={`text-right font-bold ${p.stock <= p.low_stock_threshold ? 'text-red-700' : ''}`}>{p.stock}</td>
                  <td className="text-xs">{p.deleted_at ? 'ลบแล้ว' : p.is_active ? 'เปิดขาย' : 'ปิดขาย'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
