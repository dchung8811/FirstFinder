-- Row Level Security for inventory_items.
--
-- The app's Supabase client uses the public anon key, and every query in
-- app/InventoryApp.jsx filters by id alone (e.g. .eq("id", id)) without also
-- filtering by user_id. That's safe ONLY if RLS is enabled with owner-only
-- policies -- otherwise any signed-in user could read, edit, or delete any
-- other user's rows through the anon key.
--
-- Verified 2026-07-31: this project already has RLS enabled with
-- owner-scoped policies on inventory_items (relrowsecurity = true, and
-- every policy's qual/with_check is `(select auth.uid()) = user_id`). No action is
-- needed here -- this file exists as a reference for what to check on a
-- fresh Supabase project, and as an enforcement script if a check ever
-- comes back showing gaps.
--
-- To verify current state, run:
--
--   select relrowsecurity from pg_class where relname = 'inventory_items';
--   select policyname, cmd, roles, qual, with_check
--   from pg_policies where tablename = 'inventory_items';
--
-- relrowsecurity should be true, and every row's qual/with_check should
-- reference `(select auth.uid()) = user_id`.
--
-- The scalar subquery around auth.uid() is not decoration. Written bare, the
-- planner evaluates it once per row scanned; wrapped, it is hoisted into an
-- InitPlan and evaluated once per statement. Same answer, since auth.uid()
-- cannot change mid-statement. See rls-initplan.sql.
--
-- These four policies have existed under three names across the project's
-- history -- "own inventory items" (this file, originally), "own items"
-- (schema.sql, originally), and "their own inventory" (what the deployed
-- database actually carries). Policies are OR'd rather than merged, so a set
-- created under a second name does not replace the first: both run, and every
-- row is checked twice to reach the same verdict. Each block below therefore
-- drops all three names before creating the canonical one, so running this
-- file converges on a single set whichever name the database started with.

alter table public.inventory_items enable row level security;

drop policy if exists "Users can view own inventory items" on public.inventory_items;
drop policy if exists "Users can view own items" on public.inventory_items;
drop policy if exists "Users can view their own inventory" on public.inventory_items;
create policy "Users can view their own inventory"
on public.inventory_items for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own inventory items" on public.inventory_items;
drop policy if exists "Users can insert own items" on public.inventory_items;
drop policy if exists "Users can insert their own inventory" on public.inventory_items;
create policy "Users can insert their own inventory"
on public.inventory_items for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own inventory items" on public.inventory_items;
drop policy if exists "Users can update own items" on public.inventory_items;
drop policy if exists "Users can update their own inventory" on public.inventory_items;
create policy "Users can update their own inventory"
on public.inventory_items for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own inventory items" on public.inventory_items;
drop policy if exists "Users can delete own items" on public.inventory_items;
drop policy if exists "Users can delete their own inventory" on public.inventory_items;
create policy "Users can delete their own inventory"
on public.inventory_items for delete to authenticated
using ((select auth.uid()) = user_id);
