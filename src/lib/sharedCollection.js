// Server-side reads for the public /c/<slug> collection page.
//
// SERVER ONLY. This module uses the service-role client, which bypasses RLS.
// It must never be imported from a "use client" file.
//
// Reading a public page with the service role rather than through a relaxed
// RLS policy is a deliberate trade. It costs a server render, and it buys the
// property that no public select policy exists on inventory_items at all: an
// anon key, leaked or simply read out of the JS bundle, still cannot reach one
// row of anybody's collection. The alternative -- a "public if shared" policy
// -- would expose every column of every shared row to the anon key, including
// the ones the page itself refuses to print.
//
// Two layers of filtering sit between a row and a visitor, and they are
// independent on purpose:
//
//   1. Here: the select lists only the columns the current settings allow, so
//      a withheld note or price never leaves Postgres.
//   2. src/utils/publicCollection.js: the field allowlist that builds what is
//      actually rendered.
//
// Either one alone would be sufficient. Having both means a mistake in one is
// not a disclosure.

import { createSupabaseAdminClient } from "./supabaseAdmin";
import { isValidShareSlug } from "../utils/publicCollection";

const PHOTO_BUCKET = "item-photos";

// Long enough that a page cached for the route's revalidate window never
// serves an expired image, short enough that a URL scraped off a page someone
// later unshared stops working within the hour.
const PHOTO_URL_TTL_SECONDS = 3600;

// createSignedUrls takes a list; very large collections get chunked rather
// than sent as one enormous request.
const SIGN_BATCH_SIZE = 100;

// Columns every shared page needs regardless of settings -- the shelf, plus
// the two that decide whether a row appears at all.
const BASE_COLUMNS = [
  "id",
  "name",
  "category",
  "maker",
  "edition",
  "book_genre",
  "book_edition",
  "book_printing",
  "status",
  "condition",
  "item_photos",
  // The count, never the paths: enough to render a "Receipt on file" badge,
  // and nothing that could be turned into a signed URL.
  "receipt_photo_count",
  "hidden_from_share",
  "created_at"
];

// Columns fetched only when the owner has switched that group on. Keyed by the
// same setting names as shareFieldGroups.
const OPTIONAL_COLUMNS = {
  showEstimatedValue: ["estimated_value"],
  showPrices: ["purchase_price", "sold_price", "sold_date"],
  showProvenance: ["purchase_date", "source"],
  showNotes: ["notes"]
};

function settingsFromRow(row) {
  return {
    visibility: row.visibility,
    title: row.title || "",
    blurb: row.blurb || "",
    showEstimatedValue: Boolean(row.show_estimated_value),
    showPrices: Boolean(row.show_prices),
    showProvenance: Boolean(row.show_provenance),
    showNotes: Boolean(row.show_notes),
    showSold: Boolean(row.show_sold),
    showWishlist: Boolean(row.show_wishlist)
  };
}

// Deliberately not fromDbItem: that maps every column, including ones this
// query does not select and must not invent blanks for. This mirrors the
// no-spread discipline in publicCollection.js one layer down.
function toSharedItem(row) {
  return {
    id: row.id,
    name: row.name || "",
    category: row.category || "Other",
    maker: row.maker || "",
    edition: row.edition || "",
    bookGenre: row.book_genre || "",
    bookEdition: row.book_edition || "",
    bookPrinting: row.book_printing || "",
    status: row.status || "Owned",
    condition: row.condition || "",
    hiddenFromShare: Boolean(row.hidden_from_share),
    itemPhotos: Array.isArray(row.item_photos) ? row.item_photos.filter((photo) => photo && photo.path) : [],
    receiptPhotoCount: row.receipt_photo_count || 0,
    estimatedValue: row.estimated_value === null || row.estimated_value === undefined ? "" : String(row.estimated_value),
    purchasePrice: row.purchase_price === null || row.purchase_price === undefined ? "" : String(row.purchase_price),
    soldPrice: row.sold_price === null || row.sold_price === undefined ? "" : String(row.sold_price),
    soldDate: row.sold_date || "",
    purchaseDate: row.purchase_date || "",
    source: row.source || "",
    notes: row.notes || ""
  };
}

// The owner's display name, used only when they have not set a page title.
// Falls back to empty rather than to anything derived from the email address:
// an email is never part of a public page, not even the local part.
async function fetchOwnerName(admin, userId) {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) {
    console.error("Shared collection owner lookup error:", error.message);
    return "";
  }
  return data?.user?.user_metadata?.full_name || data?.user?.user_metadata?.name || "";
}

