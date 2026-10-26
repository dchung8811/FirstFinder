-- FirstFinder: full database schema, from scratch.
--
-- The other files in this folder are incremental patches, applied in order as
-- the app grew. They assume a database that already has the tables. This file
-- is the opposite: it is the whole schema in one place, so a contributor with
-- a brand-new Supabase project can stand up a working local database in one
-- paste without replaying that history.
--
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
--
-- Safe to re-run: every statement is idempotent, and every policy block drops
-- the historical names for that policy before creating the canonical one, so a
-- re-run converges on one set rather than stacking a second set beside it.
--
-- If you add a column or a policy, add it BOTH here and in a new patch file,
-- so fresh setups and existing databases stay in step.
--
-- Every table also carries explicit grants, next to its policies. Supabase used
-- to hand the anon, authenticated and service_role API roles every privilege on
-- any new table in "public"; from 30 October 2026 it stops, and a table with no
-- grant answers every supabase-js call with "permission denied" however correct
-- its policies are. Grants decide which role may reach a table at all, RLS then
-- decides which rows. So each table is granted only what the app does with it:
-- anon reaches nothing but the site banner, authenticated gets the verbs its
-- policies allow, and service_role gets all four everywhere -- it is the server,
-- it bypasses RLS regardless, and narrowing it would only break the routes and
-- scripts that hold it. A project created before that date still has the old
-- blanket grants, and these add nothing there; that is expected.
--
-- If you add a table, add its grants in the same block, or it will be
-- unreachable from the app on any project that does not have the old defaults.

-- ---------------------------------------------------------------------------
-- inventory_items: one row per collectible.
-- ---------------------------------------------------------------------------
create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Short, human-friendly per-user number, shown as FF-0001. Assigned in
  -- application code rather than by a trigger -- see reference-number.sql for
  -- why, and for the unique index that backstops it.
  reference_number integer,

  name text not null default '',
  category text not null default 'Other',

  -- The two halves of the credit line. author is offered by the app only for
  -- the categories that have one (Book, Comic); maker is the make, publisher,
  -- or brand and applies to everything. Both are plain text: a row can carry
  -- an author from a category it no longer belongs to, and nothing here
  -- deletes it. See author-field.sql for the split, which was one column.
  author text not null default '',
  maker text not null default '',
  -- Free-text "Edition / Variant / Details" for every category except Book,
  -- which uses book_edition / book_printing below and stores this blank. See
  -- book-edition-backfill.sql.
  edition text not null default '',

  -- Book-specific detail fields. Blank for every other category.
  book_genre text not null default '',
  book_edition text not null default '',
  book_printing text not null default '',

  status text not null default 'Owned',
  -- Free-text-compatible, but the app only ever writes one of:
  -- "Near Fine/Fine", "Very Good/Good", "Fair", "Poor", or "" (not set).
  condition text not null default '',

  purchase_date date,
  source text not null default '',
  purchase_price numeric,
  -- Null (not 0) when no estimate has been entered, so "no estimate yet"
  -- stays distinguishable from "estimated at $0" across a save/reload.
  estimated_value numeric,

  -- Realized sale info, captured when an item is marked sold, and cleared
  -- again on restore. previous_status is what the item's status was just
  -- before the sale, so restoring returns it there instead of to "Owned".
  previous_status text,
  sold_price numeric,
  sold_date date,

  notes text not null default '',

  -- Keeps one item off the owner's public collection page while leaving the
  -- rest of it shared. All-or-nothing per item -- see shared-collections.sql.
  hidden_from_share boolean not null default false,

  -- Photo records, shaped {"path": "...", "name": "..."}. The counts are
  -- denormalized so list views don't have to read the JSON.
  item_photos jsonb not null default '[]'::jsonb,
  receipt_photos jsonb not null default '[]'::jsonb,
  item_photo_count integer not null default 0,
  receipt_photo_count integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enforces per-user uniqueness of the reference number. This is the guard
-- behind assigning numbers in application code: if two inserts race for the
-- same number, one fails loudly here instead of silently producing two items
-- that share a reference and can't be told apart by a CSV import.
create unique index if not exists inventory_items_user_reference_number_idx
  on public.inventory_items (user_id, reference_number);

-- No standalone (user_id) index: the unique index above already leads with
-- user_id, so it serves every `where user_id = ...` read on its own. A second
-- index on the same leading column would be one more structure to keep in
-- memory and to maintain on write, for lookups the first one already answers.
-- The deployed database does not have one, and this file should not create one
-- for a fresh project either.

-- Row Level Security is not optional here. The app talks to Supabase with the
-- public anon key and queries rows by id alone (e.g. .eq("id", id)) without
-- also filtering by user_id. That is safe ONLY because these owner-only
-- policies exist -- without them, any signed-in user could read, edit, or
-- delete anyone else's collection.
alter table public.inventory_items enable row level security;

