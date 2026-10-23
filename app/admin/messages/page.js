'use client';
import { useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { PageHead, Alert, Empty, useLoad } from '@/components/admin/ui';
import { dt, errMsg } from '@/lib/format';
import { channelHref } from '@/components/channels';

const ST = { new: 'ใหม่', read: 'อ่านแล้ว', replied: 'ตอบแล้ว', archived: 'เก็บถาวร' };

export default function MessagesPage() {
  const [status, setStatus] = useState('new');
  const [error, setError] = useState('');
  const [rows, reload, loadErr] = useLoad((sb) => {
    let q = sb.from('contact_messages').select('*').order('created_at', { ascending: false }).limit(500);
    if (status) q = q.eq('status', status);
    return q;
  }, [status]);
  async function update(m, patch) {
    const { error: e } = await getSupabase().from('contact_messages').update(patch).eq('id', m.id);
    if (e) setError(errMsg(e)); else reload();
  }
  return (
    <>
      <PageHead title="ข้อความจากลูกค้า" sub="ข้อความจากแบบฟอร์มติดต่อบนเว็บไซต์ ถูกเก็บไว้ทั้งหมด" />
      <div className="mb-4 flex flex-wrap gap-2">
        {[['new', 'ใหม่'], ['read', 'อ่านแล้ว'], ['replied', 'ตอบแล้ว'], ['archived', 'เก็บถาวร'], ['', 'ทั้งหมด']].map(([k, v]) => (
          <button key={k} onClick={() => setStatus(k)} className={status === k ? 'btn-primary btn-sm' : 'btn-ghost btn-sm'}>{v}</button>
        ))}
      </div>
      <Alert error={error || loadErr} />
      {rows === null ? <p className="text-ink-soft">กำลังโหลด…</p> : rows.length === 0 ? <Empty>ไม่มีข้อความในหมวดนี้</Empty> : (
        <ul className="space-y-3">
          {rows.map((m) => (
            <li key={m.id} className={`card p-4 ${m.status === 'new' ? 'border-saffron' : ''}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{m.name} {m.subject && <span className="font-normal text-ink-soft">— {m.subject}</span>}</p>
                  <p className="text-xs text-ink-faint">{dt(m.created_at)} · {ST[m.status]}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {m.phone && <a className="btn-ghost btn-sm" href={channelHref({ type: 'whatsapp', value: m.phone.startsWith('0') ? '856' + m.phone.replace(/\D/g, '').slice(1) : m.phone })} target="_blank" rel="noopener noreferrer">WhatsApp {m.phone}</a>}
                  {m.email && <a className="btn-ghost btn-sm" href={`mailto:${m.email}`}>{m.email}</a>}
                </div>
              </div>
              <p className="mt-3 whitespace-pre-line text-sm">{m.message}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {Object.entries(ST).filter(([k]) => k !== m.status).map(([k, v]) => (
                  <button key={k} className="btn-ghost btn-sm" onClick={() => update(m, { status: k })}>ทำเป็น “{v}”</button>
                ))}
                <input className="input max-w-sm py-1" placeholder="บันทึกภายใน (กด Enter)" defaultValue={m.staff_note || ''}
                  onKeyDown={(e) => { if (e.key === 'Enter') update(m, { staff_note: e.currentTarget.value || null }); }} aria-label="บันทึกภายใน" />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
