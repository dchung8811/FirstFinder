-- The Explore page: a separate opt-in to appear on /explore.
--
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run.
--
-- Why a new column rather than reusing visibility = 'listed': "listed" was
-- agreed to as "search engines may index my page". Appearing on a browse page
-- inside the app, next to strangers' shelves, is a different kind of exposure,
-- and nobody who chose "listed" before Explore existed agreed to it. So it is
-- its own switch, and it defaults to false -- shipping this column publishes
-- no one.

alter table public.shared_collections
  add column if not exists show_on_explore boolean not null default false;

-- Explore links to /c/<slug>, so a collection on it is reachable by anyone
-- browsing -- which is what "listed" already means and what "unlisted"
-- explicitly does not. The constraint keeps an unlisted page from ever being
-- advertised on a public index of pages, whatever the client sends.
-- toDbShareRow clears the flag itself when visibility moves off "listed", so
-- the app never trips this; it is the second lock, not the first.
alter table public.shared_collections
  drop constraint if exists shared_collections_explore_requires_listed;
alter table public.shared_collections
  add constraint shared_collections_explore_requires_listed
    check (not show_on_explore or visibility = 'listed');

-- The Explore page sweeps for exactly this pair on every request.
create index if not exists shared_collections_explore_idx
  on public.shared_collections (updated_at desc)
  where show_on_explore;
