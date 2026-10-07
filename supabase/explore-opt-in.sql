-- The Explore page (/explore): an opt-in, separate from "listed".
--
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run.
--
-- "listed" was consented to as "search engines may index my page". Appearing
-- on an in-app page that strangers browse is a different kind of exposure, so
-- it gets its own switch rather than being inferred from that one. It defaults
-- to false: applying this patch puts nobody on Explore, including collections
-- that are already listed.
--
-- Explore also requires visibility = 'listed' (enforced where it is read, in
-- src/lib/sharedCollection.js). An unlisted page on a public browse page would
-- stop being link-only, which is the whole of what unlisted promises.
alter table public.shared_collections
  add column if not exists show_on_explore boolean not null default false;

-- Which items lead the collection's strip on Explore, in the owner's order.
-- Empty means "my most recent" -- most collectors will never touch this, and
-- that must still give them a strip.
--
-- Ids only, never a copy of the item: a pick is re-checked against the item's
-- current sharing state every time the page renders, so an item hidden or sold
-- after being picked drops out on its own instead of lingering here.
alter table public.shared_collections
  add column if not exists explore_item_ids uuid[] not null default '{}';

-- Matches EXPLORE_STRIP_LIMIT in src/utils/explore.js. The app never writes
-- more; this makes sure nothing else can either.
alter table public.shared_collections
  drop constraint if exists shared_collections_explore_item_ids_check;
alter table public.shared_collections
  add constraint shared_collections_explore_item_ids_check
    check (coalesce(array_length(explore_item_ids, 1), 0) <= 8);

-- Explore's one query: listed AND opted in. Partial, so it stays the size of
-- the Explore page rather than of the table.
create index if not exists shared_collections_explore_idx
  on public.shared_collections (updated_at desc)
  where visibility = 'listed' and show_on_explore;
