'use client';
import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { Alert, Modal, SecTitle } from './ui';
import { CARRIERS, carrierLabel, waNumber } from '@/lib/carriers';
import { dt, errMsg } from '@/lib/format';
import { withBase } from '@/lib/base';
import { compressImage } from '@/lib/image';

const BLANK = { carrier: 'anousith', carrier_name: '', tracking_no: '', branch: '', branch_phone: '', note: '', files: [] };

export default function ShipmentPanel({ order, onChanged }) {
  const [list, setList] = useState(null);
  const [edit, setEdit] = useState(null);
  const [msg, setMsg] = useState({});
  const [busy, setBusy] = useState(false);
  const closed = ['cancelled', 'refunded'].includes(order.status);

  async function load() {
    const { data, error } = await getSupabase().from('order_shipments').select('*').eq('order_id', order.id).order('shipped_at');
    if (error) setMsg({ error: errMsg(error) }); else setList(data);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [order.id]);

  const receiptUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${withBase(`/receipt/?no=${encodeURIComponent(order.order_no)}&phone=${encodeURIComponent(order.ship_phone || '')}`)}`
    : '';
  function waText(s) {
    const lines = [
      `ສະບາຍດີ ${order.ship_name || ''} 🙏`,
      `ຄຳສັ່ງຊື້ ${order.order_no} ສົ່ງແລ້ວ / คำสั่งซื้อจัดส่งแล้ว`,
      s ? `${carrierLabel(s, 'lo')}${s.tracking_no ? ` · ເລກພັດສະດຸ ${s.tracking_no}` : ''}${s.branch ? ` · ສາຂາ ${s.branch}` : ''}` : '',
      `ໃບບິນ ແລະ ໃບສົ່ງພັດສະດຸ / ใบเสร็จและใบส่งพัสดุ: ${receiptUrl}`,
    ];
    return lines.filter(Boolean).join('\n');
  }

  async function upload(e) {
    const files = [...(e.target.files || [])];
    if (!files.length) return;
    setBusy(true); setMsg({});
    const sb = getSupabase();
    const urls = [];
    for (const raw of files) {
      const f = await compressImage(raw, { maxSide: 2000, quality: 0.85 });
      if (f.size > 5 * 1024 * 1024) { setMsg({ error: `${f.name}: ไฟล์ใหญ่เกิน 5MB` }); continue; }
      const ext = (f.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const path = `${order.order_no}/${crypto.randomUUID()}.${ext}`;
      const { error } = await sb.storage.from('shipping-docs').upload(path, f, { contentType: f.type, upsert: false });
      if (error) { setMsg({ error: errMsg(error) }); continue; }
      urls.push(sb.storage.from('shipping-docs').getPublicUrl(path).data.publicUrl);
    }
    setEdit((x) => ({ ...x, files: [...(x.files || []), ...urls] }));
    setBusy(false);
    e.target.value = '';
  }

  async function save(e) {
    e.preventDefault();
    const { error } = await getSupabase().rpc('save_shipment', { p_order_id: order.id, p_data: edit });
    if (error) return setMsg({ error: errMsg(error) });
    setEdit(null); setMsg({ ok: 'บันทึกการจัดส่งแล้ว — ลูกค้าเห็นข้อมูลและใบส่งพัสดุในหน้าคำสั่งซื้อทันที' });
    load(); onChanged?.();
  }

  if (list === null) return null;
  const last = list[list.length - 1];
  return (
    <section className="card p-4 no-print md:p-5">
      <SecTitle icon="🚚" tone="sky" actions={!closed && <button className="btn-primary btn-sm" onClick={() => { setMsg({}); setEdit({ ...BLANK }); }}>+ บันทึกการจัดส่ง</button>}>การจัดส่งและใบส่งพัสดุ</SecTitle>
      <Alert {...msg} />
      {list.length === 0 ? <p className="rounded-xl border border-dashed border-line p-4 text-sm text-ink-soft">ยังไม่ได้บันทึกการจัดส่ง — เมื่อส่งของให้บริษัทขนส่งแล้ว ให้บันทึกเลขพัสดุและถ่ายรูปใบส่งพัสดุแนบไว้ สถานะจะเปลี่ยนเป็น “กำลังจัดส่ง” อัตโนมัติ</p> : (
        <ul className="space-y-4">
          {list.map((s) => (
            <li key={s.id} className="rounded-xl border border-line p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{carrierLabel(s, 'th')} {s.tracking_no && <>· <span className="tracking-wide">{s.tracking_no}</span></>}</p>
                  {s.branch && <p>สาขาปลายทาง: {s.branch}{s.branch_phone ? ` (${s.branch_phone})` : ''}</p>}
                  <p className="text-xs text-ink-faint">{dt(s.shipped_at)}</p>
                  {s.note && <p className="text-ink-soft">{s.note}</p>}
                </div>
                {!closed && <button className="btn-ghost btn-sm" onClick={() => { setMsg({}); setEdit({ ...BLANK, ...s, carrier_name: s.carrier_name || '', tracking_no: s.tracking_no || '', branch: s.branch || '', branch_phone: s.branch_phone || '', note: s.note || '' }); }}>แก้ไข</button>}
              </div>
              {s.files?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {s.files.map((f) => <a key={f} href={f} target="_blank" rel="noopener noreferrer">{f.endsWith('.pdf') ? <span className="btn-ghost btn-sm">PDF</span> : <img src={f} alt="ใบส่งพัสดุ" className="h-24 w-24 rounded object-cover" />}</a>)}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
        {order.ship_phone && (
          <a className="btn-gold btn-sm" target="_blank" rel="noopener noreferrer"
            href={`https://wa.me/${waNumber(order.ship_phone)}?text=${encodeURIComponent(waText(last))}`}>ส่งใบเสร็จ + ใบส่งพัสดุทาง WhatsApp</a>
        )}
        <button className="btn-ghost btn-sm" onClick={() => { navigator.clipboard?.writeText(waText(last)); setMsg({ ok: 'คัดลอกข้อความและลิงก์ใบเสร็จแล้ว — วางส่งใน Messenger/WhatsApp ได้เลย' }); }}>คัดลอกข้อความ + ลิงก์</button>
        <a className="btn-ghost btn-sm" href={receiptUrl} target="_blank" rel="noopener noreferrer">เปิดใบเสร็จ</a>
      </div>

      {edit && (
        <Modal title={edit.id ? 'แก้ไขข้อมูลการจัดส่ง' : 'บันทึกการจัดส่ง'} onClose={() => setEdit(null)}>
          <form onSubmit={save} className="space-y-3">
            <label className="block"><span className="label">บริษัทขนส่ง</span>
              <select className="input" value={edit.carrier} onChange={(e) => setEdit({ ...edit, carrier: e.target.value })}>
                {Object.entries(CARRIERS).map(([k, v]) => <option key={k} value={k}>{v.th} — {v.lo}</option>)}
              </select></label>
            {edit.carrier === 'other' && <label className="block"><span className="label">ชื่อบริษัทขนส่ง</span><input className="input" value={edit.carrier_name} onChange={(e) => setEdit({ ...edit, carrier_name: e.target.value })} /></label>}
            <label className="block"><span className="label">เลขพัสดุ / เลขบิล</span><input className="input" value={edit.tracking_no} onChange={(e) => setEdit({ ...edit, tracking_no: e.target.value })} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="label">สาขาปลายทาง (ที่ลูกค้าไปรับ)</span><input className="input" value={edit.branch} onChange={(e) => setEdit({ ...edit, branch: e.target.value })} placeholder="เช่น สาขาปากเซ" /></label>
              <label className="block"><span className="label">เบอร์สาขา</span><input className="input" value={edit.branch_phone} onChange={(e) => setEdit({ ...edit, branch_phone: e.target.value })} /></label>
            </div>
            <div>
              <span className="label">รูปใบส่งพัสดุ / หลักฐานการส่ง (ถ่ายด้วยมือถือได้)</span>
              <div className="flex flex-wrap gap-2">
                {(edit.files || []).map((f) => (
                  <div key={f} className="relative">
                    {f.endsWith('.pdf') ? <span className="btn-ghost btn-sm">PDF</span> : <img src={f} alt="" className="h-20 w-20 rounded object-cover" />}
                    <button type="button" className="absolute right-0 top-0 rounded-bl bg-ink/70 px-1 text-xs text-white" onClick={() => setEdit({ ...edit, files: edit.files.filter((x) => x !== f) })}>✕</button>
                  </div>
                ))}
                <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded border-2 border-dashed border-line text-xs text-ink-soft">
                  {busy ? '…' : '+ รูป'}
                  <input type="file" accept="image/*,application/pdf" capture="environment" multiple className="sr-only" onChange={upload} />
                </label>
              </div>
            </div>
            <label className="block"><span className="label">หมายเหตุถึงลูกค้า</span><input className="input" value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} placeholder="เช่น ของถึงสาขาประมาณ 2 วัน" /></label>
            <Alert error={msg.error} />
            <button disabled={busy} className="btn-primary w-full">บันทึก</button>
          </form>
        </Modal>
      )}
    </section>
  );
}
