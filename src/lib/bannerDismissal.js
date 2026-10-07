// Remembers which version of the site banner this browser closed, so it stays
// closed across visits until the banner changes. What a "version" is lives in
// src/utils/siteBanner.js; this file is only the storage around it.
//
// Same defensive wrapping as offlineStore.js: localStorage throws rather than
// returning null when site data is blocked. Without it the banner simply
// comes back on the next visit, which is the right way for that to fail.

const KEY = "firstfinder:dismissed-banner";

function storage() {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readDismissedBanner() {
  try {
    return storage()?.getItem(KEY) || "";
  } catch {
    return "";
  }
}

export function writeDismissedBanner(id) {
  try {
    storage()?.setItem(KEY, id);
  } catch {
    // Blocked or full: see the header.
  }
}
