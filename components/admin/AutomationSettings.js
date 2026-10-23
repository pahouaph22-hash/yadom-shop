'use client';
import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { useShop } from '@/components/Providers';
import { Alert } from './ui';
import { errMsg } from '@/lib/format';

export default function AutomationSettings() {
  const { refreshSettings } = useShop();
  const [f, setF] = useState(null);
  const [tgReady, setTgReady] = useState(false);
  const [msg, setMsg] = useState({});
  const [busy, setBusy] = useState('');

  useEffect(() => {
    (async () => {
      const sb = getSupabase();
      const [{ data: s }, { data: c }] = await Promise.all([
        sb.from('settings').select('value').eq('key', 'auto_cancel_days').maybeSingle(),
        sb.from('notify_config').select('enabled, on_low_stock, daily_summary, telegram_chat_ids').maybeSingle(),
      ]);
      setF({ days: Number(s?.value ?? 0), on: Number(s?.value ?? 0) > 0, low: c?.on_low_stock ?? true, summary: c?.daily_summary ?? true });
      setTgReady(!!c?.enabled && (c?.telegram_chat_ids || []).length > 0);
    })();
  }, []);

  async function save(e) {
    e.preventDefault();
    setMsg({}); setBusy('save');
    const days = f.on ? Math.max(1, Math.min(30, Number(f.days) || 3)) : 0;
    const { error } = await getSupabase().rpc('set_automation', { p_auto_cancel_days: days, p_on_low_stock: f.low, p_daily_summary: f.summary });
    setBusy('');
    if (error) return setMsg({ error: errMsg(error) });
    setF({ ...f, days: days || f.days });
    setMsg({ ok: 'บันทึกงานอัตโนมัติแล้ว' });
    refreshSettings();
  }

  async function testSummary() {
    setMsg({}); setBusy('test');
    const { error } = await getSupabase().rpc('test_daily_summary');
    setBusy('');
    setMsg(error ? { error: errMsg(error) } : { ok: 'ส่งสรุปของวันนี้เข้า Telegram แล้ว' });
  }

  if (!f) return null;
  return (
    <section className="card mb-6 overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line bg-violet-50 px-4 py-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-600 text-lg text-white" aria-hidden>⚙</span>
        <div>
          <h2 className="font-semibold">งานอัตโนมัติ</h2>
          <p className="text-xs text-ink-soft">ระบบทำงานแทนให้ — ยกเลิกออเดอร์ค้างจ่าย แจ้งสต็อกใกล้หมด และสรุปยอดทุกคืน</p>
        </div>
      </div>
      <form onSubmit={save} className="space-y-4 p-4 text-sm">
        <Alert {...msg} />
        <div className="rounded-xl border border-line p-3">
          <label className="flex items-center gap-2 font-semibold">
            <input type="checkbox" checked={f.on} onChange={(e) => setF({ ...f, on: e.target.checked, days: f.days || 3 })} />
            ⏰ ยกเลิกออเดอร์ที่ไม่ชำระอัตโนมัติ
          </label>
          {f.on && (
            <div className="mt-2 flex flex-wrap items-center gap-2 pl-6">
              หลังสั่งซื้อ
              <input type="number" min={1} max={30} className="input w-20" value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} />
              วัน แล้วยังไม่ชำระ → ยกเลิกและคืนสต็อก
            </div>
          )}
          <p className="mt-2 pl-6 text-xs text-ink-faint">ลูกค้าจะเห็นกำหนดชำระในหน้าคำสั่งซื้อ · ไม่ยกเลิกออเดอร์ที่ส่งสลิปแล้วรอตรวจ และไม่ยุ่งกับออเดอร์ที่พนักงานสร้าง (เช่น ขายเชื่อลูกค้าส่ง) · ระบบตรวจทุกชั่วโมง</p>
        </div>
        <div className="rounded-xl border border-line p-3">
          <label className="flex items-center gap-2 font-semibold">
            <input type="checkbox" checked={f.low} onChange={(e) => setF({ ...f, low: e.target.checked })} />
            📦 แจ้ง Telegram เมื่อสต็อกใกล้หมด / หมด
          </label>
          <p className="mt-1 pl-6 text-xs text-ink-faint">แจ้งครั้งเดียวตอนสต็อกลดถึง “จุดเตือน” ของสินค้านั้น (ตั้งได้ในหน้าแก้ไขสินค้า) และอีกครั้งเมื่อหมด</p>
        </div>
        <div className="rounded-xl border border-line p-3">
          <label className="flex items-center gap-2 font-semibold">
            <input type="checkbox" checked={f.summary} onChange={(e) => setF({ ...f, summary: e.target.checked })} />
            📊 ส่งสรุปยอดประจำวันเข้า Telegram ทุกคืน 21:00 น.
          </label>
          <p className="mt-1 pl-6 text-xs text-ink-faint">ยอดขาย เงินที่รับจริง สินค้าขายดี ออเดอร์รอชำระ สลิปรอตรวจ รอจัดส่ง และสต็อกใกล้หมด</p>
          <button type="button" className="btn-ghost btn-sm ml-6 mt-2" disabled={!tgReady || busy === 'test'} onClick={testSummary}>
            {busy === 'test' ? 'กำลังส่ง…' : '📨 ลองส่งสรุปของวันนี้'}
          </button>
        </div>
        {!tgReady && <p className="text-xs text-saffron-deep">การแจ้งเตือนจะทำงานเมื่อเปิด “แจ้งเตือนผ่าน Telegram” ด้านบนแล้ว</p>}
        <button className="btn-primary" disabled={busy === 'save'}>{busy === 'save' ? 'กำลังบันทึก…' : 'บันทึก'}</button>
      </form>
    </section>
  );
}
