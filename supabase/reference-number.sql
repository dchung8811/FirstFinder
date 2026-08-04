-- Adds a short, human-friendly reference number to inventory_items (shown as
-- FF-0001 in the app). It is unique per user and never reused, which is what
-- lets the CSV bulk edit/delete tool use it as a matching key instead of
-- putting raw UUIDs in front of people in a spreadsheet.
--
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

alter table public.inventory_items
  add column if not exists reference_number integer;

-- Backfill existing rows: number each user's items 1..N in the order they
-- were created, so the numbers read like the order the collection was built.
--
-- Offsetting from each user's current max keeps this safe to re-run: a second
-- run only numbers rows still missing a value, and continues past whatever
-- numbers are already assigned rather than colliding with them.
with numbered as (
  select
    items.id,
    coalesce(existing.max_ref, 0)
      + row_number() over (partition by items.user_id order by items.created_at, items.id) as next_ref
  from public.inventory_items as items
  left join (
    select user_id, max(reference_number) as max_ref
    from public.inventory_items
    group by user_id
  ) as existing on existing.user_id = items.user_id
  where items.reference_number is null
)
update public.inventory_items as items
set reference_number = numbered.next_ref
from numbered
where items.id = numbered.id;

-- Enforces uniqueness per user. This is the guard behind assigning numbers in
-- application code: if two inserts ever race for the same number, one fails
-- loudly here instead of silently producing two items that share a reference
-- and therefore can't be told apart by a CSV import.
create unique index if not exists inventory_items_user_reference_number_idx
  on public.inventory_items (user_id, reference_number);

-- Left nullable on purpose. Making it NOT NULL would harden the guarantee, but
-- would also turn any future insert path that forgets to assign a number into
-- a hard failure for the user. The app assigns on every insert path today, and
-- the backfill above covers everything that already exists.
