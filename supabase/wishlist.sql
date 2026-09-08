-- The wishlist: copies a collector is looking for but does not own.
--
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run.
--
-- ---------------------------------------------------------------------------
-- Why this is a table and not a status
-- ---------------------------------------------------------------------------
-- inventory_items records FACTS about a copy in hand: this one is Near Fine, it
-- cost $45, it arrived in March. A want records a SPECIFICATION for a copy that
-- does not exist in the collection yet: a First/First, jacket required, Near
-- Fine or better, not over $3,500. Those are different kinds of statement, and
-- the fields below have no meaning on an owned item -- "won't pay over" is not
-- a property of a book you already bought.
--
-- FirstFinder did have a "Wishlist" status, and the evidence that it did not
-- work is in the data: of 193 rows at the time this was written, zero used it.
-- Nobody adopted it, so there is nothing to migrate and no compatibility to
-- preserve -- see the status removal at the end of this file.
--
-- The separation also fixes a live arithmetic bug by construction rather than
-- by remembering to filter. getActiveInventory() in src/utils/items.js excludes
-- only "Sold", so a Wishlist row counted inside "Estimated value" and inside
-- the My Collection item count: books the collector did not own, inflating what
-- their collection was worth. A want in its own table cannot reach those totals
-- however carelessly a future query is written.

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- What, in the loosest terms. Category mirrors inventory_items so a want can
  -- be a card or a piece of memorabilia, not only a book.
  name text not null default '',
  maker text not null default '',
  category text not null default 'Book',

  -- -------------------------------------------------------------------------
  -- The specification: the copy that would actually be a yes.
  -- -------------------------------------------------------------------------
  -- Named wanted_* rather than reusing book_edition / book_printing so that
  -- nothing here can be confused for a fact about a copy in hand -- these are
  -- conditions on a copy nobody has seen yet.
  wanted_edition text not null default '',
  wanted_printing text not null default '',
  publisher text not null default '',

  -- The WORST acceptable grade, not the grade of anything. Values come from
  -- conditionOptions in src/utils/constants.js, which is ordered best to worst,
  -- so "acceptable" is an index comparison rather than a lookup table. Blank
  -- means no condition floor.
  min_condition text not null default '',

  -- required  -- no jacket, no deal
  -- preferred -- would rather have one
  -- any       -- do not care
  -- na        -- meaningless for this item (a card, a paperback original)
  jacket_requirement text not null default 'any',

  -- any | signed | inscribed | association. Ascending scarcity, but NOT a
  -- threshold: someone hunting an association copy is not served by a merely
  -- signed one, and someone who wants it signed is usually delighted by an
  -- inscription. Treated as a preference to display, not a filter to enforce.
  signature_requirement text not null default 'any',

  -- -------------------------------------------------------------------------
  -- Limits
  -- -------------------------------------------------------------------------
  -- The ceiling. Null (not 0) when there is no limit set, so "would pay
  -- anything" stays distinguishable from "would pay nothing" -- the same
  -- null-vs-zero rule inventory_items.estimated_value follows.
  --
  -- NEVER published. A maximum price is a negotiating position, and putting it
  -- on a public page invites a dealer to price exactly at it. The public
  -- wishlist omits this column entirely rather than gating it behind a toggle
  -- someone could switch on without thinking about it.
  max_price numeric,
  preferred_source text not null default '',

  -- -------------------------------------------------------------------------
  -- Why, and what it is for
  -- -------------------------------------------------------------------------
  -- grail | hunting | someday. Sorted in that order in the app.
  priority text not null default 'hunting',

  -- The upgrade case: this want exists to replace a copy already owned. Set
  -- null rather than deleted if that copy goes, because wanting a better one
  -- outlives selling the worse one.
  upgrade_for_item_id uuid references public.inventory_items(id) on delete set null,

  notes text not null default '',

  -- Keeps one want off a published wishlist while leaving the rest shared,
  -- mirroring inventory_items.hidden_from_share.
  hidden_from_share boolean not null default false,

  -- -------------------------------------------------------------------------
  -- The end of the hunt
  -- -------------------------------------------------------------------------
  -- A found want is kept rather than deleted: how long something was hunted,
  -- and what was set out for, is the interesting half of collecting, and
  -- deleting the row throws it away at the exact moment it becomes a story.
  -- The list hides these by default -- found_at is null for anything still
  -- being looked for.
  found_at timestamptz,
  found_item_id uuid references public.inventory_items(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint wishlist_items_priority_check
    check (priority in ('grail', 'hunting', 'someday')),
  constraint wishlist_items_jacket_check
    check (jacket_requirement in ('required', 'preferred', 'any', 'na')),
  constraint wishlist_items_signature_check
    check (signature_requirement in ('any', 'signed', 'inscribed', 'association'))
);

-- Every read is "this user's wants, still open, best-first".
create index if not exists wishlist_items_user_open_idx
  on public.wishlist_items (user_id, created_at desc)
  where found_at is null;

-- The upgrade badge on an owned item reads the other way round: given this
-- item, is anyone hunting a replacement for it?
create index if not exists wishlist_items_upgrade_for_idx
  on public.wishlist_items (upgrade_for_item_id)
  where upgrade_for_item_id is not null;

-- Owner-only, exactly like inventory_items. The public wishlist page is
-- server-rendered through the service-role client for the same reason the
-- collection page is: no anon-readable policy exists on this table, so a
-- leaked anon key cannot reach one row -- least of all max_price.
alter table public.wishlist_items enable row level security;

drop policy if exists "Users can view own wants" on public.wishlist_items;
create policy "Users can view own wants"
on public.wishlist_items for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own wants" on public.wishlist_items;
create policy "Users can insert own wants"
on public.wishlist_items for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own wants" on public.wishlist_items;
create policy "Users can update own wants"
on public.wishlist_items for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own wants" on public.wishlist_items;
create policy "Users can delete own wants"
on public.wishlist_items for delete to authenticated
using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Retiring the "Wishlist" status
-- ---------------------------------------------------------------------------
-- The application no longer offers it (see statuses in src/utils/constants.js).
-- Nothing is dropped here and no rows are rewritten: status is free text with
-- no constraint, this database has zero rows using it, and a fork's database
-- might not. Any that exist keep working as ordinary items and simply stop
-- being offered as a choice.
--
-- To find them in a fork before removing the option there:
--
--   select id, name, maker from public.inventory_items where status = 'Wishlist';
--
-- Moving them across by hand, preserving what little the status could record:
--
--   insert into public.wishlist_items (user_id, name, maker, category, wanted_edition, wanted_printing, notes)
--   select user_id, name, maker, category, book_edition, book_printing, notes
--   from public.inventory_items where status = 'Wishlist';
--
--   delete from public.inventory_items where status = 'Wishlist';
