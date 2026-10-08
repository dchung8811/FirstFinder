"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../src/lib/supabaseClient";
import { forgetAccountOnDevice } from "../../src/lib/forgetAccountOnDevice";
import { appNavItems, pathForView } from "../../src/utils/appNav";
import SiteNav from "../SiteNav";

// The app's own nav bar on /explore. Explore is reached from that bar, and a
// page that drops it the moment you arrive reads as having left the site.
//
// Every tab but Explore is a page inside the app, at its own address
// (src/utils/appNav.js), which InventoryApp opens once it knows who is
// signed in.
// No counts beside My Collection and Wishlist: this page never loads the
// collection, and a number here would mean fetching it just to print it.
export default function ExploreNav() {
  const router = useRouter();
  // undefined until the session lookup answers. The tabs wait for it rather than
  // drawing the signed-out list first and swapping nine tabs in a moment
  // later under a collector's cursor.
  const [session, setSession] = useState(undefined);
  const isLoggedIn = session === undefined ? null : Boolean(session);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data?.session ?? null);
    });
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession ?? null));
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const items = isLoggedIn === null ? [] : appNavItems({ isLoggedIn });

  return (
    <SiteNav
      items={items}
      activeView="explore"
      onSelect={(navItem) => router.push(navItem.href || pathForView(navItem.view))}
      onHome={() => router.push("/")}
      account={
        isLoggedIn === null ? null : isLoggedIn ? (
          // Signing out leaves you here: Explore is public, so there is no
          // reason to bounce anyone off it. It still takes the collection
          // cached in this browser with it, exactly as the app's Log out does.
          <button
            type="button"
            onClick={async () => {
              const userId = session?.user?.id;
              const { error } = await supabase.auth.signOut();
              if (!error) await forgetAccountOnDevice(userId);
            }}
            className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-[#cdbb9d] bg-[#fff8ee] px-5 py-3 text-sm font-medium text-[#201a14] transition hover:bg-white"
          >
            Log out
          </button>
        ) : (
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-[#123f38] px-5 py-3 text-sm font-medium text-[#fff7ea] transition hover:bg-[#0f332d]"
          >
            Log in
          </button>
        )
      }
    />
  );
}
