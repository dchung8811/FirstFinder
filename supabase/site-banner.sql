-- The site-wide announcement banner, set from /admin.
--
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run.
--
-- One row, ever: id is pinned to 1. A banner is a single current notice, not
-- a feed, and a table that could hold several would need rules for which one
-- wins that nobody has asked for.
--
-- Anyone may read the row while it is switched on, signed in or not -- it is
-- shown to visitors on the home page too. Nobody may write it through the API
-- keys at all: there is no insert, update, or delete policy, so only the
-- service role can, and the only code holding that is /api/admin/banner,
-- behind requireAdmin(). A disabled banner is invisible to the public read, so
-- a draft saved switched off doesn't leak.
--
-- link_view is a page name from BANNER_DESTINATIONS in src/utils/siteBanner.js,
-- checked by the route. It is not constrained here so that adding a
-- destination stays a one-line code change rather than a migration too.
create table if not exists public.site_banner (
  id smallint primary key default 1 check (id = 1),
  enabled boolean not null default false,
  message text not null default '' check (char_length(message) <= 160),
  link_label text check (char_length(link_label) <= 40),
  link_view text,
  updated_at timestamptz not null default now()
);

alter table public.site_banner enable row level security;

drop policy if exists "Anyone can read the banner while it is on" on public.site_banner;
create policy "Anyone can read the banner while it is on"
  on public.site_banner for select
  to anon, authenticated
  using (enabled);

-- The first announcement: the Features page, live as soon as this runs. An
-- app deployed before the banner existed never asks for this row, so running
-- the patch early shows nothing until the code that reads it is out.
-- `do nothing` so a re-run never overwrites whatever /admin has set since.
insert into public.site_banner (id, enabled, message, link_label, link_view)
values (
  1,
  true,
  'New on FirstFinder: Explore other collectors'' shelves, offline mode, and more.',
  'See all features',
  'features'
)
on conflict (id) do nothing;
