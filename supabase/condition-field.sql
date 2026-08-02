-- New inventory_items column for the Condition field added in this change.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

alter table public.inventory_items
  -- Free-text-compatible column, but the app only ever writes one of:
  -- "Near Fine/Fine", "Very Good/Good", "Fair", "Poor", or "" (not set).
  add column if not exists condition text not null default '';
