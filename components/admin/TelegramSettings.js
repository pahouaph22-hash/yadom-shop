'use client';
import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { Alert } from './ui';
import { errMsg, dt } from '@/lib/format';

const DEFAULT_SITE = 'https://pahouaph22-hash.github.io/yadom-shop';

export default function TelegramSettings() {
  const [cfg, setCfg] = useState(null);
  const [savedToken, setSavedToken] = useState('');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [chats, setChats] = useState('');
  const [found, setFound] = useState(null);
  const [results, setResults] = useState(null);
  const [msg, setMsg] = useState({});
  const [busy, setBusy] = useState('');

  async function load() {
    const { data, error } = await getSupabase().from('notify_config').select('*').maybeSingle();
    if (error) return setMsg({ error: errMsg(error) });
    const c = data || { enabled: false, on_order: true, on_slip: true, on_message: true, telegram_chat_ids: [], site_url: DEFAULT_SITE };
    setCfg(c);
    setSavedToken(c.telegram_token || '');
    setToken(c.telegram_token || '');
    setChats((c.telegram_chat_ids || []).join(', '));
  }
  async function loadResults() {
    const { data } = await getSupabase().rpc('telegram_recent_results');
    setResults(data || []);
  }
  useEffect(() => { load(); loadResults(); }, []);

  const chatList = () => chats.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);

  async function save(e, override = {}) {
    e?.preventDefault();
    setMsg({}); setBusy('save');
    const next = { ...cfg, ...override };
    const { error } = await getSupabase().rpc('set_notify_config', {
      p_token: token.trim() === savedToken ? null : token.trim(),
      p_chat_ids: chatList(), p_enabled: !!next.enabled,
      p_on_order: !!next.on_order, p_on_slip: !!next.on_slip, p_on_message: !!next.on_message,
      p_site_url: (next.site_url || DEFAULT_SITE).trim(),
    });
    setBusy('');
    if (error) return setMsg({ error: errMsg(error) });
    setMsg({ ok: 'บันทึกการแจ้งเตือนแล้ว' });
    load();
  }

  async function findChats() {
    setMsg({}); setFound(null);
    const t = token.trim();
    if (!/^\d+:[\w-]{30,}$/.test(t)) return setMsg({ error: 'ใส่ Bot token ให้ถูกต้องก่อน (ได้จาก @BotFather)' });
    setBusy('find');
    try {
      const r = await fetch(`https://api.telegram.org/bot${t}/getUpdates`);
      const j = await r.json();
      if (!j.ok) throw new Error(j.description || 'Telegram error');
      const map = new Map();
      for (const u of j.result || []) {
        const ch = (u.message || u.channel_post || u.my_chat_member || u.edited_message)?.chat;
        if (ch) map.set(String(ch.id), ch.title || [ch.first_name, ch.last_name].filter(Boolean).join(' ') || ch.username || ch.type);
      }
      setFound([...map.entries()]);
      if (!map.size) setMsg({ error: 'ยังไม่พบแชท — เปิด Telegram ส่งข้อความอะไรก็ได้ถึงบอท (หรือเพิ่มบอทเข้ากลุ่มแล้วพิมพ์ในกลุ่ม) แล้วกดค้นหาอีกครั้ง' });
    } catch (err) {
      setMsg({ error: `ค้นหาไม่สำเร็จ: ${err.message}. ลองเปิดลิงก์ https://api.telegram.org/bot<token>/getUpdates เองแล้วดูค่า "chat":{"id":...}` });
    }
    setBusy('');
  }

  function addChat(id) {
    const list = chatList();
    if (!list.includes(id)) setChats([...list, id].join(', '));
  }

  async function test() {
    setMsg({}); setBusy('test');
    const { data, error } = await getSupabase().rpc('test_telegram');
    setBusy('');
    if (error) return setMsg({ error: errMsg(error) });
    setMsg({ ok: `ส่งข้อความทดสอบไป ${data} แชทแล้ว — ตรวจใน Telegram (ถ้าไม่ได้รับ ดูผลการส่งด้านล่าง)` });
    setTimeout(loadResults, 4000);
  }

  if (!cfg) return null;
  const dirty = token.trim() !== savedToken || chats !== (cfg.telegram_chat_ids || []).join(', ');
  const ready = savedToken && (cfg.telegram_chat_ids || []).length > 0;

  return (
    <section className="card mb-6 overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-sky-50 px-4 py-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#229ED9] text-lg text-white" aria-hidden>✈</span>
        <div className="flex-1">
          <h2 className="font-semibold">แจ้งเตือนผ่าน Telegram</h2>
          <p className="text-xs text-ink-soft">ส่งข้อความทันทีเมื่อมีออเดอร์ใหม่ สลิปโอนเงิน หรือข้อความติดต่อ</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" disabled={!ready || busy} checked={!!cfg.enabled}
            onChange={(e) => { const v = e.target.checked; setCfg({ ...cfg, enabled: v }); save(null, { enabled: v }); }} />
          {cfg.enabled ? <span className="text-jade">เปิดอยู่</span> : <span className="text-ink-faint">ปิดอยู่</span>}
        </label>
      </div>

      <form onSubmit={save} className="space-y-4 p-4">
        <Alert {...msg} />
        <ol className="space-y-4 text-sm">
          <li>
            <p className="mb-1 font-semibold">1. สร้างบอท</p>
            <p className="mb-2 text-ink-soft">เปิด Telegram ค้นหา <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="font-semibold text-jade underline">@BotFather</a> → พิมพ์ <code>/newbot</code> → ตั้งชื่อ → คัดลอก token ที่ได้มาวางด้านล่าง</p>
            <div className="flex gap-2">
              <input className="input flex-1 font-mono text-xs" type={showToken ? 'text' : 'password'} autoComplete="off"
                placeholder="123456789:AAH..." value={token} onChange={(e) => setToken(e.target.value)} />
              <button type="button" className="btn-ghost btn-sm" onClick={() => setShowToken(!showToken)}>{showToken ? 'ซ่อน' : 'แสดง'}</button>
            </div>
          </li>
          <li>
            <p className="mb-1 font-semibold">2. เลือกแชทที่จะรับแจ้งเตือน</p>
            <p className="mb-2 text-ink-soft">ส่งข้อความอะไรก็ได้ถึงบอทของคุณ (หรือเพิ่มบอทเข้ากลุ่มพนักงานแล้วพิมพ์ในกลุ่ม) แล้วกด “ค้นหาแชท”</p>
            <div className="flex flex-wrap gap-2">
              <input className="input flex-1 font-mono text-xs" placeholder="Chat ID เช่น 123456789, -1001234567890" value={chats} onChange={(e) => setChats(e.target.value)} />
              <button type="button" className="btn-ghost btn-sm" disabled={busy === 'find'} onClick={findChats}>{busy === 'find' ? 'กำลังค้นหา…' : '🔍 ค้นหาแชท'}</button>
            </div>
            {found?.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2">
                {found.map(([id, name]) => (
                  <li key={id}>
                    <button type="button" className="chip tone-sky" onClick={() => addChat(id)}>
                      {chatList().includes(id) ? '✓' : '+'} {name} <span className="font-mono text-[10px] opacity-70">{id}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
          <li>
            <p className="mb-2 font-semibold">3. เลือกเรื่องที่จะแจ้ง</p>
            <div className="flex flex-wrap gap-4">
              {[['on_order', '🛒 ออเดอร์ใหม่'], ['on_slip', '🧾 สลิปโอนเงิน'], ['on_message', '✉️ ข้อความติดต่อ']].map(([k, l]) => (
                <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={!!cfg[k]} onChange={(e) => setCfg({ ...cfg, [k]: e.target.checked })} /> {l}</label>
              ))}
            </div>
          </li>
        </ol>

        <details className="text-sm">
          <summary className="cursor-pointer text-ink-soft">ตั้งค่าเพิ่มเติม</summary>
          <label className="mt-2 block"><span className="label">ลิงก์เว็บ (ใช้สร้างลิงก์ในข้อความแจ้งเตือน)</span>
            <input className="input" value={cfg.site_url || ''} onChange={(e) => setCfg({ ...cfg, site_url: e.target.value })} /></label>
        </details>

        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" disabled={busy === 'save'}>{busy === 'save' ? 'กำลังบันทึก…' : 'บันทึก'}</button>
          <button type="button" className="btn-ghost" disabled={!ready || dirty || busy === 'test'} onClick={test}
            title={dirty ? 'บันทึกก่อนทดสอบ' : ''}>📨 ส่งข้อความทดสอบ</button>
          {!cfg.enabled && ready && <span className="self-center text-xs text-saffron-deep">บันทึกแล้ว แต่ยังไม่ได้เปิดใช้งาน — ติ๊ก “เปิด” มุมขวาบน</span>}
        </div>

        {results?.length > 0 && (
          <div className="text-xs">
            <p className="mb-1 font-semibold text-ink-soft">ผลการส่งล่าสุด <button type="button" className="ml-1 text-jade underline" onClick={loadResults}>รีเฟรช</button></p>
            <ul className="space-y-1">
              {results.slice(0, 5).map((r, i) => (
                <li key={i} className="flex gap-2">
                  <span className={r.ok ? 'text-jade' : 'text-red-600'}>{r.ok ? '✓ สำเร็จ' : '✗ ล้มเหลว'}</span>
                  <span className="text-ink-faint">{dt(r.at)}</span>
                  {!r.ok && <span className="text-red-600">{r.error || `HTTP ${r.status_code}`}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </section>
  );
}
