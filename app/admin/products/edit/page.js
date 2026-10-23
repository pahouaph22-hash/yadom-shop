'use client';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { useShop } from '@/components/Providers';
import { PageHead, Alert, Modal, useLoad } from '@/components/admin/ui';
import { kip, dt, errMsg } from '@/lib/format';

const EMPTY = {
  sku: '', name_lo: '', name_th: '', name_en: '', description_lo: '', description_th: '', description_en: '', size_label: '',
  images: [], price_retail: '', price_wholesale: '', wholesale_min_qty: 12, unit_cost: 0, packaging_cost: 0, stock: 0,
  low_stock_threshold: 10, is_active: true, sort: 0,
};
const REASON_TH = { initial: 'สต็อกเริ่มต้น', restock: 'รับสินค้าเข้า', adjust: 'ปรับยอด (ตรวจนับ)', damage: 'เสียหาย/สูญหาย', order: 'ขาย', order_edit: 'แก้ไขคำสั่งซื้อ', cancel: 'ยกเลิกคำสั่งซื้อ', return: 'รับคืนสินค้า' };

function ProductEdit({ params }) {
  const isNew = params.id === 'new';
  const router = useRouter();
  const { isAdmin, can } = useShop();
  const [f, setF] = useState(isNew ? EMPTY : null);
  const [msg, setMsg] = useState({});
  const [busy, setBusy] = useState(false);
  const [stockModal, setStockModal] = useState(false);
  const [moves, reloadMoves] = useLoad((sb) => (isNew ? Promise.resolve({ data: [] }) : sb.from('stock_movements').select('*').eq('product_id', params.id).order('created_at', { ascending: false }).limit(100)), [params.id]);

  async function load() {
    const { data, error } = await getSupabase().from('products').select('*').eq('id', params.id).single();
    if (error) setMsg({ error: errMsg(error) });
    else setF({ ...data, price_wholesale: data.price_wholesale ?? '' });
  }
  useEffect(() => { if (!isNew) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [params.id]);
  if (!f) return msg.error ? <Alert error={msg.error} /> : <p className="text-ink-soft">กำลังโหลด…</p>;

  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  async function upload(e) {
    const files = [...(e.target.files || [])];
    if (!files.length) return;
    setBusy(true); setMsg({});
    const sb = getSupabase();
    const urls = [];
    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) { setMsg({ error: `${file.name}: ไฟล์ใหญ่เกิน 5MB` }); continue; }
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${f.sku || 'product'}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await sb.storage.from('product-images').upload(path, file, { contentType: file.type, upsert: false });
      if (error) { setMsg({ error: errMsg(error) }); continue; }
      urls.push(sb.storage.from('product-images').getPublicUrl(path).data.publicUrl);
    }
    setF((x) => ({ ...x, images: [...(x.images || []), ...urls] }));
    setBusy(false);
    e.target.value = '';
  }

  async function save(e) {
    e.preventDefault();
    setBusy(true); setMsg({});
    const row = {
      sku: f.sku.trim(), name_lo: f.name_lo.trim(), name_th: f.name_th || null, name_en: f.name_en || null,
      description_lo: f.description_lo || null, description_th: f.description_th || null, description_en: f.description_en || null,
      size_label: f.size_label || null, images: f.images || [],
      price_retail: Number(f.price_retail), price_wholesale: f.price_wholesale === '' || f.price_wholesale == null ? null : Number(f.price_wholesale),
      wholesale_min_qty: Number(f.wholesale_min_qty) || 1, unit_cost: Number(f.unit_cost) || 0, packaging_cost: Number(f.packaging_cost) || 0,
      low_stock_threshold: Number(f.low_stock_threshold) || 0, is_active: !!f.is_active, sort: Number(f.sort) || 0,
    };
    if (row.price_wholesale != null && row.price_wholesale > row.price_retail) {
      setBusy(false); return setMsg({ error: 'ราคาส่งไม่ควรสูงกว่าราคาปลีก' });
    }
    const sb = getSupabase();
    const res = isNew
      ? await sb.from('products').insert({ ...row, stock: Math.max(0, Number(f.stock) || 0) }).select('id').single()
      : await sb.from('products').update(row).eq('id', params.id).select('id').single();
    setBusy(false);
    if (res.error) {
      return setMsg({ error: res.error.code === '23505' ? 'SKU นี้มีอยู่แล้ว — ใช้รหัสอื่น' : errMsg(res.error) });
    }
    if (isNew) router.replace(`/admin/products/edit?id=${res.data.id}`);
    else { setMsg({ ok: 'บันทึกแล้ว — การเปลี่ยนแปลงถูกบันทึกในประวัติ' }); load(); }
  }

  async function softDelete() {
    if (!window.confirm('ลบสินค้านี้ออกจากร้าน? (ข้อมูลและประวัติการขายยังถูกเก็บไว้ และกู้คืนได้)')) return;
    const { error } = await getSupabase().from('products').update({ deleted_at: new Date().toISOString(), is_active: false }).eq('id', params.id);
    if (error) setMsg({ error: errMsg(error) }); else router.push('/admin/products');
  }
  async function restore() {
    const { error } = await getSupabase().from('products').update({ deleted_at: null }).eq('id', params.id);
    if (error) setMsg({ error: errMsg(error) }); else load();
  }

  return (
    <>
      <PageHead title={isNew ? 'เพิ่มสินค้า' : f.name_lo} sub={!isNew && f.deleted_at ? `ลบเมื่อ ${dt(f.deleted_at)}` : null}>
        <Link href="/admin/products" className="btn-ghost">← รายการสินค้า</Link>
        {!isNew && !f.deleted_at && <button onClick={() => setStockModal(true)} className="btn-gold">ปรับสต็อก ({f.stock})</button>}
        {!isNew && isAdmin && (f.deleted_at ? <button onClick={restore} className="btn-ghost">กู้คืนสินค้า</button> : <button onClick={softDelete} className="btn-danger">ลบสินค้า</button>)}
      </PageHead>
      <Alert {...msg} />
      <form onSubmit={save} className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="card space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block"><span className="label">SKU (รหัสสินค้า) *</span><input required pattern="[A-Za-z0-9_\-]{1,40}" className="input" value={f.sku} onChange={set('sku')} /></label>
            <label className="block sm:col-span-2"><span className="label">ขนาด/บรรจุ</span><input className="input" placeholder="เช่น 2 ml, แพ็ก 6 หลอด" value={f.size_label || ''} onChange={set('size_label')} /></label>
          </div>
          <label className="block"><span className="label">ชื่อสินค้า (ภาษาลาว) *</span><input required className="input" value={f.name_lo} onChange={set('name_lo')} /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="label">ชื่อ (ไทย)</span><input className="input" value={f.name_th || ''} onChange={set('name_th')} /></label>
            <label className="block"><span className="label">ชื่อ (English)</span><input className="input" value={f.name_en || ''} onChange={set('name_en')} /></label>
          </div>
          <label className="block"><span className="label">รายละเอียด (ลาว)</span><textarea rows={3} className="input" value={f.description_lo || ''} onChange={set('description_lo')} /></label>
          <label className="block"><span className="label">รายละเอียด (ไทย)</span><textarea rows={3} className="input" value={f.description_th || ''} onChange={set('description_th')} /></label>
          <label className="block"><span className="label">รายละเอียด (English)</span><textarea rows={3} className="input" value={f.description_en || ''} onChange={set('description_en')} /></label>
          <div>
            <span className="label">รูปภาพ (JPG/PNG/WebP ไม่เกิน 5MB) — รูปแรกคือรูปหลัก</span>
            <div className="flex flex-wrap gap-2">
              {(f.images || []).map((src, i) => (
                <div key={src} className="relative">
                  <img src={src} alt="" className="h-24 w-24 rounded-lg object-cover" />
                  <div className="absolute inset-x-0 bottom-0 flex justify-between bg-ink/60 px-1 text-xs text-white">
                    <button type="button" disabled={i === 0} onClick={() => { const a = [...f.images]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; setF({ ...f, images: a }); }}>◀</button>
                    <button type="button" onClick={() => setF({ ...f, images: f.images.filter((x) => x !== src) })}>ลบ</button>
                  </div>
                </div>
              ))}
              <label className="flex h-24 w-24 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-line text-xs text-ink-soft hover:border-jade">
                {busy ? '…' : '+ เพิ่มรูป'}
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={upload} />
              </label>
            </div>
          </div>
        </section>

        <section className="card h-fit space-y-4 p-4">
          <h2 className="font-semibold">ราคาและต้นทุน (กีบ)</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="label">ราคาขายปลีก *</span><input required type="number" min={0} className="input" value={f.price_retail} onChange={set('price_retail')} /></label>
            <label className="block"><span className="label">ราคาขายส่ง</span><input type="number" min={0} className="input" placeholder="ไม่มี" value={f.price_wholesale} onChange={set('price_wholesale')} /></label>
            <label className="block"><span className="label">ขายส่งเมื่อซื้อตั้งแต่ (ชิ้น)</span><input type="number" min={1} className="input" value={f.wholesale_min_qty} onChange={set('wholesale_min_qty')} /></label>
            <span />
            <label className="block"><span className="label">ต้นทุนสินค้า/ชิ้น</span><input type="number" min={0} className="input" value={f.unit_cost} onChange={set('unit_cost')} /></label>
            <label className="block"><span className="label">ค่าบรรจุภัณฑ์/ชิ้น</span><input type="number" min={0} className="input" value={f.packaging_cost} onChange={set('packaging_cost')} /></label>
          </div>
          {Number(f.price_retail) > 0 && (
            <p className="rounded-lg bg-jade-wash p-3 text-sm">กำไรต่อชิ้น (ปลีก): <b>{kip(Number(f.price_retail) - Number(f.unit_cost) - Number(f.packaging_cost))}</b>
              {f.price_wholesale !== '' && <> · (ส่ง): <b>{kip(Number(f.price_wholesale) - Number(f.unit_cost) - Number(f.packaging_cost))}</b></>}</p>
          )}
          <h2 className="pt-2 font-semibold">สต็อกและการแสดงผล</h2>
          <div className="grid grid-cols-2 gap-3">
            {isNew
              ? <label className="block"><span className="label">สต็อกเริ่มต้น</span><input type="number" min={0} className="input" value={f.stock} onChange={set('stock')} /></label>
              : <div><span className="label">คงเหลือ</span><p className="py-2 text-xl font-bold">{f.stock}</p></div>}
            <label className="block"><span className="label">แจ้งเตือนเมื่อเหลือ ≤</span><input type="number" min={0} className="input" value={f.low_stock_threshold} onChange={set('low_stock_threshold')} /></label>
            <label className="block"><span className="label">ลำดับการแสดง</span><input type="number" className="input" value={f.sort} onChange={set('sort')} /></label>
            <label className="flex items-center gap-2 pt-6 text-sm"><input type="checkbox" checked={!!f.is_active} onChange={set('is_active')} /> เปิดขายบนหน้าร้าน</label>
          </div>
          <button disabled={busy} className="btn-primary w-full">{isNew ? 'เพิ่มสินค้า' : 'บันทึกการแก้ไข'}</button>
        </section>
      </form>

      {!isNew && (
        <section className="card mt-6 overflow-x-auto p-4">
          <h2 className="mb-3 font-semibold">ความเคลื่อนไหวของสต็อก (100 รายการล่าสุด)</h2>
          <table className="tbl">
            <thead><tr><th>วันที่</th><th>เหตุผล</th><th className="text-right">เปลี่ยนแปลง</th><th className="text-right">คงเหลือ</th><th>หมายเหตุ / คำสั่งซื้อ</th></tr></thead>
            <tbody>
              {(moves || []).map((m) => (
                <tr key={m.id}>
                  <td className="text-xs">{dt(m.created_at)}</td><td>{REASON_TH[m.reason]}</td>
                  <td className={`text-right font-semibold ${m.change < 0 ? 'text-red-700' : 'text-jade'}`}>{m.change > 0 ? '+' : ''}{m.change}</td>
                  <td className="text-right">{m.stock_after}</td>
                  <td className="text-xs">{m.order_id ? <Link className="text-jade hover:underline" href={`/admin/orders/view?id=${m.order_id}`}>{m.note}</Link> : m.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {stockModal && <StockModal p={f} isAdmin={can('finance')} onClose={() => setStockModal(false)} onDone={() => { setStockModal(false); load(); reloadMoves(); }} />}
    </>
  );
}

function StockModal({ p, isAdmin, onClose, onDone }) {
  const [f, setF] = useState({ reason: 'restock', qty: '', note: '', cost: '' });
  const [error, setError] = useState('');
  const sign = f.reason === 'restock' || f.reason === 'return' ? 1 : f.reason === 'damage' ? -1 : 0;
  async function submit(e) {
    e.preventDefault();
    const n = Number(f.qty);
    const change = sign === 0 ? n - p.stock : sign * Math.abs(n);
    if (!change) return setError('ไม่มีการเปลี่ยนแปลง');
    const sb = getSupabase();
    const { error: err } = await sb.rpc('adjust_stock', { p_product_id: p.id, p_change: change, p_reason: f.reason, p_note: f.note || null });
    if (err) return setError(errMsg(err));
    if (f.reason === 'restock' && Number(f.cost) > 0) {
      const { error: e2 } = await sb.from('expenses').insert({ category: 'inventory', amount: Number(f.cost), description: `รับสินค้าเข้า ${p.name_lo} ×${Math.abs(n)}`, product_id: p.id });
      if (e2) return setError('ปรับสต็อกแล้ว แต่บันทึกค่าใช้จ่ายไม่สำเร็จ: ' + errMsg(e2));
    }
    onDone();
  }
  return (
    <Modal title={`ปรับสต็อก: ${p.name_lo} (คงเหลือ ${p.stock})`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block"><span className="label">ประเภท</span>
          <select className="input" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })}>
            <option value="restock">รับสินค้าเข้า (+)</option>
            <option value="return">รับคืนจากลูกค้า (+)</option>
            <option value="damage">เสียหาย/สูญหาย (−)</option>
            <option value="adjust">ตรวจนับ — ตั้งยอดคงเหลือใหม่</option>
          </select>
        </label>
        <label className="block"><span className="label">{sign === 0 ? 'ยอดคงเหลือที่นับได้จริง' : 'จำนวน (ชิ้น)'}</span><input required type="number" min={0} className="input" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} /></label>
        {f.reason === 'restock' && isAdmin && <label className="block"><span className="label">ค่าใช้จ่ายในการซื้อ/ผลิตล็อตนี้ (กีบ, ไม่บังคับ)</span><input type="number" min={0} className="input" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} /></label>}
        <label className="block"><span className="label">หมายเหตุ</span><input className="input" maxLength={500} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
        <Alert error={error} />
        <button className="btn-primary w-full">บันทึก</button>
      </form>
    </Modal>
  );
}


function WithQuery() {
  const sp = useSearchParams();
  const id = sp.get('id') || '';
  return <ProductEdit key={id} params={{ id }} />;
}

export default function Page() {
  return <Suspense fallback={<p className="text-ink-soft">กำลังโหลด…</p>}><WithQuery /></Suspense>;
}
