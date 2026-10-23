-- =====================================================================
-- Members can cancel their own unpaid orders.
-- Allowed only while: status received / pending_payment, nothing paid,
-- and no slip waiting for review. Stock goes back, the timeline and audit
-- record who cancelled and why, and the shop gets a Telegram message.
-- =====================================================================

create or replace function public.order_cancellable_by_member(p_order_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.orders o
     where o.id = p_order_id
       and o.status in ('received', 'pending_payment')
       and o.paid_amount - o.refunded_amount = 0
       and not exists (select 1 from public.payment_slips s where s.order_id = o.id and s.status = 'pending')
  )
$$;
revoke all on function public.order_cancellable_by_member(uuid) from public, anon, authenticated;

create or replace function public.cancel_my_order(p_order_no text, p_reason text default null)
returns public.order_status
language plpgsql security definer set search_path = ''
as $$
declare
  v_o public.orders;
  v_reason text := nullif(left(trim(coalesce(p_reason, '')), 500), '');
begin
  if auth.uid() is null then
    raise exception 'ກະລຸນາເຂົ້າສູ່ລະບົບ / Please sign in' using errcode = 'insufficient_privilege';
  end if;

  select * into v_o from public.orders
   where order_no = upper(trim(p_order_no)) and user_id = auth.uid()
   for update;
  if not found then raise exception 'ບໍ່ພົບຄຳສັ່ງຊື້ / Order not found'; end if;
  if v_o.status = 'cancelled' then return v_o.status; end if;

  if v_o.status not in ('received', 'pending_payment') then
    raise exception 'ຄຳສັ່ງຊື້ນີ້ຍົກເລີກເອງບໍ່ໄດ້ແລ້ວ — ກະລຸນາຕິດຕໍ່ຮ້ານ / This order can no longer be cancelled online — please contact the shop';
  end if;
  if v_o.paid_amount - v_o.refunded_amount > 0 then
    raise exception 'ມີການຊຳລະແລ້ວ — ກະລຸນາຕິດຕໍ່ຮ້ານເພື່ອຂໍຄືນເງິນ / Payment already received — please contact the shop for a refund';
  end if;
  if exists (select 1 from public.payment_slips s where s.order_id = v_o.id and s.status = 'pending') then
    raise exception 'ສະລິບກຳລັງລໍຖ້າກວດສອບ — ກະລຸນາຕິດຕໍ່ຮ້ານ / A payment slip is waiting for review — please contact the shop';
  end if;

  perform set_config('app.audit_note', 'cancelled by customer' || coalesce(': ' || v_reason, ''), true);
  perform public.restock_order(v_o.id, 'cancel');
  update public.orders set status = 'cancelled' where id = v_o.id;
  perform public.order_event(v_o.id, 'status', v_o.status, 'cancelled',
                             'ລູກຄ້າຍົກເລີກເອງ / ลูกค้ายกเลิกเอง' || coalesce(': ' || v_reason, ''),
                             jsonb_build_object('by', 'customer', 'reason', v_reason));
  perform set_config('app.audit_note', '', true);

  perform public.tg_send(
    '❌ <b>ลูกค้ายกเลิกออเดอร์ ' || v_o.order_no || '</b>' || E'\n' ||
    '👤 ' || public.tg_escape(v_o.ship_name) || ' · ' || public.tg_escape(v_o.ship_phone) || E'\n' ||
    '💰 ' || public.tg_kip(v_o.total) || ' — คืนสต็อกแล้ว' ||
    coalesce(E'\n📝 เหตุผล: ' || public.tg_escape(v_reason), ''),
    'order');

  return 'cancelled';
end $$;
revoke all on function public.cancel_my_order(text, text) from public, anon;
grant execute on function public.cancel_my_order(text, text) to authenticated;

-- my_activity: add can_cancel per order
create or replace function public.my_activity()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'member', (select to_jsonb(c) - 'note' - 'type' - 'phone_verified_by' from public.customers c where c.user_id = auth.uid()),
    'orders', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', o.id, 'order_no', o.order_no, 'status', o.status, 'created_at', o.created_at,
                  'total', o.total, 'paid', o.paid_amount - o.refunded_amount, 'ship_phone', o.ship_phone,
                  'can_cancel', public.order_cancellable_by_member(o.id),
                  'items', (select coalesce(jsonb_agg(jsonb_build_object('name', i.product_name, 'qty', i.qty)), '[]'::jsonb)
                              from public.order_items i where i.order_id = o.id and i.qty > 0)
                ) order by o.created_at desc), '[]'::jsonb)
                 from public.orders o where o.user_id = auth.uid()),
    'transactions', (select coalesce(jsonb_agg(t.x order by t.at desc), '[]'::jsonb) from (
        select jsonb_build_object('kind', p.kind, 'amount', p.amount, 'method', p.method, 'at', p.paid_at,
                                  'order_no', o.order_no, 'ship_phone', o.ship_phone) as x, p.paid_at as at
          from public.payments p join public.orders o on o.id = p.order_id
         where o.user_id = auth.uid()
        union all
        select jsonb_build_object('kind', 'slip', 'status', s.status, 'amount', s.amount, 'at', s.created_at,
                                  'order_no', o.order_no, 'ship_phone', o.ship_phone, 'review_note', s.review_note), s.created_at
          from public.payment_slips s join public.orders o on o.id = s.order_id
         where o.user_id = auth.uid()
      ) t(x, at))
  )
  where auth.uid() is not null
$$;
revoke all on function public.my_activity() from public, anon;
grant execute on function public.my_activity() to authenticated;
