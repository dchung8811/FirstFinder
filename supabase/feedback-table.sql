-- Feedback table for the in-app "Send feedback" form.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  -- {"path": "...", "name": "..."} records, same shape as inventory_items'
  -- photo columns. Uploaded to the existing item-photos bucket under
  -- <user_id>/feedback/<feedback_id>/..., so the bucket's existing
  -- owner-only storage policies (which only check the first path segment)
  -- already cover these -- no new bucket or storage policy needed.
  photos jsonb not null default '[]'::jsonb,
  -- Not surfaced in the app UI; lets whoever reviews feedback triage it
  -- directly in the Supabase table editor (e.g. new / reviewed / resolved).
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

-- Photos are attached in a follow-up update after the initial insert (same
-- two-step pattern as inventory_items), so users need to be able to update
-- their own still-new feedback to attach the uploaded photo records.
drop policy if exists "Users can update own feedback" on public.feedback;
create policy "Users can update own feedback"
on public.feedback for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
