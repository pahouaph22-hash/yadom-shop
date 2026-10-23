'use client';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { useShop } from '@/components/Providers';
import { PageHead, StatusBadge, Alert, Modal, useLoad, STATUS_TH, PM_TH, CHANNEL_TH, CTYPE_TH } from '@/components/admin/ui';
import { kip, dt, errMsg } from '@/lib/format';
import SlipReview from '@/components/admin/SlipReview';
import ShipmentPanel from '@/components/admin/ShipmentPanel';

const NEXT = {
  received: ['pending_payment', 'shipping', 'delivered', 'cancelled'],
  pending_payment: ['received', 'shipping', 'delivered', 'cancelled'],
  paid: ['shipping', 'delivered'],
  shipping: ['delivered', 'cancelled'],
  delivered: ['shipping'],
  cancelled: [], refunded: [],
};
const EVENT_TH = { created: 'สร้างคำสั่งซื้อ', status: 'เปลี่ยนสถานะ', edit: 'แก้ไขคำสั่งซื้อ', payment: 'รับชำระเงิน', refund: 'คืนเงิน', note: 'บันทึก' };

function OrderDetail({ params }) {
  const id = params.id;
  const { isAdmin, can } = useShop();
  const showCost = can('finance');
  const [data, reload, loadErr] = useLoad(async (sb) => {
    const [o, items, pays, ev] = await Promise.all([
      sb.from('orders').select('*, customers(*)').eq('id', id).single(),
      sb.from('order_items').select('*').eq('order_id', id).gt('qty', 0).order('product_name'),
      sb.from('payments').select('*').eq('order_id', id).order('paid_at'),
      sb.from('order_events').select('*').eq('order_id', id).order('created_at'),
    ]);
    const error = o.error || items.error || pays.error || ev.error;
    return { data: error ? null : { o: o.data, items: items.data, pays: pays.data, ev: ev.data }, error };
  }, [id]);
  const [modal, setModal] = useState(null);
  const [msg, setMsg] = useState({});

  if (loadErr) return <Alert error={loadErr} />;
  if (!data) return <p className="text-ink-soft">กำลังโหลด…</p>;
  const { o, items, pays, ev } = data;
  const net = Number(o.paid_amount) - Number(o.refunded_amount);
  const outstanding = Number(o.total) - net;
  const editableItems = ['received', 'pending_payment'].includes(o.status);
  const closed = ['cancelled', 'refunded'].includes(o.status);

  async function run(fn, okText) {
    setMsg({});
    const { error } = await fn(getSupabase());
    if (error) { setMsg({ error: errMsg(error) }); return false; }
    setMsg({ ok: okText }); setModal(null); reload(); return true;
  }
  async function changeStatus(s) {
    const note = s === 'cancelled' ? window.prompt('เหตุผลที่ยกเลิก (สต็อกจะถูกคืนอัตโนมัติ)') : '';
    if (s === 'cancelled' && note === null) return;
    run((sb) => sb.rpc('update_order_status', { p_order_id: id, p_status: s, p_note: note || null }), `เปลี่ยนสถานะเป็น "${STATUS_TH[s]}" แล้ว`);
  }

  return (
    <>
      <PageHead title={`คำสั่งซื้อ ${o.order_no}`} sub={`${dt(o.created_at)} · ${CHANNEL_TH[o.channel]}${o.is_wholesale ? ' · ขายส่ง' : ''}`}>
        <Link href="/admin/orders" className="btn-ghost">← รายการ</Link>
        <button onClick={() => window.print()} className="btn-ghost">พิมพ์ใบเสร็จ</button>
      </PageHead>
      <Alert {...msg} />

      <div className="card mb-6 flex flex-wrap items-center gap-3 p-4 no-print">
        <span className="text-sm text-ink-soft">สถานะปัจจุบัน</span><StatusBadge s={o.status} />
        <span className="mx-2 hidden h-6 w-px bg-line sm:block" />
        {NEXT[o.status].map((s) => (
          <button key={s} onClick={() => changeStatus(s)} className={s === 'cancelled' ? 'btn-danger btn-sm' : 'btn-ghost btn-sm'}>→ {STATUS_TH[s]}</button>
        ))}
        {!closed && outstanding > 0 && <button onClick={() => { setMsg({}); setModal('pay'); }} className="btn-gold btn-sm">บันทึกการชำระเงิน</button>}
        {isAdmin && net > 0 && <button onClick={() => { setMsg({}); setModal('refund'); }} className="btn-danger btn-sm">คืนเงิน</button>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <section className="card overflow-x-auto">
            <div className="flex items-center justify-between p-4 pb-2">
              <h2 className="font-semibold">รายการสินค้า</h2>
              {editableItems && <button onClick={() => { setMsg({}); setModal('items'); }} className="btn-ghost btn-sm no-print">แก้ไขรายการ</button>}
            </div>
            <table className="tbl">
              <thead><tr><th>สินค้า</th><th className="text-right">จำนวน</th><th className="text-right">ราคา/หน่วย</th><th className="text-right">รวม</th>{showCost && <th className="text-right no-print">ต้นทุน/หน่วย</th>}</tr></thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}>
                    <td>{i.product_name} <span className="text-xs text-ink-faint">{i.sku}</span>{i.is_wholesale_price && <span className="ml-1 rounded bg-saffron-pale px-1 text-xs text-saffron-deep">ราคาส่ง</span>}</td>
                    <td className="text-right">{i.qty}</td><td className="text-right">{kip(i.unit_price)}</td>
                    <td className="text-right">{kip(i.line_total)}</td>{showCost && <td className="text-right text-ink-faint no-print">{kip(i.unit_cost)}</td>}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={3} className="text-right">ค่าสินค้า</td><td className="text-right">{kip(o.subtotal)}</td><td className="no-print" /></tr>
                <tr><td colSpan={3} className="text-right">ส่วนลด</td><td className="text-right">−{kip(o.discount)}</td><td className="no-print" /></tr>
                <tr><td colSpan={3} className="text-right">ค่าจัดส่ง</td><td className="text-right">{kip(o.shipping_fee)}</td><td className="no-print" /></tr>
                <tr className="text-base font-bold"><td colSpan={3} className="text-right">ยอดรวม</td><td className="text-right">{kip(o.total)}</td><td className="no-print" /></tr>
                <tr><td colSpan={3} className="text-right">ชำระแล้ว (สุทธิ)</td><td className="text-right text-jade">{kip(net)}</td><td className="no-print" /></tr>
                {outstanding > 0 && !closed && <tr className="font-semibold text-red-700"><td colSpan={3} className="text-right">ค้างชำระ</td><td className="text-right">{kip(outstanding)}</td><td className="no-print" /></tr>}
              </tfoot>
            </table>
            {!closed && <div className="p-4 pt-2 no-print"><button onClick={() => { setMsg({}); setModal('fees'); }} className="btn-ghost btn-sm">แก้ไขส่วนลด / ค่าจัดส่ง / ที่อยู่ / หมายเหตุ</button></div>}
            {closed && <div className="p-4 pt-2 no-print"><button onClick={() => { setMsg({}); setModal('note'); }} className="btn-ghost btn-sm">แก้ไขหมายเหตุภายใน</button></div>}
          </section>

          <SlipReview orderId={id} outstanding={closed ? 0 : outstanding} onChanged={reload} />

          <ShipmentPanel order={o} onChanged={reload} />

          <section className="card p-4">
            <h2 className="mb-3 font-semibold">การชำระเงินและการคืนเงิน</h2>
            {pays.length === 0 ? <p className="text-sm text-ink-soft">ยังไม่มีการชำระเงิน</p> : (
              <table className="tbl">
                <thead><tr><th>วันที่</th><th>ประเภท</th><th>วิธี</th><th>เลขอ้างอิง</th><th className="text-right">จำนวน</th></tr></thead>
                <tbody>
                  {pays.map((p) => (
                    <tr key={p.id}>
                      <td className="text-xs">{dt(p.paid_at)}</td>
                      <td>{p.kind === 'refund' ? <span className="text-red-700">คืนเงิน</span> : 'รับชำระ'}{p.note && <div className="text-xs text-ink-faint">{p.note}</div>}</td>
                      <td>{PM_TH[p.method]}</td><td className="text-xs">{p.reference || '—'}</td>
                      <td className={`text-right font-semibold ${p.kind === 'refund' ? 'text-red-700' : ''}`}>{p.kind === 'refund' ? '−' : ''}{kip(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-4 text-sm">
            <h2 className="mb-3 font-semibold">ลูกค้าและการจัดส่ง</h2>
            <p><Link href={`/admin/customers/edit?id=${o.customer_id}`} className="font-semibold text-jade hover:underline">{o.customers?.name}</Link> <span className="text-xs text-ink-faint">({CTYPE_TH[o.customers?.type]})</span></p>
            <dl className="mt-3 space-y-2">
              <div><dt className="text-xs text-ink-faint">ผู้รับ</dt><dd>{o.ship_name} · <a className="text-jade" href={`tel:${o.ship_phone}`}>{o.ship_phone}</a></dd></div>
              <div><dt className="text-xs text-ink-faint">ที่อยู่จัดส่ง</dt><dd className="whitespace-pre-line">{o.ship_address || '—'}</dd></div>
              <div><dt className="text-xs text-ink-faint">วิธีชำระที่ลูกค้าเลือก</dt><dd>{PM_TH[o.payment_method_pref] || o.payment_method_pref || '—'}</dd></div>
              {o.customer_note && <div><dt className="text-xs text-ink-faint">หมายเหตุจากลูกค้า</dt><dd className="rounded bg-saffron-pale p-2">{o.customer_note}</dd></div>}
              {o.internal_note && <div className="no-print"><dt className="text-xs text-ink-faint">หมายเหตุภายใน</dt><dd className="rounded bg-jade-wash p-2">{o.internal_note}</dd></div>}
            </dl>
          </section>
          <section className="card p-4 no-print">
            <h2 className="mb-3 font-semibold">ประวัติคำสั่งซื้อ</h2>
            <ol className="space-y-3 border-l-2 border-line pl-4 text-sm">
              {ev.map((e) => (
                <li key={e.id}>
                  <p className="font-semibold">{EVENT_TH[e.event]}{e.to_status && <> → {STATUS_TH[e.to_status]}</>}
                    {e.data?.amount && <> · {kip(e.data.amount)}</>}</p>
                  {e.event === 'edit' && e.data && (
                    <p className="text-xs text-ink-soft">ยอดรวม {kip(e.data.before?.total)} → {kip(e.data.after?.total)}</p>
                  )}
                  {e.note && <p className="text-xs text-ink-soft">“{e.note}”</p>}
                  <p className="text-xs text-ink-faint">{dt(e.created_at)} · {e.actor_email || 'ลูกค้า (หน้าเว็บ)'}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

      {modal === 'pay' && <PayModal o={o} outstanding={outstanding} onClose={() => setModal(null)} run={run} err={msg.error} />}
      {modal === 'refund' && <RefundModal o={o} net={net} onClose={() => setModal(null)} run={run} err={msg.error} />}
      {modal === 'fees' && <FeesModal o={o} onClose={() => setModal(null)} run={run} err={msg.error} />}
      {modal === 'note' && <FeesModal o={o} noteOnly onClose={() => setModal(null)} run={run} err={msg.error} />}
      {modal === 'items' && <ItemsModal o={o} items={items} onClose={() => setModal(null)} run={run} err={msg.error} />}
    </>
  );
}

function PayModal({ o, outstanding, onClose, run, err }) {
  const [f, setF] = useState({ amount: outstanding, method: o.payment_method_pref && PM_TH[o.payment_method_pref] ? o.payment_method_pref : 'bank_transfer', reference: '', note: '', paid_at: '' });
  return (
    <Modal title="บันทึกการชำระเงิน" onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run((sb) => sb.rpc('record_payment', { p_order_id: o.id, p_amount: Number(f.amount), p_method: f.method, p_reference: f.reference || null, p_note: f.note || null, p_paid_at: f.paid_at ? new Date(f.paid_at).toISOString() : null }), 'บันทึกการชำระเงินแล้ว'); }}>
        <label className="block"><span className="label">จำนวนเงิน (กีบ) — ค้างชำระ {kip(outstanding)}</span><input required type="number" min={1} max={outstanding} className="input" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
        <label className="block"><span className="label">วิธีชำระ</span><select className="input" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{Object.entries(PM_TH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="block"><span className="label">เลขอ้างอิงการโอน (กันบันทึกซ้ำ)</span><input className="input" maxLength={120} value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></label>
        <label className="block"><span className="label">วันเวลาที่ได้รับเงิน (เว้นว่าง = ตอนนี้)</span><input type="datetime-local" className="input" value={f.paid_at} onChange={(e) => setF({ ...f, paid_at: e.target.value })} /></label>
        <label className="block"><span className="label">หมายเหตุ</span><input className="input" maxLength={500} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
        <Alert error={err} />
        <button className="btn-gold w-full">บันทึกการชำระเงิน</button>
      </form>
    </Modal>
  );
}

function RefundModal({ o, net, onClose, run, err }) {
  const [f, setF] = useState({ amount: net, method: 'bank_transfer', reason: '', restock: true, reference: '' });
  const full = Number(f.amount) >= net;
  return (
    <Modal title="คืนเงิน" onClose={onClose}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!window.confirm(`ยืนยันคืนเงิน ${kip(f.amount)} ?`)) return; run((sb) => sb.rpc('record_refund', { p_order_id: o.id, p_amount: Number(f.amount), p_method: f.method, p_reason: f.reason, p_restock: full && f.restock, p_reference: f.reference || null }), 'บันทึกการคืนเงินแล้ว'); }}>
        <label className="block"><span className="label">จำนวนเงินที่คืน (สูงสุด {kip(net)})</span><input required type="number" min={1} max={net} className="input" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
        <label className="block"><span className="label">วิธีคืนเงิน</span><select className="input" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{Object.entries(PM_TH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="block"><span className="label">เหตุผล *</span><input required className="input" maxLength={500} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></label>
        <label className="block"><span className="label">เลขอ้างอิง</span><input className="input" maxLength={120} value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></label>
        {full && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.restock} onChange={(e) => setF({ ...f, restock: e.target.checked })} /> ได้รับสินค้าคืน — นำกลับเข้าสต็อก</label>}
        <p className="text-xs text-ink-soft">{full ? 'คืนเงินเต็มจำนวน: สถานะจะเปลี่ยนเป็น "คืนเงินแล้ว"' : 'คืนเงินบางส่วน: สถานะคำสั่งซื้อไม่เปลี่ยน'}</p>
        <Alert error={err} />
        <button className="btn-danger w-full">ยืนยันคืนเงิน</button>
      </form>
    </Modal>
  );
}

function FeesModal({ o, onClose, run, noteOnly, err }) {
  const [f, setF] = useState({ discount: o.discount, shipping_fee: o.shipping_fee, ship_name: o.ship_name || '', ship_phone: o.ship_phone || '', ship_address: o.ship_address || '', internal_note: o.internal_note || '' });
  const [reason, setReason] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  function submit(e) {
    e.preventDefault();
    const changes = noteOnly ? { internal_note: f.internal_note } : { ...f, discount: Number(f.discount), shipping_fee: Number(f.shipping_fee) };
    run((sb) => sb.rpc('update_order', { p_order_id: o.id, p_changes: changes, p_reason: reason || null }), 'บันทึกการแก้ไขแล้ว');
  }
  return (
    <Modal title={noteOnly ? 'หมายเหตุภายใน' : 'แก้ไขรายละเอียดคำสั่งซื้อ'} onClose={onClose}>
      <form className="space-y-3" onSubmit={submit}>
        {!noteOnly && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="label">ส่วนลด (กีบ)</span><input type="number" min={0} className="input" value={f.discount} onChange={set('discount')} /></label>
              <label className="block"><span className="label">ค่าจัดส่ง (กีบ)</span><input type="number" min={0} className="input" value={f.shipping_fee} onChange={set('shipping_fee')} /></label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="label">ชื่อผู้รับ</span><input className="input" value={f.ship_name} onChange={set('ship_name')} /></label>
              <label className="block"><span className="label">เบอร์โทร</span><input className="input" value={f.ship_phone} onChange={set('ship_phone')} /></label>
            </div>
            <label className="block"><span className="label">ที่อยู่จัดส่ง</span><textarea rows={2} className="input" value={f.ship_address} onChange={set('ship_address')} /></label>
          </>
        )}
        <label className="block"><span className="label">หมายเหตุภายใน (ลูกค้าไม่เห็น)</span><textarea rows={2} className="input" value={f.internal_note} onChange={set('internal_note')} /></label>
        <label className="block"><span className="label">เหตุผลในการแก้ไข (บันทึกในประวัติ)</span><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
        <Alert error={err} />
        <button className="btn-primary w-full">บันทึก</button>
      </form>
    </Modal>
  );
}

function ItemsModal({ o, items, onClose, run, err }) {
  const [products] = useLoad((sb) => sb.from('products').select('id,name_lo,sku,price_retail,price_wholesale,wholesale_min_qty,stock').is('deleted_at', null).order('sort'), []);
  const [lines, setLines] = useState(items.map((i) => ({ product_id: i.product_id, qty: i.qty, unit_price: String(i.unit_price), name: i.product_name, custom: false })));
  const [reason, setReason] = useState('');
  const [add, setAdd] = useState('');
  function submit(e) {
    e.preventDefault();
    const payload = lines.map((l) => ({ product_id: l.product_id, qty: Number(l.qty), ...(l.custom ? { unit_price: Number(l.unit_price) } : {}) }));
    run((sb) => sb.rpc('update_order', { p_order_id: o.id, p_changes: { items: payload }, p_reason: reason || null }), 'แก้ไขรายการสินค้าแล้ว — สต็อกปรับตามจริง');
  }
  return (
    <Modal title="แก้ไขรายการสินค้า" onClose={onClose}>
      <form className="space-y-3" onSubmit={submit}>
        {lines.map((l, k) => (
          <div key={l.product_id} className="grid grid-cols-[1fr_70px_110px_auto] items-end gap-2">
            <span className="text-sm">{l.name}</span>
            <input aria-label="จำนวน" type="number" min={0} className="input" value={l.qty} onChange={(e) => setLines(lines.map((x, i) => (i === k ? { ...x, qty: e.target.value } : x)))} />
            <input aria-label="ราคาต่อหน่วย" type="number" min={0} className="input" value={l.unit_price} disabled={!l.custom}
              onChange={(e) => setLines(lines.map((x, i) => (i === k ? { ...x, unit_price: e.target.value } : x)))} />
            <label className="text-xs"><input type="checkbox" checked={l.custom} onChange={(e) => setLines(lines.map((x, i) => (i === k ? { ...x, custom: e.target.checked } : x)))} /> กำหนดราคาเอง</label>
          </div>
        ))}
        <p className="text-xs text-ink-faint">ใส่จำนวน 0 เพื่อนำสินค้าออก · ถ้าไม่ได้กำหนดราคาเอง ระบบจะใช้ราคาปลีก/ส่งตามจำนวน</p>
        <div className="flex gap-2">
          <select className="input" value={add} onChange={(e) => setAdd(e.target.value)} aria-label="เพิ่มสินค้า">
            <option value="">+ เพิ่มสินค้า…</option>
            {(products || []).filter((p) => !lines.some((l) => l.product_id === p.id)).map((p) => <option key={p.id} value={p.id}>{p.name_lo} ({p.sku}) · คงเหลือ {p.stock}</option>)}
          </select>
          <button type="button" className="btn-ghost" disabled={!add} onClick={() => { const p = products.find((x) => x.id === add); setLines([...lines, { product_id: p.id, qty: 1, unit_price: String(p.price_retail), name: p.name_lo, custom: false }]); setAdd(''); }}>เพิ่ม</button>
        </div>
        <label className="block"><span className="label">เหตุผลในการแก้ไข</span><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
        <Alert error={err} />
        <button className="btn-primary w-full">บันทึกรายการใหม่</button>
      </form>
    </Modal>
  );
}


function WithQuery() {
  const sp = useSearchParams();
  const id = sp.get('id') || '';
  return <OrderDetail key={id} params={{ id }} />;
}

export default function Page() {
  return <Suspense fallback={<p className="text-ink-soft">กำลังโหลด…</p>}><WithQuery /></Suspense>;
}
