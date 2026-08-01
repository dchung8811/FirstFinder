-- New inventory_items columns for the sale-price capture, restore-to-prior-
-- status, and Book-specific detail fields added in this change.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

alter table public.inventory_items
  -- Realized sale info, captured when an item is marked sold. Nullable:
  -- empty until a sale price is entered, and cleared again on restore.
  add column if not exists sold_price numeric,
  add column if not exists sold_date date,
  -- What the item's status was immediately before being marked sold, so
  -- restoring returns it there instead of always defaulting to "Owned".
  add column if not exists previous_status text,
  -- Book-specific detail fields, shown in the UI only when category = "Book".
  add column if not exists book_genre text not null default '',
  add column if not exists book_edition text not null default '',
  add column if not exists book_printing text not null default '';

-- estimated_value must accept NULL so "no estimate entered yet" can be
-- stored distinctly from "estimated at $0" (previously the app always sent
-- 0, which is why blank estimates dragged down gain totals). Safe to run
-- even if the column is already nullable.
alter table public.inventory_items
  alter column estimated_value drop not null;
