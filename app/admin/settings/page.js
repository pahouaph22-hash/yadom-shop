'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { useShop } from '@/components/Providers';
import { PageHead, Alert, Modal, useLoad } from '@/components/admin/ui';
import { CHANNEL_TYPES, CHANNEL_LABEL, ChannelIcon, channelHref } from '@/components/channels';
import { errMsg, dt } from '@/lib/format';
import QrManager from '@/components/admin/QrManager';
import TelegramSettings from '@/components/admin/TelegramSettings';

const LANG3 = [['lo', 'ລາວ'], ['th', 'ไทย'], ['en', 'English']];
const ML_KEYS = [
  ['store_name', 'ชื่อร้าน'], ['store_tagline', 'คำโปรยหน้าแรก'],
  ['shipping_note', 'ข้อความเรื่องค่าจัดส่ง (แสดงในตะกร้า)'], ['payment_info', 'ข้อมูลการชำระเงิน เช่น เลขบัญชี/QR (แสดงตอนสั่งซื้อ)'],
];

export default function SettingsPage() {
  const { refreshSettings, isAdmin } = useShop();
  const [msg, setMsg] = useState({});
  const [s, setS] = useState(null);
  const [channels, reloadCh] = useLoad((sb) => sb.from('contact_channels').select('*').order('sort'), []);
  const [edit, setEdit] = useState(null);

  async function loadSettings() {
    const { data, error } = await getSupabase().from('settings').select('*');
    if (error) return setMsg({ error: errMsg(error) });
    setS(Object.fromEntries(data.map((r) => [r.key, r.value])));
  }
  useEffect(() => { loadSettings(); }, []);

  async function saveSettings(e) {
    e.preventDefault();
    setMsg({});
    const rows = [...ML_KEYS.map(([k]) => ({ key: k, value: s[k] || {}, is_public: true })), { key: 'thb_rate', value: Number(s.thb_rate) || 650, is_public: true }];
    const { error } = await getSupabase().from('settings').upsert(rows);
    if (error) return setMsg({ error: errMsg(error) });
    setMsg({ ok: 'บันทึกการตั้งค่าแล้ว' }); refreshSettings();
  }
  async function saveChannel(e) {
    e.preventDefault();
    const row = { type: edit.type, label: edit.label || null, value: edit.value.trim(), url: edit.url?.trim() || null, sort: Number(edit.sort) || 0, is_active: !!edit.is_active };
    const sb = getSupabase();
    const res = edit.id ? await sb.from('contact_channels').update(row).eq('id', edit.id) : await sb.from('contact_channels').insert(row);
    if (res.error) return setMsg({ error: errMsg(res.error).includes('url') ? 'ลิงก์ต้องขึ้นต้นด้วย https://, tel: หรือ mailto:' : errMsg(res.error) });
    setEdit(null); reloadCh(); refreshSettings(); setMsg({ ok: 'บันทึกช่องทางติดต่อแล้ว' });
  }
  async function removeChannel(c) {
    if (!window.confirm(`ลบช่องทาง ${CHANNEL_LABEL[c.type]} ${c.value}?`)) return;
    const { error } = await getSupabase().from('contact_channels').delete().eq('id', c.id);
    if (error) setMsg({ error: errMsg(error) }); else { reloadCh(); refreshSettings(); }
  }
  return (
    <>
      <PageHead title="ช่องทางติดต่อและตั้งค่า" />
      <Alert {...msg} />
      {isAdmin && <TelegramSettings />}
      <QrManager />

      <section className="card mb-6 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">ช่องทางติดต่อ (แสดงบนหน้าร้าน)</h2>
          <button className="btn-primary btn-sm" onClick={() => setEdit({ type: 'whatsapp', label: '', value: '', url: '', sort: (channels?.length || 0) + 1, is_active: true })}>+ เพิ่มช่องทาง</button>
        </div>
        <ul className="divide-y divide-line">
          {(channels || []).map((c) => (
            <li key={c.id} className={`flex flex-wrap items-center gap-3 py-3 ${c.is_active ? '' : 'opacity-50'}`}>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-jade text-white"><ChannelIcon type={c.type} /></span>
              <span className="flex-1"><b>{c.label || CHANNEL_LABEL[c.type]}</b> · {c.value}
                <a href={channelHref(c) || '#'} target="_blank" rel="noopener noreferrer" className="block text-xs text-jade hover:underline">{channelHref(c)}</a></span>
              <span className="text-xs text-ink-faint">{c.is_active ? 'แสดง' : 'ซ่อน'} · ลำดับ {c.sort}</span>
              <button className="btn-ghost btn-sm" onClick={() => setEdit({ ...c, url: c.url || '', label: c.label || '' })}>แก้ไข</button>
              <button className="btn-danger btn-sm" onClick={() => removeChannel(c)}>ลบ</button>
            </li>
          ))}
          {channels?.length === 0 && <li className="py-4 text-sm text-ink-soft">ยังไม่มีช่องทางติดต่อ — เพิ่ม WhatsApp, Facebook Page, TikTok ฯลฯ</li>}
        </ul>
      </section>

      {s && (
        <form onSubmit={saveSettings} className="card mb-6 space-y-4 p-4">
          <h2 className="font-semibold">ข้อมูลร้าน</h2>
          {ML_KEYS.map(([k, label]) => (
            <fieldset key={k}>
              <legend className="label">{label}</legend>
              <div className="grid gap-2 md:grid-cols-3">
                {LANG3.map(([l, ln]) => (
                  <textarea key={l} rows={k === 'payment_info' ? 3 : 1} className="input" placeholder={ln} aria-label={`${label} ${ln}`}
                    value={(s[k] || {})[l] || ''} onChange={(e) => setS({ ...s, [k]: { ...(s[k] || {}), [l]: e.target.value } })} />
                ))}
              </div>
            </fieldset>
          ))}
          <label className="block max-w-xs"><span className="label">อัตราแลกเปลี่ยน: 1 บาท = ? กีบ</span><input type="number" min={1} className="input" value={s.thb_rate ?? 650} onChange={(e) => setS({ ...s, thb_rate: e.target.value })} /></label>
          <button className="btn-primary">บันทึกข้อมูลร้าน</button>
        </form>
      )}

      <section className="card p-4 text-sm">
        <h2 className="mb-1 font-semibold">ผู้ดูแลระบบและพนักงาน</h2>
        <p className="text-ink-soft">จัดการบัญชีพนักงานและสิทธิ์ได้ที่เมนู <Link href="/admin/staff" className="font-semibold text-jade underline">พนักงานและสิทธิ์</Link></p>
      </section>

      {edit && (
        <Modal title={edit.id ? 'แก้ไขช่องทางติดต่อ' : 'เพิ่มช่องทางติดต่อ'} onClose={() => setEdit(null)}>
          <form onSubmit={saveChannel} className="space-y-3">
            <label className="block"><span className="label">ประเภท</span>
              <select className="input" value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value })}>{CHANNEL_TYPES.map((t) => <option key={t} value={t}>{CHANNEL_LABEL[t]}</option>)}</select>
            </label>
            <label className="block"><span className="label">ข้อมูลที่แสดง *</span><input required className="input" maxLength={300} value={edit.value} onChange={(e) => setEdit({ ...edit, value: e.target.value })}
              placeholder={{ whatsapp: '+856 20 xxxx xxxx', phone: '+856 20 xxxx xxxx', email: 'shop@example.com', facebook: 'ชื่อเพจ หรือ https://facebook.com/...', tiktok: '@yourshop', instagram: '@yourshop', address: 'บ้าน… เมือง… แขวง…' }[edit.type] || ''} /></label>
            <label className="block"><span className="label">ชื่อที่แสดง (ไม่บังคับ)</span><input className="input" maxLength={80} value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} /></label>
            <label className="block"><span className="label">ลิงก์ (เว้นว่างเพื่อให้ระบบสร้างให้)</span><input className="input" value={edit.url} onChange={(e) => setEdit({ ...edit, url: e.target.value })} placeholder="https://..." /></label>
            <p className="text-xs text-ink-faint">ลิงก์ที่ปุ่มจะเปิด: {channelHref({ ...edit, url: edit.url || null }) || '—'}</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="label">ลำดับ</span><input type="number" className="input" value={edit.sort} onChange={(e) => setEdit({ ...edit, sort: e.target.value })} /></label>
              <label className="flex items-center gap-2 pt-6 text-sm"><input type="checkbox" checked={edit.is_active} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} /> แสดงบนหน้าร้าน</label>
            </div>
            <Alert error={msg.error} />
            <button className="btn-primary w-full">บันทึก</button>
          </form>
        </Modal>
      )}
    </>
  );
}
