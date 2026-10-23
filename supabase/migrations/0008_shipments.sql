-- =====================================================================
-- Shipments: carrier, tracking number, pickup branch and waybill photos
-- (Anousith, HAL/Houng Aloun, Mixay, …) shown to the customer for pickup
-- =====================================================================

create table public.order_shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  carrier text not null check (carrier in ('anousith','hal','mixay','unitel','self','other')),
  carrier_name text check (char_length(carrier_name) <= 80),
  tracking_no text check (char_length(tracking_no) <= 80),
  branch text check (char_length(branch) <= 200),
  branch_phone text check (char_length(branch_phone) <= 40),
  files text[] not null default '{}',
  note text check (char_length(note) <= 500),
  shipped_at timestamptz not null default now(),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.order_shipments (order_id);

alter table public.order_shipments enable row level security;
create policy "shipments: staff read" on public.order_shipments for select to authenticated
  using ((select public.is_staff()) or exists (
    select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid())));
revoke all on public.order_shipments from anon;
revoke insert, update, truncate on public.order_shipments from authenticated;

create trigger set_updated_at before update on public.order_shipments
  for each row execute function public.tg_set_updated_at();
create trigger audit after insert or update on public.order_shipments
  for each row execute function public.tg_audit();

-- Waybill photos: public bucket with unguessable file names so the customer
-- can show them at the carrier counter; only staff can upload
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shipping-docs', 'shipping-docs', true, 5242880, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

create policy "shipping docs: staff upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'shipping-docs' and (select public.is_staff()));
create policy "shipping docs: staff update" on storage.objects for update to authenticated
  using (bucket_id = 'shipping-docs' and (select public.is_staff()));

-- Create or update a shipment; moves the order to "shipping" when it is earlier in the flow
create or replace function public.save_shipment(p_order_id uuid, p_data jsonb)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_o record;
  v_id uuid := nullif(p_data ->> 'id', '')::uuid;
  v_files text[];
begin
  if not public.is_staff() then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;
  select * into v_o from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_o.status in ('cancelled', 'refunded') then
    raise exception 'Order is %', v_o.status;
  end if;

  select coalesce(array_agg(f), '{}') into v_files
    from jsonb_array_elements_text(coalesce(p_data -> 'files', '[]'::jsonb)) f
   where f ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/shipping-docs/';
  if array_length(v_files, 1) > 10 then raise exception 'Too many files'; end if;

  if v_id is null then
    insert into public.order_shipments (order_id, carrier, carrier_name, tracking_no, branch, branch_phone, files, note, shipped_at, created_by)
    values (p_order_id, coalesce(nullif(p_data ->> 'carrier', ''), 'other'), nullif(btrim(p_data ->> 'carrier_name'), ''),
            nullif(btrim(p_data ->> 'tracking_no'), ''), nullif(btrim(p_data ->> 'branch'), ''), nullif(btrim(p_data ->> 'branch_phone'), ''),
            v_files, nullif(btrim(p_data ->> 'note'), ''), coalesce((p_data ->> 'shipped_at')::timestamptz, now()), auth.uid())
    returning id into v_id;
    perform public.order_event(p_order_id, 'note', null, null, 'ບັນທຶກການຈັດສົ່ງ / บันทึกการจัดส่ง',
      jsonb_build_object('carrier', p_data ->> 'carrier', 'tracking_no', p_data ->> 'tracking_no'));
  else
    update public.order_shipments set
      carrier = coalesce(nullif(p_data ->> 'carrier', ''), carrier),
      carrier_name = nullif(btrim(p_data ->> 'carrier_name'), ''),
      tracking_no = nullif(btrim(p_data ->> 'tracking_no'), ''),
      branch = nullif(btrim(p_data ->> 'branch'), ''),
      branch_phone = nullif(btrim(p_data ->> 'branch_phone'), ''),
      files = v_files,
      note = nullif(btrim(p_data ->> 'note'), ''),
      shipped_at = coalesce((p_data ->> 'shipped_at')::timestamptz, shipped_at)
    where id = v_id and order_id = p_order_id;
    if not found then raise exception 'Shipment not found'; end if;
  end if;

  if v_o.status in ('received', 'pending_payment', 'paid') then
    update public.orders set status = 'shipping' where id = p_order_id;
    perform public.order_event(p_order_id, 'status', v_o.status, 'shipping', 'auto: shipment recorded');
  end if;
  return v_id;
end $$;

-- Tracking / receipt data for the customer (order number + phone)
create or replace function public.track_order(p_order_no text, p_phone text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'order_no', o.order_no, 'status', o.status, 'created_at', o.created_at,
    'subtotal', o.subtotal, 'discount', o.discount, 'shipping_fee', o.shipping_fee, 'total', o.total,
    'paid', o.paid_amount - o.refunded_amount,
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

grant execute on function public.save_shipment(uuid, jsonb) to authenticated;
grant execute on function public.track_order(text, text) to anon, authenticated;
