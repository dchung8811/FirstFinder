"use client";

import { useEffect } from "react";
import { readStoredUserId, setAnalyticsUser } from "../src/lib/analytics";

// Keeps GA's user_id in step with who is signed in. It has its own auth
// subscription rather than living in InventoryApp, whose getSession /
// onAuthStateChange handlers carry delicate race guards around landing views
// that analytics has no business touching.
//
// The Supabase client is imported lazily. This renders from the root layout,
// so a static import would add supabase-js to every public /books and /c page;
// a dynamic import reuses the one client the app already has (modules are
// singletons) without making pages that never sign anyone in pay for it. The
// layout only renders this when GA is configured.
export default function AnalyticsUser() {
  useEffect(() => {
    let cancelled = false;
    let unsubscribe = () => {};
    // Starts as undefined so the first answer, even "signed out", is sent.
    let lastSent;

    function send(userId) {
      if (cancelled || userId === lastSent) return;
      lastSent = userId;
      setAnalyticsUser(userId);
    }

    // Synchronous, so it runs before GA's own init script (an effect of the
    // <GoogleAnalytics> rendered after this in the layout) queues its config:
    // the first page_view of a signed-in visit then carries the id. Signed-out
    // visits wait for getSession below rather than queueing a null now.
    const storedUserId = readStoredUserId();
    if (storedUserId) send(storedUserId);

    import("../src/lib/supabaseClient")
      .then(({ supabase }) => {
        if (cancelled) return;

        const { data } = supabase.auth.onAuthStateChange((event, session) => {
          // INITIAL_SESSION and TOKEN_REFRESHED carry the same user the page
          // already has; SIGNED_IN and SIGNED_OUT are the changes. Deduping in
          // send() makes passing every event through harmless.
          if (event === "SIGNED_OUT") send(null);
          else send(session?.user?.id || null);
        });
        unsubscribe = () => data?.subscription?.unsubscribe();

        return supabase.auth.getSession().then(({ data: sessionData }) => {
          send(sessionData?.session?.user?.id || null);
        });
      })
      .catch(() => {
        // A missing env var or a failed chunk load costs us one visitor's
        // user_id, never the page.
      });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return null;
}