-- These four have been created under three different names over the project's
-- life: "own items" here, "own inventory items" in inventory-items-rls.sql,
-- and "their own inventory" on the deployed database. Policies are OR'd, so
-- two sets with different names do not conflict -- they simply both run, and
-- every row read is checked twice for no benefit. Each block below therefore
-- drops every historical name before creating the canonical one, which is what
-- makes re-running this file converge instead of accumulate.
--
-- The canonical name is the one production already carries, so a re-run there
-- rewrites the policy it already has rather than introducing a new one.

drop policy if exists "Users can view own items" on public.inventory_items;
drop policy if exists "Users can view own inventory items" on public.inventory_items;
drop policy if exists "Users can view their own inventory" on public.inventory_items;
create policy "Users can view their own inventory"
on public.inventory_items for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own items" on public.inventory_items;
drop policy if exists "Users can insert own inventory items" on public.inventory_items;
drop policy if exists "Users can insert their own inventory" on public.inventory_items;
create policy "Users can insert their own inventory"
on public.inventory_items for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own items" on public.inventory_items;
drop policy if exists "Users can update own inventory items" on public.inventory_items;
drop policy if exists "Users can update their own inventory" on public.inventory_items;
create policy "Users can update their own inventory"
on public.inventory_items for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own items" on public.inventory_items;
drop policy if exists "Users can delete own inventory items" on public.inventory_items;
drop policy if exists "Users can delete their own inventory" on public.inventory_items;
create policy "Users can delete their own inventory"
on public.inventory_items for delete to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.inventory_items to authenticated;
grant select, insert, update, delete on public.inventory_items to service_role;

-- ---------------------------------------------------------------------------
-- feedback: the in-app "Send feedback" form.
-- ---------------------------------------------------------------------------
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  -- Same {"path", "name"} shape as the inventory photo columns. Stored in the
  -- same item-photos bucket under <user_id>/feedback/<feedback_id>/..., so the
  -- bucket policies below (which only check the first path segment) already
  -- cover them -- no separate bucket or policy needed.
  photos jsonb not null default '[]'::jsonb,
  -- Not surfaced in the app UI; lets whoever reviews feedback triage it in the
  -- Supabase table editor (e.g. new / reviewed / resolved).
  status text not null default 'new',

  -- The feedback -> GitHub issue pipeline, driven by app/api/feedback-review.
  --
  -- triage holds the whole machine-generated assessment as one document: type,
  -- severity, suggested labels, proposed approach, possible duplicates. Its
  -- shape belongs to the triage prompt's JSON schema and changes as that prompt
  -- is tuned, so promoting fields to columns would mean a migration each time.
  -- Nothing queries inside it.
  triage jsonb,
  -- new | triaged | published | dismissed | error. Separate from `status` above,
  -- which is the maintainer's own free-text note in the table editor.
  triage_status text not null default 'new',
  triage_error text,
  triaged_at timestamptz,
  -- Set together when an issue is filed. The url is stored rather than rebuilt
  -- from the number so a repo rename doesn't break old rows.
  github_issue_number integer,
  github_issue_url text,
  published_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The review queue reads "oldest unhandled first".
create index if not exists feedback_triage_status_created_at_idx
  on public.feedback (triage_status, created_at);

alter table public.feedback enable row level security;

drop policy if exists "Users can view own feedback" on public.feedback;
create policy "Users can view own feedback"
on public.feedback for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own feedback" on public.feedback;
create policy "Users can insert own feedback"
on public.feedback for insert to authenticated
with check ((select auth.uid()) = user_id);

-- Photos are attached in a follow-up update after the initial insert (the same
-- two-step pattern as inventory_items), so users need to be able to update
-- their own feedback rows to attach the uploaded photo records.
drop policy if exists "Users can update own feedback" on public.feedback;
create policy "Users can update own feedback"
on public.feedback for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- No delete: there is no delete policy either, and a sent message stays sent.
-- Account deletion removes feedback through the service role.
grant select, insert, update on public.feedback to authenticated;
grant select, insert, update, delete on public.feedback to service_role;

