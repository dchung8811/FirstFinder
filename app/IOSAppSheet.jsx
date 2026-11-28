"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { APP_STORE_URL, shouldShowAppSheet } from "../src/utils/iosApp";
import { readAppSheetClosedAt, writeAppSheetClosedAt } from "../src/lib/appSheetDismissal";

// The sheet that rises on an iPhone browser to say FirstFinder is also an
// app. Mounted once in the root layout, so it greets a visitor on whichever
// page they land -- a shared collection or a guide from search as often as
// the home page. Who sees it and for how long it stays closed are decided in
// src/utils/iosApp.js; notably it never shows inside the iOS app's own web
// views.
//
// Not Apple's Smart App Banner (<meta name="apple-itunes-app">). That one
// would know whether the app is already installed, which this can't, but it
// only works in Safari and is a thin strip that's easy to miss. Running both
// would ask twice, so it's one or the other.

// Long enough for the page underneath to paint first, so the sheet reads as
// arriving over the site rather than in place of it.
const OPEN_DELAY_MS = 600;

export default function IOSAppSheet() {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const sheetRef = useRef(null);

  useEffect(() => {
    // After mount only: the server can't see the user agent or localStorage.
    if (!shouldShowAppSheet(window.navigator.userAgent, readAppSheetClosedAt(), Date.now())) return;
    const timer = window.setTimeout(() => setOpen(true), OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(event) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("keydown", handleKeyDown);
    sheetRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Every way out counts as "closed", tapping through to the App Store
  // included: whoever went to look doesn't need asking again on the way back.
  function close() {
    writeAppSheetClosedAt(Date.now());
    setOpen(false);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="ios-app-sheet"
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 print:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
          onClick={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <motion.div
            ref={sheetRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-app-sheet-title"
            className="w-full max-w-md rounded-t-[2rem] bg-[#fff9f0] px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3 text-[#201a14] shadow-2xl outline-none"
            initial={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", damping: 32, stiffness: 320 }}
          >
            <div className="mx-auto h-1.5 w-10 rounded-full bg-[#d9cbb6]" aria-hidden="true" />

            <div className="mt-6 flex items-center gap-4">
              <img
                src="/firstfinder-mark-exact.png"
                alt=""
                className="h-16 w-16 shrink-0 rounded-[1.1rem] object-cover shadow-md"
              />
              <div className="min-w-0">
                <h2 id="ios-app-sheet-title" className="font-display text-2xl font-semibold leading-tight tracking-tight">
                  FirstFinder is on iPhone
                </h2>
                <p className="mt-1 text-sm text-[#665746]">Free on the App Store</p>
              </div>
            </div>

            <p className="mt-5 text-[15px] leading-6 text-[#4d4135]">
              The same catalog, made for your phone. Sign in with the account you use here and your whole
              collection comes with you.
            </p>

            <a
              href={APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={close}
              className="pressable mt-6 flex w-full items-center justify-center rounded-full bg-[#123f38] px-6 py-3.5 text-base font-medium text-[#fff7ea] transition hover:bg-[#0f332d]"
            >
              Get the app
            </a>
            <button
              type="button"
              onClick={close}
              className="mt-2 w-full rounded-full px-6 py-3 text-base font-medium text-[#123f38] transition hover:bg-[#f0e2cf]"
            >
              Continue in browser
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
