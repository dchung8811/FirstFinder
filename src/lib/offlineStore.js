// Where the offline snapshot actually lives, and the only place that touches
// browser storage.
//
// localStorage rather than IndexedDB on purpose: the snapshot is one small
// JSON string (see the photo note in offlineCollection.js), it has to be
// readable synchronously on the first render after a cold launch with no
// network, and IndexedDB's asynchronous open would put a flash of "no items"
// in front of a collector standing in a shop.
//
// Every call is wrapped, because reading localStorage is not merely
// unreliable, it throws: Safari's private mode and a browser set to block site
// data both raise on access rather than returning null. A collector who has
// blocked storage still gets the online app; they simply get no snapshot.

import { serializeCollection, parseCollection, offlineCacheKey } from "../utils/offlineCollection";

function storage() {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readOfflineCollection(userId) {
  const store = storage();
  if (!store || !userId) return null;

  try {
    return parseCollection(store.getItem(offlineCacheKey(userId)), { userId });
  } catch {
    return null;
  }
}

// Returns the timestamp it wrote, or null if the snapshot could not be saved.
// A failure here is not worth a toast: the app works, and the collector did
// not ask for this. It is the offline banner's absence that tells them.
export function writeOfflineCollection(userId, items) {
  const store = storage();
  if (!store || !userId) return null;

  const syncedAt = new Date().toISOString();
  try {
    store.setItem(offlineCacheKey(userId), serializeCollection(items, { userId, syncedAt }));
    return syncedAt;
  } catch {
    // Over quota, or storage blocked. Drop the stale snapshot rather than
    // leaving an older one to be shown as though it were this sync.
    try {
      store.removeItem(offlineCacheKey(userId));
    } catch {
      // Nothing further to try.
    }
    return null;
  }
}

// Called on sign-out and on account deletion. A shared laptop is the whole
// reason: the next person to sign in must not find the last person's shelf
// sitting in the browser, and "delete my account" has to mean the copy on
// this device too.
export function clearOfflineCollection(userId) {
  const store = storage();
  if (!store) return;

  try {
    store.removeItem(offlineCacheKey(userId));
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
