-- =====================================================================
-- Member verification (email via magic link, phone by staff) and the
-- member's own transaction history
-- =====================================================================

alter table public.customers
  add column email_verified_at timestamptz,
  add column phone_verified_at timestamptz,
  add column phone_verified_by uuid;

-- Called after the member signs in through the email link: the session's
-- authentication method proves the member controls the mailbox.
create or replace function public.mark_my_email_verified()
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not exists (
    select 1 from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) a
     where a ->> 'method' in ('otp', 'magiclink')
  ) then
    return false;
  end if;
  update public.customers set email_verified_at = coalesce(email_verified_at, now())
   where user_id = auth.uid();
  return true;
end $$;

-- Staff confirm a phone number after calling / messaging the customer
create or replace function public.set_phone_verified(p_customer_id uuid, p_verified boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.can('customers') then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;
  update public.customers
     set phone_verified_at = case when p_verified then now() end,
         phone_verified_by = case when p_verified then auth.uid() end
   where id = p_customer_id;
  if not found then raise exception 'Customer not found'; end if;
end $$;

-- Everything a signed-in member may see about their own account
create or replace function public.my_activity()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'member', (select to_jsonb(c) - 'note' - 'type' - 'phone_verified_by' from public.customers c where c.user_id = auth.uid()),
    'orders', (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', o.id, 'order_no', o.order_no, 'status', o.status, 'created_at', o.created_at,
                  'total', o.total, 'paid', o.paid_amount - o.refunded_amount, 'ship_phone', o.ship_phone,
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

grant execute on function public.mark_my_email_verified() to authenticated;
grant execute on function public.set_phone_verified(uuid, boolean) to authenticated;
grant execute on function public.my_activity() to authenticated;

-- customer_stats: append verification columns
create or replace view public.customer_stats with (security_invoker = on) as
select
  c.id, c.name, c.phone, c.email, c.address, c.province, c.type, c.note, c.created_at, c.updated_at,
  count(o.id) filter (where o.status not in ('cancelled')) as orders_count,
  coalesce(sum(o.total) filter (where o.status not in ('cancelled', 'refunded')), 0) as total_spent,
  coalesce(sum(o.paid_amount - o.refunded_amount), 0) as net_paid,
  max(o.created_at) as last_order_at,
  c.user_id, c.member_since, c.district, c.village, c.gender, c.birth_date,
  c.whatsapp, c.facebook, c.referral_source, c.marketing_ok,
  c.email_verified_at, c.phone_verified_at
from public.customers c
left join public.orders o on o.customer_id = c.id
group by c.id;
revoke all on public.customer_stats from anon;
