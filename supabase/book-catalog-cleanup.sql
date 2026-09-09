-- Removing what is not a collectible book from an already-seeded catalog.
--
-- Run once, after supabase/book-catalog.sql and after the first seed. A fresh
-- project does NOT need this: scripts/seed-book-catalog.mjs applies the same
-- rules at seed time, so nothing this file deletes can get in any more. It
-- exists because the production catalog was seeded before those filters did.
--
-- Run in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
--
-- ---------------------------------------------------------------------------
-- What comes out, and why
-- ---------------------------------------------------------------------------
-- The catalog is for people cataloguing first editions. A row that cannot be a
-- first edition of anything is not a neutral extra -- it is a wrong answer
-- sitting above a right one in a dropdown eight rows tall.
--
--   print-on-demand reprint  Open Library reports the WORK's year, so a modern
--                            CreateSpace reprint arrives looking like
--                            "Frankenstein, 1818, CreateSpace". The most
--                            misleading row shape in the whole import, and the
--                            largest group by far.
--   omnibus / set            Omnibuses, boxed sets, collected works, trilogies
--                            sold as one volume. Real books; not a first
--                            edition of any single title.
--   split volume scan        Open Library's own two-part scans, "[1/2]".
--   numbered range           "Harry Potter (series) 1-7".
--   study aid                SparkNotes, CliffsNotes, workbooks.
--   movie tie-in             Reissues carrying film artwork.
--   not a book               Colouring books, graphic novel adaptations, audio.
--   titled as the author     How Open Library files critical selections: a row
--                            whose title is just the author's name.
--
-- ---------------------------------------------------------------------------
-- What deliberately STAYS, having been wrongly caught while writing this
-- ---------------------------------------------------------------------------
-- Earlier drafts of these rules deleted real first editions, and the near
-- misses are worth naming so nobody re-adds the patterns that caused them:
--
--   * A title merely CONTAINING a suspect word. "illustrated" took Bradbury's
--     The Illustrated Man; "a guide to" took Murdoch's Metaphysics as a Guide
--     to Morals; "reader" took Woolf's The Second Common Reader.
--   * A title listing several works. That is an ordinary shape for a genuine
--     first edition -- Stevenson's The Merry Men, and Other Tales and Fables;
--     Orwell's Dickens, Dali & Others.
--   * Anything matched inside Open Library's own annotations. "[12 stories]"
--     and "(Adam Dalgliesh Mystery Series #1)" describe the edition RECORD, not
--     the book, and testing them loses the 1892 Adventures of Sherlock Holmes
--     and P. D. James's first novel. Hence the head-of-title normalisation.
--   * "Collected Stories of X". A collected-works volume is a set; a Collected
--     Stories published as its own first edition is not. Collected Stories of
--     William Faulkner won the National Book Award. So "stories" is absent from
--     the set-noun list on purpose.
--
-- When a rule here is uncertain, let the row through. A junk suggestion costs a
-- collector one scroll; a missing one costs them the feature.
--
-- NOTE ON DIALECT: these patterns also live in scripts/seed-book-catalog.mjs,
-- where the word boundary is spelled \b rather than Postgres's \y. Mixing them
-- up does not throw in JavaScript -- \y there is a literal "y" -- it silently
-- matches nothing. scripts/seed-book-catalog.test.js pins that.

-- Deleted rows are kept rather than dropped, so a rule that turns out to be too
-- greedy can be reversed. Drop this table once you are satisfied:
--   drop table public.book_catalog_removed;
create table if not exists public.book_catalog_removed (
  id uuid,
  title text,
  author text,
  publisher text,
  first_published_year integer,
  cover_id text,
  openlibrary_key text,
  source text,
  created_at timestamptz,
  removed_reason text,
  removed_at timestamptz
);

-- Nobody reads this through the API; it is a maintainer's undo buffer.
alter table public.book_catalog_removed enable row level security;

with norm as (
  select
    id,
    title,
    author,
    publisher,
    -- The head of the title: everything before Open Library's first bracket or
    -- parenthesis. See the note above about why the annotations must not be
    -- tested.
    btrim(regexp_replace(regexp_replace(title, '\[[^]]*\]', '', 'g'), '\([^)]*\)?.*$', '', 'g')) as head
  from public.book_catalog
),
doomed as (
  select id,
    case
      when publisher ~* '(independently published|createspace|lulu\.com|bookrix|blurb|authorhouse|xlibris|iuniverse|outskirts press|dorrance|vdm publishing|alpha edition|sagwan|palala|wentworth press|trieste publishing|hansebooks|nabu press|forgotten books|bibliolife|kessinger|legare street|franklin classics|scholar select|creative media partners)' then 'print-on-demand reprint'
      when title ~* '(movie|film|tv|television) tie[- ]?in' then 'movie tie-in'
      when title ~* '(sparknotes|cliffsnotes|cliffs notes|study guide|lesson plans|teacher''s guide|workbook)' or author ~* '^(sparknotes|cliffsnotes|bookrags)$' then 'study aid'
      when title ~* '(coloring book|activity book|colouring book|audiobook|audio book|graphic novel|\[audio|dvd|vhs)' then 'not a book'
      when title ~* '\[\s*\d+\s*/\s*\d+\s*\]' or head ~* '\yin (two|three|four|five) volumes' then 'split volume scan'
      when head ~* '\y(books?|vols?\.?|volumes?)\s*\.?\s*\d{1,2}\s*[-–—]\s*\d{1,2}\y' or title ~* '\(series\)\s*\d' then 'numbered range'
      when head ~* '\y(trilogy|tetralogy|quartet|quintet|duology)\y' then 'omnibus / set'
      when head ~* '\y(complete|collected|selected)\s+(prose\s+|poetical\s+)?(works|writings|essays|letters|poems|plays|adventures|novels)\y' then 'omnibus / set'
      when head ~* '(omnibus|boxed set|box set|complete (works|novels|stories|poetical works|writings|series)|collected (works|novels)|the complete sherlock)' then 'omnibus / set'
      when lower(head) in ('trilogy','omnibus','collection','works','novels','stories','complete') then 'omnibus / set'
      when head ~* '\y(two|three|four|five|six|seven|eight|nine|ten)\s+(complete\s+)?(novels|books)\y' then 'omnibus / set'
      when lower(btrim(title)) = lower(btrim(author)) then 'titled as the author'
    end as reason
  from norm
)
insert into public.book_catalog_removed
  (id, title, author, publisher, first_published_year, cover_id, openlibrary_key, source, created_at, removed_reason, removed_at)
select b.id, b.title, b.author, b.publisher, b.first_published_year, b.cover_id,
       b.openlibrary_key, b.source, b.created_at, d.reason, now()
from public.book_catalog b
join doomed d on d.id = b.id
where d.reason is not null
  and not exists (select 1 from public.book_catalog_removed r where r.id = b.id);

delete from public.book_catalog b
using public.book_catalog_removed r
where b.id = r.id;

-- What went, and why:
--   select removed_reason, count(*) from public.book_catalog_removed
--   group by removed_reason order by count(*) desc;
--
-- To put a group back:
--   insert into public.book_catalog (id, title, author, publisher,
--     first_published_year, cover_id, openlibrary_key, source, created_at)
--   select id, title, author, publisher, first_published_year, cover_id,
--          openlibrary_key, source, created_at
--   from public.book_catalog_removed where removed_reason = 'omnibus / set';
