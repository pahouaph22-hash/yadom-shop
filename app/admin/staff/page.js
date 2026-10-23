'use client';
import { useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { useShop } from '@/components/Providers';
import { PageHead, Alert, Modal, useLoad } from '@/components/admin/ui';
import { PERMS, PERM_LABEL, PRESETS } from '@/components/admin/perms';
import { dt, errMsg } from '@/lib/format';

async function callStaffAdmin(body) {
  const { data, error } = await getSupabase().functions.invoke('staff-admin', { body });
  if (error) {
    let m = error.message;
    try { const j = await error.context.json(); if (j?.error) m = j.error; } catch { /* keep default */ }
    return { error: m };
  }
  if (data?.error) return { error: data.error };
  return { data };
}

function PermPicker({ value, onChange }) {
  const toggle = (k) => onChange(value.includes(k) ? value.filter((x) => x !== k) : [...value, k]);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        <span className="text-xs text-ink-faint">ชุดสิทธิ์สำเร็จรูป:</span>
        {PRESETS.map(([name, ps]) => <button type="button" key={name} className="rounded-full border border-line px-2 py-0.5 text-xs hover:border-jade" onClick={() => onChange(ps)}>{name}</button>)}
      </div>
      {PERMS.map(([k, label, desc]) => (
        <label key={k} className="flex items-start gap-2 rounded-lg border border-line p-2 text-sm">
          <input type="checkbox" className="mt-1" checked={value.includes(k)} onChange={() => toggle(k)} />
          <span><b>{label}</b><span className="block text-xs text-ink-soft">{desc}</span></span>
        </label>
      ))}
    </div>
  );
}

