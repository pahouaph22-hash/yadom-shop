'use client';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabase/client';
import { PageHead, StatusBadge, Alert, Empty, STATUS_TH, CHANNEL_TH } from '@/components/admin/ui';
import { kip, dt, errMsg } from '@/lib/format';
import { exportCSV, exportXLSX } from '@/lib/exporter';

const PAGE = 50;
const COLS = [
  { key: 'order_no', label: 'เลขคำสั่งซื้อ' }, { key: (o) => dt(o.created_at), label: 'วันที่' },
  { key: (o) => o.customers?.name, label: 'ลูกค้า' }, { key: 'ship_phone', label: 'เบอร์โทร' },
  { key: (o) => CHANNEL_TH[o.channel], label: 'ช่องทาง' }, { key: (o) => STATUS_TH[o.status], label: 'สถานะ' },
  { key: 'subtotal', label: 'ค่าสินค้า' }, { key: 'discount', label: 'ส่วนลด' }, { key: 'shipping_fee', label: 'ค่าส่ง' },
  { key: 'total', label: 'ยอดรวม' }, { key: 'paid_amount', label: 'ชำระแล้ว' }, { key: 'refunded_amount', label: 'คืนเงิน' },
  { key: (o) => (o.is_wholesale ? 'ขายส่ง' : 'ขายปลีก'), label: 'ประเภท' },
];

function OrdersInner() {
  const sp = useSearchParams();
  const [f, setF] = useState({
    q: sp.get('q') || '', status: sp.get('status') || '', from: sp.get('from') || '', to: sp.get('to') || '',
    channel: '', unpaid: sp.get('unpaid') === '1', customer: sp.get('customer') || '',
  });
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState(null);
  const [count, setCount] = useState(0);
  const [error, setError] = useState('');

  function query(sb, withRange = true) {
    let q = sb.from('orders').select('*, customers(name,type)', { count: 'exact' }).order('created_at', { ascending: false });
    if (f.status) q = q.eq('status', f.status);
    if (f.channel) q = q.eq('channel', f.channel);
    if (f.customer) q = q.eq('customer_id', f.customer);
    if (f.from) q = q.gte('created_at', `${f.from}T00:00:00+07:00`);
    if (f.to) q = q.lte('created_at', `${f.to}T23:59:59+07:00`);
    if (f.q.trim()) {
      const s = f.q.trim().replace(/[,()]/g, ' ');
      q = q.or(`order_no.ilike.%${s}%,ship_name.ilike.%${s}%,ship_phone.ilike.%${s}%`);
    }
    if (withRange) q = q.range(page * PAGE, page * PAGE + PAGE - 1);
    return q;
  }

  useEffect(() => {
    let live = true;
    query(getSupabase()).then(({ data, count: c, error: e }) => {
      if (!live) return;
      if (e) setError(errMsg(e));
      else {
        setError('');
        setRows(f.unpaid ? data.filter((o) => !['cancelled', 'refunded'].includes(o.status) && Number(o.paid_amount) - Number(o.refunded_amount) < Number(o.total)) : data);
        setCount(c || 0);
      }
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, page]);

  async function doExport(kind) {
    const { data, error: e } = await query(getSupabase(), false).limit(10000);
    if (e) return setError(errMsg(e));
    if (kind === 'csv') exportCSV(`orders-${Date.now()}.csv`, data, COLS);
    else exportXLSX(`orders-${Date.now()}.xlsx`, [{ name: 'Orders', rows: data, cols: COLS }]);
  }

  const set = (k) => (e) => { setPage(0); setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }); };
  return (
    <>
      <PageHead title="คำสั่งซื้อ" sub={`ทั้งหมด ${count} รายการ`}>
        <button onClick={() => doExport('csv')} className="btn-ghost">ส่งออก CSV</button>
        <button onClick={() => doExport('xlsx')} className="btn-ghost">ส่งออก Excel</button>
        <Link href="/admin/orders/new" className="btn-primary">+ สร้างคำสั่งซื้อ</Link>
      </PageHead>
      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
        <input className="input lg:col-span-2" placeholder="ค้นหาเลขคำสั่งซื้อ / ชื่อ / เบอร์โทร" value={f.q} onChange={set('q')} aria-label="ค้นหา" />
        <select className="input" value={f.status} onChange={set('status')} aria-label="สถานะ">
          <option value="">ทุกสถานะ</option>
          {Object.entries(STATUS_TH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input" value={f.channel} onChange={set('channel')} aria-label="ช่องทาง">
          <option value="">ทุกช่องทาง</option>
          {Object.entries(CHANNEL_TH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input type="date" className="input" value={f.from} onChange={set('from')} aria-label="จากวันที่" />
        <input type="date" className="input" value={f.to} onChange={set('to')} aria-label="ถึงวันที่" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.unpaid} onChange={set('unpaid')} /> เฉพาะที่ยังชำระไม่ครบ</label>
        {f.customer && <button className="btn-ghost btn-sm" onClick={() => setF({ ...f, customer: '' })}>ล้างตัวกรองลูกค้า ✕</button>}
      </div>
      <Alert error={error} />
      {rows === null ? <p className="text-ink-soft">กำลังโหลด…</p> : rows.length === 0 ? <Empty>ไม่พบคำสั่งซื้อตามเงื่อนไขนี้</Empty> : (
        <div className="card overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>เลขที่</th><th>วันที่</th><th>ลูกค้า</th><th>ช่องทาง</th><th>สถานะ</th><th className="text-right">ยอดรวม</th><th className="text-right">ชำระแล้ว</th></tr></thead>
            <tbody>
              {rows.map((o) => {
                const net = Number(o.paid_amount) - Number(o.refunded_amount);
                return (
                  <tr key={o.id}>
                    <td><Link href={`/admin/orders/view?id=${o.id}`} className="font-semibold text-jade hover:underline">{o.order_no}</Link>{o.is_wholesale && <span className="ml-1 rounded bg-saffron-pale px-1 text-xs text-saffron-deep">ส่ง</span>}</td>
                    <td className="whitespace-nowrap text-xs">{dt(o.created_at)}</td>
                    <td>{o.customers?.name}<div className="text-xs text-ink-faint">{o.ship_phone}</div></td>
                    <td className="text-xs">{CHANNEL_TH[o.channel]}</td>
                    <td><StatusBadge s={o.status} /></td>
                    <td className="text-right font-semibold">{kip(o.total)}</td>
                    <td className={`text-right ${net < Number(o.total) && !['cancelled', 'refunded'].includes(o.status) ? 'text-red-700' : ''}`}>{kip(net)}</td>
                  </tr>
                );
              })}
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

export default function OrdersPage() {
  return <Suspense><OrdersInner /></Suspense>;
}
