-- Reporting and blocking shared collections, and taking a page down.
--
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run. Run it before the code that reads these tables is deployed.
--
-- App Store guideline 1.2 asks any app showing other people's content for a way
-- to report it, a way to block who posted it, and a way to act on what comes in.
-- Explore and /c/<slug> pages show collectors' own photos and words.
--
-- All three tables are service-role only: RLS on, no policies, and the API-key
-- grants revoked. Nobody should be able to read who reported whom, and an owner
-- must not be able to lift a takedown on themselves -- which is why a takedown
-- is its own table rather than a column on shared_collections, whose row the
-- owner may update.

-- One row per report. A block also files one (reason 'blocked'), because blocking
-- is often the only signal that something on a page is wrong.
create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  -- Set null, not cascade: a reporter deleting their account shouldn't erase the
  -- report that a page broke the rules.
  reporter_id uuid references auth.users(id) on delete set null,
  -- The slug when reported, since "Reset link" can change it afterwards.
  slug text not null,
  item_id uuid,
  reason text not null check (reason in ('spam', 'offensive', 'harassment', 'private_info', 'illegal', 'other', 'blocked')),
  details text not null default '' check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'dismissed', 'actioned')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists content_reports_open_idx
  on public.content_reports (created_at desc) where status = 'open';
create index if not exists content_reports_owner_idx
  on public.content_reports (owner_id, status);
create index if not exists content_reports_reporter_idx
  on public.content_reports (reporter_id, created_at desc);

-- Blocks follow the owner, not the slug, so "Reset link" can't undo one.
-- slug_at_block lets the block list show that page without ever telling the
-- blocker a new unlisted link: see buildBlockList in src/utils/contentReports.js.
create table if not exists public.collection_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug_at_block text not null,
  created_at timestamptz not null default now(),
  unique (blocker_id, owner_id)
);

-- A row here takes the owner's page down everywhere: /c/<slug>, Explore, the
-- home page shelves and the sitemap. Their private collection is untouched.
create table if not exists public.moderated_collections (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  -- 'auto' (enough separate reports) or 'admin' (pressed in /admin).
  source text not null default 'admin' check (source in ('auto', 'admin')),
  hidden_at timestamptz not null default now()
);

alter table public.content_reports enable row level security;
alter table public.collection_blocks enable row level security;
alter table public.moderated_collections enable row level security;

revoke all on public.content_reports from anon, authenticated;
revoke all on public.collection_blocks from anon, authenticated;
revoke all on public.moderated_collections from anon, authenticated;
