-- Ordering requires a signed-in member account (staff can still create orders for anyone)
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
  v_staff boolean := public.can('orders');
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
    v_channel := coalesce(nullif(v_opts ->> 'channel', ''), 'web');
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
  -- members only: shoppers must be signed in; their member record is the customer
  if not v_staff then
    if auth.uid() is null then
      raise exception 'ກະລຸນາເຂົ້າສູ່ລະບົບກ່ອນສັ່ງຊື້ / กรุณาเข้าสู่ระบบก่อนสั่งซื้อ / Please sign in to order'
        using errcode = 'insufficient_privilege';
    end if;
    v_opts := '{}'::jsonb;
    select id into v_customer_id from public.customers where user_id = auth.uid();
    if found then v_opts := jsonb_build_object('customer_id', v_customer_id::text); end if;
    v_customer_id := null;
  end if;

  if nullif(v_opts ->> 'customer_id', '') is not null then
    select * into v_cust from public.customers where id = (v_opts ->> 'customer_id')::uuid;
    if not found then
      raise exception 'Customer not found';
    end if;
    v_customer_id := v_cust.id;
    v_ctype := v_cust.type;
    v_name := coalesce(v_name, v_cust.name);
    v_phone := coalesce(v_phone, v_cust.phone);
    v_address := coalesce(v_address, v_cust.address);
    v_province := coalesce(v_province, v_cust.province);
    if not v_staff and (v_address is null or char_length(v_address) < 5) then
      raise exception 'ກະລຸນາໃສ່ທີ່ຢູ່ຈັດສົ່ງ / กรุณาใส่ที่อยู่จัดส่ง / Shipping address is required';
    end if;
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
      insert into public.customers (name, phone, email, address, province, user_id, member_since)
      values (v_name, v_phone, v_email, v_address, v_province,
              case when not v_staff then auth.uid() end, case when not v_staff then now() end)
      returning id, type into v_customer_id, v_ctype;
    else
      v_customer_id := v_cust.id;
      v_ctype := v_cust.type;
      if not v_staff and v_cust.user_id is null
         and not exists (select 1 from public.customers where user_id = auth.uid()) then
        update public.customers set user_id = auth.uid(), member_since = coalesce(member_since, now()) where id = v_cust.id;
      end if;
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


grant execute on function public.place_order(jsonb, jsonb, text, text, jsonb) to anon, authenticated;