-- ---------------------------------------------------------------------------
-- shared_collections: the settings behind a public /c/<slug> collection page.
-- ---------------------------------------------------------------------------
-- The public page is server-rendered and reads through the service-role client
-- (src/lib/sharedCollection.js), never the browser's anon key, so there is
-- deliberately no anon or public select policy on this table or on
-- inventory_items. Adding one to "make sharing easier" would hand every
-- anon-key holder the columns the page itself never prints -- purchase prices,
-- sources, notes, receipt paths. See supabase/shared-collections.sql for the
-- full reasoning behind every column here.
create table if not exists public.shared_collections (
  user_id uuid primary key references auth.users(id) on delete cascade,

  -- Random, ~128 bits, generated in application code. Never derived from the
  -- user id or their name: an unlisted page's only protection is that its URL
  -- cannot be guessed. Rotating this is what "Reset link" does.
  slug text not null unique,

  -- off (route 404s) | unlisted (link-only, noindex) | listed (indexed).
  -- Defaults to off, so creating the row publishes nothing.
  visibility text not null default 'off',

  title text not null default '',
  blurb text not null default '',

  -- Field groups, mirroring shareFieldGroups in src/utils/publicCollection.js.
  -- All default false, so switching sharing on lands on the shelf-only view.
  show_estimated_value boolean not null default false,
  show_prices boolean not null default false,
  show_provenance boolean not null default false,
  show_notes boolean not null default false,
  show_sold boolean not null default false,
  show_wishlist boolean not null default false,

  -- Explore (/explore) is its own consent, not implied by 'listed', and only
  -- honoured for listed pages. explore_item_ids is the owner's chosen strip,
  -- empty meaning "most recent". See supabase/explore-opt-in.sql.
  show_on_explore boolean not null default false,
  explore_item_ids uuid[] not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint shared_collections_visibility_check
    check (visibility in ('off', 'unlisted', 'listed')),
  constraint shared_collections_explore_item_ids_check
    check (coalesce(array_length(explore_item_ids, 1), 0) <= 8)
);

-- When the page first went live, for the admin dashboard's "new shares" count.
-- Set by the trigger below on the first write that leaves it off 'off', and
-- never cleared. See supabase/admin-metrics.sql. Added after the table rather
-- than inside it so a database built from an older copy of this file picks it
-- up on a re-run.
alter table public.shared_collections
  add column if not exists first_published_at timestamptz;

create or replace function public.stamp_first_published()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.visibility <> 'off' and new.first_published_at is null then
    new.first_published_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists shared_collections_stamp_first_published on public.shared_collections;
create trigger shared_collections_stamp_first_published
  before insert or update on public.shared_collections
  for each row execute function public.stamp_first_published();

create index if not exists shared_collections_visibility_idx
  on public.shared_collections (visibility)
  where visibility <> 'off';

create index if not exists shared_collections_explore_idx
  on public.shared_collections (updated_at desc)
  where visibility = 'listed' and show_on_explore;

alter table public.shared_collections enable row level security;

drop policy if exists "Users can view own share settings" on public.shared_collections;
create policy "Users can view own share settings"
on public.shared_collections for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own share settings" on public.shared_collections;
create policy "Users can insert own share settings"
on public.shared_collections for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own share settings" on public.shared_collections;
create policy "Users can update own share settings"
on public.shared_collections for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own share settings" on public.shared_collections;
create policy "Users can delete own share settings"
on public.shared_collections for delete to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.shared_collections to authenticated;
grant select, insert, update, delete on public.shared_collections to service_role;

-- ---------------------------------------------------------------------------
-- Storage: item and receipt photos.
-- ---------------------------------------------------------------------------
-- Receipts can hold personal information, so this bucket is NOT public; the
-- app renders photos through short-lived signed URLs instead.
insert into storage.buckets (id, name, public)
values ('item-photos', 'item-photos', false)
on conflict (id) do nothing;

