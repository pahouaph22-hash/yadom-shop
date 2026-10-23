'use client';
import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { Alert, Modal, PM_TH, SecTitle } from './ui';
import { kip, dt, errMsg } from '@/lib/format';

const ST = { pending: ['รอตรวจสอบ', 'bg-saffron-pale text-saffron-deep'], approved: ['ยืนยันแล้ว', 'bg-jade-mist text-jade'], rejected: ['ปฏิเสธ', 'bg-red-50 text-red-700'] };

export default function SlipReview({ orderId, outstanding, onChanged }) {
  const [slips, setSlips] = useState(null);
  const [urls, setUrls] = useState({});
  const [approve, setApprove] = useState(null);
  const [msg, setMsg] = useState({});

  async function load() {
    const sb = getSupabase();
    const { data, error } = await sb.from('payment_slips').select('*').eq('order_id', orderId).order('created_at', { ascending: false });
    if (error) return setMsg({ error: errMsg(error) });
    setSlips(data);
    if (data.length) {
      const { data: signed } = await sb.storage.from('payment-slips').createSignedUrls(data.map((s) => s.file_path), 3600);
      setUrls(Object.fromEntries((signed || []).map((x) => [x.path, x.signedUrl])));
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [orderId]);

  async function review(slip, ok, amount, method, note) {
    setMsg({});
    const { error } = await getSupabase().rpc('review_slip', { p_slip_id: slip.id, p_approve: ok, p_amount: amount ?? null, p_method: method ?? 'qr', p_note: note || null });
    if (error) { setMsg({ error: errMsg(error) }); return false; }
    setApprove(null); setMsg({ ok: ok ? 'ยืนยันสลิปและบันทึกการชำระเงินแล้ว' : 'ปฏิเสธสลิปแล้ว — ลูกค้าจะเห็นเหตุผลในหน้าติดตามคำสั่งซื้อ' });
    load(); onChanged?.(); return true;
  }
  async function closePaid(slip) {
    setMsg({});
    const { error } = await getSupabase().rpc('close_paid_slip', { p_slip_id: slip.id });
    if (error) return setMsg({ error: errMsg(error) });
    setMsg({ ok: 'ปิดสลิปแล้ว (ไม่บันทึกเงินซ้ำ)' }); load(); onChanged?.();
  }
  function reject(slip) {
    const note = window.prompt('เหตุผลที่ปฏิเสธ (ลูกค้าจะเห็นข้อความนี้)', 'ยอดเงินไม่ตรง / สลิปไม่ชัด');
    if (note) review(slip, false, null, null, note);
  }

  if (slips === null) return null;
  return (
    <section className="card p-4 no-print md:p-5">
      <SecTitle icon="📎" tone="gold" actions={slips.some((s) => s.status === 'pending') && <span className="chip bg-saffron text-ink">● มีสลิปรอตรวจ</span>}>สลิปการโอนจากลูกค้า</SecTitle>
      <Alert {...msg} />
      {slips.length === 0 ? <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-soft">ลูกค้ายังไม่ได้ส่งสลิป</p> : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {slips.map((s) => {
            const url = urls[s.file_path];
            const isPdf = s.file_path.toLowerCase().endsWith('.pdf');
            return (
              <li key={s.id} className="rounded-xl border border-line p-3 text-sm">
                {url && (isPdf
                  ? <a href={url} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">เปิดไฟล์ PDF</a>
                  : <a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt="สลิป" className="max-h-64 w-full rounded-lg bg-jade-wash object-contain" /></a>)}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ST[s.status][1]}`}>{ST[s.status][0]}</span>
                  <span className="text-xs text-ink-faint">{dt(s.created_at)}</span>
                </div>
                {s.amount && <p className="mt-1">ลูกค้าแจ้งยอด: <b>{kip(s.amount)}</b></p>}
                {s.note && <p className="text-ink-soft">“{s.note}”</p>}
                {s.review_note && <p className="text-xs text-ink-faint">หมายเหตุ: {s.review_note}</p>}
                {s.status === 'pending' && (
                  <div className="mt-2 flex gap-2">
                    {outstanding > 0
                      ? <button className="btn-gold btn-sm" onClick={() => setApprove({ slip: s, amount: Math.min(Number(s.amount || outstanding), outstanding), method: 'qr', note: '' })}>ยืนยันยอดเงิน</button>
                      : <button className="btn-primary btn-sm" title="ออเดอร์นี้บันทึกการชำระครบแล้ว — ปิดสลิปโดยไม่บันทึกเงินซ้ำ" onClick={() => closePaid(s)}>✓ ปิดสลิป (ชำระครบแล้ว)</button>}
                    <button className="btn-danger btn-sm" onClick={() => reject(s)}>ปฏิเสธ</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {approve && (
        <Modal title="ยืนยันสลิปและบันทึกการชำระเงิน" onClose={() => setApprove(null)}>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); review(approve.slip, true, Number(approve.amount), approve.method, approve.note); }}>
            <p className="text-sm text-ink-soft">ตรวจยอดเงินและชื่อผู้รับในสลิปให้ตรงกับบัญชีร้านก่อนยืนยัน · ค้างชำระ {kip(outstanding)}</p>
            <label className="block"><span className="label">ยอดเงินที่ได้รับจริง (กีบ)</span>
              <input required type="number" min={1} max={outstanding} className="input" value={approve.amount} onChange={(e) => setApprove({ ...approve, amount: e.target.value })} /></label>
            <label className="block"><span className="label">วิธีชำระ</span>
              <select className="input" value={approve.method} onChange={(e) => setApprove({ ...approve, method: e.target.value })}>{Object.entries(PM_TH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label className="block"><span className="label">หมายเหตุ</span><input className="input" value={approve.note} onChange={(e) => setApprove({ ...approve, note: e.target.value })} /></label>
            <Alert error={msg.error} />
            <button className="btn-gold w-full">ยืนยัน — บันทึกการชำระเงิน</button>
          </form>
        </Modal>
      )}
    </section>
  );
}
