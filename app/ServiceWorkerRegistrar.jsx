"use client";

import { useEffect } from "react";

// Registers public/sw.js, and nothing else. Rendering it from the layout is
// what makes the app installable and gives it a shell that survives a dead
// connection (issue #60).
//
// Not registered in development: a service worker serving a cached shell in
// front of the dev server turns every edit into a debugging session about why
// the change did not appear.
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    // After load, so registration never competes with the first paint for
    // bandwidth on the connection this is all meant to help with.
    function register() {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        // A refused registration (private mode, an unsupported browser, a
        // policy) costs the collector nothing but offline support. It is not
        // worth a toast in front of someone who did not ask for this.
        console.error("Service worker registration failed:", error.message);
      });
    }

    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
