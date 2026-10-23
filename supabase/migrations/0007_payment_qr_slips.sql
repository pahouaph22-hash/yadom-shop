-- =====================================================================
-- Payment QR codes (managed in settings) + customer payment slips
-- =====================================================================

-- QR codes live in settings.payment_qr as a JSON array:
-- [{ "id", "label", "bank", "account_name", "account_no", "image_url", "active" }]
insert into public.settings (key, value, is_public) values ('payment_qr', '[]', true)
on conflict (key) do nothing;

create table public.payment_slips (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  file_path text not null unique check (char_length(file_path) <= 300),
  amount numeric(14,0) check (amount is null or amount > 0),
  note text check (char_length(note) <= 500),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  review_note text check (char_length(review_note) <= 500),
  reviewed_by uuid,
  reviewed_at timestamptz,
  payment_id uuid references public.payments (id),
  created_at timestamptz not null default now()
);
create index on public.payment_slips (order_id);
create index on public.payment_slips (status) where status = 'pending';
create index on public.payment_slips (payment_id);

alter table public.payment_slips enable row level security;
create policy "slips: staff read" on public.payment_slips for select to authenticated
  using ((select public.is_staff()));
revoke all on public.payment_slips from anon;
revoke insert, update, truncate on public.payment_slips from authenticated;

create trigger audit after insert or update on public.payment_slips
  for each row execute function public.tg_audit();

-- ---------------------------------------------------------------------
-- Private bucket for slips (only staff can view; customers can only upload
-- into the folder of an order that is still waiting for payment)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-slips', 'payment-slips', false, 5242880, array['image/jpeg','image/png','image/webp','image/heic','application/pdf'])
on conflict (id) do nothing;

create or replace function public.slip_upload_allowed(p_path text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.orders o
     where o.order_no = split_part(p_path, '/', 1)
       and o.status in ('received', 'pending_payment', 'shipping', 'delivered')
       and o.paid_amount - o.refunded_amount < o.total
  ) and (select count(*) from public.payment_slips s join public.orders o on o.id = s.order_id
          where o.order_no = split_part(p_path, '/', 1)) < 10
$$;

create policy "slips: customer upload" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'payment-slips' and public.slip_upload_allowed(name));
create policy "slips: staff view" on storage.objects for select to authenticated
  using (bucket_id = 'payment-slips' and (select public.is_staff()));

-- ---------------------------------------------------------------------
-- Customer submits a slip (order number + phone, like order tracking)
-- ---------------------------------------------------------------------
create or replace function public.submit_slip(
  p_order_no text, p_phone text, p_file_path text, p_amount numeric default null, p_note text default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_o record;
  v_id uuid;
begin
  select o.* into v_o
    from public.orders o join public.customers c on c.id = o.customer_id
   where o.order_no = upper(btrim(p_order_no))
     and char_length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) >= 6
     and (c.phone_norm = regexp_replace(p_phone, '\D', '', 'g')
          or regexp_replace(coalesce(o.ship_phone, ''), '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g'))
   for update of o;
  if not found then
    raise exception 'ບໍ່ພົບຄຳສັ່ງຊື້ / ไม่พบคำสั่งซื้อ / Order not found';
  end if;
  if v_o.status in ('cancelled', 'refunded') or v_o.paid_amount - v_o.refunded_amount >= v_o.total then
    raise exception 'ຄຳສັ່ງຊື້ນີ້ບໍ່ຕ້ອງຊຳລະແລ້ວ / คำสั่งซื้อนี้ไม่ต้องชำระแล้ว / Nothing to pay on this order';
  end if;
  if split_part(p_file_path, '/', 1) <> v_o.order_no then
    raise exception 'Invalid file';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'payment-slips' and name = p_file_path) then
    raise exception 'ອັບໂຫຼດສະລິບບໍ່ສຳເລັດ / อัปโหลดสลิปไม่สำเร็จ / Slip upload not found';
  end if;
  if (select count(*) from public.payment_slips where order_id = v_o.id) >= 10 then
    raise exception 'Too many slips for this order';
  end if;

  insert into public.payment_slips (order_id, file_path, amount, note)
  values (v_o.id, p_file_path, nullif(p_amount, 0), left(nullif(btrim(p_note), ''), 500))
  on conflict (file_path) do nothing
  returning id into v_id;

  perform public.order_event(v_o.id, 'note', null, null, 'ລູກຄ້າສົ່ງສະລິບ / ลูกค้าส่งสลิปการโอน',
    jsonb_build_object('slip_id', v_id, 'amount', p_amount));

  if v_o.status = 'received' then
    update public.orders set status = 'pending_payment' where id = v_o.id;
    perform public.order_event(v_o.id, 'status', 'received', 'pending_payment', 'auto: slip received');
  end if;

  return jsonb_build_object('slip_id', v_id);
