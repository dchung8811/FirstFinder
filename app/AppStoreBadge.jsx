"use client";

import { useSyncExternalStore } from "react";
import { APP_STORE_URL, isIPhoneBrowser } from "../src/utils/iosApp";

// A "Download on the App Store" badge for page footers, drawn only for
// visitors in an iPhone browser: the app is iPhone only, so on anything else
// the link leads to a listing that can't be installed.
//
// Drawn inline rather than as Apple's downloadable artwork so it needs no
// asset fetch and its text sets in the system font, which on an iPhone is the
// badge's own typeface. It follows Apple's black badge: black fill, thin grey
// keyline, logo left of two lines of text, and at least 40px tall on screen.
//
// The server can't see the user agent, so it always renders nothing, and the
// client answers for real once hydrated. useSyncExternalStore is what keeps
// those two from disagreeing during hydration. The user agent never changes
// within a page's life, so there is nothing to subscribe to.
const noSubscription = () => () => {};
const onIPhone = () => isIPhoneBrowser(window.navigator.userAgent);
const onServer = () => false;

export default function AppStoreBadge({ className = "" }) {
  const show = useSyncExternalStore(noSubscription, onIPhone, onServer);

  if (!show) return null;

  return (
    <a
      href={APP_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Download FirstFinder on the App Store"
      className={`inline-flex h-11 items-center gap-2 rounded-[9px] border border-[#a6a6a6] bg-black pl-2.5 pr-3.5 text-white transition active:opacity-80 ${className}`}
      style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif" }}
    >
      <AppleLogo className="h-6 w-6 shrink-0" />
      <span className="flex flex-col leading-none">
        <span className="text-[10px] font-medium tracking-[0.01em]">Download on the</span>
        <span className="mt-0.5 text-[19px] font-semibold tracking-[-0.02em]">App Store</span>
      </span>
    </a>
  );
}

function AppleLogo({ className }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}
