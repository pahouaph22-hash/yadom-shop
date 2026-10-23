'use client';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { useShop } from '@/components/Providers';
import { PageHead, Alert, StatusBadge, Stat, useLoad, CTYPE_TH } from '@/components/admin/ui';
import { kip, dt, errMsg } from '@/lib/format';

function CustomerPage({ params }) {
  const isNew = params.id === 'new';
  const router = useRouter();
  const { isAdmin } = useShop();
  const [f, setF] = useState(isNew ? { name: '', phone: '', email: '', address: '', province: '', type: 'retail', note: '' } : null);
  const [stats, setStats] = useState(null);
  const [msg, setMsg] = useState({});
  const [orders] = useLoad((sb) => (isNew ? Promise.resolve({ data: [] }) : sb.from('orders').select('id,order_no,status,total,paid_amount,refunded_amount,created_at,channel').eq('customer_id', params.id).order('created_at', { ascending: false })), [params.id]);

  async function load() {
    const { data, error } = await getSupabase().from('customer_stats').select('*').eq('id', params.id).single();
    if (error) return setMsg({ error: errMsg(error) });
    setStats(data);
    setF({ name: data.name, phone: data.phone, email: data.email || '', address: data.address || '', province: data.province || '', type: data.type, note: data.note || '' });
  }
  useEffect(() => { if (!isNew) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [params.id]);
  if (!f) return msg.error ? <Alert error={msg.error} /> : <p className="text-ink-soft">กำลังโหลด…</p>;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function save(e) {
    e.preventDefault();
    setMsg({});
    const row = { ...f, email: f.email || null, address: f.address || null, province: f.province || null, note: f.note || null };
    const sb = getSupabase();
    const res = isNew ? await sb.from('customers').insert(row).select('id').single() : await sb.from('customers').update(row).eq('id', params.id).select('id').single();
    if (res.error) return setMsg({ error: res.error.code === '23505' ? 'เบอร์โทรนี้มีลูกค้าอยู่แล้ว' : errMsg(res.error) });
    if (isNew) router.replace(`/admin/customers/edit?id=${res.data.id}`); else { setMsg({ ok: 'บันทึกแล้ว' }); load(); }
  }
  async function remove() {
    if (!window.confirm('ลบลูกค้ารายนี้? (ลบได้เฉพาะลูกค้าที่ยังไม่มีคำสั่งซื้อ)')) return;
    const { error } = await getSupabase().from('customers').delete().eq('id', params.id);
    if (error) setMsg({ error: error.code === '23503' ? 'ลบไม่ได้ เพราะลูกค้ามีประวัติคำสั่งซื้อ — ข้อมูลต้องเก็บไว้เพื่อการตรวจสอบ' : errMsg(error) });
    else router.push('/admin/customers');
  }

  return (
    <>
      <PageHead title={isNew ? 'เพิ่มลูกค้า' : f.name} sub={stats ? `ลูกค้าตั้งแต่ ${dt(stats.created_at)}` : null}>
        <Link href="/admin/customers" className="btn-ghost">← รายชื่อลูกค้า</Link>
        {!isNew && <Link href={`/admin/orders?customer=${params.id}`} className="btn-ghost">ดูคำสั่งซื้อทั้งหมด</Link>}
        {!isNew && isAdmin && <button onClick={remove} className="btn-danger">ลบลูกค้า</button>}
      </PageHead>
      <Alert {...msg} />
      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="จำนวนคำสั่งซื้อ" value={stats.orders_count} tone="ink" />
          <Stat label="ยอดซื้อสะสม" value={kip(stats.total_spent)} />
          <Stat label="ชำระสุทธิ" value={kip(stats.net_paid)} tone="gold" />
          <Stat label="สั่งซื้อล่าสุด" value={stats.last_order_at ? dt(stats.last_order_at).split(',')[0] : '—'} tone="ink" />
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <form onSubmit={save} className="card h-fit space-y-3 p-4">
          <label className="block"><span className="label">ชื่อ *</span><input required className="input" value={f.name} onChange={set('name')} /></label>
          <label className="block"><span className="label">เบอร์โทร *</span><input required className="input" value={f.phone} onChange={set('phone')} /></label>
          <label className="block"><span className="label">อีเมล</span><input type="email" className="input" value={f.email} onChange={set('email')} /></label>
          <label className="block"><span className="label">ที่อยู่จัดส่ง</span><textarea rows={2} className="input" value={f.address} onChange={set('address')} /></label>
          <label className="block"><span className="label">แขวง</span><input className="input" value={f.province} onChange={set('province')} /></label>
          <label className="block"><span className="label">ประเภทลูกค้า</span>
            <select className="input" value={f.type} onChange={set('type')}>{Object.entries(CTYPE_TH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </label>
          <p className="text-xs text-ink-faint">ลูกค้าขายส่งได้ราคาส่งทุกจำนวน · ลูกค้าทั่วไปจะเป็น “ลูกค้าประจำ” อัตโนมัติเมื่อส่งมอบสำเร็จครบ 3 คำสั่งซื้อ</p>
          <label className="block"><span className="label">บันทึกเกี่ยวกับลูกค้า</span><textarea rows={2} className="input" value={f.note} onChange={set('note')} /></label>
          <button className="btn-primary w-full">{isNew ? 'เพิ่มลูกค้า' : 'บันทึก'}</button>
        </form>
        {!isNew && (
          <section className="card overflow-x-auto p-4">
            <h2 className="mb-3 font-semibold">ประวัติการซื้อ</h2>
            {(orders || []).length === 0 ? <p className="text-sm text-ink-soft">ยังไม่มีคำสั่งซื้อ</p> : (
              <table className="tbl">
                <thead><tr><th>เลขที่</th><th>วันที่</th><th>สถานะ</th><th className="text-right">ยอดรวม</th><th className="text-right">ชำระแล้ว</th></tr></thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td><Link href={`/admin/orders/view?id=${o.id}`} className="font-semibold text-jade hover:underline">{o.order_no}</Link></td>
                      <td className="text-xs">{dt(o.created_at)}</td><td><StatusBadge s={o.status} /></td>
                      <td className="text-right">{kip(o.total)}</td><td className="text-right">{kip(Number(o.paid_amount) - Number(o.refunded_amount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}
      </div>
    </>
  );
}


function WithQuery() {
  const sp = useSearchParams();
  const id = sp.get('id') || '';
  return <CustomerPage key={id} params={{ id }} />;
}

export default function Page() {
  return <Suspense fallback={<p className="text-ink-soft">กำลังโหลด…</p>}><WithQuery /></Suspense>;
}
