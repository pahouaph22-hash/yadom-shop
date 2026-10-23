-- =====================================================================
-- Orders, payments, refunds, contact form — all writes go through these
-- SECURITY DEFINER functions so totals, stock and history stay consistent.
-- =====================================================================

create or replace function public.order_event(
  p_order_id uuid, p_event text, p_from public.order_status, p_to public.order_status,
  p_note text default null, p_data jsonb default null
) returns void
language sql security definer set search_path = ''
as $$
  insert into public.order_events (order_id, event, from_status, to_status, note, data, actor_id, actor_email)
  values (p_order_id, p_event, p_from, p_to, left(p_note, 1000), p_data, auth.uid(),
          (select email from auth.users where id = auth.uid()));
$$;

-- Restock every line of an order (cancel / full refund with return)
create or replace function public.restock_order(p_order_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare r record; v_no text;
begin
  select order_no into v_no from public.orders where id = p_order_id;
  for r in
    select product_id, sum(qty)::int as qty from public.order_items
     where order_id = p_order_id group by product_id order by product_id
  loop
    perform public.apply_stock(r.product_id, r.qty, p_reason, p_order_id, v_no);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- place_order: storefront checkout AND staff manual sales
-- ---------------------------------------------------------------------
create or replace function public.place_order(
  p_customer jsonb,
  p_items jsonb,
  p_idempotency_key text,
  p_note text default null,
  p_options jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_staff boolean := public.is_staff();
  v_opts jsonb := coalesce(p_options, '{}'::jsonb);
  v_existing record;
  v_cust record;
  v_customer_id uuid;
  v_ctype public.customer_type;
  v_name text := nullif(btrim(p_customer ->> 'name'), '');
  v_phone text := nullif(btrim(p_customer ->> 'phone'), '');
  v_email text := nullif(lower(btrim(p_customer ->> 'email')), '');
  v_address text := nullif(btrim(p_customer ->> 'address'), '');
  v_province text := nullif(btrim(p_customer ->> 'province'), '');
  v_order_id uuid;
  v_order_no text;
  v_subtotal numeric := 0;
  v_any_ws boolean := false;
  v_item record;
  v_prod record;
  v_price numeric;
  v_is_ws boolean;
  v_channel text := 'web';
  v_discount numeric := 0;
  v_shipping numeric := 0;
  v_status public.order_status := 'received';
  v_total numeric;
  v_pay jsonb;
  v_pay_amount numeric;
begin
  if p_idempotency_key is null or char_length(p_idempotency_key) < 8 then
    raise exception 'Missing idempotency key';
  end if;

  -- Same submit twice (double click, network retry) => return the first order
  select id, order_no, total into v_existing from public.orders where idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('order_id', v_existing.id, 'order_no', v_existing.order_no,
                              'total', v_existing.total, 'duplicate', true);
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'ກະຕ່າວ່າງ / ตะกร้าว่าง / Cart is empty';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'Too many lines in one order';
  end if;

  if v_staff then
    v_channel := coalesce(nullif(v_opts ->> 'channel', ''), 'shop');
    v_discount := coalesce((v_opts ->> 'discount')::numeric, 0);
    v_shipping := coalesce((v_opts ->> 'shipping_fee')::numeric, 0);
    v_status := coalesce(nullif(v_opts ->> 'status', '')::public.order_status, 'received');
    if v_status not in ('received', 'pending_payment', 'paid') then
      raise exception 'Invalid initial status';
    end if;
    if v_discount < 0 or v_shipping < 0 then
      raise exception 'Discount / shipping cannot be negative';
    end if;
  end if;

  -- ---- customer ----
  if v_staff and nullif(v_opts ->> 'customer_id', '') is not null then
    select * into v_cust from public.customers where id = (v_opts ->> 'customer_id')::uuid;
    if not found then
      raise exception 'Customer not found';
    end if;
    v_customer_id := v_cust.id;
    v_ctype := v_cust.type;
    v_name := coalesce(v_name, v_cust.name);
    v_phone := coalesce(v_phone, v_cust.phone);
    v_address := coalesce(v_address, v_cust.address);
  else
    if v_name is null or char_length(v_name) > 120 then
      raise exception 'ກະລຸນາໃສ່ຊື່ / กรุณาใส่ชื่อ / Name is required';
    end if;
    if v_phone is null or char_length(regexp_replace(v_phone, '\D', '', 'g')) not between 6 and 15 then
      raise exception 'ເບີໂທບໍ່ຖືກຕ້ອງ / เบอร์โทรไม่ถูกต้อง / Invalid phone number';
    end if;
    if v_channel = 'web' and (v_address is null or char_length(v_address) < 5) then
      raise exception 'ກະລຸນາໃສ່ທີ່ຢູ່ຈັດສົ່ງ / กรุณาใส่ที่อยู่จัดส่ง / Shipping address is required';
    end if;
    if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      raise exception 'Invalid email';
    end if;

    select * into v_cust from public.customers
     where phone_norm = regexp_replace(v_phone, '\D', '', 'g') for update;
    if not found then
      insert into public.customers (name, phone, email, address, province)
      values (v_name, v_phone, v_email, v_address, v_province)
      returning id, type into v_customer_id, v_ctype;
    else
      v_customer_id := v_cust.id;
      v_ctype := v_cust.type;
      -- fill in blanks only; never overwrite existing data from a public form
      if v_cust.address is null and v_address is not null
         or v_cust.email is null and v_email is not null
         or v_cust.province is null and v_province is not null then
        update public.customers
           set address = coalesce(address, v_address),
               email = coalesce(email, v_email),
               province = coalesce(province, v_province)
         where id = v_customer_id;
      end if;
    end if;
  end if;

  -- ---- order header ----
  insert into public.orders (
    customer_id, user_id, status, channel, ship_name, ship_phone, ship_address,
    payment_method_pref, customer_note, internal_note, idempotency_key, created_by
  ) values (
    v_customer_id,
    case when v_staff then null else auth.uid() end,
    v_status, v_channel, v_name, v_phone,
    concat_ws(', ', v_address, v_province),
    left(nullif(btrim(coalesce(p_customer ->> 'payment_method', v_opts ->> 'payment_method_pref')), ''), 40),
    left(nullif(btrim(p_note), ''), 1000),
    case when v_staff then left(nullif(btrim(v_opts ->> 'internal_note'), ''), 2000) end,
    p_idempotency_key, auth.uid()
  ) returning id, order_no into v_order_id, v_order_no;

  -- ---- lines ----
  for v_item in
    select (e ->> 'product_id')::uuid as product_id,
           sum((e ->> 'qty')::int)::int as qty,
           max((e ->> 'unit_price')::numeric) as unit_price
      from jsonb_array_elements(p_items) e
     group by 1 order by 1
  loop
    if v_item.qty is null or v_item.qty < 1 or v_item.qty > 100000 then
      raise exception 'Invalid quantity';
    end if;

    select * into v_prod from public.products where id = v_item.product_id;
    if not found or v_prod.deleted_at is not null or (not v_prod.is_active and not v_staff) then
      raise exception 'ສິນຄ້ານີ້ບໍ່ມີຂາຍແລ້ວ / สินค้านี้ไม่มีจำหน่ายแล้ว / Product unavailable';
    end if;

    v_is_ws := v_prod.price_wholesale is not null
               and (v_ctype = 'wholesale' or v_item.qty >= v_prod.wholesale_min_qty);
    v_price := case when v_is_ws then v_prod.price_wholesale else v_prod.price_retail end;
    if v_staff and v_item.unit_price is not null then
      if v_item.unit_price < 0 then raise exception 'Invalid price'; end if;
      v_price := v_item.unit_price;
    end if;
    v_any_ws := v_any_ws or v_is_ws;

    perform public.apply_stock(v_prod.id, -v_item.qty, 'order', v_order_id, v_order_no);

    insert into public.order_items (order_id, product_id, product_name, sku, qty, unit_price, unit_cost, is_wholesale_price)
    values (v_order_id, v_prod.id, v_prod.name_lo, v_prod.sku, v_item.qty, v_price,
            v_prod.unit_cost + v_prod.packaging_cost, v_is_ws);

    v_subtotal := v_subtotal + v_item.qty * v_price;
  end loop;

  if v_discount > v_subtotal then
    raise exception 'Discount is larger than subtotal';
  end if;

  update public.orders
     set subtotal = v_subtotal, discount = v_discount, shipping_fee = v_shipping, is_wholesale = v_any_ws
   where id = v_order_id
  returning total into v_total;

  perform public.order_event(v_order_id, 'created', null, v_status, null,
    jsonb_build_object('channel', v_channel, 'total', v_total));

  -- staff sale paid on the spot
  if v_staff and v_status = 'paid' then
    v_pay := coalesce(v_opts -> 'payment', '{}'::jsonb);
    v_pay_amount := coalesce((v_pay ->> 'amount')::numeric, v_total);
    if v_pay_amount > 0 then
      insert into public.payments (order_id, kind, amount, method, reference, actor_id)
      values (v_order_id, 'payment', v_pay_amount, coalesce(nullif(v_pay ->> 'method', ''), 'cash'),
              nullif(v_pay ->> 'reference', ''), auth.uid());
      update public.orders set paid_amount = v_pay_amount where id = v_order_id;
      perform public.order_event(v_order_id, 'payment', null, null, null,
        jsonb_build_object('amount', v_pay_amount, 'method', coalesce(nullif(v_pay ->> 'method', ''), 'cash')));
    end if;
  end if;

  return jsonb_build_object('order_id', v_order_id, 'order_no', v_order_no, 'total', v_total, 'duplicate', false);
end $$;

-- ---------------------------------------------------------------------
-- Status changes
-- ---------------------------------------------------------------------
create or replace function public.update_order_status(
  p_order_id uuid, p_status public.order_status, p_note text default null
) returns public.order_status
language plpgsql security definer set search_path = ''
as $$
declare
  v_o record;
  v_net_paid numeric;
  v_allowed public.order_status[];
  v_delivered int;
begin
  if not public.is_staff() then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;

  select * into v_o from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_o.status = p_status then return p_status; end if;

  v_allowed := case v_o.status
    when 'received'        then array['pending_payment','paid','shipping','delivered','cancelled']
    when 'pending_payment' then array['received','paid','shipping','delivered','cancelled']
    when 'paid'            then array['shipping','delivered']
    when 'shipping'        then array['delivered','paid','cancelled']
    when 'delivered'       then array['shipping']
    else array[]::text[]
  end::public.order_status[];

  if not (p_status = any (v_allowed)) then
    raise exception 'ປ່ຽນສະຖານະຈາກ % ເປັນ % ບໍ່ໄດ້ / Cannot change status from % to %', v_o.status, p_status, v_o.status, p_status;
  end if;
  if p_status = 'refunded' then
    raise exception 'Use record_refund to refund an order';
  end if;

  v_net_paid := v_o.paid_amount - v_o.refunded_amount;

  if p_status = 'paid' and v_net_paid < v_o.total then
    raise exception 'ຍັງຈ່າຍບໍ່ຄົບ — ບັນທຶກການຊຳລະກ່ອນ / ยังชำระไม่ครบ — บันทึกการชำระเงินก่อน (paid % of %)', v_net_paid, v_o.total;
  end if;

  if p_status = 'cancelled' then
    if v_net_paid > 0 then
      raise exception 'ມີການຊຳລະແລ້ວ — ໃຫ້ຄືນເງິນກ່ອນ / มีการชำระแล้ว — ต้องคืนเงินก่อนยกเลิก';
    end if;
    perform public.restock_order(p_order_id, 'cancel');
  end if;

  update public.orders set status = p_status where id = p_order_id;
  perform public.order_event(p_order_id, 'status', v_o.status, p_status, p_note);

  -- loyal customers become "regular" automatically after 3 delivered orders
  if p_status = 'delivered' then
    select count(*) into v_delivered from public.orders
     where customer_id = v_o.customer_id and status = 'delivered';
    if v_delivered >= 3 then
      perform set_config('app.audit_note', 'auto: 3+ delivered orders', true);
      update public.customers set type = 'regular' where id = v_o.customer_id and type = 'retail';
      perform set_config('app.audit_note', '', true);
    end if;
  end if;

  return p_status;
end $$;

-- ---------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------
create or replace function public.record_payment(
  p_order_id uuid, p_amount numeric, p_method text,
  p_reference text default null, p_note text default null, p_paid_at timestamptz default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_o record;
  v_paid numeric;
  v_status public.order_status;
begin
  if not public.is_staff() then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;
  select * into v_o from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_o.status in ('cancelled', 'refunded') then
    raise exception 'Order is %', v_o.status;
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;
  if v_o.paid_amount - v_o.refunded_amount + p_amount > v_o.total then
    raise exception 'ຍອດເກີນ / ยอดเกินยอดคำสั่งซื้อ (outstanding %)', v_o.total - (v_o.paid_amount - v_o.refunded_amount);
  end if;

  begin
    insert into public.payments (order_id, kind, amount, method, reference, note, paid_at, actor_id)
    values (p_order_id, 'payment', p_amount, p_method, nullif(btrim(p_reference), ''), nullif(btrim(p_note), ''),
            coalesce(p_paid_at, now()), auth.uid());
  exception when unique_violation then
    raise exception 'ເລກອ້າງອີງນີ້ບັນທຶກແລ້ວ / เลขอ้างอิงนี้ถูกบันทึกแล้ว (duplicate reference)';
  end;

  update public.orders set paid_amount = paid_amount + p_amount where id = p_order_id
  returning paid_amount, status into v_paid, v_status;

  perform public.order_event(p_order_id, 'payment', null, null, p_note,
    jsonb_build_object('amount', p_amount, 'method', p_method, 'reference', p_reference));

  if v_paid - v_o.refunded_amount >= v_o.total and v_status in ('received', 'pending_payment') then
    update public.orders set status = 'paid' where id = p_order_id;
    perform public.order_event(p_order_id, 'status', v_status, 'paid', 'auto: fully paid');
    v_status := 'paid';
  end if;

  return jsonb_build_object('paid_amount', v_paid, 'status', v_status);
end $$;

create or replace function public.record_refund(
  p_order_id uuid, p_amount numeric, p_method text, p_reason text, p_restock boolean default false,
  p_reference text default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_o record;
  v_refunded numeric;
  v_status public.order_status;
begin
  if not public.is_admin() then
    raise exception 'Only admins can refund' using errcode = 'insufficient_privilege';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception 'Reason is required';
  end if;
  select * into v_o from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;
  if p_amount > v_o.paid_amount - v_o.refunded_amount then
    raise exception 'Refund larger than amount paid (max %)', v_o.paid_amount - v_o.refunded_amount;
  end if;

  begin
    insert into public.payments (order_id, kind, amount, method, reference, note, actor_id)
    values (p_order_id, 'refund', p_amount, p_method, nullif(btrim(p_reference), ''), p_reason, auth.uid());
  exception when unique_violation then
    raise exception 'Duplicate refund reference';
  end;

  update public.orders set refunded_amount = refunded_amount + p_amount where id = p_order_id
  returning refunded_amount, status into v_refunded, v_status;

  perform public.order_event(p_order_id, 'refund', null, null, p_reason,
    jsonb_build_object('amount', p_amount, 'method', p_method, 'restock', p_restock));

  if v_refunded >= v_o.paid_amount then
    if p_restock and v_o.status <> 'cancelled' then
      perform public.restock_order(p_order_id, 'return');
    end if;
    update public.orders set status = 'refunded' where id = p_order_id;
    perform public.order_event(p_order_id, 'status', v_status, 'refunded', p_reason);
    v_status := 'refunded';
  end if;

  return jsonb_build_object('refunded_amount', v_refunded, 'status', v_status);
end $$;

-- update_order(): see 0005_update_order.sql

-- ---------------------------------------------------------------------
-- Public order tracking (order no + phone)
-- ---------------------------------------------------------------------
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
                  from public.order_events e where e.order_id = o.id and e.to_status is not null))
  from public.orders o
  join public.customers c on c.id = o.customer_id
  where o.order_no = upper(btrim(p_order_no))
    and char_length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) >= 6
    and (c.phone_norm = regexp_replace(p_phone, '\D', '', 'g')
         or regexp_replace(coalesce(o.ship_phone, ''), '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g'))
$$;

-- ---------------------------------------------------------------------
-- Contact form
-- ---------------------------------------------------------------------
create or replace function public.submit_contact(
  p_name text, p_phone text, p_email text, p_subject text, p_message text
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if nullif(btrim(p_name), '') is null or nullif(btrim(p_message), '') is null then
    raise exception 'Name and message are required';
  end if;
  if nullif(btrim(p_phone), '') is null and nullif(btrim(p_email), '') is null then
    raise exception 'ກະລຸນາໃສ່ເບີໂທ ຫຼື ອີເມວ / กรุณาใส่เบอร์โทรหรืออีเมล';
  end if;
  -- ignore an identical message sent again within 10 minutes
  select id into v_id from public.contact_messages
   where message = btrim(p_message) and coalesce(phone, '') = coalesce(btrim(p_phone), '')
     and created_at > now() - interval '10 minutes'
   limit 1;
  if found then return v_id; end if;
  -- simple flood guard
  if (select count(*) from public.contact_messages where created_at > now() - interval '1 minute') > 20 then
    raise exception 'Too many messages, please try again shortly';
  end if;

  insert into public.contact_messages (name, phone, email, subject, message)
  values (left(btrim(p_name), 120), left(nullif(btrim(p_phone), ''), 30), left(nullif(lower(btrim(p_email)), ''), 160),
          left(nullif(btrim(p_subject), ''), 160), left(btrim(p_message), 4000))
  returning id into v_id;
  return v_id;
end $$;

-- Public catalogue (never exposes cost columns)
create or replace function public.shop_products()
returns table (
  id uuid, sku text, name_lo text, name_th text, name_en text,
  description_lo text, description_th text, description_en text,
  size_label text, images text[], price_retail numeric, price_wholesale numeric,
  wholesale_min_qty integer, stock integer, sort integer
)
language sql stable security definer set search_path = ''
as $$
  select id, sku, name_lo, name_th, name_en, description_lo, description_th, description_en,
         size_label, images, price_retail, price_wholesale, wholesale_min_qty, stock, sort
    from public.products
   where is_active and deleted_at is null
   order by sort, created_at
$$;

-- Admin: change a user's role by email
create or replace function public.set_user_role(p_email text, p_role public.app_role)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins' using errcode = 'insufficient_privilege';
  end if;
  update public.profiles set role = p_role where email = lower(btrim(p_email));
  if not found then
    raise exception 'ບໍ່ພົບຜູ້ໃຊ້ — ໃຫ້ລົງທະບຽນກ່ອນ / ไม่พบผู้ใช้ — ให้สมัครสมาชิกก่อน';
  end if;
end $$;
