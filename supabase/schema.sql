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
-- Safe to re-run: every statement is idempotent. Existing projects (including
-- production) already have all of this from the patch files, so running it
-- there changes nothing.
--
-- If you add a column or a policy, add it BOTH here and in a new patch file,
-- so fresh setups and existing databases stay in step.

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

-- Every read in the app is scoped to the signed-in user.
create index if not exists inventory_items_user_id_idx
  on public.inventory_items (user_id);

-- Row Level Security is not optional here. The app talks to Supabase with the
-- public anon key and queries rows by id alone (e.g. .eq("id", id)) without
-- also filtering by user_id. That is safe ONLY because these owner-only
-- policies exist -- without them, any signed-in user could read, edit, or
-- delete anyone else's collection.
alter table public.inventory_items enable row level security;

drop policy if exists "Users can view own items" on public.inventory_items;
create policy "Users can view own items"
on public.inventory_items for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own items" on public.inventory_items;
create policy "Users can insert own items"
on public.inventory_items for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own items" on public.inventory_items;
create policy "Users can update own items"
on public.inventory_items for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own items" on public.inventory_items;
create policy "Users can delete own items"
on public.inventory_items for delete to authenticated
using (auth.uid() = user_id);

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
using (auth.uid() = user_id);

drop policy if exists "Users can insert own feedback" on public.feedback;
create policy "Users can insert own feedback"
on public.feedback for insert to authenticated
with check (auth.uid() = user_id);

-- Photos are attached in a follow-up update after the initial insert (the same
-- two-step pattern as inventory_items), so users need to be able to update
-- their own feedback rows to attach the uploaded photo records.
drop policy if exists "Users can update own feedback" on public.feedback;
create policy "Users can update own feedback"
on public.feedback for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

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

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint shared_collections_visibility_check
    check (visibility in ('off', 'unlisted', 'listed'))
);

create index if not exists shared_collections_visibility_idx
  on public.shared_collections (visibility)
  where visibility <> 'off';

alter table public.shared_collections enable row level security;

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

  -- The publisher of the edition Open Library happened to describe, which is
  -- very often NOT the first edition's publisher. It is shown in the suggestion
  -- row to tell two same-titled books apart, and is not copied into the item.
  publisher text not null default '',

  -- Year of first publication of the WORK, not of any particular printing.
  first_published_year integer,

  -- Open Library's cover id. Kept for a future thumbnail in the dropdown;
  -- nothing renders it yet.
  cover_id text not null default '',

  -- The Open Library work key ("/works/OL893415W"). Unique, so re-running the
  -- seed script updates rows instead of duplicating them. Null for rows that
  -- came from somewhere else.
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
