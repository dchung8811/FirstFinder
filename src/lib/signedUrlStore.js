// Where issued photo URLs actually live between page loads.
//
// localStorage, and the same defensive wrapping as offlineStore.js, for the
// same reason: reading it does not merely return null when a browser is set to
// block site data or is in Safari's private mode, it throws. Someone who has
// blocked storage still gets every photo; they simply sign for them on each
// load, which is what the app did before this existed.
//
// One entry per owner. Correctness does not depend on that -- every entry is
// keyed by the full storage path, which already contains the owner id, so a
// URL belonging to one account can never be handed to another -- but clearing
// does, and clearing is the part that matters on a shared machine.
//
// What is being written here is worth naming plainly: a signed URL is a bearer
// token. Anyone holding one can fetch that photo for as long as it lives,
// with no login. Putting them on disk for up to a week is why
// clearSignedUrls() is called from the same two places clearOfflineCollection()
// is -- sign-out and account deletion -- and not only on one of them.

import {
  signedUrlCacheKey,
  parseSignedUrls,
  serializeSignedUrls
} from "../utils/signedUrlCache";

function storage() {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readSignedUrls(ownerId) {
  const store = storage();
  if (!store || !ownerId) return {};

  try {
    return parseSignedUrls(store.getItem(signedUrlCacheKey(ownerId)));
  } catch {
    return {};
  }
}

export function writeSignedUrls(ownerId, entries) {
  const store = storage();
  if (!store || !ownerId) return false;

  try {
    store.setItem(signedUrlCacheKey(ownerId), serializeSignedUrls(entries));
    return true;
  } catch {
    // Over quota, or storage blocked. Drop what is there rather than leave a
    // half-updated map behind: a stale URL that is still reusable would go on
    // being handed out, and the next signing would try to grow the same value
    // that just failed to fit.
    try {
      store.removeItem(signedUrlCacheKey(ownerId));
    } catch {
      // Nothing further to try.
    }
    return false;
  }
}

export function clearSignedUrls(ownerId) {
  const store = storage();
  if (!store) return;

  try {
    store.removeItem(signedUrlCacheKey(ownerId));
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
