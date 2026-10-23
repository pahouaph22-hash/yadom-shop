-- lets an admin restore a deleted contact message from the audit log
create policy "messages: admin insert" on public.contact_messages for insert to authenticated
  with check ((select public.is_admin()));
