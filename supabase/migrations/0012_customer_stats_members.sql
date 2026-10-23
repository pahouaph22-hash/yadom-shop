-- customer_stats: append member columns (existing columns unchanged)
create or replace view public.customer_stats with (security_invoker = on) as
select
  c.id, c.name, c.phone, c.email, c.address, c.province, c.type, c.note, c.created_at, c.updated_at,
  count(o.id) filter (where o.status not in ('cancelled')) as orders_count,
  coalesce(sum(o.total) filter (where o.status not in ('cancelled', 'refunded')), 0) as total_spent,
  coalesce(sum(o.paid_amount - o.refunded_amount), 0) as net_paid,
  max(o.created_at) as last_order_at,
  c.user_id, c.member_since, c.district, c.village, c.gender, c.birth_date,
  c.whatsapp, c.facebook, c.referral_source, c.marketing_ok
from public.customers c
left join public.orders o on o.customer_id = c.id
group by c.id;
revoke all on public.customer_stats from anon;
