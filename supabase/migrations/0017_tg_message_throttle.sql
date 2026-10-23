-- Contact form is public: cap Telegram pings so a spammer can't flood the shop's chat.
-- After 5 messages in 10 minutes, send one "many messages" notice, then stay quiet until it calms down.
create or replace function public.tg_on_message() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare base text; n int;
begin
  select count(*) into n from public.contact_messages where created_at > now() - interval '10 minutes';
  select site_url into base from public.notify_config where id;
  if n > 6 then return null; end if;
  if n = 6 then
    perform public.tg_send('⚠️ <b>มีข้อความติดต่อเข้ามาจำนวนมาก</b>' || E'\n' ||
      'หยุดแจ้งทีละข้อความชั่วคราว 10 นาที — ดูทั้งหมดในกล่องข้อความ' ||
      E'\n\n<a href="' || base || '/admin/messages/">เปิดกล่องข้อความ</a>', 'message');
    return null;
  end if;
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
revoke all on function public.tg_on_message() from public, anon, authenticated;
