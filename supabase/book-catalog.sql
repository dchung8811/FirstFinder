-- The book catalog: a shared, read-only reference table of books that exist,
-- used to autocomplete the item name when someone is adding a book.
--
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run: everything here is create-if-not-exists or create-or-replace.
--
-- ---------------------------------------------------------------------------
-- Why this is a separate table from inventory_items
-- ---------------------------------------------------------------------------
-- Same reasoning that split wishlist_items out. inventory_items records facts
-- about a copy in someone's hand: this one is Near Fine, it cost $45, it has a
-- price-clipped jacket. The catalog records that a book EXISTS: Dune, Frank
-- Herbert, Chilton, 1965. Those are different kinds of statement and they have
-- different owners -- the first belongs to one collector, the second to nobody.
--
-- Picking a book from autocomplete COPIES a snapshot of these fields into
-- inventory_items. It does not store a foreign key back to here, and that is
-- deliberate on both sides of the relationship:
--
--   * The collector can then edit anything -- retitle it, fix the author,
--     correct the publisher -- without mutating a row every other user reads.
--   * A later catalog correction cannot silently rewrite what someone recorded
--     about a copy they are holding. If we fix a typo in a publisher name in
--     2027, the record a collector made in 2026 still says what they saw.
--
-- ---------------------------------------------------------------------------
-- What this table deliberately does NOT hold
-- ---------------------------------------------------------------------------
-- No edition points. No first-edition claims. No values. Rows here are bulk
-- imported from Open Library and nobody has checked them, so the strongest
-- thing the catalog is allowed to say is "this book exists, spelled this way."
--
-- Identification claims live in src/content/books/, where every point carries a
-- source id and a human has verified it before publication. Autocomplete
-- surfaces those eleven works FIRST and marks them; the catalog is the long
-- tail underneath, so that searching for a book we have no guide for returns
-- something rather than nothing.

-- Trigram matching is what makes "gats" find "The Great Gatsby" without a
-- leading-anchored index scan. Supabase keeps extensions in their own schema.
create extension if not exists pg_trgm with schema extensions;

create table if not exists public.book_catalog (
  id uuid primary key default gen_random_uuid(),

  title text not null,
  author text not null default '',

  -- The publisher of the edition Open Library happened to describe, which is
  -- very often NOT the first edition's publisher. It is shown in the suggestion
  -- row to tell two same-titled books apart, and it is copied into the item's
  -- Make / Publisher / Brand field on a pick -- so it is the field on that form
  -- most worth a collector's second look, and the hint under the name says so.
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
