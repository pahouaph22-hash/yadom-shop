-- =====================================================================
-- Separate customer (member) accounts from staff accounts
-- + per-staff permissions
-- =====================================================================

-- ---------- staff permissions ----------
alter table public.profiles
  add column permissions text[] not null default '{}',
  add column is_active boolean not null default true,
  add column title text check (char_length(title) <= 80);

alter table public.profiles add constraint profiles_permissions_valid
  check (permissions <@ array['orders','products','customers','messages','reports','finance','settings','audit']::text[]);

-- Active staff only
create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','staff') and is_active)
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and is_active)
$$;

-- Admin can do everything; staff only what their permissions list says
create or replace function public.can(p_perm text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid() and is_active
       and (role = 'admin' or (role = 'staff' and p_perm = any (permissions)))
  )
$$;
grant execute on function public.can(text) to anon, authenticated;

-- Only admins change role / permissions / active flag (service role, e.g. the
-- staff-admin edge function, has auth.uid() = null and is allowed)
create or replace function public.tg_guard_profile()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (new.role is distinct from old.role or new.permissions is distinct from old.permissions
      or new.is_active is distinct from old.is_active)
     and auth.uid() is not null and not public.is_admin() then
    raise exception 'Only admins can change roles or permissions' using errcode = 'insufficient_privilege';
  end if;
  if old.id = auth.uid() and old.role = 'admin' and (new.role <> 'admin' or not new.is_active) then
    if (select count(*) from public.profiles where role = 'admin' and is_active) <= 1 then
      raise exception 'Cannot remove the last admin';
    end if;
  end if;
  if new.email is distinct from old.email and auth.uid() is not null then
    raise exception 'Email cannot be changed here';
  end if;
  return new;
end $$;

-- ---------- member details on customers ----------
alter table public.customers
  add column user_id uuid unique references auth.users (id) on delete set null,
  add column district text check (char_length(district) <= 80),
  add column village text check (char_length(village) <= 80),
  add column gender text check (gender in ('male','female','other')),
  add column birth_date date,
  add column whatsapp text check (char_length(whatsapp) <= 30),
  add column facebook text check (char_length(facebook) <= 160),
  add column referral_source text check (char_length(referral_source) <= 80),
  add column marketing_ok boolean not null default false,
  add column member_since timestamptz;

-- New sign-ups: allowlisted emails become admin; everyone else is a customer
-- and gets a member record from the registration form. Staff accounts are
-- created only by the staff-admin edge function (it promotes the profile).
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_admin boolean := exists (select 1 from public.admin_allowlist a where a.email = lower(new.email));
  v_phone text := nullif(btrim(m ->> 'phone'), '');
  v_cust uuid;
begin
  insert into public.profiles (id, email, full_name, phone, role)
  values (new.id, lower(new.email), nullif(m ->> 'full_name', ''), v_phone,
          case when v_admin then 'admin'::public.app_role else 'customer'::public.app_role end);

  if not v_admin and coalesce(m ->> 'account_type', 'customer') = 'customer'
     and v_phone is not null and char_length(regexp_replace(v_phone, '\D', '', 'g')) between 6 and 15 then
    select id into v_cust from public.customers
     where phone_norm = regexp_replace(v_phone, '\D', '', 'g') and user_id is null;
    if found then
      -- existing walk-in customer with the same phone: attach the new login,
      -- fill blanks only (past orders stay private to staff)
      update public.customers set
        user_id = new.id, member_since = now(),
        email = coalesce(email, lower(new.email)),
        address = coalesce(address, nullif(m ->> 'address', '')),
        province = coalesce(province, nullif(m ->> 'province', '')),
        district = coalesce(district, nullif(m ->> 'district', '')),
        village = coalesce(village, nullif(m ->> 'village', ''))
      where id = v_cust;
    elsif not exists (select 1 from public.customers where phone_norm = regexp_replace(v_phone, '\D', '', 'g')) then
      insert into public.customers (user_id, member_since, name, phone, email, address, province, district, village,
                                    gender, birth_date, whatsapp, facebook, referral_source, marketing_ok)
      values (new.id, now(), coalesce(nullif(m ->> 'full_name', ''), split_part(new.email, '@', 1)), v_phone, lower(new.email),
              nullif(m ->> 'address', ''), nullif(m ->> 'province', ''), nullif(m ->> 'district', ''), nullif(m ->> 'village', ''),
              case when m ->> 'gender' in ('male','female','other') then m ->> 'gender' end,
              case when (m ->> 'birth_date') ~ '^\d{4}-\d{2}-\d{2}$' then (m ->> 'birth_date')::date end,
              nullif(m ->> 'whatsapp', ''), nullif(m ->> 'facebook', ''), nullif(m ->> 'referral_source', ''),
              coalesce((m ->> 'marketing_ok')::boolean, false));
    end if;
  end if;
  return new;
end $$;

