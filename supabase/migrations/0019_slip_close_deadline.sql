-- 1. Close a pending slip on an order that is already fully paid (payment was recorded by hand)
create or replace function public.close_paid_slip(p_slip_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_s record; v_o record;
begin
  if not public.can('orders') then raise exception 'Not allowed' using errcode = 'insufficient_privilege'; end if;
  select * into v_s from public.payment_slips where id = p_slip_id for update;
  if not found then raise exception 'Slip not found'; end if;
  if v_s.status <> 'pending' then raise exception 'Slip already %', v_s.status; end if;
  select * into v_o from public.orders where id = v_s.order_id;
  if v_o.paid_amount - v_o.refunded_amount < v_o.total then
    raise exception 'ออเดอร์ยังชำระไม่ครบ — ใช้ปุ่ม "ยืนยันยอดเงิน" แทน';
  end if;
  update public.payment_slips
     set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(),
         review_note = 'ຊຳລະຄົບແລ້ວ / ชำระครบแล้ว (บันทึกการชำระแยก)'
   where id = p_slip_id;
  perform public.order_event(v_s.order_id, 'note', null, null, 'ปิดสลิป — ออเดอร์ชำระครบแล้ว', jsonb_build_object('slip_id', p_slip_id));
end $$;
revoke all on function public.close_paid_slip(uuid) from public, anon;
grant execute on function public.close_paid_slip(uuid) to authenticated;

-- 2. track_order: tell the customer when an unpaid order will be auto-cancelled
create or replace function public.track_order(p_order_no text, p_phone text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'order_no', o.order_no, 'status', o.status, 'created_at', o.created_at,
    'subtotal', o.subtotal, 'discount', o.discount, 'shipping_fee', o.shipping_fee, 'total', o.total,
    'paid', o.paid_amount - o.refunded_amount,
    'auto_cancel_at', case when o.user_id is not null and public.auto_cancel_days() > 0
                             and o.status in ('received', 'pending_payment') and o.paid_amount - o.refunded_amount = 0
                           then o.created_at + make_interval(days => public.auto_cancel_days()) end,
    'ship_name', o.ship_name, 'ship_phone', o.ship_phone, 'ship_address', o.ship_address,
    'items', (select jsonb_agg(jsonb_build_object('name', i.product_name, 'qty', i.qty, 'unit_price', i.unit_price, 'line_total', i.line_total))
                from public.order_items i where i.order_id = o.id and i.qty > 0),
    'history', (select jsonb_agg(jsonb_build_object('status', e.to_status, 'at', e.created_at) order by e.created_at)
                  from public.order_events e where e.order_id = o.id and e.to_status is not null),
    'slips', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'status', s.status, 'amount', s.amount,
                       'created_at', s.created_at, 'review_note', s.review_note) order by s.created_at), '[]'::jsonb)
                from public.payment_slips s where s.order_id = o.id),
    'payments', (select coalesce(jsonb_agg(jsonb_build_object('kind', p.kind, 'amount', p.amount, 'method', p.method, 'paid_at', p.paid_at) order by p.paid_at), '[]'::jsonb)
                   from public.payments p where p.order_id = o.id),
    'shipments', (select coalesce(jsonb_agg(jsonb_build_object('id', sh.id, 'carrier', sh.carrier, 'carrier_name', sh.carrier_name,
                       'tracking_no', sh.tracking_no, 'branch', sh.branch, 'branch_phone', sh.branch_phone, 'files', sh.files,
                       'note', sh.note, 'shipped_at', sh.shipped_at) order by sh.shipped_at), '[]'::jsonb)
                    from public.order_shipments sh where sh.order_id = o.id))
  from public.orders o
  join public.customers c on c.id = o.customer_id
  where o.order_no = upper(btrim(p_order_no))
    and char_length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) >= 6
    and (c.phone_norm = regexp_replace(p_phone, '\D', '', 'g')
         or regexp_replace(coalesce(o.ship_phone, ''), '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g'))
$$;
grant execute on function public.track_order(text, text) to anon, authenticated;
