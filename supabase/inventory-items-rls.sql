-- Row Level Security for inventory_items.
--
-- The app's Supabase client uses the public anon key, and every query in
-- app/InventoryApp.jsx filters by id alone (e.g. .eq("id", id)) without also
-- filtering by user_id. That's safe ONLY if RLS is enabled with owner-only
-- policies below -- otherwise any signed-in user could read, edit, or
-- delete any other user's rows through the anon key.
--
-- First, check whether RLS is already on (run this by itself to inspect):
--
--   select relrowsecurity from pg_class where relname = 'inventory_items';
--   select policyname, cmd, roles from pg_policies where tablename = 'inventory_items';
--
-- If relrowsecurity is false, or no owner-scoped policies are listed, run
-- everything below once in the Supabase dashboard: SQL Editor -> New query.

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
