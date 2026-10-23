'use client';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { PageHead, Alert, useLoad, CHANNEL_TH, PM_TH, CTYPE_TH } from '@/components/admin/ui';
import { kip, errMsg } from '@/lib/format';

export default function NewOrder() {
  const router = useRouter();
  const [products] = useLoad((sb) => sb.from('products').select('*').is('deleted_at', null).order('sort'), []);
  const [key] = useState(() => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()));
  const [cust, setCust] = useState({ mode: 'new', id: '', type: 'retail', name: '', phone: '', address: '', province: '' });
  const [search, setSearch] = useState('');
  const [found, setFound] = useState([]);
  const [lines, setLines] = useState([]);
  const [opt, setOpt] = useState({ channel: 'shop', discount: 0, shipping_fee: 0, status: 'paid', method: 'cash', reference: '', internal_note: '' });
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function findCustomers(q) {
    setSearch(q);
    if (q.trim().length < 2) return setFound([]);
    const s = q.trim().replace(/[,()]/g, ' ');
    const { data } = await getSupabase().from('customers').select('id,name,phone,type,address').or(`name.ilike.%${s}%,phone.ilike.%${s}%`).limit(8);
    setFound(data || []);
  }

  const priced = useMemo(() => lines.map((l) => {
    const p = (products || []).find((x) => x.id === l.product_id);
    if (!p) return { ...l, unit: 0 };
    const ws = p.price_wholesale != null && (cust.type === 'wholesale' || Number(l.qty) >= p.wholesale_min_qty);
    const unit = l.custom ? Number(l.unit_price || 0) : Number(ws ? p.price_wholesale : p.price_retail);
    return { ...l, p, ws: !l.custom && ws, unit };
  }), [lines, products, cust.type]);
  const subtotal = priced.reduce((s, l) => s + l.unit * Number(l.qty || 0), 0);
  const total = subtotal - Number(opt.discount || 0) + Number(opt.shipping_fee || 0);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!lines.length) return setError('เพิ่มสินค้าอย่างน้อย 1 รายการ');
    setBusy(true);
    const options = {
      channel: opt.channel, discount: Number(opt.discount || 0), shipping_fee: Number(opt.shipping_fee || 0), status: opt.status,
      internal_note: opt.internal_note, payment_method_pref: opt.method,
      ...(cust.mode === 'existing' ? { customer_id: cust.id } : {}),
      ...(opt.status === 'paid' ? { payment: { method: opt.method, reference: opt.reference, amount: total } } : {}),
    };
    const { data, error: err } = await getSupabase().rpc('place_order', {
      p_customer: cust.mode === 'existing' ? {} : { name: cust.name, phone: cust.phone, address: cust.address, province: cust.province },
      p_items: lines.map((l) => ({ product_id: l.product_id, qty: Number(l.qty), ...(l.custom ? { unit_price: Number(l.unit_price) } : {}) })),
      p_idempotency_key: key, p_note: note || null, p_options: options,
    });
    setBusy(false);
    if (err) return setError(errMsg(err));
    router.push(`/admin/orders/${data.order_id}`);
  }

  return (
    <>
      <PageHead title="สร้างคำสั่งซื้อ" sub="ใช้สำหรับขายหน้าร้าน ออกบูธ หรือรับออเดอร์ทาง Facebook / WhatsApp / โทรศัพท์" />
      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <section className="card space-y-3 p-4">
            <h2 className="font-semibold">ลูกค้า</h2>
            {cust.mode === 'existing' ? (
              <div className="flex items-center justify-between rounded-lg bg-jade-wash p-3 text-sm">
                <span><b>{cust.name}</b> · {cust.phone} · {CTYPE_TH[cust.type]}</span>
                <button type="button" className="btn-ghost btn-sm" onClick={() => setCust({ mode: 'new', id: '', type: 'retail', name: '', phone: '', address: '', province: '' })}>เปลี่ยน</button>
              </div>
            ) : (
              <>
                <input className="input" placeholder="ค้นหาลูกค้าเดิม (ชื่อหรือเบอร์โทร)" value={search} onChange={(e) => findCustomers(e.target.value)} aria-label="ค้นหาลูกค้าเดิม" />
                {found.length > 0 && (
                  <ul className="divide-y divide-line rounded-lg border border-line">
                    {found.map((c) => (
                      <li key={c.id}><button type="button" className="w-full p-2 text-left text-sm hover:bg-jade-wash" onClick={() => { setCust({ mode: 'existing', ...c }); setFound([]); setSearch(''); }}>{c.name} · {c.phone} <span className="text-xs text-ink-faint">{CTYPE_TH[c.type]}</span></button></li>
                    ))}
                  </ul>
                )}
                <p className="text-xs text-ink-faint">หรือกรอกลูกค้าใหม่ (ถ้าเบอร์ซ้ำกับลูกค้าเดิม ระบบจะผูกกับลูกค้าเดิมอัตโนมัติ)</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input required className="input" placeholder="ชื่อ *" value={cust.name} onChange={(e) => setCust({ ...cust, name: e.target.value })} />
                  <input required className="input" placeholder="เบอร์โทร *" value={cust.phone} onChange={(e) => setCust({ ...cust, phone: e.target.value })} />
                  <input className="input sm:col-span-2" placeholder="ที่อยู่จัดส่ง" value={cust.address} onChange={(e) => setCust({ ...cust, address: e.target.value })} />
                  <input className="input" placeholder="แขวง" value={cust.province} onChange={(e) => setCust({ ...cust, province: e.target.value })} />
                </div>
              </>
            )}
          </section>

          <section className="card space-y-3 p-4">
            <h2 className="font-semibold">สินค้า</h2>
            <select className="input" value="" onChange={(e) => { const id = e.target.value; if (id && !lines.some((l) => l.product_id === id)) setLines([...lines, { product_id: id, qty: 1, unit_price: '', custom: false }]); }} aria-label="เพิ่มสินค้า">
              <option value="">+ เลือกสินค้า…</option>
              {(products || []).map((p) => <option key={p.id} value={p.id} disabled={p.stock <= 0}>{p.name_lo} ({p.sku}) · {kip(p.price_retail)} · คงเหลือ {p.stock}{p.is_active ? '' : ' · ปิดขาย'}</option>)}
            </select>
            {priced.map((l, k) => (
              <div key={l.product_id} className="grid grid-cols-[1fr_80px_120px] items-center gap-2 border-b border-line pb-2 text-sm sm:grid-cols-[1fr_80px_120px_auto_auto]">
                <span>{l.p?.name_lo}{l.ws && <span className="ml-1 rounded bg-saffron-pale px-1 text-xs text-saffron-deep">ราคาส่ง</span>}<span className="block text-xs text-ink-faint">คงเหลือ {l.p?.stock}</span></span>
                <input aria-label="จำนวน" type="number" min={1} max={l.p?.stock} className="input" value={l.qty} onChange={(e) => setLines(lines.map((x, i) => (i === k ? { ...x, qty: e.target.value } : x)))} />
                <input aria-label="ราคาต่อหน่วย" type="number" min={0} className="input" disabled={!l.custom} value={l.custom ? l.unit_price : l.unit} onChange={(e) => setLines(lines.map((x, i) => (i === k ? { ...x, unit_price: e.target.value } : x)))} />
                <label className="text-xs"><input type="checkbox" checked={l.custom} onChange={(e) => setLines(lines.map((x, i) => (i === k ? { ...x, custom: e.target.checked, unit_price: String(l.unit) } : x)))} /> ราคาพิเศษ</label>
                <button type="button" className="text-xs text-red-700" onClick={() => setLines(lines.filter((_, i) => i !== k))}>ลบ</button>
              </div>
            ))}
          </section>
        </div>

        <section className="card h-fit space-y-3 p-4">
          <h2 className="font-semibold">การขายและการชำระเงิน</h2>
          <label className="block"><span className="label">ช่องทางการขาย</span><select className="input" value={opt.channel} onChange={(e) => setOpt({ ...opt, channel: e.target.value })}>{Object.entries(CHANNEL_TH).filter(([k]) => k !== 'web').map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="label">ส่วนลด</span><input type="number" min={0} className="input" value={opt.discount} onChange={(e) => setOpt({ ...opt, discount: e.target.value })} /></label>
            <label className="block"><span className="label">ค่าจัดส่ง</span><input type="number" min={0} className="input" value={opt.shipping_fee} onChange={(e) => setOpt({ ...opt, shipping_fee: e.target.value })} /></label>
          </div>
          <label className="block"><span className="label">สถานะเริ่มต้น</span>
            <select className="input" value={opt.status} onChange={(e) => setOpt({ ...opt, status: e.target.value })}>
              <option value="paid">ชำระเงินครบแล้ว (ขายสด)</option>
              <option value="pending_payment">รอชำระเงิน</option>
              <option value="received">รับคำสั่งซื้อ</option>
            </select>
          </label>
          <label className="block"><span className="label">วิธีชำระ</span><select className="input" value={opt.method} onChange={(e) => setOpt({ ...opt, method: e.target.value })}>{Object.entries(PM_TH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          {opt.status === 'paid' && <label className="block"><span className="label">เลขอ้างอิงการโอน</span><input className="input" value={opt.reference} onChange={(e) => setOpt({ ...opt, reference: e.target.value })} /></label>}
          <label className="block"><span className="label">หมายเหตุภายใน</span><textarea rows={2} className="input" value={opt.internal_note} onChange={(e) => setOpt({ ...opt, internal_note: e.target.value })} /></label>
          <label className="block"><span className="label">หมายเหตุจากลูกค้า</span><textarea rows={2} className="input" value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <dl className="space-y-1 rounded-lg bg-jade-wash p-3 text-sm">
            <div className="flex justify-between"><dt>ค่าสินค้า</dt><dd>{kip(subtotal)}</dd></div>
            <div className="flex justify-between"><dt>ส่วนลด</dt><dd>−{kip(opt.discount)}</dd></div>
            <div className="flex justify-between"><dt>ค่าจัดส่ง</dt><dd>{kip(opt.shipping_fee)}</dd></div>
            <div className="flex justify-between text-base font-bold"><dt>ยอดรวม</dt><dd>{kip(total)}</dd></div>
          </dl>
          <p className="text-xs text-ink-faint">ราคาสุดท้ายคำนวณโดยระบบฐานข้อมูล สต็อกจะถูกตัดทันทีเมื่อบันทึก</p>
          <Alert error={error} />
          <button disabled={busy} className="btn-primary w-full py-3">{busy ? 'กำลังบันทึก…' : 'บันทึกคำสั่งซื้อ'}</button>
        </section>
      </form>
    </>
  );
}
