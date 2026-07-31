-- Photo storage setup for FirstFinder
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

-- 1. Columns that store the uploaded photo records as JSON arrays of
--    objects shaped like {"path": "...", "name": "..."}.
alter table public.inventory_items
  add column if not exists item_photos jsonb not null default '[]'::jsonb,
  add column if not exists receipt_photos jsonb not null default '[]'::jsonb;

-- 2. Private storage bucket for item and receipt photos. Receipts can hold
--    personal information, so the bucket is NOT public; the app renders
--    photos through short-lived signed URLs instead.
insert into storage.buckets (id, name, public)
values ('item-photos', 'item-photos', false)
on conflict (id) do nothing;

-- 3. Storage policies: each user can only touch files inside their own
--    top-level folder (paths look like "<user_id>/<item_id>/<file>").
create policy "Users can view own photos"
on storage.objects for select to authenticated
using (bucket_id = 'item-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can upload own photos"
on storage.objects for insert to authenticated
with check (bucket_id = 'item-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can delete own photos"
on storage.objects for delete to authenticated
using (bucket_id = 'item-photos' and (storage.foldername(name))[1] = auth.uid()::text);
