-- FirstFinder: full database schema, from scratch.
--
-- The other files in this folder are incremental patches, applied in order as
-- the app grew. They assume a database that already has the tables. This file
-- is the opposite: it is the whole schema in one place, so a contributor with
-- a brand-new Supabase project can stand up a working local database in one
-- paste without replaying that history.
--
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
--
-- Safe to re-run: every statement is idempotent. Existing projects (including
-- production) already have all of this from the patch files, so running it
-- there changes nothing.
--
-- If you add a column or a policy, add it BOTH here and in a new patch file,
-- so fresh setups and existing databases stay in step.

-- ---------------------------------------------------------------------------
-- inventory_items: one row per collectible.
-- ---------------------------------------------------------------------------
create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Short, human-friendly per-user number, shown as FF-0001. Assigned in
  -- application code rather than by a trigger -- see reference-number.sql for
  -- why, and for the unique index that backstops it.
  reference_number integer,

  name text not null default '',
  category text not null default 'Other',
  maker text not null default '',
  edition text not null default '',

  -- Book-specific detail fields. Blank for every other category.
  book_genre text not null default '',
  book_edition text not null default '',
  book_printing text not null default '',

  status text not null default 'Owned',
  -- Free-text-compatible, but the app only ever writes one of:
  -- "Near Fine/Fine", "Very Good/Good", "Fair", "Poor", or "" (not set).
  condition text not null default '',

  purchase_date date,
  source text not null default '',
  purchase_price numeric,
  -- Null (not 0) when no estimate has been entered, so "no estimate yet"
  -- stays distinguishable from "estimated at $0" across a save/reload.
  estimated_value numeric,

  -- Realized sale info, captured when an item is marked sold, and cleared
  -- again on restore. previous_status is what the item's status was just
  -- before the sale, so restoring returns it there instead of to "Owned".
  previous_status text,
  sold_price numeric,
  sold_date date,

  notes text not null default '',

  -- Photo records, shaped {"path": "...", "name": "..."}. The counts are
  -- denormalized so list views don't have to read the JSON.
  item_photos jsonb not null default '[]'::jsonb,
  receipt_photos jsonb not null default '[]'::jsonb,
  item_photo_count integer not null default 0,
  receipt_photo_count integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enforces per-user uniqueness of the reference number. This is the guard
-- behind assigning numbers in application code: if two inserts race for the
-- same number, one fails loudly here instead of silently producing two items
-- that share a reference and can't be told apart by a CSV import.
create unique index if not exists inventory_items_user_reference_number_idx
  on public.inventory_items (user_id, reference_number);

-- Every read in the app is scoped to the signed-in user.
create index if not exists inventory_items_user_id_idx
  on public.inventory_items (user_id);

-- Row Level Security is not optional here. The app talks to Supabase with the
-- public anon key and queries rows by id alone (e.g. .eq("id", id)) without
-- also filtering by user_id. That is safe ONLY because these owner-only
-- policies exist -- without them, any signed-in user could read, edit, or
-- delete anyone else's collection.
alter table public.inventory_items enable row level security;

drop policy if exists "Users can view own items" on public.inventory_items;
create policy "Users can view own items"
on public.inventory_items for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own items" on public.inventory_items;
create policy "Users can insert own items"
on public.inventory_items for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own items" on public.inventory_items;
create policy "Users can update own items"
on public.inventory_items for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own items" on public.inventory_items;
create policy "Users can delete own items"
on public.inventory_items for delete to authenticated
using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- feedback: the in-app "Send feedback" form.
-- ---------------------------------------------------------------------------
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  -- Same {"path", "name"} shape as the inventory photo columns. Stored in the
  -- same item-photos bucket under <user_id>/feedback/<feedback_id>/..., so the
  -- bucket policies below (which only check the first path segment) already
  -- cover them -- no separate bucket or policy needed.
  photos jsonb not null default '[]'::jsonb,
  -- Not surfaced in the app UI; lets whoever reviews feedback triage it in the
  -- Supabase table editor (e.g. new / reviewed / resolved).
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

drop policy if exists "Users can view own feedback" on public.feedback;
create policy "Users can view own feedback"
on public.feedback for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own feedback" on public.feedback;
create policy "Users can insert own feedback"
on public.feedback for insert to authenticated
with check (auth.uid() = user_id);

-- Photos are attached in a follow-up update after the initial insert (the same
-- two-step pattern as inventory_items), so users need to be able to update
-- their own feedback rows to attach the uploaded photo records.
drop policy if exists "Users can update own feedback" on public.feedback;
create policy "Users can update own feedback"
on public.feedback for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage: item and receipt photos.
-- ---------------------------------------------------------------------------
-- Receipts can hold personal information, so this bucket is NOT public; the
-- app renders photos through short-lived signed URLs instead.
insert into storage.buckets (id, name, public)
values ('item-photos', 'item-photos', false)
on conflict (id) do nothing;

-- Each user can only touch files inside their own top-level folder. Paths look
-- like "<user_id>/<item_id>/<file>".
drop policy if exists "Users can view own photos" on storage.objects;
create policy "Users can view own photos"
on storage.objects for select to authenticated
using (bucket_id = 'item-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can upload own photos" on storage.objects;
create policy "Users can upload own photos"
on storage.objects for insert to authenticated
with check (bucket_id = 'item-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete own photos" on storage.objects;
create policy "Users can delete own photos"
on storage.objects for delete to authenticated
using (bucket_id = 'item-photos' and (storage.foldername(name))[1] = auth.uid()::text);
