-- =====================================================================
-- Row Level Security, reports, grants, storage, initial settings
-- Roles: admin (everything) · staff (orders, products, customers, stock,
-- messages, reports) · customer (own orders only) · anon (shop + forms)
-- Expenses, refunds, settings, contacts, roles and the audit log: admin.
-- =====================================================================

alter table public.profiles          enable row level security;
alter table public.admin_allowlist   enable row level security;
alter table public.settings          enable row level security;
alter table public.contact_channels  enable row level security;
alter table public.contact_messages  enable row level security;
alter table public.products          enable row level security;
alter table public.stock_movements   enable row level security;
alter table public.customers         enable row level security;
alter table public.orders            enable row level security;
alter table public.order_items       enable row level security;
alter table public.order_events      enable row level security;
alter table public.payments          enable row level security;
alter table public.expenses          enable row level security;
alter table public.audit_log         enable row level security;

-- profiles
create policy "profiles: read own or staff" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_staff()));
create policy "profiles: update own or admin" on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()))
  with check (id = (select auth.uid()) or (select public.is_admin()));

-- admin_allowlist: admins only
create policy "allowlist: admin" on public.admin_allowlist for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- settings
create policy "settings: public read" on public.settings for select to anon, authenticated
  using (is_public or (select public.is_admin()));
create policy "settings: admin write" on public.settings for insert to authenticated
  with check ((select public.is_admin()));
create policy "settings: admin update" on public.settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "settings: admin delete" on public.settings for delete to authenticated
  using ((select public.is_admin()));

-- contact channels
create policy "channels: public read" on public.contact_channels for select to anon, authenticated
  using (is_active or (select public.is_staff()));
create policy "channels: admin insert" on public.contact_channels for insert to authenticated
  with check ((select public.is_admin()));
create policy "channels: admin update" on public.contact_channels for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "channels: admin delete" on public.contact_channels for delete to authenticated
  using ((select public.is_admin()));

-- contact messages (insert only through submit_contact)
create policy "messages: staff read" on public.contact_messages for select to authenticated
  using ((select public.is_staff()));
create policy "messages: staff update" on public.contact_messages for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "messages: admin delete" on public.contact_messages for delete to authenticated
  using ((select public.is_admin()));

-- products (public catalogue goes through shop_products())
create policy "products: staff read" on public.products for select to authenticated
  using ((select public.is_staff()));
create policy "products: staff insert" on public.products for insert to authenticated
  with check ((select public.is_staff()));
create policy "products: staff update" on public.products for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "products: admin delete" on public.products for delete to authenticated
  using ((select public.is_admin()));

create policy "stock: staff read" on public.stock_movements for select to authenticated
  using ((select public.is_staff()));

-- customers (personal data: staff only)
create policy "customers: staff read" on public.customers for select to authenticated
  using ((select public.is_staff()));
create policy "customers: staff insert" on public.customers for insert to authenticated
  with check ((select public.is_staff()));
create policy "customers: staff update" on public.customers for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "customers: admin delete" on public.customers for delete to authenticated
  using ((select public.is_admin()));

-- orders & related: staff, or the signed-in customer who placed the order
create policy "orders: staff or owner read" on public.orders for select to authenticated
  using ((select public.is_staff()) or user_id = (select auth.uid()));
create policy "order_items: staff or owner read" on public.order_items for select to authenticated
  using ((select public.is_staff()) or exists (
    select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid())));
create policy "order_events: staff or owner read" on public.order_events for select to authenticated
  using ((select public.is_staff()) or exists (
    select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid())));
create policy "payments: staff read" on public.payments for select to authenticated
  using ((select public.is_staff()));

-- expenses: admin
create policy "expenses: admin read" on public.expenses for select to authenticated
  using ((select public.is_admin()));
create policy "expenses: admin insert" on public.expenses for insert to authenticated
  with check ((select public.is_admin()));
create policy "expenses: admin update" on public.expenses for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "expenses: admin delete" on public.expenses for delete to authenticated
  using ((select public.is_admin()));

-- audit log: admin read only; nobody can write directly
create policy "audit: admin read" on public.audit_log for select to authenticated
  using ((select public.is_admin()));

-- Tighten table privileges on top of RLS
revoke all on public.audit_log, public.stock_movements, public.order_events, public.payments,
              public.orders, public.order_items from anon;
revoke insert, update, delete, truncate on public.audit_log, public.stock_movements, public.order_events,
              public.payments, public.orders, public.order_items from authenticated;
revoke all on public.products, public.customers, public.expenses, public.contact_messages,
              public.admin_allowlist, public.profiles from anon;
revoke truncate on all tables in schema public from authenticated;