-- A signed-in member reads / updates their own member record
create policy "customers: member reads own" on public.customers for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.update_my_member(p jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  update public.customers set
    name = coalesce(nullif(btrim(p ->> 'name'), ''), name),
    address = nullif(btrim(p ->> 'address'), ''),
    province = nullif(btrim(p ->> 'province'), ''),
    district = nullif(btrim(p ->> 'district'), ''),
    village = nullif(btrim(p ->> 'village'), ''),
    whatsapp = nullif(btrim(p ->> 'whatsapp'), ''),
    facebook = nullif(btrim(p ->> 'facebook'), ''),
    gender = case when p ->> 'gender' in ('male','female','other') then p ->> 'gender' else gender end,
    birth_date = case when (p ->> 'birth_date') ~ '^\d{4}-\d{2}-\d{2}$' then (p ->> 'birth_date')::date else birth_date end,
    marketing_ok = coalesce((p ->> 'marketing_ok')::boolean, marketing_ok)
  where user_id = auth.uid();
  update public.profiles set full_name = coalesce(nullif(btrim(p ->> 'name'), ''), full_name) where id = auth.uid();
end $$;
grant execute on function public.update_my_member(jsonb) to authenticated;

-- Member account info for the back office (email, sign-up, last login)
create or replace function public.member_accounts(p_user_ids uuid[])
returns table (user_id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz, confirmed boolean)
language sql stable security definer set search_path = ''
as $$
  select u.id, u.email, u.created_at, u.last_sign_in_at, u.email_confirmed_at is not null
    from auth.users u
   where u.id = any (p_user_ids) and public.can('customers')
$$;
grant execute on function public.member_accounts(uuid[]) to authenticated;

-- Staff list with login info (admin only)
create or replace function public.staff_accounts()
returns table (id uuid, email text, full_name text, title text, role public.app_role, permissions text[], is_active boolean,
               created_at timestamptz, last_sign_in_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.email, p.full_name, p.title, p.role, p.permissions, p.is_active, p.created_at, u.last_sign_in_at
    from public.profiles p join auth.users u on u.id = p.id
   where p.role in ('admin','staff') and public.is_admin()
   order by p.role, p.created_at
$$;
grant execute on function public.staff_accounts() to authenticated;

create or replace function public.set_staff_access(p_user_id uuid, p_permissions text[], p_is_active boolean, p_title text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Only admins' using errcode = 'insufficient_privilege'; end if;
  update public.profiles
     set permissions = coalesce(p_permissions, '{}'), is_active = coalesce(p_is_active, true), title = nullif(btrim(p_title), '')
   where id = p_user_id and role in ('admin','staff');
  if not found then raise exception 'Staff account not found'; end if;
end $$;
grant execute on function public.set_staff_access(uuid, text[], boolean, text) to authenticated;

-- ---------- permission-based policies ----------
alter policy "products: staff read" on public.products using ((select public.can('products')) or (select public.can('orders')) or (select public.can('reports')));
alter policy "products: staff insert" on public.products with check ((select public.can('products')));
alter policy "products: staff update" on public.products using ((select public.can('products'))) with check ((select public.can('products')));
alter policy "stock: staff read" on public.stock_movements using ((select public.can('products')));

alter policy "customers: staff read" on public.customers using ((select public.can('customers')) or (select public.can('orders')));
alter policy "customers: staff insert" on public.customers with check ((select public.can('customers')));
alter policy "customers: staff update" on public.customers using ((select public.can('customers'))) with check ((select public.can('customers')));

alter policy "payments: staff read" on public.payments using ((select public.can('orders')) or (select public.can('reports')) or (select public.can('finance')));
alter policy "slips: staff read" on public.payment_slips using ((select public.can('orders')));

alter policy "messages: staff read" on public.contact_messages using ((select public.can('messages')));
alter policy "messages: staff update" on public.contact_messages using ((select public.can('messages'))) with check ((select public.can('messages')));

alter policy "expenses: admin read" on public.expenses using ((select public.can('finance')));
alter policy "expenses: admin insert" on public.expenses with check ((select public.can('finance')));
alter policy "expenses: admin update" on public.expenses using ((select public.can('finance'))) with check ((select public.can('finance')));

alter policy "settings: admin write" on public.settings with check ((select public.can('settings')));
alter policy "settings: admin update" on public.settings using ((select public.can('settings'))) with check ((select public.can('settings')));
alter policy "channels: admin insert" on public.contact_channels with check ((select public.can('settings')));
alter policy "channels: admin update" on public.contact_channels using ((select public.can('settings'))) with check ((select public.can('settings')));

alter policy "audit: admin read" on public.audit_log using ((select public.can('audit')));

alter policy "product images: staff upload" on storage.objects with check (bucket_id = 'product-images' and ((select public.can('products')) or (select public.can('settings'))));
alter policy "product images: staff update" on storage.objects using (bucket_id = 'product-images' and ((select public.can('products')) or (select public.can('settings'))));
alter policy "shipping docs: staff upload" on storage.objects with check (bucket_id = 'shipping-docs' and (select public.can('orders')));
alter policy "shipping docs: staff update" on storage.objects using (bucket_id = 'shipping-docs' and (select public.can('orders')));
alter policy "slips: staff view" on storage.objects using (bucket_id = 'payment-slips' and (select public.can('orders')));

-- Registration form check: is this phone already tied to a member account?
create or replace function public.member_phone_taken(p_phone text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.customers
                  where phone_norm = regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') and user_id is not null)
$$;
grant execute on function public.member_phone_taken(text) to anon, authenticated;
