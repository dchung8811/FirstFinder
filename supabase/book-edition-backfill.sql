-- Retires the free-text edition column for books. Issue #169.
--
-- Books record their edition in the book_edition and book_printing dropdowns;
-- the free-text edition field has been hidden on the book form since those
-- were added. But rows imported or created before then still carry text in
-- edition -- "Book Club Edition", "First Edition, Tenth Printing" -- and the
-- app no longer shows it anywhere a book is displayed, so it is invisible.
--
-- This moves that text somewhere it can be seen, then blanks edition on books.
-- The column itself stays: for every other category it is the only edition
-- field ("Edition / Variant / Details") and is still in use.
--
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Idempotent: it only touches book rows whose edition is not yet blank, and it
-- blanks that edition, so a second run finds nothing to do.
--
-- For each book row with edition text:
--
--   1. book_edition and book_printing are filled from the text ONLY when they
--      are blank. A value the owner picked is never overwritten, even where the
--      text disagrees (a "Book Club Edition" row marked First / First) --
--      guessing which of the two is right is the owner's call, and the text
--      survives in notes for them to make it.
--
--      "First Edition" through "Fifth Edition" map to that dropdown value.
--      Any other named edition -- Book Club, Mass Market Paperback, First
--      American, Easton Press -- maps to "Other". First American in particular
--      is not "First": for a book first published abroad it is exactly the
--      copy the dropdown's "First" exists to tell apart from the true first.
--      "Reading Copy" describes the copy's purpose, not its edition, so it
--      fills nothing.
--
--      "First Printing" through "Fifth Printing" map likewise; any later
--      printing ("Tenth", "Thirty-Fifth") maps to "Other", since the dropdown
--      stops at Fifth.
--
--   2. The original text is appended to notes as "Edition: <text>", unless the
--      dropdowns now say exactly the same thing ("First Edition, First
--      Printing" on a First / First row) or the text is one of the two
--      placeholders the app's original photo flow wrote ("Needs edition
--      details", "Needs item photo"), which were never anyone's data.
--
--   3. edition is set to ''.
with parsed as (
  select
    id,
    edition,
    case
      when edition in ('Needs edition details', 'Needs item photo') then null
      when edition ~* '^(first|second|third|fourth|fifth) edition' then initcap(substring(edition from '^(\w+)'))
      when edition ~* '^reading copy$' then null
      else 'Other'
    end as parsed_edition,
    case
      -- The leading boundary rules out a hyphen, so "Thirty-Fifth Printing"
      -- is not read as "Fifth Printing".
      when edition ~* '(^|[\s,])(first|second|third|fourth|fifth) printing'
        then initcap(substring(edition from '(?i)(?:^|[\s,])(first|second|third|fourth|fifth) printing'))
      when edition ~* '[\w-]+ printing' and edition !~* 'printing not specified' then 'Other'
      else null
    end as parsed_printing
  from public.inventory_items
  where category = 'Book'
    and edition <> ''
),
proposed as (
  select
    p.id,
    p.edition,
    case when i.book_edition = '' then coalesce(p.parsed_edition, '') else i.book_edition end as new_edition,
    case when i.book_printing = '' then coalesce(p.parsed_printing, '') else i.book_printing end as new_printing,
    i.notes
  from parsed p
  join public.inventory_items i on i.id = p.id
)
update public.inventory_items i
   set book_edition = pr.new_edition,
       book_printing = pr.new_printing,
       notes = case
         when pr.edition in ('Needs edition details', 'Needs item photo') then pr.notes
         when lower(pr.edition) in (
           lower(pr.new_edition || ' Edition, ' || pr.new_printing || ' Printing'),
           lower(pr.new_edition || ' Edition')
         ) then pr.notes
         when position('Edition: ' || pr.edition in pr.notes) > 0 then pr.notes
         when pr.notes = '' then 'Edition: ' || pr.edition
         else rtrim(pr.notes) || ' Edition: ' || pr.edition
       end,
       edition = '',
       updated_at = now()
  from proposed pr
 where i.id = pr.id;

-- Check: should return 0.
--   select count(*) from public.inventory_items where category = 'Book' and edition <> '';
