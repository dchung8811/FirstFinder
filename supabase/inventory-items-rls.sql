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
-- every policy's qual/with_check is `auth.uid() = user_id`). No action is
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
-- reference `auth.uid() = user_id`. If not, run the statements below --
-- but check your existing policy names first, since `drop policy if
-- exists` only matches by exact name and won't remove differently-named
-- policies that already cover the same rule.

alter table public.inventory_items enable row level security;

drop policy if exists "Users can view own inventory items" on public.inventory_items;
create policy "Users can view own inventory items"
on public.inventory_items for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own inventory items" on public.inventory_items;
create policy "Users can insert own inventory items"
on public.inventory_items for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own inventory items" on public.inventory_items;
create policy "Users can update own inventory items"
on public.inventory_items for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own inventory items" on public.inventory_items;
create policy "Users can delete own inventory items"
on public.inventory_items for delete to authenticated
using (auth.uid() = user_id);