-- ---------------------------------------------------------------------
-- Customer stats view (respects RLS of the caller)
-- ---------------------------------------------------------------------
create view public.customer_stats with (security_invoker = on) as
select
  c.id, c.name, c.phone, c.email, c.address, c.province, c.type, c.note, c.created_at, c.updated_at,
  count(o.id) filter (where o.status not in ('cancelled')) as orders_count,
  coalesce(sum(o.total) filter (where o.status not in ('cancelled', 'refunded')), 0) as total_spent,
  coalesce(sum(o.paid_amount - o.refunded_amount), 0) as net_paid,
  max(o.created_at) as last_order_at
from public.customers c
left join public.orders o on o.customer_id = c.id
group by c.id;
revoke all on public.customer_stats from anon;

-- ---------------------------------------------------------------------
-- Reports (times in Asia/Vientiane)
-- Revenue = money actually received (payments − refunds) in the period.
-- COGS    = cost+packaging of items in non-cancelled/non-refunded orders
--           created in the period.
-- Operating expenses exclude category 'inventory' (stock purchases are
-- already counted through COGS when sold).
-- Profit  = received − COGS − operating expenses.
-- ---------------------------------------------------------------------
create or replace function public.report_series(p_from date, p_to date, p_grain text default 'day')
returns table (
  period date, orders_count bigint, gross_sales numeric, items_sold bigint,
  received numeric, refunds numeric, cogs numeric, op_expenses numeric, inventory_purchases numeric, profit numeric
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;
  if p_grain not in ('day', 'month', 'year') then
    raise exception 'grain must be day, month or year';
  end if;
  if p_to < p_from or p_to - p_from > 3700 then
    raise exception 'Invalid date range';
  end if;

  return query
  with periods as (
    select generate_series(date_trunc(p_grain, p_from::timestamp), date_trunc(p_grain, p_to::timestamp),
                           ('1 ' || p_grain)::interval)::date as period
  ),
  o as (
    select date_trunc(p_grain, (o.created_at at time zone 'Asia/Vientiane'))::date as period,
           count(*) as orders_count, sum(o.total) as gross_sales
      from public.orders o
     where o.status not in ('cancelled', 'refunded')
       and (o.created_at at time zone 'Asia/Vientiane')::date between p_from and p_to
     group by 1
  ),
  i as (
    select date_trunc(p_grain, (o.created_at at time zone 'Asia/Vientiane'))::date as period,
           sum(i.qty) as items_sold, sum(i.qty * i.unit_cost) as cogs
      from public.order_items i join public.orders o on o.id = i.order_id
     where o.status in ('paid', 'shipping', 'delivered')
       and (o.created_at at time zone 'Asia/Vientiane')::date between p_from and p_to
     group by 1
  ),
  p as (
    select date_trunc(p_grain, (paid_at at time zone 'Asia/Vientiane'))::date as period,
           sum(amount) filter (where kind = 'payment') as received,
           sum(amount) filter (where kind = 'refund') as refunds
      from public.payments
     where (paid_at at time zone 'Asia/Vientiane')::date between p_from and p_to
     group by 1
  ),
  e as (
    select date_trunc(p_grain, expense_date::timestamp)::date as period,
           sum(amount) filter (where category <> 'inventory') as op_expenses,
           sum(amount) filter (where category = 'inventory') as inventory_purchases
      from public.expenses
     where expense_date between p_from and p_to
     group by 1
  )
  select pr.period,
         coalesce(o.orders_count, 0), coalesce(o.gross_sales, 0), coalesce(i.items_sold, 0)::bigint,
         coalesce(p.received, 0), coalesce(p.refunds, 0), coalesce(i.cogs, 0),
         case when public.is_admin() then coalesce(e.op_expenses, 0) end,
         case when public.is_admin() then coalesce(e.inventory_purchases, 0) end,
         case when public.is_admin() then
           coalesce(p.received, 0) - coalesce(p.refunds, 0) - coalesce(i.cogs, 0) - coalesce(e.op_expenses, 0) end
    from periods pr
    left join o on o.period = pr.period
    left join i on i.period = pr.period
    left join p on p.period = pr.period
    left join e on e.period = pr.period
   order by pr.period;
end $$;

create or replace function public.report_products(p_from date, p_to date)
returns table (product_id uuid, sku text, name text, qty_sold bigint, sales numeric, cogs numeric, stock integer)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;
  return query
  select pr.id, pr.sku, pr.name_lo,
         coalesce(sum(i.qty), 0)::bigint, coalesce(sum(i.line_total), 0), coalesce(sum(i.qty * i.unit_cost), 0),
         pr.stock
    from public.products pr
    left join public.order_items i on i.product_id = pr.id
     and exists (select 1 from public.orders o where o.id = i.order_id
                  and o.status not in ('cancelled', 'refunded')
                  and (o.created_at at time zone 'Asia/Vientiane')::date between p_from and p_to)
   where pr.deleted_at is null or i.id is not null
   group by pr.id
   order by 5 desc, 3;
end $$;

create or replace function public.dashboard_stats()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Vientiane')::date;
  v_month date := date_trunc('month', v_today::timestamp)::date;
  v_admin boolean := public.is_admin();
  r jsonb;
begin
  if not public.is_staff() then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;
  select jsonb_build_object(
    'today', (select to_jsonb(s) from public.report_series(v_today, v_today, 'day') s limit 1),
    'month', (select jsonb_build_object(
                'orders_count', sum(orders_count), 'gross_sales', sum(gross_sales), 'received', sum(received),
                'refunds', sum(refunds), 'cogs', sum(cogs), 'op_expenses', sum(op_expenses), 'profit', sum(profit))
                from public.report_series(v_month, v_today, 'day')),
    'open_orders', (select jsonb_object_agg(status, n) from (
                      select status, count(*) n from public.orders
                       where status in ('received', 'pending_payment', 'paid', 'shipping') group by status) x),
    'unpaid_total', (select coalesce(sum(total - (paid_amount - refunded_amount)), 0) from public.orders
                      where status not in ('cancelled', 'refunded') and paid_amount - refunded_amount < total),
    'low_stock', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name_lo, 'sku', sku, 'stock', stock, 'threshold', low_stock_threshold) order by stock), '[]'::jsonb)
                    from public.products where deleted_at is null and is_active and stock <= low_stock_threshold),
    'new_messages', (select count(*) from public.contact_messages where status = 'new'),
    'recent_orders', (select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
                        select o.id, o.order_no, o.status, o.total, o.created_at, c.name as customer
                          from public.orders o join public.customers c on c.id = o.customer_id
                         order by o.created_at desc limit 8) x),
    'recent_activity', case when v_admin then (select coalesce(jsonb_agg(a order by a.at desc), '[]'::jsonb) from (
                        select id, at, actor_email, action, entity, entity_id, changed_fields, note
                          from public.audit_log order by at desc limit 12) a) else '[]'::jsonb end
  ) into r;
  return r;