-- Each user can only touch files inside their own top-level folder. Paths look
-- like "<user_id>/<item_id>/<file>".
drop policy if exists "Users can view own photos" on storage.objects;
create policy "Users can view own photos"
on storage.objects for select to authenticated
using (bucket_id = 'item-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can upload own photos" on storage.objects;
create policy "Users can upload own photos"
on storage.objects for insert to authenticated
with check (bucket_id = 'item-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete own photos" on storage.objects;
create policy "Users can delete own photos"
on storage.objects for delete to authenticated
using (bucket_id = 'item-photos' and (storage.foldername(name))[1] = auth.uid()::text);


-- ---------------------------------------------------------------------------
-- book_catalog: the shared reference table behind item-name autocomplete.
-- ---------------------------------------------------------------------------
-- A read-only list of books that exist, kept separate from inventory_items for
-- the same reason wishlist_items is separate: "this book exists" and "I own
-- this copy, Near Fine, bought for $45" are different kinds of statement with
-- different owners. Picking a suggestion copies a snapshot into the item rather
-- than storing a reference, so a collector can edit freely and a later catalog
-- correction cannot rewrite what someone recorded about a copy in their hand.
--
-- Nothing here makes a first-edition claim. Rows are bulk imported and
-- unchecked; identification claims live in src/content/books/, where each one
-- carries a source and a human verified it. See supabase/book-catalog.sql for
-- the long version of all of this.

-- Trigram matching is what makes "gats" find "The Great Gatsby" without a
-- leading-anchored index scan. Supabase keeps extensions in their own schema.
create extension if not exists pg_trgm with schema extensions;

create table if not exists public.book_catalog (
  id uuid primary key default gen_random_uuid(),

  title text not null,
  author text not null default '',

  -- The first edition's publisher, as far as Open Library's edition records
  -- can establish it: the oldest printed English edition, with reprints that
  -- carry the original's date outvoted (scripts/first-edition.mjs). It is
  -- copied into the item's Make / Publisher / Brand field on a pick. Better
  -- evidence than the first seed's, which took whichever imprint the search
  -- index listed first, but still unchecked -- so the hint under the name still
  -- says to confirm it against the copy.
  publisher text not null default '',

  -- The year of that same first edition. For a translated book it is the
  -- first ENGLISH edition, because the title is the English title.
  first_published_year integer,

  -- Open Library's cover id. Kept for a future thumbnail in the dropdown;
  -- nothing renders it yet.
  cover_id text not null default '',

  -- The Open Library work key ("/works/OL893415W"). Unique, so re-running the
  -- seed script updates rows instead of duplicating them. Where Open Library
  -- holds one book as several works, the seed merges them and keeps the key of
  -- the one with the most editions. Null for rows that came from somewhere else.
  openlibrary_key text unique,

  -- openlibrary -- bulk imported, unchecked.
  -- user        -- promoted from what collectors actually recorded.
  -- verified    -- a human confirmed this row's fields.
  -- Note that even "verified" here means the title/author/publisher are right,
  -- never that any copy is a first edition.
  source text not null default 'openlibrary'
    check (source in ('openlibrary', 'user', 'verified')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One denormalised haystack rather than searching two columns separately, so a
-- query like "herbert dune" can match across both and one index serves the
-- whole lookup. Generated, so it cannot drift from the columns it summarises.
alter table public.book_catalog
  add column if not exists search_text text
  generated always as (lower(title || ' ' || author)) stored;

-- GIN + trigram is what lets an unanchored ILIKE '%query%' use an index. A
-- btree here would be useless: the interesting searches are all infix.
create index if not exists book_catalog_search_trgm_idx
  on public.book_catalog using gin (search_text extensions.gin_trgm_ops);

-- Serves the membership check in queue_book_suggestion below, which asks
-- "does the catalog already know this title" on every book saved.
--
-- Deliberately NOT unique. Open Library occasionally holds two work records for
-- one book, and a unique constraint here would turn that upstream data quirk
-- into a failed seed run. A duplicate row is a cosmetic problem the dropdown
-- already solves -- mergeSuggestions in src/utils/bookSearch.js collapses rows
-- with the same title and author -- and openlibrary_key still stops a re-run
-- from inserting the same record twice.
create index if not exists book_catalog_title_author_idx
  on public.book_catalog (lower(title), lower(author));

alter table public.book_catalog enable row level security;

-- Read-only to every signed-in user, and writable by nobody through the API.
-- There is no insert, update, or delete policy anywhere in this file, so the
-- only thing that can write here is the service role -- which means the seed
-- script and the promotion job, both of which run outside the browser.
--
-- Anon is deliberately excluded. Autocomplete only exists inside the add-item
-- form, which requires an account, and an unauthenticated endpoint returning
-- bulk bibliographic data is a scraping target for no benefit.
drop policy if exists "Signed-in users can read the catalog" on public.book_catalog;
create policy "Signed-in users can read the catalog"
on public.book_catalog for select to authenticated
using (true);

-- search_book_catalog below runs as its caller, so this select is also what
-- lets autocomplete work at all.
grant select on public.book_catalog to authenticated;
grant select, insert, update, delete on public.book_catalog to service_role;

-- ---------------------------------------------------------------------------
-- search_book_catalog: the autocomplete lookup.
-- ---------------------------------------------------------------------------
-- Security INVOKER (the default), so the select policy above still applies --
-- this function grants no access the caller did not already have.
--
-- Ranking, in order: an exact title match, then a title that starts with what
-- was typed, then an author that starts with it, then everything else by
-- trigram similarity. That ordering is what makes typing "dune" put Dune first
-- rather than "The Dune Encyclopedia", without needing a relevance score the
-- caller has to interpret.
create or replace function public.search_book_catalog(p_query text, p_limit integer default 8)
returns table (
  id uuid,
  title text,
  author text,
  publisher text,
  first_published_year integer,
  cover_id text,
  source text
)
language sql
stable
set search_path = public, extensions
as $$
  with needle as (
    select lower(trim(coalesce(p_query, ''))) as q
  )
  select
    b.id,
    b.title,
    b.author,
    b.publisher,
    b.first_published_year,
    b.cover_id,
    b.source
  from public.book_catalog b, needle n
  -- Three characters is both the product rule ("autocomplete shows up at three
  -- letters") and a technical floor: a trigram index cannot help with fewer,
  -- so a two-character query would mean a sequential scan of the whole table.
  where length(n.q) >= 3
    and b.search_text like '%' || n.q || '%'
  order by
    case
      when lower(b.title) = n.q then 0
      when lower(b.title) like n.q || '%' then 1
      when lower(b.author) like n.q || '%' then 2
      else 3
    end,
    similarity(b.search_text, n.q) desc,
    -- Older first, on the theory that someone cataloguing a collectible book is
    -- far more often holding the 1965 printing than the 2019 reissue.
    coalesce(b.first_published_year, 9999),
    b.title
  limit least(greatest(coalesce(p_limit, 8), 1), 25);
$$;

revoke all on function public.search_book_catalog(text, integer) from public, anon;
grant execute on function public.search_book_catalog(text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- book_catalog_suggestions: growing the catalog from what people actually own.
-- ---------------------------------------------------------------------------
-- A bulk bibliography is something anyone can download. The accumulating record
-- of what collectors actually catalogue is not, and it is the better source of
-- what belongs in here -- so every book saved that the catalog does not already
-- know about gets queued for review.
--
-- This is a queue, not a catalog. Nothing here is readable by users and nothing
-- here reaches autocomplete until a person promotes the row.
create table if not exists public.book_catalog_suggestions (
  id uuid primary key default gen_random_uuid(),

  -- Who first recorded it. Kept only so an import that turns out to be junk can
  -- be traced back to a pattern of abuse, and it goes when the account does.
  user_id uuid references auth.users(id) on delete set null,

  title text not null,
  author text not null default '',

  -- How many separate accounts have now recorded this book. The promotion
  -- signal: three collectors independently owning it says more than one does.
  seen_count integer not null default 1,

  status text not null default 'new'
    check (status in ('new', 'promoted', 'rejected')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists book_catalog_suggestions_unique_idx
  on public.book_catalog_suggestions (lower(title), lower(author));

create index if not exists book_catalog_suggestions_status_idx
  on public.book_catalog_suggestions (status, seen_count desc);

-- RLS on with no policies at all, which denies every anon and authenticated
-- request. The queue is written only through the security-definer function
-- below and read only by the maintainer in the table editor. A user being able
-- to read this table would learn what other people are collecting.
alter table public.book_catalog_suggestions enable row level security;

-- Nothing for authenticated: queue_book_suggestion is security definer, so it
-- writes as the table's owner and needs no grant from the caller.
grant select, insert, update, delete on public.book_catalog_suggestions to service_role;

-- ---------------------------------------------------------------------------
-- queue_book_suggestion: called once per book saved.
-- ---------------------------------------------------------------------------
-- Does the catalog-membership check in SQL rather than in the app, so saving an
-- item costs one round trip instead of a lookup followed by a conditional
-- write. Security definer because it writes to a table with no insert policy;
-- it is deliberately narrow -- it takes two strings, it writes at most one row,
-- and it returns nothing a caller could mine.
create or replace function public.queue_book_suggestion(p_title text, p_author text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text := nullif(trim(coalesce(p_title, '')), '');
  v_author text := trim(coalesce(p_author, ''));
begin
  -- Nothing to learn from a blank or a single letter.
  if v_title is null or length(v_title) < 3 then
    return;
  end if;

  -- Already known: the whole point is to find what the catalog is missing.
  if exists (
    select 1 from public.book_catalog b
    where lower(b.title) = lower(v_title)
      and (v_author = '' or lower(b.author) = lower(v_author))
  ) then
    return;
  end if;

  insert into public.book_catalog_suggestions (user_id, title, author)
  values (auth.uid(), v_title, v_author)
  on conflict (lower(title), lower(author)) do update
    -- A second collector recording the same book is the signal worth counting.
    set seen_count = book_catalog_suggestions.seen_count + 1,
        updated_at = now();
end;
$$;

revoke all on function public.queue_book_suggestion(text, text) from public, anon;
grant execute on function public.queue_book_suggestion(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Site banner (patch: site-banner.sql)
--
-- One row (id = 1) holding the announcement set from /admin. Readable by
-- anyone while enabled; writable only by the service role, which only
-- /api/admin/banner holds. See site-banner.sql for the reasoning. A fresh
-- project starts with no row, which reads as no banner.
-- ---------------------------------------------------------------------------
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

-- The only table anon is granted anything on: the banner shows to signed-out
-- visitors too. Writes go through /api/admin/banner.
grant select on public.site_banner to anon, authenticated;
grant select, insert, update, delete on public.site_banner to service_role;

-- ---------------------------------------------------------------------------
-- Scan-to-fill daily cap (patch: scan-daily-limit.sql)
--
-- An optional per-user cap on app/api/scan-book, used only when
-- SCAN_DAILY_LIMIT is set, and separate from photo identification's because a
-- scan costs a small fraction of what an identification does. RLS on with no policies: only the service role reads
-- or writes it. See scan-daily-limit.sql for the reasoning.
-- ---------------------------------------------------------------------------
create table if not exists public.scan_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null,
  call_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

alter table public.scan_usage enable row level security;

grant select, insert, update, delete on public.scan_usage to service_role;

create or replace function public.claim_scan_call(p_user_id uuid, p_limit integer)
returns table (allowed boolean, used integer, day_limit integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_used integer;
begin
  if p_limit <= 0 then
    return query select false, 0, p_limit;
    return;
  end if;

  insert into public.scan_usage as usage (user_id, usage_date, call_count)
  values (p_user_id, v_today, 1)
  on conflict (user_id, usage_date) do update
    set call_count = usage.call_count + 1,
        updated_at = now()
    where usage.call_count < p_limit
  returning usage.call_count into v_used;

  if v_used is null then
    return query select false, p_limit, p_limit;
    return;
  end if;

  return query select true, v_used, p_limit;
end;
$$;

revoke all on function public.claim_scan_call(uuid, integer) from public;
revoke all on function public.claim_scan_call(uuid, integer) from anon;
revoke all on function public.claim_scan_call(uuid, integer) from authenticated;
-- Explicit for the same reason the tables' grants are: after the revokes above,
-- service_role can call this only if something grants it, and a fresh project
-- should not depend on Supabase's defaults to do that.
grant execute on function public.claim_scan_call(uuid, integer) to service_role;

-- ---------------------------------------------------------------------------
-- wishlist_items: copies a collector is looking for but does not own
-- (patch: wishlist.sql)
-- ---------------------------------------------------------------------------
-- A table rather than a status, because a want is a specification for a copy
-- nobody has seen yet, not a fact about one in hand. See wishlist.sql for the
-- reasoning, and for the retired "Wishlist" status this replaced.
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
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own wants" on public.wishlist_items;
create policy "Users can insert own wants"
on public.wishlist_items for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own wants" on public.wishlist_items;
create policy "Users can update own wants"
on public.wishlist_items for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own wants" on public.wishlist_items;
create policy "Users can delete own wants"
on public.wishlist_items for delete to authenticated
using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.wishlist_items to authenticated;
grant select, insert, update, delete on public.wishlist_items to service_role;

-- ---------------------------------------------------------------------------
-- login_events: the login history Supabase does not keep for us
-- (patches: admin-metrics.sql, login-events-trigger.sql)
-- ---------------------------------------------------------------------------
-- One row per sign-in, written by a trigger on auth.users and read only by the
-- admin dashboard through the service role. See admin-metrics.sql for why
-- auth's own records cannot answer "how many logins".
create table if not exists public.login_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists login_events_created_at_idx
  on public.login_events (created_at desc);
create index if not exists login_events_user_id_created_at_idx
  on public.login_events (user_id, created_at desc);

-- RLS on with no policies: the API keys can neither read nor write this table.
-- Reading it would tell a user when other people signed in, and since the
-- trigger below writes every row, nothing in the browser needs to write one.
alter table public.login_events enable row level security;

-- The browser used to insert these rows itself. Dropped and revoked rather
-- than just left out, so a database built from an older copy of this file
-- loses them on a re-run.
drop policy if exists "Users can record own logins" on public.login_events;
revoke insert on public.login_events from authenticated;
grant select, insert, update, delete on public.login_events to service_role;

-- Logins are recorded where Supabase completes them, not in the browser.
-- Sign-ins that come back through a redirect -- Google, and the email
-- confirmation link every new collector's first sign-in goes through --
-- finish before the app's auth listener can tell them apart from a restored
-- session, so the old client-side insert missed nearly all of them.
-- last_sign_in_at moves on every real sign-in and never on a token refresh,
-- which is exactly the line the login count needs.
--
-- The insert must never fail the sign-in itself: this runs inside the
-- auth.users update that completes it, so an error here would lock a
-- collector out over a missing metric. The exception handler trades that for
-- one lost row.
create or replace function public.record_login_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.last_sign_in_at is null then
    return new;
  end if;
  -- Nested rather than one OR: OLD has no row on insert, and an OR is not
  -- guaranteed to skip reading it.
  if tg_op = 'UPDATE' then
    if new.last_sign_in_at is not distinct from old.last_sign_in_at then
      return new;
    end if;
  end if;

  begin
    insert into public.login_events (user_id, created_at)
    values (new.id, new.last_sign_in_at);
  exception when others then
    raise warning 'login event not recorded for %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

-- Fired only by the trigger. Revoked so it is not left callable through the
-- API keys like every other function in public.
revoke all on function public.record_login_event() from public;
revoke all on function public.record_login_event() from anon;
revoke all on function public.record_login_event() from authenticated;

drop trigger if exists on_auth_user_sign_in on auth.users;
create trigger on_auth_user_sign_in
  after insert or update of last_sign_in_at on auth.users
  for each row execute function public.record_login_event();

-- ---------------------------------------------------------------------------
-- Photo identification daily cap (patch: identify-daily-limit.sql)
-- ---------------------------------------------------------------------------
-- The persisted per-user cap on app/api/identify-book, plus per-user overrides.
-- RLS on with no policies: only the service role reads or writes these, and
-- overrides are set by hand in the SQL editor. See identify-daily-limit.sql
-- for the reasoning and the day-to-day queries.
create table if not exists public.identify_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null,
  call_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

-- daily_limit 0 switches identification off for that account entirely.
create table if not exists public.identify_limits (
  user_id uuid primary key references auth.users (id) on delete cascade,
  daily_limit integer not null check (daily_limit >= 0),
  note text,
  updated_at timestamptz not null default now()
);

alter table public.identify_usage enable row level security;
alter table public.identify_limits enable row level security;

grant select, insert, update, delete on public.identify_usage to service_role;
grant select, insert, update, delete on public.identify_limits to service_role;

create or replace function public.claim_identify_call(p_user_id uuid, p_limit integer)
returns table (allowed boolean, used integer, day_limit integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'utc')::date;
  v_limit integer;
  v_used integer;
begin
  select limits.daily_limit into v_limit
  from public.identify_limits as limits
  where limits.user_id = p_user_id;

  v_limit := coalesce(v_limit, p_limit);

  if v_limit <= 0 then
    return query select false, 0, v_limit;
    return;
  end if;

  insert into public.identify_usage as usage (user_id, usage_date, call_count)
  values (p_user_id, v_today, 1)
  on conflict (user_id, usage_date) do update
    set call_count = usage.call_count + 1,
        updated_at = now()
    where usage.call_count < v_limit
  returning usage.call_count into v_used;

  -- No row came back, so the ON CONFLICT guard refused: the user is already at
  -- the cap. Read the current count for the message the route shows them.
  if v_used is null then
    select usage.call_count into v_used
    from public.identify_usage as usage
    where usage.user_id = p_user_id and usage.usage_date = v_today;

    return query select false, coalesce(v_used, v_limit), v_limit;
    return;
  end if;

  return query select true, v_used, v_limit;
end;
$$;

-- Only the service role should be able to move someone's counter. Without this
-- revoke, a logged-in user holding the anon key could call the function
-- directly -- which would only ever spend their own allowance, but there is no
-- reason to leave it reachable.
revoke all on function public.claim_identify_call(uuid, integer) from public;
revoke all on function public.claim_identify_call(uuid, integer) from anon;
revoke all on function public.claim_identify_call(uuid, integer) from authenticated;
grant execute on function public.claim_identify_call(uuid, integer) to service_role;

-- ---------------------------------------------------------------------------
-- admin_platform_metrics: every admin dashboard number in one round trip
-- (patches: admin-metrics.sql, then pause-activity-sessions.sql)
-- ---------------------------------------------------------------------------
-- Read only by app/api/admin/stats through the service role. This is the
-- latest version, from pause-activity-sessions.sql; admin-metrics.sql explains
-- why it is a database function at all.
create or replace function public.admin_platform_metrics(p_exclude uuid[] default '{}')
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'generated_at', now(),

    'users', (
      select jsonb_build_object(
        'total', count(*),
        'excluding_admins', count(*) filter (where not (u.id = any(p_exclude))),
        'new_7d', count(*) filter (where u.created_at > now() - interval '7 days' and not (u.id = any(p_exclude))),
        'new_30d', count(*) filter (where u.created_at > now() - interval '30 days' and not (u.id = any(p_exclude))),
        -- last_sign_in_at is a single overwritten timestamp, so this is "came
        -- back at least once in the window", not a visit count. It is the one
        -- activity figure that has history behind it today; the login_events
        -- counts below only start from this migration.
        'active_7d', count(*) filter (where u.last_sign_in_at > now() - interval '7 days' and not (u.id = any(p_exclude))),
        'active_30d', count(*) filter (where u.last_sign_in_at > now() - interval '30 days' and not (u.id = any(p_exclude))),
        -- Signed up and never came back: the clearest single signal of whether
        -- the front door works. Counted as "one sign-in ever", since the
        -- account-creating login itself sets last_sign_in_at.
        'never_returned', count(*) filter (
          where not (u.id = any(p_exclude))
            and (u.last_sign_in_at is null or u.last_sign_in_at <= u.created_at + interval '5 minutes')
        )
      )
      from auth.users u
    ),

    'items', (
      select jsonb_build_object(
        'total', count(*),
        'excluding_admins', count(*) filter (where not (i.user_id = any(p_exclude))),
        'new_7d', count(*) filter (where i.created_at > now() - interval '7 days' and not (i.user_id = any(p_exclude))),
        'new_30d', count(*) filter (where i.created_at > now() - interval '30 days' and not (i.user_id = any(p_exclude))),
        'with_photos', count(*) filter (where i.item_photo_count > 0 and not (i.user_id = any(p_exclude))),
        -- Collectors who hold at least one item, which is the number that says
        -- whether signups are turning into use.
        'collectors', count(distinct i.user_id) filter (where not (i.user_id = any(p_exclude)))
      )
      from public.inventory_items i
    ),

    'shares', (
      select jsonb_build_object(
        'rows', count(*) filter (where not (s.user_id = any(p_exclude))),
        'published', count(*) filter (where s.visibility <> 'off' and not (s.user_id = any(p_exclude))),
        'listed', count(*) filter (where s.visibility = 'listed' and not (s.user_id = any(p_exclude))),
        'unlisted', count(*) filter (where s.visibility = 'unlisted' and not (s.user_id = any(p_exclude))),
        'new_30d', count(*) filter (where s.first_published_at > now() - interval '30 days' and not (s.user_id = any(p_exclude))),
        -- Opened the dialog, saved, and left it off. A visible drop-off point.
        'started_not_published', count(*) filter (where s.visibility = 'off' and not (s.user_id = any(p_exclude)))
      )
      from public.shared_collections s
    ),

    'feedback', (
      select jsonb_build_object(
        'total', count(*),
        'new_7d', count(*) filter (where f.created_at > now() - interval '7 days'),
        'filed_to_github', count(*) filter (where f.github_issue_number is not null),
        -- Anything stuck in 'error' is feedback a person took the trouble to
        -- write that never reached the tracker, so it is worth surfacing.
        'errored', count(*) filter (where f.triage_status = 'error')
      )
      from public.feedback f
    ),

    'identify', (
      select jsonb_build_object(
        -- The only metric here attached to a per-call bill, which is why it is
        -- on the dashboard at all: every identification is a paid, search-
        -- grounded model call.
        'calls_today', coalesce(sum(x.call_count) filter (where x.usage_date = (now() at time zone 'utc')::date), 0),
        'calls_7d', coalesce(sum(x.call_count) filter (where x.usage_date > (now() at time zone 'utc')::date - 7), 0),
        'calls_30d', coalesce(sum(x.call_count) filter (where x.usage_date > (now() at time zone 'utc')::date - 30), 0),
        'users_today', count(distinct x.user_id) filter (where x.usage_date = (now() at time zone 'utc')::date),
        'overrides', (select count(*) from public.identify_limits)
      )
      from public.identify_usage x
    ),

    'logins', (
      select jsonb_build_object(
        'total', count(*),
        'd7', count(*) filter (where l.created_at > now() - interval '7 days'),
        'd30', count(*) filter (where l.created_at > now() - interval '30 days'),
        'users_7d', count(distinct l.user_id) filter (where l.created_at > now() - interval '7 days'),
        -- Lets the UI say "since <date>" instead of quietly presenting a
        -- partial count as a lifetime total. Null until the first login lands.
        'tracked_since', min(l.created_at)
      )
      from public.login_events l
      where not (l.user_id = any(p_exclude))
    ),

    -- The capacity half: what the free plan meters, read from the database
    -- itself. Thresholds and plan limits live in application code
    -- (src/utils/platformLimits.js), not here -- they are a published price
    -- list that changes without warning, and editing a constant is a deploy
    -- while editing this function is a migration.
    'capacity', jsonb_build_object(
      'db_bytes', pg_database_size(current_database()),
      'storage_bytes', (select coalesce(sum((o.metadata->>'size')::bigint), 0) from storage.objects o),
      'storage_objects', (select count(*) from storage.objects),
      -- Supabase bills monthly active users across the whole project, so this
      -- one is deliberately NOT owner-excluded: it must match what they meter.
      'mau_30d', (select count(*) from auth.users where last_sign_in_at > now() - interval '30 days'),
      -- Free projects can pause after a week of low activity, which for a
      -- quiet project is a likelier outage than any quota. The most recent of
      -- the things a real visit produces is the best proxy we have for it.
      --
      -- The session rows are what make it see visits. A collector who stays
      -- signed in never produces a new last_sign_in_at or login_events row,
      -- but the client refreshes its access token whenever it opens the app
      -- with an expired one and hourly while it stays open, and every refresh
      -- touches auth.sessions and mints a row in auth.refresh_tokens. Without
      -- these the dashboard reported "idle 8 of 7 days" on a project that had
      -- been used that same hour. Signing out deletes the session rows, which
      -- is why they are added to the other signals rather than replacing them.
      'last_activity_at', greatest(
        (select max(created_at) from public.inventory_items),
        (select max(updated_at) from public.inventory_items),
        (select max(last_sign_in_at) from auth.users),
        (select max(created_at) from public.login_events),
        (select max(updated_at) from auth.sessions),
        (select max(created_at) from auth.refresh_tokens)
      )
    )
  );
$$;

-- security definer means this function runs as its owner and can read
-- auth.users, so who may call it matters more than usual. Only the service
-- role should -- revoke the default grant from everyone else. Without this, any
-- holder of the anon key could call it directly and read the entire platform's
-- shape, which is exactly the leak the whole design above is avoiding.
revoke all on function public.admin_platform_metrics(uuid[]) from public;
revoke all on function public.admin_platform_metrics(uuid[]) from anon;
revoke all on function public.admin_platform_metrics(uuid[]) from authenticated;
grant execute on function public.admin_platform_metrics(uuid[]) to service_role;
