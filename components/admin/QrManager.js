'use client';
import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { useShop } from '@/components/Providers';
import { Alert, Modal } from './ui';
import { errMsg } from '@/lib/format';

const BLANK = { label: '', bank: 'BCEL One', account_name: '', account_no: '', image_url: '', active: true };

export default function QrManager() {
  const { refreshSettings } = useShop();
  const [list, setList] = useState(null);
  const [edit, setEdit] = useState(null);
  const [msg, setMsg] = useState({});
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data, error } = await getSupabase().from('settings').select('value').eq('key', 'payment_qr').maybeSingle();
    if (error) return setMsg({ error: errMsg(error) });
    setList(Array.isArray(data?.value) ? data.value : []);
  }
  useEffect(() => { load(); }, []);

  async function persist(next, okText) {
    const { error } = await getSupabase().from('settings').upsert({ key: 'payment_qr', value: next, is_public: true });
    if (error) { setMsg({ error: errMsg(error) }); return false; }
    setList(next); setMsg({ ok: okText }); refreshSettings(); return true;
  }

  async function upload(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return setMsg({ error: 'ไฟล์ใหญ่เกิน 5MB' });
    setBusy(true);
    const sb = getSupabase();
    const ext = (f.name.split('.').pop() || 'png').toLowerCase();
    const path = `payment-qr/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await sb.storage.from('product-images').upload(path, f, { contentType: f.type, upsert: false });
    setBusy(false);
    if (error) return setMsg({ error: errMsg(error) });
    setEdit((x) => ({ ...x, image_url: sb.storage.from('product-images').getPublicUrl(path).data.publicUrl }));
  }

  async function save(e) {
    e.preventDefault();
    if (!edit.image_url) return setMsg({ error: 'กรุณาอัปโหลดรูป QR Code' });
    const item = { ...edit, id: edit.id || crypto.randomUUID() };
    const next = edit.id ? list.map((q) => (q.id === edit.id ? item : q)) : [...list, item];
    if (await persist(next, 'บันทึก QR Code แล้ว — แสดงในหน้าชำระเงินของลูกค้าทันที')) setEdit(null);
  }

  return (
    <section className="card mb-6 p-4">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-semibold">QR Code สำหรับชำระเงิน</h2>
        <button className="btn-primary btn-sm" onClick={() => { setMsg({}); setEdit({ ...BLANK }); }}>+ เพิ่ม QR Code</button>
      </div>
      <p className="mb-3 text-sm text-ink-soft">ลูกค้าจะเห็น QR ในหน้าคำสั่งซื้อตอนรอชำระเงิน แล้วอัปโหลดสลิปส่งกลับมาได้ (ตรวจและยืนยันสลิปในหน้ารายละเอียดคำสั่งซื้อ)</p>
      <Alert {...msg} />
      {list === null ? <p className="text-sm text-ink-soft">กำลังโหลด…</p> : list.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-ink-soft">ยังไม่มี QR Code — กด “เพิ่ม QR Code” แล้วอัปโหลดรูป QR จากแอปธนาคาร (เช่น BCEL One)</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((q) => (
            <div key={q.id} className={`rounded-xl border border-line p-3 ${q.active === false ? 'opacity-50' : ''}`}>
              <img src={q.image_url} alt="" className="mx-auto aspect-square w-40 rounded bg-white object-contain" />
              <p className="mt-2 font-semibold">{q.label || q.bank}</p>
              <p className="text-xs text-ink-soft">{q.account_name} {q.account_no && `· ${q.account_no}`}</p>
              <p className="text-xs">{q.active === false ? 'ซ่อนอยู่' : 'แสดงให้ลูกค้า'}</p>
              <div className="mt-2 flex gap-2">
                <button className="btn-ghost btn-sm" onClick={() => { setMsg({}); setEdit({ ...q }); }}>แก้ไข</button>
                <button className="btn-danger btn-sm" onClick={() => { if (window.confirm('ลบ QR Code นี้?')) persist(list.filter((x) => x.id !== q.id), 'ลบแล้ว'); }}>ลบ</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {edit && (
        <Modal title={edit.id ? 'แก้ไข QR Code' : 'เพิ่ม QR Code'} onClose={() => setEdit(null)}>
          <form onSubmit={save} className="space-y-3">
            <div>
              <span className="label">รูป QR Code *</span>
              <div className="flex items-center gap-3">
                {edit.image_url ? <img src={edit.image_url} alt="" className="h-28 w-28 rounded bg-white object-contain" /> : <div className="h-28 w-28 rounded bg-jade-mist" />}
                <label className="btn-ghost cursor-pointer">{busy ? 'กำลังอัปโหลด…' : edit.image_url ? 'เปลี่ยนรูป' : 'อัปโหลดรูป'}
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={upload} /></label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="label">ธนาคาร / แอป</span><input className="input" value={edit.bank} onChange={(e) => setEdit({ ...edit, bank: e.target.value })} placeholder="BCEL One, LDB, JDB…" /></label>
              <label className="block"><span className="label">ชื่อที่แสดง</span><input className="input" value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} placeholder="เช่น โอนกีบ (BCEL)" /></label>
            </div>
            <label className="block"><span className="label">ชื่อบัญชี</span><input className="input" value={edit.account_name} onChange={(e) => setEdit({ ...edit, account_name: e.target.value })} /></label>
            <label className="block"><span className="label">เลขบัญชี</span><input className="input" value={edit.account_no} onChange={(e) => setEdit({ ...edit, account_no: e.target.value })} /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.active !== false} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> แสดงให้ลูกค้าเห็น</label>
            <Alert error={msg.error} />
            <button disabled={busy} className="btn-primary w-full">บันทึก</button>
          </form>
        </Modal>
      )}
    </section>
  );
}
