// Carries a ticked "email me about new features" box across the Google
// redirect. The rules for what counts as a valid flag live in
// src/utils/emailUpdates.js; this file is only the storage around them.
//
// Same defensive wrapping as offlineStore.js: localStorage throws rather than
// returning null when site data is blocked. Losing the flag there costs one
// opt-in the collector can still make from My account.

import {
  PENDING_EMAIL_UPDATES_KEY,
  isPendingEmailUpdatesValid,
  serializePendingEmailUpdates
} from "../utils/emailUpdates";

function storage() {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function setPendingEmailUpdates(subscribed) {
  const store = storage();
  if (!store) return;
  try {
    if (subscribed) store.setItem(PENDING_EMAIL_UPDATES_KEY, serializePendingEmailUpdates());
    else store.removeItem(PENDING_EMAIL_UPDATES_KEY);
  } catch {
    // Quota or a blocked write: see the header.
  }
}

// Reads and clears in one step, so the flag is spent on the first account to
// arrive, valid or not.
export function takePendingEmailUpdates() {
  const store = storage();
  if (!store) return false;
  try {
    const raw = store.getItem(PENDING_EMAIL_UPDATES_KEY);
    store.removeItem(PENDING_EMAIL_UPDATES_KEY);
    return isPendingEmailUpdatesValid(raw);
  } catch {
    return false;
  }
}
