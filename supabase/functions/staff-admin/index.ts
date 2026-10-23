// staff-admin: lets an ADMIN create staff accounts and reset staff passwords.
// Staff accounts can only be made here (never from the public sign-up form),
// so customer and staff accounts stay separate.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const PERMS = ['orders', 'products', 'customers', 'messages', 'reports', 'finance', 'settings', 'audit'];
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Not signed in' }, 401);

  // Who is calling? Must be an active admin.
  const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data: userData, error: userErr } = await caller.auth.getUser(authHeader.slice(7));
  if (userErr || !userData?.user) return json({ error: 'Not signed in' }, 401);
  const { data: isAdmin } = await caller.rpc('is_admin');
  if (!isAdmin) return json({ error: 'Only admins can manage staff' }, 403);

  const admin = createClient(url, service, { auth: { persistSession: false } });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  if (body.action === 'create') {
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    const fullName = String(body.full_name ?? '').trim().slice(0, 120);
    const title = String(body.title ?? '').trim().slice(0, 80) || null;
    const role = body.role === 'admin' ? 'admin' : 'staff';
    const permissions = Array.isArray(body.permissions) ? (body.permissions as string[]).filter((p) => PERMS.includes(p)) : [];
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'อีเมลไม่ถูกต้อง' }, 400);
    if (password.length < 8) return json({ error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัว' }, 400);

    const { data: existing } = await admin.from('profiles').select('id, role').eq('email', email).maybeSingle();
    if (existing) {
      return json({ error: existing.role === 'customer'
        ? 'อีเมลนี้เป็นบัญชีลูกค้าอยู่แล้ว — บัญชีพนักงานต้องใช้อีเมลแยกจากบัญชีลูกค้า'
        : 'อีเมลนี้เป็นบัญชีพนักงานอยู่แล้ว' }, 409);
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name: fullName, account_type: 'staff' },
    });
    if (createErr || !created.user) return json({ error: createErr?.message ?? 'Create failed' }, 400);

    const { error: profErr } = await admin.from('profiles')
      .update({ role, permissions: role === 'admin' ? [] : permissions, title, full_name: fullName || null, is_active: true })
      .eq('id', created.user.id);
    if (profErr) {
      await admin.auth.admin.deleteUser(created.user.id);
      return json({ error: profErr.message }, 400);
    }
    await admin.rpc('write_audit', {
      p_action: 'staff_create', p_entity: 'profiles', p_entity_id: created.user.id,
      p_old: null, p_new: { email, role, permissions, by: userData.user.email }, p_changed: null, p_note: `created by ${userData.user.email}`,
    });
    return json({ ok: true, id: created.user.id });
  }

  if (body.action === 'reset_password') {
    const id = String(body.user_id ?? '');
    const password = String(body.password ?? '');
    if (password.length < 8) return json({ error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัว' }, 400);
    const { data: target } = await admin.from('profiles').select('role').eq('id', id).maybeSingle();
    if (!target || !['admin', 'staff'].includes(target.role)) return json({ error: 'ไม่พบบัญชีพนักงาน' }, 404);
    const { error } = await admin.auth.admin.updateUserById(id, { password });
    if (error) return json({ error: error.message }, 400);
    await admin.rpc('write_audit', {
      p_action: 'staff_password_reset', p_entity: 'profiles', p_entity_id: id,
      p_old: null, p_new: null, p_changed: null, p_note: `by ${userData.user.email}`,
    });
    return json({ ok: true });
  }

  return json({ error: 'Unknown action' }, 400);
});