end $$;

-- ---------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
grant execute on function public.place_order(jsonb, jsonb, text, text, jsonb) to anon, authenticated;
grant execute on function public.track_order(text, text) to anon, authenticated;
grant execute on function public.submit_contact(text, text, text, text, text) to anon, authenticated;
grant execute on function public.shop_products() to anon, authenticated;
grant execute on function public.my_role(), public.is_staff(), public.is_admin() to anon, authenticated;

grant execute on function
  public.log_auth_event(text),
  public.adjust_stock(uuid, integer, text, text),
  public.update_order_status(uuid, public.order_status, text),
  public.record_payment(uuid, numeric, text, text, text, timestamptz),
  public.record_refund(uuid, numeric, text, text, boolean, text),
  public.update_order(uuid, jsonb, text),
  public.set_user_role(text, public.app_role),
  public.report_series(date, date, text),
  public.report_products(date, date),
  public.dashboard_stats()
to authenticated;

-- internal helpers: not callable through the API
revoke execute on function
  public.write_audit(text, text, text, jsonb, jsonb, text[], text),
  public.apply_stock(uuid, integer, text, uuid, text),
  public.restock_order(uuid, text),
  public.order_event(uuid, text, public.order_status, public.order_status, text, jsonb)
from authenticated;

-- Functions created later should not be public by default
alter default privileges in schema public revoke execute on functions from public, anon;

-- ---------------------------------------------------------------------
-- Storage bucket for product photos
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "product images: staff upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and (select public.is_staff()));
create policy "product images: staff update" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and (select public.is_staff()));
create policy "product images: staff delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (select public.is_staff()));

-- ---------------------------------------------------------------------
-- Initial settings (store owner edits these in Admin → Settings)
-- ---------------------------------------------------------------------
insert into public.settings (key, value, is_public) values
  ('store_name',    '{"lo":"ຢາດົມຫອມລາວ","th":"ยาดมหอมลาว","en":"Ya Dom Hom Lao"}', true),
  ('store_tagline', '{"lo":"ຢາດົມສະໝຸນໄພລາວ ຫອມສົດຊື່ນ ຈາກທຳມະຊາດ","th":"ยาดมสมุนไพรลาว หอมสดชื่น จากธรรมชาติ","en":"Lao herbal inhaler — fresh, natural, handmade"}', true),
  ('thb_rate',      '650', true),
  ('shipping_note', '{"lo":"ຄ່າຈັດສົ່ງຈະແຈ້ງໃຫ້ຮູ້ຫຼັງຢືນຢັນຄຳສັ່ງຊື້","th":"ค่าจัดส่งจะแจ้งให้ทราบหลังยืนยันคำสั่งซื้อ","en":"Shipping fee will be confirmed after we receive your order"}', true),
  ('payment_info',  '{"lo":"","th":"","en":""}', true)
on conflict (key) do nothing;

insert into public.admin_allowlist (email) values ('pahouaph22@gmail.com') on conflict do nothing;
