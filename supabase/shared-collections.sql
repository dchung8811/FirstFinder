-- Shareable collection pages.
--
-- Adds the per-user settings row behind /c/<slug>, plus the per-item opt-out
-- that lets a collector keep one item off an otherwise public page.
--
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run.
--
-- A note on how the public page reads this data, because it decides the whole
-- policy design below: the page is server-rendered and reads through the
-- service-role client (src/lib/sharedCollection.js), never through the
-- browser's anon key. So there is deliberately NO anon or public select policy
-- here, on either table. The rows a visitor sees have already been filtered
-- and stripped on the server by src/utils/publicCollection.js. If a public
-- select policy is ever added to inventory_items to "make sharing easier", it
-- hands every anon-key holder a route to rows the page itself would never
-- print -- purchase prices, sources, notes, receipt paths.

-- ---------------------------------------------------------------------------
-- shared_collections: one row per user, created the first time they open the
-- share dialog.
-- ---------------------------------------------------------------------------
create table if not exists public.shared_collections (
  -- One page per collector, so the user id is the key. A second page over a
  -- subset ("my Steinbeck shelf") would make this a normal id + user_id table.
  user_id uuid primary key references auth.users(id) on delete cascade,

  -- The public URL segment. Random, ~128 bits, generated in application code
  -- (generateShareSlug in src/utils/publicCollection.js) rather than derived
  -- from the user id or their name: an unlisted page's only protection is that
  -- its URL cannot be guessed or walked, and a derived slug would give away
  -- every other collector's page along with your own. Rotating this column is
  -- what "Reset link" does, and it is what revokes a link already sent.
  slug text not null unique,

  -- off | unlisted | listed.
  --   off      -- the route 404s. Nothing is served, so nothing is indexable.
  --   unlisted -- served to anyone with the link; noindex, and left out of the
  --               sitemap. Link-only in practice, but not secret.
  --   listed   -- served, indexed, and listed in the sitemap.
  -- Defaults to off: creating the row (which happens just by opening the
  -- dialog) must not publish anything.
  visibility text not null default 'off',

  -- Optional page heading and standfirst. Blank title falls back to the
  -- owner's account name in application code.
  title text not null default '',
  blurb text not null default '',

  -- The field groups, all defaulting to false so that switching sharing on
  -- always lands on the shelf-only view. Grouped the way the share dialog
  -- presents them, not one column per inventory column -- see shareFieldGroups
  -- in src/utils/publicCollection.js, which is the list this mirrors.
  --
  -- Discrete columns rather than a settings jsonb because this set is small
  -- and stable, and because each one is a privacy decision worth being able to
  -- see, grep, and audit by name. (Compare feedback.triage, which is jsonb
  -- precisely because its shape churns.)
  show_estimated_value boolean not null default false,
  show_prices boolean not null default false,
  show_provenance boolean not null default false,
  show_notes boolean not null default false,
  show_sold boolean not null default false,
  show_wishlist boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint shared_collections_visibility_check
    check (visibility in ('off', 'unlisted', 'listed'))
);

-- The public page looks a collection up by slug, and the sitemap sweeps for
-- listed ones. Both run on every render of a shared page.
create index if not exists shared_collections_visibility_idx
  on public.shared_collections (visibility)
  where visibility <> 'off';

alter table public.shared_collections enable row level security;

-- Owner-only, exactly like inventory_items. Nothing here grants anon anything:
-- the public page does not read through this table's policies at all.
drop policy if exists "Users can view own share settings" on public.shared_collections;
create policy "Users can view own share settings"
on public.shared_collections for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own share settings" on public.shared_collections;
create policy "Users can insert own share settings"
on public.shared_collections for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own share settings" on public.shared_collections;
create policy "Users can update own share settings"
on public.shared_collections for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own share settings" on public.shared_collections;
create policy "Users can delete own share settings"
on public.shared_collections for delete to authenticated
using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- inventory_items.hidden_from_share: the per-item opt-out.
-- ---------------------------------------------------------------------------
-- All-or-nothing per item, by design: field-level overrides per item would
-- multiply into a state space neither the share dialog nor a reader could keep
-- straight. Field rules are set once for the whole collection; an individual
-- item is either on the page or not on it.
--
-- Defaults to false ("not hidden") so existing rows land in the right state
-- without a backfill. That is safe because it only decides what a page shows
-- once the owner has already switched visibility off 'off', having seen a
-- preview of exactly what a visitor gets.
alter table public.inventory_items
  add column if not exists hidden_from_share boolean not null default false;
