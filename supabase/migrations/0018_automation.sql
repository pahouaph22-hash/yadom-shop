-- =====================================================================
-- Automation:
--  1. Auto-cancel unpaid member orders after N days (returns stock)
--  2. Telegram alert when a product drops to its low-stock threshold
--  3. Nightly Telegram sales summary (21:00 Vientiane)
-- Staff-created orders (user_id is null, e.g. credit for wholesale buyers)
-- are never auto-cancelled.
-- =====================================================================

create extension if not exists pg_cron;

alter table public.notify_config
  add column on_low_stock boolean not null default true,
  add column daily_summary boolean not null default true;

-- Public so the storefront can tell customers the payment deadline. 0 = off.
insert into public.settings (key, value, is_public) values ('auto_cancel_days', '3'::jsonb, true)
on conflict (key) do nothing;

create or replace function public.auto_cancel_days() returns integer
language sql stable security definer set search_path = ''
as $$ select greatest(0, least(30, coalesce((select (value #>> '{}')::int from public.settings where key = 'auto_cancel_days'), 0))) $$;

-- event-aware sender (adds 'stock' and 'summary')
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
    if p_event = 'stock' and not c.on_low_stock then return 0; end if;
    if p_event = 'summary' and not c.daily_summary then return 0; end if;
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

-- ------------------------------------------------------------ 1. auto-cancel
create or replace function public.expire_unpaid_orders()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_days int := public.auto_cancel_days();
  o record;
  n int := 0;
  lines text := '';
  base text;
begin
  if v_days = 0 then return 0; end if;
  for o in
    select * from public.orders x
     where x.status in ('received', 'pending_payment')
       and x.user_id is not null
       and x.paid_amount - x.refunded_amount = 0
       and x.created_at < now() - make_interval(days => v_days)
       and not exists (select 1 from public.payment_slips s where s.order_id = x.id and s.status = 'pending')
     order by x.created_at
     limit 200
     for update skip locked
  loop
    perform set_config('app.audit_note', 'auto-cancel: unpaid ' || v_days || ' days', true);
    perform public.restock_order(o.id, 'cancel');
    update public.orders set status = 'cancelled' where id = o.id;
    perform public.order_event(o.id, 'status', o.status, 'cancelled',
      'ຍົກເລີກອັດຕະໂນມັດ: ບໍ່ຊຳລະພາຍໃນ ' || v_days || ' ມື້ / ยกเลิกอัตโนมัติ: ไม่ชำระภายใน ' || v_days || ' วัน',
      jsonb_build_object('by', 'system', 'days', v_days));
    perform set_config('app.audit_note', '', true);
    n := n + 1;
    if n <= 15 then
      lines := lines || E'\n• ' || o.order_no || ' · ' || public.tg_escape(o.ship_name) || ' · ' || public.tg_kip(o.total);
    end if;
  end loop;
  if n > 0 then
    select site_url into base from public.notify_config where id;
    perform public.tg_send('⏰ <b>ยกเลิกอัตโนมัติ ' || n || ' ออเดอร์</b> (ไม่ชำระภายใน ' || v_days || ' วัน — คืนสต็อกแล้ว)' ||
      lines || case when n > 15 then E'\n… และอีก ' || (n - 15) else '' end ||
      E'\n\n<a href="' || base || '/admin/orders/">เปิดรายการออเดอร์</a>', 'order');
  end if;
  return n;
end $$;
revoke all on function public.expire_unpaid_orders() from public, anon, authenticated;

-- ------------------------------------------------------------ 2. low stock
create or replace function public.tg_on_low_stock() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare base text;
begin
  if new.deleted_at is not null or not new.is_active then return null; end if;
  if not (old.stock > old.low_stock_threshold and new.stock <= new.low_stock_threshold)
     and not (old.stock > 0 and new.stock = 0) then
    return null;
  end if;
  select site_url into base from public.notify_config where id;
  perform public.tg_send(
    case when new.stock = 0 then '🚫 <b>สินค้าหมดสต็อก</b>' else '📦 <b>สต็อกใกล้หมด</b>' end || E'\n' ||
    public.tg_escape(coalesce(nullif(new.name_th, ''), new.name_lo)) || ' (' || public.tg_escape(new.sku) || ')' || E'\n' ||
    'เหลือ <b>' || new.stock || '</b> ชิ้น (จุดเตือน ' || new.low_stock_threshold || ')' ||
    E'\n\n<a href="' || base || '/admin/products/edit/?id=' || new.id || '">เติมสต็อก</a>',
    'stock');
  return null;
exception when others then
  raise warning 'tg_on_low_stock: %', sqlerrm;
  return null;
end $$;
revoke all on function public.tg_on_low_stock() from public, anon, authenticated;

create trigger notify_low_stock after update of stock on public.products
  for each row when (new.stock < old.stock)
  execute function public.tg_on_low_stock();

-- ------------------------------------------------------------ 3. daily summary
create or replace function public.daily_summary_text(p_day date default (now() at time zone 'Asia/Vientiane')::date)
returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  t0 timestamptz := (p_day::timestamp at time zone 'Asia/Vientiane');
  t1 timestamptz := ((p_day + 1)::timestamp at time zone 'Asia/Vientiane');
  v_orders int; v_sales numeric; v_cancel int; v_recv numeric; v_refund numeric; v_members int;
  v_await int; v_await_amt numeric; v_slips int; v_toship int; v_msgs int; v_low text; v_top text; base text;
begin
  select count(*) filter (where status not in ('cancelled', 'refunded')),
         coalesce(sum(total) filter (where status not in ('cancelled', 'refunded')), 0),
         count(*) filter (where status = 'cancelled')
    into v_orders, v_sales, v_cancel
    from public.orders where created_at >= t0 and created_at < t1;
  select coalesce(sum(amount) filter (where kind = 'payment'), 0), coalesce(sum(amount) filter (where kind = 'refund'), 0)
    into v_recv, v_refund from public.payments where paid_at >= t0 and paid_at < t1;
  select count(*) into v_members from public.customers where member_since >= t0 and member_since < t1;
  select count(*), coalesce(sum(total - (paid_amount - refunded_amount)), 0) into v_await, v_await_amt
    from public.orders where status in ('received', 'pending_payment') and paid_amount - refunded_amount < total;
  select count(*) into v_slips from public.payment_slips where status = 'pending';
  select count(*) into v_toship from public.orders where status = 'paid';
  select count(*) into v_msgs from public.contact_messages where status = 'new';
  select string_agg('• ' || public.tg_escape(coalesce(nullif(name_th, ''), name_lo)) || ' — เหลือ ' || stock, E'\n' order by stock)
    into v_low from public.products where deleted_at is null and is_active and stock <= low_stock_threshold;
  select string_agg('• ' || public.tg_escape(n) || ' × ' || q, E'\n' order by q desc) into v_top from (
    select i.product_name n, sum(i.qty) q from public.order_items i join public.orders o on o.id = i.order_id
     where o.created_at >= t0 and o.created_at < t1 and o.status not in ('cancelled', 'refunded') and i.qty > 0
     group by 1 order by 2 desc limit 5) x;
  select site_url into base from public.notify_config where id;

  return '📊 <b>สรุปประจำวัน ' || to_char(p_day, 'DD/MM/YYYY') || '</b>' || E'\n\n' ||
    '🛒 ออเดอร์ใหม่: <b>' || v_orders || '</b>' || case when v_cancel > 0 then ' (ยกเลิก ' || v_cancel || ')' else '' end || E'\n' ||
    '💰 ยอดขาย: <b>' || public.tg_kip(v_sales) || '</b>' || E'\n' ||
    '💵 รับเงินจริง: <b>' || public.tg_kip(v_recv) || '</b>' || case when v_refund > 0 then ' · คืนเงิน ' || public.tg_kip(v_refund) else '' end || E'\n' ||
    '👥 สมาชิกใหม่: ' || v_members ||
    coalesce(E'\n\n<b>ขายดีวันนี้</b>\n' || v_top, '') ||
    E'\n\n<b>งานที่รออยู่</b>' || E'\n' ||
    '⏳ รอชำระ: ' || v_await || ' ออเดอร์ (' || public.tg_kip(v_await_amt) || ')' || E'\n' ||
    '🧾 สลิปรอตรวจ: ' || v_slips || E'\n' ||
    '📦 รอจัดส่ง: ' || v_toship || E'\n' ||
    '✉️ ข้อความใหม่: ' || v_msgs ||
    coalesce(E'\n\n<b>สต็อกใกล้หมด</b>\n' || v_low, '') ||
    E'\n\n<a href="' || base || '/admin/">เปิดหน้าภาพรวม</a>';
end $$;
revoke all on function public.daily_summary_text(date) from public, anon, authenticated;

create or replace function public.send_daily_summary() returns integer
language sql security definer set search_path = ''
as $$ select public.tg_send(public.daily_summary_text(), 'summary') $$;
revoke all on function public.send_daily_summary() from public, anon, authenticated;

-- ------------------------------------------------------------ admin RPCs
create or replace function public.set_automation(p_auto_cancel_days int, p_on_low_stock boolean, p_daily_summary boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = 'insufficient_privilege'; end if;
  if p_auto_cancel_days is null or p_auto_cancel_days < 0 or p_auto_cancel_days > 30 then
    raise exception 'จำนวนวันต้องอยู่ระหว่าง 0–30 (0 = ปิด)';
  end if;
  insert into public.settings (key, value, is_public) values ('auto_cancel_days', to_jsonb(p_auto_cancel_days), true)
  on conflict (key) do update set value = excluded.value;
  update public.notify_config set on_low_stock = coalesce(p_on_low_stock, true), daily_summary = coalesce(p_daily_summary, true),
         updated_at = now(), updated_by = auth.uid() where id;
  perform public.write_audit('automation', 'notify_config', null, null,
    jsonb_build_object('auto_cancel_days', p_auto_cancel_days, 'on_low_stock', p_on_low_stock, 'daily_summary', p_daily_summary),
    null, 'ตั้งค่างานอัตโนมัติ');
end $$;

create or replace function public.test_daily_summary() returns integer
language plpgsql security definer set search_path = ''
as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'Not allowed' using errcode = 'insufficient_privilege'; end if;
  n := public.tg_send(public.daily_summary_text(), 'summary', true);
  if n = 0 then raise exception 'ยังไม่ได้ตั้งค่า Telegram'; end if;
  return n;
end $$;

revoke all on function public.set_automation(int, boolean, boolean) from public, anon;
revoke all on function public.test_daily_summary() from public, anon;
grant execute on function public.set_automation(int, boolean, boolean) to authenticated;
grant execute on function public.test_daily_summary() to authenticated;

-- ------------------------------------------------------------ schedules (UTC)
select cron.schedule('yadom-expire-unpaid', '7 * * * *', $$select public.expire_unpaid_orders()$$);
select cron.schedule('yadom-daily-summary', '0 14 * * *', $$select public.send_daily_summary()$$);  -- 21:00 Vientiane
