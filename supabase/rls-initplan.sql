-- Stops every owner-only RLS policy re-running auth.uid() once per row.
--
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run: ALTER POLICY is idempotent in effect, and the expressions
-- below are already what a re-run would set.
--
-- What this fixes
-- ---------------
-- `auth.uid()` reads a GUC through current_setting(). It is STABLE, so one
-- call per statement would be correct -- but written bare in a policy, the
-- planner treats it as part of the per-row filter and evaluates it for every
-- row the scan touches. Wrapping it in a scalar subquery, `(select
-- auth.uid())`, makes the planner hoist it into an InitPlan: evaluated once,
-- before the scan, and compared against as a constant.
--
-- This is Supabase's own documented remedy for the `auth_rls_initplan` lint,
-- which flagged all sixteen policies changed here:
-- https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
--
-- The behaviour is identical. auth.uid() cannot change partway through a
-- statement, so evaluating it once per statement and once per row can only
-- ever produce the same answer -- this changes how often the question is
-- asked, never what it returns.
--
-- Why ALTER POLICY and not DROP + CREATE
-- --------------------------------------
-- DROP then CREATE leaves a window, however brief, in which the table has one
-- fewer policy protecting it. ALTER POLICY rewrites the expression in place,
-- so the policy's name, command, and granted roles are carried over untouched
-- and there is no moment where the row is reachable by someone it should not
-- be. It also means this file cannot silently disagree with production about
-- a policy's name or its role list -- it does not restate either.
--
-- NOTE: the role lists differ between tables (inventory_items' policies are
-- granted to `public`, the rest to `authenticated`). That difference is
-- preserved here precisely because ALTER POLICY does not touch it. It is not
-- a security gap -- for an anonymous caller auth.uid() is null, so `null =
-- user_id` is null, which is not true, and no row passes.

-- inventory_items ------------------------------------------------------------
alter policy "Users can view their own inventory" on public.inventory_items
  using ((select auth.uid()) = user_id);

alter policy "Users can insert their own inventory" on public.inventory_items
  with check ((select auth.uid()) = user_id);

alter policy "Users can update their own inventory" on public.inventory_items
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users can delete their own inventory" on public.inventory_items
  using ((select auth.uid()) = user_id);

-- wishlist_items -------------------------------------------------------------
alter policy "Users can view own wants" on public.wishlist_items
  using ((select auth.uid()) = user_id);

alter policy "Users can insert own wants" on public.wishlist_items
  with check ((select auth.uid()) = user_id);

alter policy "Users can update own wants" on public.wishlist_items
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users can delete own wants" on public.wishlist_items
  using ((select auth.uid()) = user_id);

-- shared_collections ---------------------------------------------------------
alter policy "Users can view own share settings" on public.shared_collections
  using ((select auth.uid()) = user_id);

alter policy "Users can insert own share settings" on public.shared_collections
  with check ((select auth.uid()) = user_id);

alter policy "Users can update own share settings" on public.shared_collections
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users can delete own share settings" on public.shared_collections
  using ((select auth.uid()) = user_id);

-- feedback -------------------------------------------------------------------
alter policy "Users can view own feedback" on public.feedback
  using ((select auth.uid()) = user_id);

alter policy "Users can insert own feedback" on public.feedback
  with check ((select auth.uid()) = user_id);

alter policy "Users can update own feedback" on public.feedback
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- login_events ---------------------------------------------------------------
alter policy "Users can record own logins" on public.login_events
  with check ((select auth.uid()) = user_id);
