-- =====================================================================
-- Hardening after review
-- =====================================================================

-- Signed-in-only functions: not callable by anonymous visitors at all
-- (each already checks permissions inside; this removes the surface entirely)
revoke execute on function
  public.mark_my_email_verified(),
  public.member_accounts(uuid[]),
  public.my_activity(),
  public.review_slip(uuid, boolean, numeric, text, text),
  public.save_shipment(uuid, jsonb),
  public.set_phone_verified(uuid, boolean),
  public.set_staff_access(uuid, text[], boolean, text),
  public.staff_accounts(),
  public.update_my_member(jsonb)
from anon, public;

-- Ordering requires a signed-in member now
revoke execute on function public.place_order(jsonb, jsonb, text, text, jsonb) from anon, public;

-- Superseded by the staff management page (Edge Function + set_staff_access)
revoke execute on function public.set_user_role(text, public.app_role) from authenticated, anon, public;
