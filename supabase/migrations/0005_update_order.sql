-- Order lines are never deleted: a removed line is kept with qty 0 so history stays intact.
alter table public.order_items drop constraint order_items_qty_check;
alter table public.order_items add constraint order_items_qty_check check (qty >= 0 and qty <= 100000);
create unique index order_items_order_product_key on public.order_items (order_id, product_id);

-- Edit an order (lines while unpaid; fees / shipping / notes any time)
-- p_changes: {items:[{product_id,qty,unit_price?}], discount, shipping_fee,
--             ship_name, ship_phone, ship_address, internal_note}
create or replace function public.update_order(
  p_order_id uuid, p_changes jsonb, p_reason text default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_o record;
  v_before jsonb;
  v_after jsonb;
  r record;
  v_line record;
  v_prod record;
  v_ctype public.customer_type;
  v_price numeric;
  v_is_ws boolean;
  v_items jsonb := p_changes -> 'items';
  v_total numeric;
begin
  if not public.is_staff() then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;
  select * into v_o from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_o.status in ('cancelled', 'refunded') and (p_changes - 'internal_note') <> '{}'::jsonb then
    raise exception 'Order is % — only the internal note can change', v_o.status;
  end if;

  v_before := jsonb_build_object(
    'subtotal', v_o.subtotal, 'discount', v_o.discount, 'shipping_fee', v_o.shipping_fee, 'total', v_o.total,
    'items', (select jsonb_agg(jsonb_build_object('product_id', product_id, 'name', product_name, 'qty', qty, 'unit_price', unit_price) order by product_name)
                from public.order_items where order_id = p_order_id and qty > 0));

  if v_items is not null then
    if v_o.status not in ('received', 'pending_payment') then
      raise exception 'ແກ້ລາຍການສິນຄ້າໄດ້ສະເພາະກ່ອນຊຳລະ / แก้ไขรายการสินค้าได้เฉพาะก่อนชำระเงิน';
    end if;
    if jsonb_typeof(v_items) <> 'array'
       or coalesce((select sum((e ->> 'qty')::int) from jsonb_array_elements(v_items) e), 0) <= 0 then
      raise exception 'Order must have at least one item';
    end if;
    select type into v_ctype from public.customers where id = v_o.customer_id;

    for r in
      select coalesce(o.product_id, n.product_id) as product_id,
             coalesce(o.qty, 0) as old_qty, coalesce(n.qty, 0) as new_qty, n.unit_price
        from (select product_id, qty from public.order_items where order_id = p_order_id) o
        full join (select (e ->> 'product_id')::uuid as product_id, sum((e ->> 'qty')::int)::int as qty,
                          max((e ->> 'unit_price')::numeric) as unit_price
                     from jsonb_array_elements(v_items) e group by 1) n
          on o.product_id = n.product_id
       order by 1
    loop
      if r.new_qty < 0 or r.new_qty > 100000 then raise exception 'Invalid quantity'; end if;

      select * into v_line from public.order_items where order_id = p_order_id and product_id = r.product_id;

      if r.new_qty > 0 then
        select * into v_prod from public.products where id = r.product_id;
        if not found or v_prod.deleted_at is not null then
          raise exception 'Product unavailable';
        end if;
        v_is_ws := v_prod.price_wholesale is not null and (v_ctype = 'wholesale' or r.new_qty >= v_prod.wholesale_min_qty);
        v_price := case when v_is_ws then v_prod.price_wholesale else v_prod.price_retail end;
        if r.unit_price is not null then
          if r.unit_price < 0 then raise exception 'Invalid price'; end if;
          v_price := r.unit_price;
        elsif v_line.id is not null and v_line.qty > 0 and v_line.is_wholesale_price = v_is_ws then
          -- same price tier as before: keep the previously agreed price
          v_price := v_line.unit_price;
        end if;
      end if;

      if r.old_qty <> r.new_qty then
        perform public.apply_stock(r.product_id, r.old_qty - r.new_qty, 'order_edit', p_order_id, v_o.order_no);
      end if;

      if v_line.id is not null then
        if r.new_qty = 0 then
          update public.order_items set qty = 0 where id = v_line.id and qty <> 0;
        else
          update public.order_items
             set qty = r.new_qty, unit_price = v_price, is_wholesale_price = v_is_ws
           where id = v_line.id;
        end if;
      elsif r.new_qty > 0 then
        insert into public.order_items (order_id, product_id, product_name, sku, qty, unit_price, unit_cost, is_wholesale_price)
        values (p_order_id, v_prod.id, v_prod.name_lo, v_prod.sku, r.new_qty, v_price,
                v_prod.unit_cost + v_prod.packaging_cost, v_is_ws);
      end if;
    end loop;
  end if;

  perform set_config('app.audit_note', coalesce('edit: ' || nullif(btrim(p_reason), ''), 'edit'), true);
  update public.orders set
    subtotal = (select coalesce(sum(line_total), 0) from public.order_items where order_id = p_order_id),
    is_wholesale = exists (select 1 from public.order_items where order_id = p_order_id and qty > 0 and is_wholesale_price),
    discount = coalesce((p_changes ->> 'discount')::numeric, discount),
    shipping_fee = coalesce((p_changes ->> 'shipping_fee')::numeric, shipping_fee),
    ship_name = case when p_changes ? 'ship_name' then nullif(btrim(p_changes ->> 'ship_name'), '') else ship_name end,
    ship_phone = case when p_changes ? 'ship_phone' then nullif(btrim(p_changes ->> 'ship_phone'), '') else ship_phone end,
    ship_address = case when p_changes ? 'ship_address' then nullif(btrim(p_changes ->> 'ship_address'), '') else ship_address end,
    internal_note = case when p_changes ? 'internal_note' then nullif(btrim(p_changes ->> 'internal_note'), '') else internal_note end
  where id = p_order_id
  returning total into v_total;
  perform set_config('app.audit_note', '', true);

  if v_total < v_o.paid_amount - v_o.refunded_amount then
    raise exception 'ຍອດໃໝ່ຕ່ຳກວ່າທີ່ຈ່າຍແລ້ວ — ຄືນເງິນກ່ອນ / ยอดใหม่ต่ำกว่าที่ชำระแล้ว — ต้องคืนเงินก่อน';
  end if;

  select jsonb_build_object(
    'subtotal', o.subtotal, 'discount', o.discount, 'shipping_fee', o.shipping_fee, 'total', o.total,
    'items', (select jsonb_agg(jsonb_build_object('product_id', product_id, 'name', product_name, 'qty', qty, 'unit_price', unit_price) order by product_name)
                from public.order_items where order_id = p_order_id and qty > 0))
    into v_after from public.orders o where o.id = p_order_id;

  perform public.order_event(p_order_id, 'edit', null, null, p_reason,
    jsonb_build_object('before', v_before, 'after', v_after));

  return v_after;
end $$;

grant execute on function public.update_order(uuid, jsonb, text) to authenticated;
