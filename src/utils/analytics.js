// Tells Google Analytics which signed-in collector a visit belongs to, so one
// person's visits can be found again: look their id up by email in Supabase,
// then search it in GA4's User explorer or the BigQuery export.
//
// Only the Supabase user UUID is ever sent. It means nothing outside our own
// database, while an email or a name would be personal data in Google's hands,
// which their terms forbid and which collectors never agreed to.
//
// The caller passes in the window and the measurement id rather than this file
// reading globals, so it stays testable in plain Node like the rest of
// src/utils. src/lib/analytics.js is the caller that supplies the real ones.

// gtag ignores plain arrays in the dataLayer: a command only counts when it is
// an `arguments` object, which is what the snippet's own gtag() pushes.
export function gtagCommand() {
  return arguments;
}

// Queues `set user_id` straight onto the dataLayer, creating it if needed.
// Deliberately not sendGAEvent: that warns and drops the call when it runs
// before GA's init script, and on a fresh load this can run first. Queued
// early is the better case anyway, since gtag works through the queue in
// order and the first page_view then carries the id.
//
// A null id clears it after sign-out, so the next person on a shared computer
// isn't counted as the last one.
export function queueAnalyticsUser(win, gaId, userId) {
  if (!gaId || !win) return false;
  try {
    win.dataLayer = win.dataLayer || [];
    win.dataLayer.push(gtagCommand("set", { user_id: userId || null }));
    return true;
  } catch {
    // Analytics must never be the reason a page breaks.
    return false;
  }
}

// On a fresh load, supabase.auth.getSession() answers only after GA has
// already queued its config and sent the first page_view, so that page_view
// would go out with no user_id. Reading the session supabase-js keeps in
// localStorage synchronously gets the id in first. The async subscription in
// app/AnalyticsUser.jsx stays the source of truth: if this read ever comes up
// empty or stale, the next event carries the right answer anyway.
//
// This mirrors supabase-js's default storage key. It is a best-effort shortcut,
// not a dependency: if supabase-js changes the key, or src/lib/supabaseClient.js
// pins a different one, this finds nothing and the first page_view simply goes
// out unattributed, which is how it behaved before.
export function supabaseStorageKey(supabaseUrl) {
  try {
    return `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
  } catch {
    return null;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Only a well-formed UUID comes out, whatever is in storage: this is the one
// value allowed to reach Google, so anything else is treated as no user.
export function userIdFromStoredSession(raw) {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const id = JSON.parse(raw)?.user?.id;
    return typeof id === "string" && UUID.test(id) ? id : null;
  } catch {
    return null;
  }
}