export default function StaffPage() {
  const { user } = useShop();
  const [rows, reload, error] = useLoad((sb) => sb.rpc('staff_accounts'), []);
  const [create, setCreate] = useState(null);
  const [edit, setEdit] = useState(null);
  const [pw, setPw] = useState(null);
  const [msg, setMsg] = useState({});
  const [busy, setBusy] = useState(false);

  async function doCreate(e) {
    e.preventDefault();
    setBusy(true); setMsg({});
    const r = await callStaffAdmin({ action: 'create', ...create });
    setBusy(false);
    if (r.error) return setMsg({ error: r.error });
    setMsg({ ok: `สร้างบัญชี ${create.email} แล้ว — แจ้งอีเมลและรหัสผ่านให้พนักงาน แล้วให้เข้าที่หน้า /staff/login` });
    setCreate(null); reload();
  }
  async function doEdit(e) {
    e.preventDefault();
    const { error: err } = await getSupabase().rpc('set_staff_access', { p_user_id: edit.id, p_permissions: edit.permissions, p_is_active: edit.is_active, p_title: edit.title || null });
    if (err) return setMsg({ error: errMsg(err) });
    setMsg({ ok: 'บันทึกสิทธิ์แล้ว — มีผลทันทีเมื่อพนักงานโหลดหน้าใหม่' }); setEdit(null); reload();
  }
  async function doPw(e) {
    e.preventDefault();
    setBusy(true);
    const r = await callStaffAdmin({ action: 'reset_password', user_id: pw.id, password: pw.password });
    setBusy(false);
    if (r.error) return setMsg({ error: r.error });
    setMsg({ ok: `ตั้งรหัสผ่านใหม่ให้ ${pw.email} แล้ว` }); setPw(null);
  }

  return (
    <>
      <PageHead title="พนักงานและสิทธิ์" sub="บัญชีพนักงานแยกจากบัญชีลูกค้า — สร้างได้จากหน้านี้เท่านั้น และเข้าสู่ระบบที่ /staff/login">
        <button className="btn-primary" onClick={() => { setMsg({}); setCreate({ email: '', password: '', full_name: '', title: '', role: 'staff', permissions: ['orders'] }); }}>+ เพิ่มพนักงาน</button>
      </PageHead>
      <Alert {...msg} /><Alert error={error} />
      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>พนักงาน</th><th>ตำแหน่ง</th><th>สิทธิ์</th><th>สถานะ</th><th>เข้าระบบล่าสุด</th><th></th></tr></thead>
          <tbody>
            {(rows || []).map((s) => (
              <tr key={s.id} className={s.is_active ? '' : 'opacity-50'}>
                <td><b>{s.full_name || '—'}</b><div className="text-xs text-ink-faint">{s.email}</div></td>
                <td className="text-xs">{s.title || '—'}</td>
                <td className="text-xs">{s.role === 'admin' ? <span className="rounded bg-jade px-1.5 py-0.5 text-white">ผู้ดูแลระบบ — ทุกสิทธิ์</span>
                  : (s.permissions || []).map((p) => <span key={p} className="mr-1 inline-block rounded bg-jade-mist px-1.5 py-0.5 text-jade">{PERM_LABEL[p] || p}</span>)}</td>
                <td className="text-xs">{s.is_active ? 'ใช้งาน' : 'ปิดใช้งาน'}</td>
                <td className="text-xs">{s.last_sign_in_at ? dt(s.last_sign_in_at) : 'ยังไม่เคย'}</td>
                <td className="whitespace-nowrap text-right">
                  {s.role === 'staff' && <button className="btn-ghost btn-sm" onClick={() => { setMsg({}); setEdit({ ...s, permissions: s.permissions || [], title: s.title || '' }); }}>สิทธิ์</button>}
                  {s.id !== user?.id && <button className="btn-ghost btn-sm ml-1" onClick={() => { setMsg({}); setPw({ id: s.id, email: s.email, password: '' }); }}>ตั้งรหัสใหม่</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-ink-faint">พนักงานที่ถูกปิดใช้งานจะเข้าระบบหลังบ้านไม่ได้ทันที · ข้อมูลที่เคยบันทึกยังอยู่ครบในประวัติการดำเนินงาน</p>

      {create && (
        <Modal title="เพิ่มบัญชีพนักงาน" onClose={() => setCreate(null)}>
          <form onSubmit={doCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="label">ชื่อ-นามสกุล *</span><input required className="input" value={create.full_name} onChange={(e) => setCreate({ ...create, full_name: e.target.value })} /></label>
              <label className="block"><span className="label">ตำแหน่ง</span><input className="input" value={create.title} onChange={(e) => setCreate({ ...create, title: e.target.value })} placeholder="เช่น แอดมินเพจ" /></label>
            </div>
            <label className="block"><span className="label">อีเมลสำหรับเข้าระบบ * (ห้ามซ้ำกับบัญชีลูกค้า)</span><input required type="email" className="input" value={create.email} onChange={(e) => setCreate({ ...create, email: e.target.value })} /></label>
            <label className="block"><span className="label">รหัสผ่านเริ่มต้น * (8 ตัวขึ้นไป)</span><input required minLength={8} className="input" value={create.password} onChange={(e) => setCreate({ ...create, password: e.target.value })} /></label>
            <label className="block"><span className="label">ประเภทบัญชี</span>
              <select className="input" value={create.role} onChange={(e) => setCreate({ ...create, role: e.target.value })}>
                <option value="staff">พนักงาน — กำหนดสิทธิ์ตามหน้าที่</option><option value="admin">ผู้ดูแลระบบ — ทุกสิทธิ์</option>
              </select></label>
            {create.role === 'staff' && <PermPicker value={create.permissions} onChange={(p) => setCreate({ ...create, permissions: p })} />}
            <Alert error={msg.error} />
            <button disabled={busy} className="btn-primary w-full">{busy ? 'กำลังสร้าง…' : 'สร้างบัญชีพนักงาน'}</button>
          </form>
        </Modal>
      )}
      {edit && (
        <Modal title={`สิทธิ์ของ ${edit.full_name || edit.email}`} onClose={() => setEdit(null)}>
          <form onSubmit={doEdit} className="space-y-3">
            <label className="block"><span className="label">ตำแหน่ง</span><input className="input" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></label>
            <PermPicker value={edit.permissions} onChange={(p) => setEdit({ ...edit, permissions: p })} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.is_active} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} /> เปิดใช้งานบัญชี</label>
            <Alert error={msg.error} />
            <button className="btn-primary w-full">บันทึกสิทธิ์</button>
          </form>
        </Modal>
      )}
      {pw && (
        <Modal title={`ตั้งรหัสผ่านใหม่: ${pw.email}`} onClose={() => setPw(null)}>
          <form onSubmit={doPw} className="space-y-3">
            <label className="block"><span className="label">รหัสผ่านใหม่ (8 ตัวขึ้นไป)</span><input required minLength={8} className="input" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} /></label>
            <Alert error={msg.error} />
            <button disabled={busy} className="btn-primary w-full">ตั้งรหัสผ่าน</button>
          </form>
        </Modal>
      )}
    </>
  );
}
