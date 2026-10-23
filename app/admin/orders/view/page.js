'use client';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { useShop } from '@/components/Providers';
import { StatusBadge, Alert, Modal, useLoad, Stat, SecTitle, STATUS_TH, PM_TH, CHANNEL_TH, CTYPE_TH } from '@/components/admin/ui';
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
const FLOW = ['received', 'pending_payment', 'paid', 'shipping', 'delivered'];
const EVENT_DOT = { created: 'bg-violet-500', status: 'bg-jade', edit: 'bg-saffron', payment: 'bg-sky-500', refund: 'bg-rose-500', note: 'bg-slate-400' };
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
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/orders" className="text-sm text-ink-soft hover:text-jade no-print">← คำสั่งซื้อทั้งหมด</Link>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-bold tracking-wide md:text-3xl">{o.order_no}</h1>
            <StatusBadge s={o.status} />
            {o.is_wholesale && <span className="chip tone-gold">ขายส่ง</span>}
          </div>
          <p className="mt-1 text-sm text-ink-soft">{dt(o.created_at)} · ช่องทาง {CHANNEL_TH[o.channel]}</p>
        </div>
        <button onClick={() => window.print()} className="btn-ghost no-print">🖨 พิมพ์</button>
      </div>
      <Alert {...msg} />

      {/* Status pipeline + actions */}
      <section className="card mb-5 p-4 no-print">
        <ol className="mb-4 grid grid-cols-5 gap-1 text-center text-[11px] sm:text-xs">
          {FLOW.map((s, i) => {
            const idx = FLOW.indexOf(o.status);
            const done = !closed && i <= idx;
            const now = !closed && i === idx;
            return (
              <li key={s} className="flex flex-col items-center gap-1.5">
                <span className={`h-2 w-full rounded-full ${done ? 'bg-jade' : 'bg-line'}`} />
                <span className={`${now ? 'font-bold text-jade' : done ? 'text-ink' : 'text-ink-faint'}`}>{STATUS_TH[s]}</span>
              </li>
            );
          })}
        </ol>
        {closed && <p className="mb-3 rounded-lg bg-slate-50 p-2 text-center text-sm text-slate-600">คำสั่งซื้อนี้ {STATUS_TH[o.status]} แล้ว</p>}
        <div className="flex flex-wrap items-center gap-2">
          {NEXT[o.status].length > 0 && <span className="mr-1 text-xs font-medium text-ink-soft">เปลี่ยนสถานะ:</span>}
          {NEXT[o.status].map((s) => (
            <button key={s} onClick={() => changeStatus(s)} className={s === 'cancelled' ? 'btn-danger btn-sm' : 'btn-ghost btn-sm'}>{s === 'cancelled' ? '✕' : '→'} {STATUS_TH[s]}</button>
          ))}
          <span className="flex-1" />
          {!closed && outstanding > 0 && <button onClick={() => { setMsg({}); setModal('pay'); }} className="btn-gold btn-sm">💰 บันทึกการชำระเงิน</button>}
          {isAdmin && net > 0 && <button onClick={() => { setMsg({}); setModal('refund'); }} className="btn-danger btn-sm">↩ คืนเงิน</button>}
        </div>
      </section>

      {/* Money summary */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon="🧾" label="ยอดรวมคำสั่งซื้อ" value={kip(o.total)} tone="jade" />
        <Stat icon="✓" label="ชำระแล้ว (สุทธิ)" value={kip(net)} tone="sky" />
        <Stat icon="⏳" label="ค้างชำระ" value={kip(closed ? 0 : Math.max(outstanding, 0))} tone={!closed && outstanding > 0 ? 'red' : 'ink'} />
        <Stat icon="📦" label="จำนวนสินค้า" value={`${items.reduce((n, i) => n + i.qty, 0)} ชิ้น`} tone="gold" hint={`${items.length} รายการ`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.65fr_1fr]">
        <div className="min-w-0 space-y-6">
          <section className="card p-4 md:p-5">
            <SecTitle icon="🛍" tone="jade" actions={editableItems && <button onClick={() => { setMsg({}); setModal('items'); }} className="btn-ghost btn-sm no-print">✎ แก้ไขรายการ</button>}>รายการสินค้า</SecTitle>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead><tr><th>สินค้า</th><th className="text-right">จำนวน</th><th className="text-right">ราคา/หน่วย</th><th className="text-right">รวม</th>{showCost && <th className="text-right no-print">ต้นทุน/หน่วย</th>}</tr></thead>
                <tbody>
                  {items.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <p className="font-medium">{i.product_name}</p>
                        <p className="text-xs text-ink-faint">{i.sku}{i.is_wholesale_price && <span className="chip tone-gold ml-2 px-1.5 py-0">ราคาส่ง</span>}</p>
                      </td>
                      <td className="text-right font-semibold">{i.qty}</td>
                      <td className="text-right">{kip(i.unit_price)}</td>
                      <td className="text-right font-semibold">{kip(i.line_total)}</td>
                      {showCost && <td className="text-right text-ink-faint no-print">{kip(i.unit_cost)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-col-reverse gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="no-print">
                {!closed && <button onClick={() => { setMsg({}); setModal('fees'); }} className="btn-ghost btn-sm">✎ ส่วนลด / ค่าส่ง / ที่อยู่ / หมายเหตุ</button>}
                {closed && <button onClick={() => { setMsg({}); setModal('note'); }} className="btn-ghost btn-sm">✎ หมายเหตุภายใน</button>}
              </div>
              <dl className="num w-full space-y-1.5 rounded-xl bg-jade-wash/70 p-4 text-sm sm:w-72">
                <div className="flex justify-between"><dt className="text-ink-soft">ค่าสินค้า</dt><dd>{kip(o.subtotal)}</dd></div>
                {Number(o.discount) > 0 && <div className="flex justify-between text-rose-700"><dt>ส่วนลด</dt><dd>−{kip(o.discount)}</dd></div>}
                <div className="flex justify-between"><dt className="text-ink-soft">ค่าจัดส่ง</dt><dd>{Number(o.shipping_fee) > 0 ? kip(o.shipping_fee) : 'ฟรี'}</dd></div>
                <div className="flex justify-between border-t border-line pt-2 text-base font-bold"><dt>ยอดรวม</dt><dd className="text-jade">{kip(o.total)}</dd></div>
                <div className="flex justify-between text-sky-700"><dt>ชำระแล้ว</dt><dd>{kip(net)}</dd></div>
                {outstanding > 0 && !closed && <div className="flex justify-between font-semibold text-rose-700"><dt>ค้างชำระ</dt><dd>{kip(outstanding)}</dd></div>}
              </dl>
            </div>
          </section>

          <SlipReview orderId={id} outstanding={closed ? 0 : outstanding} onChanged={reload} />

          <ShipmentPanel order={o} onChanged={reload} />

          <section className="card p-4 md:p-5">
            <SecTitle icon="💳" tone="sky">การชำระเงินและการคืนเงิน</SecTitle>
            {pays.length === 0 ? <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-soft">ยังไม่มีการชำระเงิน</p> : (
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead><tr><th>วันที่</th><th>ประเภท</th><th>วิธี</th><th>เลขอ้างอิง</th><th className="text-right">จำนวน</th></tr></thead>
                  <tbody>
                    {pays.map((p) => (
                      <tr key={p.id}>
                        <td className="whitespace-nowrap text-xs text-ink-soft">{dt(p.paid_at)}</td>
                        <td>{p.kind === 'refund' ? <span className="chip tone-rose">↩ คืนเงิน</span> : <span className="chip tone-jade">✓ รับชำระ</span>}
                          {p.note && <div className="mt-1 text-xs text-ink-faint">{p.note}</div>}</td>
                        <td>{PM_TH[p.method]}</td><td className="text-xs">{p.reference || '—'}</td>
                        <td className={`text-right font-bold ${p.kind === 'refund' ? 'text-rose-700' : 'text-jade'}`}>{p.kind === 'refund' ? '−' : '+'}{kip(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-4 text-sm md:p-5">
            <SecTitle icon="👤" tone="violet">ลูกค้าและการจัดส่ง</SecTitle>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-saffron font-bold text-ink">{(o.customers?.name || '?').slice(0, 1).toUpperCase()}</span>
              <div>
                <Link href={`/admin/customers/edit?id=${o.customer_id}`} className="font-semibold text-jade hover:underline">{o.customers?.name}</Link>
                <p className="text-xs text-ink-faint">{CTYPE_TH[o.customers?.type]}{o.user_id ? ' · สมาชิก' : ''}</p>
              </div>
            </div>
            <dl className="mt-4 space-y-3">
              <div className="flex gap-3"><dt className="w-5 shrink-0" aria-label="ผู้รับ">👤</dt><dd>{o.ship_name}</dd></div>
              <div className="flex gap-3"><dt className="w-5 shrink-0" aria-label="เบอร์">📞</dt><dd><a className="text-jade hover:underline" href={`tel:${o.ship_phone}`}>{o.ship_phone}</a></dd></div>
              <div className="flex gap-3"><dt className="w-5 shrink-0" aria-label="ที่อยู่">📍</dt><dd className="whitespace-pre-line">{o.ship_address || '—'}</dd></div>
              <div className="flex gap-3"><dt className="w-5 shrink-0" aria-label="วิธีชำระ">💳</dt><dd>{PM_TH[o.payment_method_pref] || o.payment_method_pref || '—'}</dd></div>
            </dl>
            {o.customer_note && <div className="mt-4 rounded-xl bg-saffron-pale p-3"><p className="text-xs font-semibold text-saffron-deep">หมายเหตุจากลูกค้า</p><p>{o.customer_note}</p></div>}
            {o.internal_note && <div className="mt-3 rounded-xl bg-jade-wash p-3 no-print"><p className="text-xs font-semibold text-jade">หมายเหตุภายใน</p><p>{o.internal_note}</p></div>}
          </section>

          <section className="card p-4 no-print md:p-5">
            <SecTitle icon="🕘" tone="indigo">ประวัติคำสั่งซื้อ</SecTitle>
            <ol className="relative space-y-4 pl-6 text-sm before:absolute before:bottom-1 before:left-[7px] before:top-1 before:w-0.5 before:bg-line">
              {ev.map((e) => (
                <li key={e.id} className="relative">
                  <span className={`absolute -left-6 top-1 h-4 w-4 rounded-full border-2 border-white ${EVENT_DOT[e.event] || 'bg-slate-400'}`} aria-hidden="true" />
                  <p className="font-semibold">{EVENT_TH[e.event]}{e.to_status && <> → <span className="text-jade">{STATUS_TH[e.to_status]}</span></>}
                    {e.data?.amount && <span className="num"> · {kip(e.data.amount)}</span>}</p>
                  {e.event === 'edit' && e.data && <p className="text-xs text-ink-soft">ยอดรวม {kip(e.data.before?.total)} → {kip(e.data.after?.total)}</p>}
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
