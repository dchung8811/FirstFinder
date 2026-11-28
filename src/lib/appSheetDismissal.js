// Remembers when this browser last closed the "get the iPhone app" sheet. How
// long that lasts lives in src/utils/iosApp.js; this file is only the storage.
//
// Same defensive wrapping as bannerDismissal.js: localStorage throws rather
// than returning null when site data is blocked (Private Browsing on older
// iOS). Failing open means the sheet shows again next visit, which is the
// right way for this to fail -- it is one tap to close.

const KEY = "firstfinder:app-sheet-closed-at";

function storage() {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readAppSheetClosedAt() {
  try {
    return Number(storage()?.getItem(KEY)) || 0;
  } catch {
    return 0;
  }
}

export function writeAppSheetClosedAt(at) {
  try {
    storage()?.setItem(KEY, String(at));
  } catch {
    // Blocked or full: see the header.
  }
}
