import { queueAnalyticsUser, supabaseStorageKey, userIdFromStoredSession } from "../utils/analytics";

// The browser-side wrappers around src/utils/analytics.js: they supply the
// real window and the same measurement id app/layout.js loads GA with, so they
// do nothing at all when GA isn't configured (as in local development).
export function setAnalyticsUser(userId) {
  if (typeof window === "undefined") return false;
  return queueAnalyticsUser(window, process.env.NEXT_PUBLIC_GA_ID, userId);
}

// The signed-in user's id as supabase-js last stored it, read synchronously so
// it can reach the dataLayer before GA's config does. Null when signed out,
// when storage is blocked (private modes can throw on access), or when the
// stored shape isn't what we expect.
export function readStoredUserId() {
  if (typeof window === "undefined") return null;
  try {
    const key = supabaseStorageKey(process.env.NEXT_PUBLIC_SUPABASE_URL);
    return key ? userIdFromStoredSession(window.localStorage.getItem(key)) : null;
  } catch {
    return null;
  }
}
