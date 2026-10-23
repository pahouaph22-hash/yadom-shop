-- =====================================================================
-- Telegram notifications: new order, new payment slip, new contact message.
-- Messages are queued with pg_net and only sent after the transaction
-- commits, so a rolled-back order never notifies, and a Telegram outage
-- never blocks an order.
-- =====================================================================

create extension if not exists pg_net with schema extensions;

-- Single-row config. The bot token is a secret: admins only, no audit trigger
-- (the RPC writes its own audit entry with the token masked).
create table public.notify_config (
  id boolean primary key default true check (id),
  telegram_token text,
  telegram_chat_ids text[] not null default '{}',
  enabled boolean not null default false,
  on_order boolean not null default true,
  on_slip boolean not null default true,
  on_message boolean not null default true,
  site_url text not null default 'https://pahouaph22-hash.github.io/yadom-shop',
  updated_at timestamptz not null default now(),
  updated_by uuid
);
insert into public.notify_config default values;
alter table public.notify_config enable row level security;
create policy notify_config_admin_read on public.notify_config for select to authenticated using (public.is_admin());
revoke all on public.notify_config from anon;
revoke insert, update, delete on public.notify_config from authenticated;

create or replace function public.tg_escape(t text) returns text
language sql immutable set search_path = ''
as $$ select replace(replace(replace(coalesce(t, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;') $$;

create or replace function public.tg_kip(n numeric) returns text
language sql immutable set search_path = ''
as $$ select trim(to_char(coalesce(n, 0), 'FM999,999,999,999,990')) || ' ₭' $$;

-- Queue a Telegram message to every configured chat. Never raises.
create or replace function public.tg_send(p_text text, p_event text default null, p_force boolean default false)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  c public.notify_config;
  chat text;
  n integer := 0;
begin
  select * into c from public.notify_config where id;
  if c.telegram_token is null or coalesce(array_length(c.telegram_chat_ids, 1), 0) = 0 then return 0; end if;
  if not p_force then
    if not c.enabled then return 0; end if;
    if p_event = 'order' and not c.on_order then return 0; end if;
    if p_event = 'slip' and not c.on_slip then return 0; end if;
    if p_event = 'message' and not c.on_message then return 0; end if;
  end if;
  foreach chat in array c.telegram_chat_ids loop
    perform net.http_post(
      url := 'https://api.telegram.org/bot' || c.telegram_token || '/sendMessage',
      body := jsonb_build_object('chat_id', chat, 'text', left(p_text, 4000), 'parse_mode', 'HTML',
                                 'disable_web_page_preview', true),
      headers := '{"Content-Type":"application/json"}'::jsonb,
      timeout_milliseconds := 8000
    );
    n := n + 1;
  end loop;
  return n;
exception when others then
  raise warning 'tg_send failed: %', sqlerrm;
  return 0;
end $$;
revoke all on function public.tg_send(text, text, boolean) from public, anon, authenticated;

-- ---------------------------------------------------------------- triggers
create or replace function public.tg_on_order() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  o public.orders;
  items text;
  base text;
begin
  select * into o from public.orders where id = new.id;   -- final values at commit
  if not found then return null; end if;
  select site_url into base from public.notify_config where id;
  select string_agg('• ' || public.tg_escape(i.product_name) || ' × ' || i.qty, E'\n' order by i.product_name)
    into items from public.order_items i where i.order_id = o.id and i.qty > 0;
  perform public.tg_send(
    '🛒 <b>ออเดอร์ใหม่ ' || o.order_no || '</b>' ||
    case when o.created_by is not null and o.created_by is distinct from o.user_id then ' (พนักงานสร้าง)' else '' end || E'\n' ||
    '👤 ' || public.tg_escape(o.ship_name) || ' · ' || public.tg_escape(o.ship_phone) || E'\n' ||
    case when o.ship_address is not null then '📍 ' || public.tg_escape(left(o.ship_address, 200)) || E'\n' else '' end ||
    coalesce(items, '') || E'\n' ||
    '💰 ยอดรวม <b>' || public.tg_kip(o.total) || '</b>' || case when o.is_wholesale then ' (ราคาส่ง)' else '' end ||
    case when o.customer_note is not null and o.customer_note <> '' then E'\n📝 ' || public.tg_escape(left(o.customer_note, 300)) else '' end ||
    E'\n\n<a href="' || base || '/admin/orders/view/?id=' || o.id || '">เปิดดูออเดอร์</a>',
    'order');
  return null;
exception when others then
  raise warning 'tg_on_order: %', sqlerrm;
  return null;
end $$;

-- Deferred so order_items (inserted after the order row) are visible.
create constraint trigger notify_new_order
  after insert on public.orders
  deferrable initially deferred
  for each row execute function public.tg_on_order();

create or replace function public.tg_on_slip() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  o public.orders;
  base text;
begin
  select * into o from public.orders where id = new.order_id;
  select site_url into base from public.notify_config where id;
  perform public.tg_send(
    '🧾 <b>สลิปโอนเงินใหม่</b> — ' || coalesce(o.order_no, '?') || E'\n' ||
    '👤 ' || public.tg_escape(o.ship_name) || ' · ' || public.tg_escape(o.ship_phone) || E'\n' ||
    '💵 ยอดที่แจ้ง: <b>' || case when new.amount is null then 'ไม่ระบุ' else public.tg_kip(new.amount) end || '</b>' ||
    ' / ยอดออเดอร์ ' || public.tg_kip(o.total) ||
    case when new.note is not null and new.note <> '' then E'\n📝 ' || public.tg_escape(left(new.note, 300)) else '' end ||
    E'\n\n<a href="' || base || '/admin/orders/view/?id=' || o.id || '">ตรวจสลิป</a>',
    'slip');
  return null;
exception when others then
  raise warning 'tg_on_slip: %', sqlerrm;
  return null;
end $$;

create trigger notify_new_slip after insert on public.payment_slips
  for each row execute function public.tg_on_slip();

create or replace function public.tg_on_message() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare base text;
begin
  select site_url into base from public.notify_config where id;
  perform public.tg_send(
    '✉️ <b>ข้อความติดต่อใหม่</b>' || E'\n' ||
    '👤 ' || public.tg_escape(new.name) ||
    coalesce(' · ' || public.tg_escape(nullif(trim(new.phone), '')), '') || coalesce(' · ' || public.tg_escape(nullif(trim(new.email), '')), '') || E'\n' ||
    case when new.subject is not null and new.subject <> '' then '<b>' || public.tg_escape(new.subject) || '</b>' || E'\n' else '' end ||
    public.tg_escape(left(new.message, 800)) ||
    E'\n\n<a href="' || base || '/admin/messages/">เปิดกล่องข้อความ</a>',
    'message');
  return null;
exception when others then
  raise warning 'tg_on_message: %', sqlerrm;
  return null;
end $$;

create trigger notify_new_message after insert on public.contact_messages
  for each row execute function public.tg_on_message();

revoke all on function public.tg_on_order() from public, anon, authenticated;
revoke all on function public.tg_on_slip() from public, anon, authenticated;
revoke all on function public.tg_on_message() from public, anon, authenticated;

-- ---------------------------------------------------------------- admin RPCs
-- p_token null = keep the saved token; '' = clear it.
create or replace function public.set_notify_config(
  p_token text, p_chat_ids text[], p_enabled boolean,
  p_on_order boolean, p_on_slip boolean, p_on_message boolean, p_site_url text
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  ids text[];
  tok text;
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = 'insufficient_privilege'; end if;
  tok := nullif(trim(p_token), '');
  if p_token is not null and tok is not null and tok !~ '^[0-9]+:[A-Za-z0-9_-]{30,}$' then
    raise exception 'Bot token ไม่ถูกต้อง (รูปแบบ 123456:ABC...)';
  end if;
  select coalesce(array_agg(distinct x), '{}') into ids
    from unnest(coalesce(p_chat_ids, '{}')) u(v), lateral (select trim(u.v) as x) t
   where x <> '';
  if exists (select 1 from unnest(ids) x where x !~ '^-?[0-9]{3,20}$') then
    raise exception 'Chat ID ต้องเป็นตัวเลข เช่น 123456789 หรือ -100123...';
  end if;
  if p_site_url !~ '^https://' then raise exception 'ลิงก์เว็บต้องขึ้นต้นด้วย https://'; end if;

  update public.notify_config set
    telegram_token = case when p_token is null then telegram_token else tok end,
    telegram_chat_ids = ids, enabled = coalesce(p_enabled, false),
    on_order = coalesce(p_on_order, true), on_slip = coalesce(p_on_slip, true), on_message = coalesce(p_on_message, true),
    site_url = rtrim(p_site_url, '/'), updated_at = now(), updated_by = auth.uid()
  where id;

  perform public.write_audit('notify_config', 'notify_config', null, null,
    jsonb_build_object('chat_ids', ids, 'enabled', p_enabled, 'on_order', p_on_order, 'on_slip', p_on_slip,
                       'on_message', p_on_message, 'token_changed', p_token is not null),
    null, 'ตั้งค่าแจ้งเตือน Telegram');
end $$;

create or replace function public.test_telegram() returns integer
language plpgsql security definer set search_path = ''
as $$
declare n integer;
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = 'insufficient_privilege'; end if;
  n := public.tg_send('✅ <b>ทดสอบแจ้งเตือน</b>' || E'\n' || 'ร้านยาดม — ระบบแจ้งเตือนเชื่อมต่อสำเร็จ ' ||
                      to_char(now() at time zone 'Asia/Vientiane', 'DD/MM/YYYY HH24:MI'), null, true);
  if n = 0 then raise exception 'ยังไม่ได้ใส่ Bot token หรือ Chat ID'; end if;
  return n;
end $$;

-- Delivery results of recent sends (pg_net keeps responses ~6 hours)
create or replace function public.telegram_recent_results() returns table(at timestamptz, status_code integer, ok boolean, error text)
language sql security definer set search_path = ''
as $$
  select r.created, r.status_code,
         coalesce((j ->> 'ok')::boolean, false),
         coalesce(j ->> 'description', r.error_msg)
    from net._http_response r
    cross join lateral (select case when r.content like '{%' then r.content::jsonb end as j) x
   where public.is_admin()
   order by r.created desc limit 10
$$;

revoke all on function public.set_notify_config(text, text[], boolean, boolean, boolean, boolean, text) from public, anon;
revoke all on function public.test_telegram() from public, anon;
revoke all on function public.telegram_recent_results() from public, anon;
grant execute on function public.set_notify_config(text, text[], boolean, boolean, boolean, boolean, text) to authenticated;
grant execute on function public.test_telegram() to authenticated;
grant execute on function public.telegram_recent_results() to authenticated;
