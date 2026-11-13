import { supabase } from "./supabaseClient";

// Tells the server an item was just added, so it can send the one-time "You
// added your first book!" email (app/api/first-item-email). Called after
// every successful add rather than only the first, because this tab can't
// know what the account did on another device -- the server decides, and
// sends at most once per account.
//
// Fire and forget: it never throws, never shows anything, and never delays
// the add. Once the server says the account is settled, this page stops
// asking, so a long session of adding books makes one request, not one each.

const SETTLED_STATUSES = new Set(["sent", "already_handled", "no_email"]);
const settledUserIds = new Set();
const inFlightUserIds = new Set();

export function requestFirstItemEmail(userId) {
  if (!userId || settledUserIds.has(userId) || inFlightUserIds.has(userId)) return;
  inFlightUserIds.add(userId);

  (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data?.session?.access_token;
      if (!accessToken) return;

      // keepalive lets the request finish if the collector navigates away or
      // closes the tab straight after saving.
      const response = await fetch("/api/first-item-email", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        keepalive: true
      });
      if (!response.ok) return;

      const body = await response.json();
      if (SETTLED_STATUSES.has(body?.status)) settledUserIds.add(userId);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn("First-item email request failed:", error.message);
      }
    } finally {
      inFlightUserIds.delete(userId);
    }
  })();
}
