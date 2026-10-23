-- =====================================================================
-- Role helpers, updated_at, audit trail, guards
-- =====================================================================

create or replace function public.my_role()
returns public.app_role
language sql stable security definer set search_path = ''
as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'customer'::public.app_role)
$$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','staff'))
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

-- ---------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','settings','contact_channels','contact_messages','products','customers','orders','expenses']
  loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.tg_set_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Audit trail
-- ---------------------------------------------------------------------
create or replace function public.write_audit(
  p_action text, p_entity text, p_entity_id text,
  p_old jsonb default null, p_new jsonb default null,
  p_changed text[] default null, p_note text default null
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.audit_log (actor_id, actor_email, actor_role, action, entity, entity_id, old_data, new_data, changed_fields, note)
  values (
    auth.uid(),
    (select email from auth.users where id = auth.uid()),
    case when auth.uid() is null then coalesce(auth.role(), 'system') else public.my_role()::text end,
    p_action, p_entity, p_entity_id, p_old, p_new, p_changed, p_note
  );
end $$;

create or replace function public.tg_audit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_changed text[];
  v_id text;
begin
  if tg_op in ('UPDATE','DELETE') then v_old := to_jsonb(old); end if;
  if tg_op in ('INSERT','UPDATE') then v_new := to_jsonb(new); end if;

  if tg_op = 'UPDATE' then
    select array_agg(k order by k) into v_changed
      from jsonb_object_keys(v_new) as k
     where v_new -> k is distinct from v_old -> k
       and k not in ('updated_at');
    if v_changed is null then
      return new;
    end if;
    -- keep the log compact: only the fields that changed (+ identifiers)
    select jsonb_object_agg(k, v_old -> k) into v_old from unnest(v_changed || array['id']) as k where v_old ? k;
    select jsonb_object_agg(k, v_new -> k) into v_new from unnest(v_changed || array['id']) as k where v_new ? k;
  end if;

  v_id := coalesce(v_new ->> 'id', v_old ->> 'id', v_new ->> 'key', v_old ->> 'key', v_new ->> 'email', v_old ->> 'email');

  perform public.write_audit(lower(tg_op), tg_table_name, v_id, v_old, v_new, v_changed,
    nullif(current_setting('app.audit_note', true), ''));
  return coalesce(new, old);
end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','admin_allowlist','settings','contact_channels','contact_messages','products','customers','orders','order_items','payments','expenses']
  loop
    execute format('create trigger audit after insert or update or delete on public.%I for each row execute function public.tg_audit()', t);
  end loop;
end $$;

-- Append-only guard for history tables
create or replace function public.tg_block_change()
returns trigger language plpgsql set search_path = ''
as $$
begin
  raise exception 'Table % is append-only; % is not allowed', tg_table_name, tg_op
    using errcode = 'insufficient_privilege';
end $$;

create trigger append_only before update or delete on public.audit_log
  for each row execute function public.tg_block_change();
create trigger append_only_truncate before truncate on public.audit_log
  for each statement execute function public.tg_block_change();
create trigger append_only before update or delete on public.stock_movements
  for each row execute function public.tg_block_change();
create trigger append_only before update or delete on public.order_events
  for each row execute function public.tg_block_change();
create trigger append_only before update or delete on public.payments
  for each row execute function public.tg_block_change();

-- Login / logout events (called by the app right after sign-in)
create or replace function public.log_auth_event(p_event text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if p_event not in ('login','logout') then
    raise exception 'invalid event';
  end if;
  perform public.write_audit(p_event, 'auth', auth.uid()::text, null, null, null, null);
end $$;

-- ---------------------------------------------------------------------
-- New user -> profile (admin if on allowlist)
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    lower(new.email),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    case when exists (select 1 from public.admin_allowlist a where a.email = lower(new.email))
         then 'admin'::public.app_role else 'customer'::public.app_role end
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only admins may change roles (direct SQL by the project owner still works)
create or replace function public.tg_guard_profile()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'Only admins can change roles' using errcode = 'insufficient_privilege';
  end if;
  if new.role is distinct from old.role and old.id = auth.uid() and old.role = 'admin' then
    if (select count(*) from public.profiles where role = 'admin') <= 1 then
      raise exception 'Cannot remove the last admin';
    end if;
  end if;
  if new.email is distinct from old.email and auth.uid() is not null then
    raise exception 'Email cannot be changed here';
  end if;
  return new;
end $$;

create trigger guard_profile before update on public.profiles
  for each row execute function public.tg_guard_profile();

-- ---------------------------------------------------------------------
-- Stock: only changeable through apply_stock() so every change is logged
-- ---------------------------------------------------------------------
create or replace function public.tg_guard_stock()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.stock is distinct from old.stock
     and coalesce(current_setting('app.stock_change', true), '') <> 'on' then
    raise exception 'Stock must be changed through adjust_stock (so it is logged)'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

create trigger guard_stock before update on public.products
  for each row execute function public.tg_guard_stock();

create or replace function public.tg_initial_stock()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.stock > 0 then
    insert into public.stock_movements (product_id, change, stock_after, reason, note, actor_id)
    values (new.id, new.stock, new.stock, 'initial', 'Initial stock', auth.uid());
  end if;
  return new;
end $$;

create trigger initial_stock after insert on public.products
  for each row execute function public.tg_initial_stock();

create or replace function public.apply_stock(
  p_product_id uuid, p_change integer, p_reason text, p_order_id uuid default null, p_note text default null
) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_stock integer;
  v_name text;
begin
  if p_change = 0 then
    return (select stock from public.products where id = p_product_id);
  end if;

  select stock, name_lo into v_stock, v_name from public.products where id = p_product_id for update;
  if not found then
    raise exception 'Product not found';
  end if;
  if v_stock + p_change < 0 then
    raise exception 'ສິນຄ້າບໍ່ພໍ / สินค้าไม่พอ: % (เหลือ %, ต้องการ %)', v_name, v_stock, -p_change
      using errcode = 'check_violation';
  end if;

  perform set_config('app.stock_change', 'on', true);
  perform set_config('app.audit_note', 'stock:' || p_reason || coalesce(' — ' || p_note, ''), true);
  update public.products set stock = stock + p_change where id = p_product_id returning stock into v_stock;
  perform set_config('app.stock_change', 'off', true);
  perform set_config('app.audit_note', '', true);

  insert into public.stock_movements (product_id, change, stock_after, reason, order_id, note, actor_id)
  values (p_product_id, p_change, v_stock, p_reason, p_order_id, p_note, auth.uid());
  return v_stock;
end $$;

-- Staff-facing stock adjustment
create or replace function public.adjust_stock(
  p_product_id uuid, p_change integer, p_reason text, p_note text default null
) returns integer
language plpgsql security definer set search_path = ''
as $$
declare v_new integer;
begin
  if not public.is_staff() then
    raise exception 'Not allowed' using errcode = 'insufficient_privilege';
  end if;
  if p_reason not in ('restock','adjust','damage','return') then
    raise exception 'Invalid reason';
  end if;
  if p_change is null or p_change = 0 then
    raise exception 'Change must not be zero';
  end if;
  v_new := public.apply_stock(p_product_id, p_change, p_reason, null, p_note);
  return v_new;
end $$;
