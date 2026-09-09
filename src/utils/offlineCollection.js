// The collection as it was the last time the network worked.
//
// The moments this app earns its keep -- a book fair, a shop basement, an
// antique mall -- are the moments with no bars of signal (issue #60). Every
// read today goes to Supabase, so the answer to "do I already own this?" is
// exactly the answer the app cannot give in the aisle where it matters.
//
// This module is the snapshot half of the fix: turning the loaded collection
// into something that survives a reload with no network, and reading it back
// safely. It stays pure -- no storage, no React, no Supabase -- so the rules
// below can be tested without a browser. The caller owns the storage, and the
// service worker owns the app shell that runs this code.
//
// What it is NOT: an offline write queue. Nothing here accepts an edit made
// offline. A snapshot you can read is a large win on its own, and pretending
// to accept a save that has nowhere to go would be worse than refusing it.
// That half is issue #147.

// Bumped whenever the shape below changes. A cache written by an older
// version is discarded rather than migrated: it is a copy of data that still
// exists in Postgres, so throwing it away costs one sync and no data at all.
export const OFFLINE_CACHE_VERSION = 1;

// Namespaced per user. Two collectors sharing a laptop must never see each
// other's shelf, and parseCollection checks the id inside the payload as well
// -- the key alone is a filename, and a filename is not a permission.
export function offlineCacheKey(userId) {
  return `firstfinder:collection:v${OFFLINE_CACHE_VERSION}:${userId || "anonymous"}`;
}

// Photos are deliberately dropped, both the item and the receipt lists.
//
// They are the only unbounded field on a row, and they are useless offline
// anyway: the app renders photos through short-lived signed URLs, so a cached
// path resolves to nothing without a network to sign it with. The counts are
// kept, because "3 photos on file" is still true and still worth showing. The
// snapshot is therefore a few hundred bytes per item, which is what keeps a
// large collection inside a browser storage quota.
export function stripPhotos(item) {
  return {
    ...item,
    itemPhotos: [],
    receiptPhotos: [],
    itemPhotoCount: Array.isArray(item.itemPhotos) ? item.itemPhotos.length : item.itemPhotoCount || 0,
    receiptPhotoCount: Array.isArray(item.receiptPhotos) ? item.receiptPhotos.length : item.receiptPhotoCount || 0
  };
}

export function serializeCollection(items, { userId, syncedAt }) {
  return JSON.stringify({
    version: OFFLINE_CACHE_VERSION,
    userId: userId || "",
    syncedAt: syncedAt || new Date().toISOString(),
    items: (items || []).map(stripPhotos)
  });
}

// Returns null for anything it cannot vouch for, and never throws: a corrupt
// or foreign snapshot must degrade to "no offline copy", not to a crash on
// launch or, far worse, to another account's collection on screen.
export function parseCollection(raw, { userId } = {}) {
  if (!raw) return null;

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!payload || typeof payload !== "object") return null;
  if (payload.version !== OFFLINE_CACHE_VERSION) return null;
  if (!Array.isArray(payload.items)) return null;
  // A snapshot with no owner, or one belonging to whoever was signed in
  // before, is not this user's collection.
  if (!payload.userId || (userId && payload.userId !== userId)) return null;

  return {
    userId: payload.userId,
    syncedAt: typeof payload.syncedAt === "string" ? payload.syncedAt : "",
    items: payload.items.filter((item) => item && typeof item === "object").map(stripPhotos)
  };
}

// How long ago the snapshot was taken, for the line the offline banner shows.
//
// Deliberately coarse. The collector needs to know whether they are looking at
// this morning's collection or last month's; "3 minutes ago" and "5 minutes
// ago" are the same answer to that question, and a ticking clock in a banner
// is noise. An unreadable or future timestamp reads as "at some point", which
// is honest -- a wrong-looking date would just undermine the whole banner.
export function syncAgeLabel(syncedAt, now = new Date()) {
  const then = new Date(syncedAt || "");
  if (Number.isNaN(then.getTime())) return "at some point";

  const minutes = Math.floor((now.getTime() - then.getTime()) / 60000);
  if (minutes < 0) return "at some point";
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes} minutes ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "an hour ago" : `${hours} hours ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return days === 1 ? "yesterday" : `${days} days ago`;

  const months = Math.floor(days / 30);
  return months === 1 ? "a month ago" : `${months} months ago`;
}