export async function signPhotoPaths(admin, paths) {
  const urlByPath = new Map();
  if (paths.length === 0) return urlByPath;

  const batches = [];
  for (let start = 0; start < paths.length; start += SIGN_BATCH_SIZE) {
    batches.push(paths.slice(start, start + SIGN_BATCH_SIZE));
  }

  // In parallel, not one after another. The batches are independent, and a
  // large shelf is where this page is slowest -- signing 400 photos serially
  // is four round trips stacked end to end for no reason. Nothing here shares
  // state, so the only ordering that ever mattered was the loop's.
  const results = await Promise.all(
    batches.map(async (batch) => {
      const { data, error } = await admin.storage.from(PHOTO_BUCKET).createSignedUrls(batch, PHOTO_URL_TTL_SECONDS);

      if (error) {
        // A page with missing images still tells a visitor what is in the
        // collection, which beats a 500.
        console.error("Shared collection signed URL error:", error.message);
        return [];
      }

      return data || [];
    })
  );

  results.flat().forEach((row) => {
    if (row.signedUrl) urlByPath.set(row.path, row.signedUrl);
  });

  return urlByPath;
}

// Loads everything /c/<slug> needs, or null when there is nothing to serve --
// unknown slug, or the owner has switched sharing off. The caller turns null
// into a 404, so those two cases are indistinguishable from outside: a
// visitor cannot tell "never existed" from "was taken down".
export async function loadSharedCollection(slug) {
  // Checked before the query so a malformed URL costs nothing, and so the
  // slug column only ever sees strings of the expected shape.
  if (!isValidShareSlug(slug)) return null;

  const admin = createSupabaseAdminClient();

  const { data: shareRow, error: shareError } = await admin
    .from("shared_collections")
    .select("user_id, slug, visibility, title, blurb, show_estimated_value, show_prices, show_provenance, show_notes, show_sold, show_wishlist, updated_at")
    .eq("slug", slug)
    .neq("visibility", "off")
    .maybeSingle();

  if (shareError) {
    console.error("Shared collection lookup error:", shareError.message);
    return null;
  }

  if (!shareRow) return null;

  const settings = settingsFromRow(shareRow);

  const columns = [
    ...BASE_COLUMNS,
    ...Object.entries(OPTIONAL_COLUMNS).flatMap(([setting, cols]) => (settings[setting] ? cols : []))
  ];

  // Sold and wishlist rows are excluded in SQL when they are not shared, so
  // the rows never leave the database -- isItemShared enforces the same rule
  // again on what does come back.
  let query = admin
    .from("inventory_items")
    .select(columns.join(", "))
    .eq("user_id", shareRow.user_id)
    .eq("hidden_from_share", false);

  const excludedStatuses = [
    ...(settings.showSold ? [] : ["Sold"]),
    ...(settings.showWishlist ? [] : ["Wishlist"])
  ];
  if (excludedStatuses.length > 0) {
    query = query.not("status", "in", `(${excludedStatuses.join(",")})`);
  }

  // The owner's name depends only on the share row, so it has no reason to
  // wait behind the items query. Started here and awaited later, it overlaps
  // with the two slowest steps instead of adding a round trip after them.
  //
  // The catch is not decoration. If the items query below fails we return
  // early, leaving this promise with nobody waiting on it -- and an unhandled
  // rejection in a server render is a process-level event, not a local one.
  // Settling it here means the worst case is a page that falls back to no
  // owner name, which is what fetchOwnerName already does on an error it can
  // see.
  const ownerNamePromise = settings.title.trim()
    ? Promise.resolve("")
    : fetchOwnerName(admin, shareRow.user_id).catch(() => "");

  const { data: itemRows, error: itemsError } = await query.order("created_at", { ascending: false });

  if (itemsError) {
    console.error("Shared collection items error:", itemsError.message);
    return null;
  }

  const items = (itemRows || []).map(toSharedItem);

  // One photo per card. A card is a thumbnail, so signing the rest would be
  // work nobody sees -- a per-item photo view is a follow-up, and it is the
  // reason this signs by path map rather than by index.
  const coverPaths = items.map((item) => item.itemPhotos[0]?.path).filter(Boolean);

  const [photoUrls, ownerName] = await Promise.all([signPhotoPaths(admin, coverPaths), ownerNamePromise]);

  return { settings, items, ownerName, photoUrls, updatedAt: shareRow.updated_at };
}

// Slugs of collections their owners have chosen to have indexed. Unlisted
// pages are left out: keeping them out of the sitemap is half of what
// "unlisted" means, alongside the noindex the page itself carries.
export async function listListedCollectionSlugs() {
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("shared_collections")
      .select("slug, updated_at")
      .eq("visibility", "listed");

    if (error) {
      console.error("Listed collections lookup error:", error.message);
      return [];
    }

    return data || [];
  } catch (error) {
    // The sitemap is generated at build time too, where the service-role key
    // may legitimately be absent (a contributor running `next build` without
    // a full .env.local). A sitemap missing the shared pages is better than a
    // build that fails.
    console.error("Listed collections unavailable:", error.message);
    return [];
  }
}
