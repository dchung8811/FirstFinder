// The two numbers beside My Collection and Wishlist in the nav, for pages
// outside the app that don't load the collection itself -- today, /explore.
//
// Counted in Postgres with head-only queries: no rows come back, just the
// total, so this costs two small requests rather than the whole collection.
// Read with the anon key, so RLS keeps it to the signed-in collector's own
// rows; the user_id filter matches what the app's own loads ask for.
//
// The filters have to agree with the app's, or the same tab reads differently
// on two pages:
//   My Collection -- everything not sold. getActiveInventory in
//     src/utils/items.js. status is NOT NULL in the schema, so .neq can't
//     silently drop rows the app would count.
//   Wishlist -- wants not yet found. openWants in src/utils/wishlist.js.

import { supabase } from "./supabaseClient";

// null for either count that fails, which the nav reads as "not known yet"
// and shows no number for -- the same as the app while it is still loading.
export async function loadNavCounts(userId) {
  const [inventory, wishlist] = await Promise.all([
    supabase.from("inventory_items").select("id", { count: "exact", head: true }).eq("user_id", userId).neq("status", "Sold"),
    supabase.from("wishlist_items").select("id", { count: "exact", head: true }).eq("user_id", userId).is("found_at", null)
  ]);
  return {
    inventoryCount: inventory.error ? null : inventory.count ?? null,
    wishlistCount: wishlist.error ? null : wishlist.count ?? null
  };
}
