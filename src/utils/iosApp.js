// Who gets told about the iPhone app, and when to stop telling them. Pure, so
// the rules are under test; the sheet and the footer badge only call in.

export const APP_STORE_URL = "https://apps.apple.com/us/app/firstfinder/id6830777019";

// A closed sheet stays closed this long. Not forever: someone who waved it
// off on a quick visit may be a regular a month later. Not every visit
// either: a prompt that comes back each time is a reason to leave.
export const APP_SHEET_SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;

// An iPhone browser a person chose to open, as opposed to a web view inside
// some other app. The "Safari/" token is the difference: Safari, Chrome
// (CriOS), Firefox (FxiOS) and Edge (EdgiOS) on iPhone all carry it, and a
// bare WKWebView does not. That matters most for our own app: its WebPage
// view loads Explore, the guides and shared collections in a WKWebView, and
// telling someone inside the app to go get the app would be absurd.
// Instagram's and Facebook's in-app browsers and home-screen web apps carry
// no "Safari/" either, and from those an App Store link is a dead end anyway.
//
// iPhone only, because the app is iPhone only (TARGETED_DEVICE_FAMILY = 1).
// iPadOS Safari also reports itself as a Mac, so it would not match anyway.
export function isIPhoneBrowser(userAgent) {
  const ua = String(userAgent || "");
  return /\biPhone\b/.test(ua) && /\bSafari\//.test(ua);
}

// `snoozedAt` is the epoch ms the sheet was last closed, or 0 if never.
export function shouldShowAppSheet(userAgent, snoozedAt, now) {
  if (!isIPhoneBrowser(userAgent)) return false;
  const at = Number(snoozedAt) || 0;
  // A stamp from the future (a clock that was wrong when it was written)
  // would otherwise snooze the sheet indefinitely.
  if (at <= 0 || at > now) return true;
  return now - at >= APP_SHEET_SNOOZE_MS;
}
