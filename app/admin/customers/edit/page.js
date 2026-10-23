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
  const EXTRA = { district: '', village: '', gender: '', birth_date: '', whatsapp: '', facebook: '', referral_source: '', marketing_ok: false };
  const [f, setF] = useState(isNew ? { name: '', phone: '', email: '', address: '', province: '', type: 'retail', note: '', ...EXTRA } : null);
  const [acct, setAcct] = useState(null);
  const [stats, setStats] = useState(null);
  const [msg, setMsg] = useState({});
  const [orders] = useLoad((sb) => (isNew ? Promise.resolve({ data: [] }) : sb.from('orders').select('id,order_no,status,total,paid_amount,refunded_amount,created_at,channel').eq('customer_id', params.id).order('created_at', { ascending: false })), [params.id]);

  async function load() {
    const { data, error } = await getSupabase().from('customer_stats').select('*').eq('id', params.id).single();
    if (error) return setMsg({ error: errMsg(error) });
    setStats(data);
    setF({ name: data.name, phone: data.phone, email: data.email || '', address: data.address || '', province: data.province || '', type: data.type, note: data.note || '',
      district: data.district || '', village: data.village || '', gender: data.gender || '', birth_date: data.birth_date || '', whatsapp: data.whatsapp || '',
      facebook: data.facebook || '', referral_source: data.referral_source || '', marketing_ok: !!data.marketing_ok });
    if (data.user_id) {
      const sb = getSupabase();
      const [{ data: a }, { data: prof }] = await Promise.all([
        sb.rpc('member_accounts', { p_user_ids: [data.user_id] }),
        sb.from('profiles').select('is_active').eq('id', data.user_id).maybeSingle(),
      ]);
      setAcct({ ...(a?.[0] || {}), user_id: data.user_id, is_active: prof?.is_active ?? true });
    } else setAcct(null);
  }
  useEffect(() => { if (!isNew) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [params.id]);
  if (!f) return msg.error ? <Alert error={msg.error} /> : <p className="text-ink-soft">กำลังโหลด…</p>;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function save(e) {
    e.preventDefault();
    setMsg({});
    const row = { ...f, email: f.email || null, address: f.address || null, province: f.province || null, note: f.note || null,
      district: f.district || null, village: f.village || null, gender: f.gender || null, birth_date: f.birth_date || null,
      whatsapp: f.whatsapp || null, facebook: f.facebook || null, referral_source: f.referral_source || null };
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
      {acct && (
        <section className="card mb-6 flex flex-wrap items-center justify-between gap-3 border-l-4 border-jade p-4 text-sm">
          <div>
            <p className="font-semibold">บัญชีสมาชิก: {acct.email}</p>
            <p className="text-xs text-ink-soft">สมัครเมื่อ {dt(acct.created_at)} · {acct.confirmed ? 'ยืนยันอีเมลแล้ว' : 'ยังไม่ยืนยันอีเมล'} · เข้าระบบล่าสุด {acct.last_sign_in_at ? dt(acct.last_sign_in_at) : 'ยังไม่เคย'}</p>
            {!acct.is_active && <p className="mt-1 font-semibold text-red-700">บัญชีถูกปิดใช้งาน — สั่งซื้อไม่ได้</p>}
            <p className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <span className={`rounded-full px-2 py-0.5 font-semibold ${stats?.email_verified_at ? 'bg-jade-mist text-jade' : 'bg-saffron-pale text-saffron-deep'}`}>อีเมล: {stats?.email_verified_at ? 'ยืนยันแล้ว' : 'ยังไม่ยืนยัน'}</span>
              <span className={`rounded-full px-2 py-0.5 font-semibold ${stats?.phone_verified_at ? 'bg-jade-mist text-jade' : 'bg-saffron-pale text-saffron-deep'}`}>เบอร์โทร: {stats?.phone_verified_at ? `ยืนยันแล้ว ${dt(stats.phone_verified_at)}` : 'ยังไม่ยืนยัน'}</span>
              <button className="btn-ghost btn-sm" onClick={async () => {
                const v = !stats?.phone_verified_at;
                if (v && !window.confirm(`ยืนยันว่าได้โทร/ทัก WhatsApp เบอร์ ${stats?.phone} แล้ว และเป็นเจ้าของบัญชีจริง?`)) return;
                const { error } = await getSupabase().rpc('set_phone_verified', { p_customer_id: params.id, p_verified: v });
                if (error) setMsg({ error: errMsg(error) }); else load();
              }}>{stats?.phone_verified_at ? 'ยกเลิกการยืนยันเบอร์' : 'ยืนยันเบอร์โทรแล้ว'}</button>
              {stats?.phone && <a className="btn-ghost btn-sm" target="_blank" rel="noopener noreferrer" href={`https://wa.me/${String(stats.phone).replace(/\D/g, '').replace(/^0/, '856')}`}>เปิด WhatsApp</a>}
            </p>
          </div>
          {isAdmin && (
            <button className={acct.is_active ? 'btn-danger btn-sm' : 'btn-primary btn-sm'} onClick={async () => {
              if (!window.confirm(acct.is_active ? 'ปิดใช้งานบัญชีสมาชิกนี้? ลูกค้าจะสั่งซื้อไม่ได้จนกว่าจะเปิดใหม่' : 'เปิดใช้งานบัญชีนี้อีกครั้ง?')) return;
              const { error } = await getSupabase().from('profiles').update({ is_active: !acct.is_active }).eq('id', acct.user_id);
              if (error) setMsg({ error: errMsg(error) }); else load();
            }}>{acct.is_active ? 'ปิดใช้งานบัญชี' : 'เปิดใช้งานบัญชี'}</button>
          )}
        </section>
      )}
      {stats && !stats.user_id && <p className="mb-6 rounded-lg bg-jade-wash p-3 text-sm text-ink-soft">ลูกค้ารายนี้ยังไม่ได้สมัครสมาชิก (บันทึกจากหน้าร้าน/คำสั่งซื้อเก่า) — ถ้าสมัครด้วยเบอร์เดียวกัน ระบบจะผูกประวัติให้อัตโนมัติ</p>}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <form onSubmit={save} className="card h-fit space-y-3 p-4">
          <label className="block"><span className="label">ชื่อ *</span><input required className="input" value={f.name} onChange={set('name')} /></label>
          <label className="block"><span className="label">เบอร์โทร *</span><input required className="input" value={f.phone} onChange={set('phone')} /></label>
          <label className="block"><span className="label">อีเมล</span><input type="email" className="input" value={f.email} onChange={set('email')} /></label>
          <label className="block"><span className="label">ที่อยู่จัดส่ง</span><textarea rows={2} className="input" value={f.address} onChange={set('address')} /></label>
          <div className="grid grid-cols-3 gap-2">
            <label className="block"><span className="label">บ้าน</span><input className="input" value={f.village} onChange={set('village')} /></label>
            <label className="block"><span className="label">เมือง</span><input className="input" value={f.district} onChange={set('district')} /></label>
            <label className="block"><span className="label">แขวง</span><input className="input" value={f.province} onChange={set('province')} /></label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="label">WhatsApp</span><input className="input" value={f.whatsapp} onChange={set('whatsapp')} /></label>
            <label className="block"><span className="label">Facebook</span><input className="input" value={f.facebook} onChange={set('facebook')} /></label>
            <label className="block"><span className="label">เพศ</span><select className="input" value={f.gender} onChange={set('gender')}><option value="">—</option><option value="female">หญิง</option><option value="male">ชาย</option><option value="other">อื่น ๆ</option></select></label>
            <label className="block"><span className="label">วันเกิด</span><input type="date" className="input" value={f.birth_date} onChange={set('birth_date')} /></label>
          </div>
          <label className="block"><span className="label">รู้จักร้านจาก</span><input className="input" value={f.referral_source} onChange={set('referral_source')} /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!f.marketing_ok} onChange={set('marketing_ok')} /> ยินยอมรับข่าวสาร/โปรโมชัน</label>
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
