-- Swap the generic staff check for the specific permission each function needs
do $$
declare
  r record;
  def text;
  m jsonb := '{
    "adjust_stock": [["public.is_staff()", "public.can(''products'')"]],
    "update_order_status": [["public.is_staff()", "public.can(''orders'')"]],
    "record_payment": [["public.is_staff()", "public.can(''orders'')"]],
    "update_order": [["public.is_staff()", "public.can(''orders'')"]],
    "review_slip": [["public.is_staff()", "public.can(''orders'')"]],
    "save_shipment": [["public.is_staff()", "public.can(''orders'')"]],
    "report_products": [["public.is_staff()", "public.can(''reports'')"]],
    "report_series": [["public.is_admin()", "public.can(''finance'')"]],
    "dashboard_stats": [["v_admin boolean := public.is_admin();", "v_admin boolean := public.can(''audit'');"]]
  }';
  pair jsonb;
begin
  for r in select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname in (select jsonb_object_keys(m)) loop
    def := pg_get_functiondef(r.oid);
    for pair in select * from jsonb_array_elements(m -> r.proname) loop
      if position(pair ->> 0 in def) = 0 then
        raise exception 'pattern % not found in %', pair ->> 0, r.proname;
      end if;
      def := replace(def, pair ->> 0, pair ->> 1);
    end loop;
    execute def;
  end loop;
end $$;