end $$;

-- ---------------------------------------------------------------------
-- Staff approves (records the payment) or rejects a slip
-- ---------------------------------------------------------------------
create or replace function public.review_slip(
  p_slip_id uuid, p_approve boolean, p_amount numeric default null, p_method text default 'bank_transfer', p_note text default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_s record;
  v_o record;
  v_amount numeric;
  v_pay jsonb;
  v_payment_id uuid;
begin
  if not public.is_staff() then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;
  select * into v_s from public.payment_slips where id = p_slip_id for update;
  if not found then raise exception 'Slip not found'; end if;
  if v_s.status <> 'pending' then raise exception 'Slip already %', v_s.status; end if;

  if p_approve then
    select * into v_o from public.orders where id = v_s.order_id;
    v_amount := coalesce(p_amount, v_s.amount, v_o.total - (v_o.paid_amount - v_o.refunded_amount));
    v_pay := public.record_payment(v_s.order_id, v_amount, coalesce(p_method, 'bank_transfer'),
                                   'SLIP-' || left(v_s.id::text, 8), coalesce(p_note, 'ຢືນຢັນຈາກສະລິບ / ยืนยันจากสลิป'));
    select id into v_payment_id from public.payments
     where order_id = v_s.order_id and kind = 'payment' and reference = 'SLIP-' || left(v_s.id::text, 8);
    update public.payment_slips
       set status = 'approved', payment_id = v_payment_id, reviewed_by = auth.uid(), reviewed_at = now(),
           review_note = left(nullif(btrim(p_note), ''), 500)
     where id = p_slip_id;
    return jsonb_build_object('status', 'approved', 'order', v_pay);
  else
    if nullif(btrim(p_note), '') is null then
      raise exception 'ກະລຸນາບອກເຫດຜົນ / กรุณาระบุเหตุผลที่ปฏิเสธ';
    end if;
    update public.payment_slips
       set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_note = left(btrim(p_note), 500)
     where id = p_slip_id;
    perform public.order_event(v_s.order_id, 'note', null, null, 'ປະຕິເສດສະລິບ / ปฏิเสธสลิป: ' || btrim(p_note), jsonb_build_object('slip_id', p_slip_id));
    return jsonb_build_object('status', 'rejected');
  end if;
end $$;

-- Order tracking now also returns the customer's slips (status only, never the file)
create or replace function public.track_order(p_order_no text, p_phone text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'order_no', o.order_no, 'status', o.status, 'created_at', o.created_at,
    'subtotal', o.subtotal, 'discount', o.discount, 'shipping_fee', o.shipping_fee, 'total', o.total,
    'paid', o.paid_amount - o.refunded_amount,
    'items', (select jsonb_agg(jsonb_build_object('name', i.product_name, 'qty', i.qty, 'unit_price', i.unit_price, 'line_total', i.line_total))
                from public.order_items i where i.order_id = o.id and i.qty > 0),
    'history', (select jsonb_agg(jsonb_build_object('status', e.to_status, 'at', e.created_at) order by e.created_at)
                  from public.order_events e where e.order_id = o.id and e.to_status is not null),
    'slips', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'status', s.status, 'amount', s.amount,
                       'created_at', s.created_at, 'review_note', s.review_note) order by s.created_at), '[]'::jsonb)
                from public.payment_slips s where s.order_id = o.id))
  from public.orders o
  join public.customers c on c.id = o.customer_id
  where o.order_no = upper(btrim(p_order_no))
    and char_length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) >= 6
    and (c.phone_norm = regexp_replace(p_phone, '\D', '', 'g')
         or regexp_replace(coalesce(o.ship_phone, ''), '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g'))
$$;

revoke execute on function public.slip_upload_allowed(text) from public;
grant execute on function public.slip_upload_allowed(text) to anon, authenticated;
grant execute on function public.submit_slip(text, text, text, numeric, text) to anon, authenticated;
grant execute on function public.review_slip(uuid, boolean, numeric, text, text) to authenticated;
grant execute on function public.track_order(text, text) to anon, authenticated;
