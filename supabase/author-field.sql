-- Splits the old single "Maker / Author / Brand" column in two: an author,
-- and a make / publisher / brand. Issue #140.
--
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Both statements are idempotent, so re-running is safe.

alter table public.inventory_items
  add column if not exists author text not null default '';

-- Move the existing value across for the categories that have an author.
--
-- Every book and comic catalogued before this change put the author in maker
-- -- that is what the field's own label told people to do -- so leaving those
-- rows alone would empty the Author field for every book in every collection.
-- The value is moved rather than copied: keeping it in both places would show
-- "Stephen King · Stephen King" under the title.
--
-- The `author = ''` guard is what makes this safe to run twice: a row that has
-- already been split is skipped, so a second run cannot blank an author the
-- owner has since edited by hand.
update public.inventory_items
   set author = maker,
       maker = ''
 where category in ('Book', 'Comic')
   and author = ''
   and maker <> '';

-- Other categories keep their maker untouched: a card made by Topps was never
-- claiming Topps wrote anything.
