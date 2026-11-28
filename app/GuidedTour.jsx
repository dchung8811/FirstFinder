"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { START_TOUR_EVENT, TOUR_STEPS, WIDE_SCREEN_QUERY, nearbyStep, placeTooltip, stepFits, tourStepsFor } from "../src/utils/tour";

// The guided tour: dims the app and spotlights one feature at a time, moving
// through its views. Steps, auto-start rule and card placement live in
// src/utils/tour.js. Rendered by InventoryApp, which owns the view: the tour
// asks it to change view through `onNavigate` rather than routing itself,
// because activeView is this app's router.
//
// Starts by itself for a new collector (`autoStart`), and from the Tutorial
// tab or the footer through START_TOUR_EVENT. `onFinish` records that it was
// taken or skipped, so it never starts by itself again.

// Remembers the step across a reload, for this tab only.
const STORAGE_KEY = "firstfinder:tour";
// Room around the feature inside the spotlight.
const PAD = 8;
// Stop waiting for a step's feature after this long and show the card on its
// own, centred. A target can be missing for real: the collection still
// loading, or a view that changed since the steps were written.
const FIND_TIMEOUT_MS = 4000;

function readProgress() {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? "null");
    return value && Number.isInteger(value.index) && value.index >= 0 && value.index < TOUR_STEPS.length ? value : null;
  } catch {
    return null;
  }
}

function saveProgress(value) {
  try {
    if (value) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be refused. The tour still runs; it just won't survive a reload.
  }
}

function findTarget(targets) {
  for (const name of targets ?? []) {
    const element = document.querySelector(`[data-tour="${name}"]`);
    // getClientRects is empty for something hidden at this width, such as a
    // tab that has moved into the menu, so the next target gets its turn.
    if (element && element.getClientRects().length > 0) return element;
  }
  return null;
}

function watchWideScreen(onChange) {
  const query = window.matchMedia(WIDE_SCREEN_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const isWideScreen = () => window.matchMedia(WIDE_SCREEN_QUERY).matches;

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Any other modal open right now -- the iPhone app sheet, a dialog the
// collector opened. The tour waits for it rather than stacking on top.
function anotherDialogOpen(own) {
  return [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].some((dialog) => dialog !== own);
}

export default function GuidedTour({ activeView, onNavigate, autoStart, onFinish }) {
  // A tour under way before a reload picks up where it was. Read at first
  // render: InventoryApp only mounts the tour once someone is signed in,
  // which is after hydration, so the server never draws this.
  const [progress, setProgress] = useState(readProgress);
  // What the search for the current step's feature turned up, tagged with the
  // step it was for. Anything tagged with another step is stale, which is how
  // moving on clears the spotlight without resetting state in an effect.
  const [found, setFound] = useState({ stepId: null, element: null });
  const [frame, setFrame] = useState({ stepId: null, rect: null, placement: null });
  const tooltip = useRef(null);
  const primary = useRef(null);
  const handled = useRef(progress !== null);
  const restoreFocus = useRef(null);
  // Held in refs so the effects below don't restart every time InventoryApp
  // renders a new function.
  const onNavigateRef = useRef(onNavigate);
  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onNavigateRef.current = onNavigate;
    onFinishRef.current = onFinish;
  });

  // Steps for features hidden on phones (the CSV import) are skipped there.
  // The server answers "wide", but the tour never renders on the server: it
  // only mounts once someone is signed in, after hydration.
  const wideScreen = useSyncExternalStore(watchWideScreen, isWideScreen, () => true);
  const steps = tourStepsFor(wideScreen);
  // A saved step that doesn't fit this screen -- a window narrowed to phone
  // width mid-tour, or a tour picked up after a reload on a phone -- shows as
  // the nearest step that does, going forward first. Worked out here rather
  // than corrected in an effect, so the hidden step is never drawn even once.
  const index = !progress
    ? null
    : stepFits(TOUR_STEPS[progress.index], wideScreen)
      ? progress.index
      : (nearbyStep(progress.index, 1, wideScreen) ?? nearbyStep(progress.index, -1, wideScreen));
  const step = index === null ? null : (TOUR_STEPS[index] ?? null);
  const searching = Boolean(step) && found.stepId !== step.id;
  const target = searching ? null : found.element;
  const previous = index === null ? null : nearbyStep(index, -1, wideScreen);
  const next = index === null ? null : nearbyStep(index, 1, wideScreen);
  const isFirst = index === 0;
  const isLast = next === null;

  const start = useCallback((from) => {
    restoreFocus.current = document.activeElement;
    const fresh = { index: 0, returnTo: from };
    saveProgress(fresh);
    setProgress(fresh);
  }, []);

  const goTo = useCallback((index) => {
    setProgress((current) => {
      if (!current) return current;
      const moved = { ...current, index };
      saveProgress(moved);
      return moved;
    });
  }, []);

  // Ends the tour, taken or skipped, and puts the collector back where they
  // started.
  const end = useCallback(() => {
    const returnTo = progress?.returnTo;
    saveProgress(null);
    setProgress(null);
    onFinishRef.current?.();
    if (returnTo && returnTo !== activeView) onNavigateRef.current(returnTo);
    else restoreFocus.current?.focus?.();
  }, [progress?.returnTo, activeView]);

  // Start a new collector's first tour, once the screen is clear of other
  // dialogs.
  useEffect(() => {
    if (handled.current || !autoStart) return undefined;
    let timer = 0;
    const tryStart = () => {
      if (anotherDialogOpen(null)) {
        timer = window.setTimeout(tryStart, 500);
        return;
      }
      handled.current = true;
      start(activeView);
    };
    // A beat after the page settles, so the tour arrives over the app rather
    // than in place of it.
    timer = window.setTimeout(tryStart, 800);
    return () => window.clearTimeout(timer);
  }, [autoStart, activeView, start]);

  // The Tutorial tab and the footer link.
  useEffect(() => {
    const onStart = () => {
      handled.current = true;
      start(activeView);
    };
    window.addEventListener(START_TOUR_EVENT, onStart);
    return () => window.removeEventListener(START_TOUR_EVENT, onStart);
  }, [activeView, start]);

  // Open the step's view, then wait for its feature to show up and scroll it
  // into view.
  useEffect(() => {
    if (!step) return undefined;
    if (step.view && activeView !== step.view) {
      onNavigateRef.current(step.view);
      // A view that never arrives (signed out mid-tour, say) shows the card
      // anyway rather than leaving the screen dimmed with nothing on it.
      const giveUp = window.setTimeout(() => setFound({ stepId: step.id, element: null }), FIND_TIMEOUT_MS);
      return () => window.clearTimeout(giveUp);
    }
    const startedAt = Date.now();
    let timer = 0;
    const look = () => {
      const element = findTarget(step.targets);
      if (element || !step.targets || Date.now() - startedAt > FIND_TIMEOUT_MS) {
        element?.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
        setFound({ stepId: step.id, element });
        return;
      }
      timer = window.setTimeout(look, 100);
    };
    // A tick later rather than now: the view just switched, and its feature
    // renders on the next paint.
    timer = window.setTimeout(look, 0);
    return () => window.clearTimeout(timer);
  }, [step, activeView]);

  // Follow the feature as the page scrolls, settles or resizes, and keep the
  // card beside it.
  useEffect(() => {
    if (!step || searching) return undefined;
    let raf = 0;
    let last = "";
    const measure = () => {
      const box = target?.getBoundingClientRect();
      const rect = box ? { top: box.top - PAD, left: box.left - PAD, width: box.width + PAD * 2, height: box.height + PAD * 2 } : null;
      const card = tooltip.current;
      const placement = card
        ? placeTooltip(rect, { width: card.offsetWidth, height: card.offsetHeight }, { width: window.innerWidth, height: window.innerHeight })
        : null;
      const key = JSON.stringify([rect, placement]);
      if (key !== last) {
        last = key;
        setFrame({ stepId: step.id, rect, placement });
      }
      raf = window.requestAnimationFrame(measure);
    };
    raf = window.requestAnimationFrame(measure);
    return () => window.cancelAnimationFrame(raf);
  }, [step, target, searching]);

  // While the tour is open, the page stays put underneath it. Scrolling a
  // target into view still works: scrollIntoView ignores overflow hidden.
  const active = Boolean(progress);
  useEffect(() => {
    if (!active) return undefined;
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = before;
    };
  }, [active]);

  // A frame measured for an earlier step is no frame at all.
  const { rect, placement } = frame.stepId === step?.id ? frame : { rect: null, placement: null };

  // Focus the step's main button once the card is in place.
  const placed = Boolean(placement);
  useEffect(() => {
    if (placed) primary.current?.focus({ preventScroll: true });
  }, [placed, step?.id]);

  // Escape skips, the arrow keys step through, and Tab stays inside the card.
  useEffect(() => {
    if (!progress) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        end();
      } else if (event.key === "ArrowRight" && !searching) {
        event.preventDefault();
        if (next !== null) goTo(next);
      } else if (event.key === "ArrowLeft" && !searching) {
        event.preventDefault();
        if (previous !== null) goTo(previous);
      } else if (event.key === "Tab" && tooltip.current) {
        const focusable = [...tooltip.current.querySelectorAll("button:not(:disabled)")];
        if (focusable.length === 0) return;
        const first = focusable[0];
        const lastButton = focusable[focusable.length - 1];
        if (!tooltip.current.contains(document.activeElement)) {
          event.preventDefault();
          first.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          lastButton.focus();
        } else if (!event.shiftKey && document.activeElement === lastButton) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [progress, searching, end, goTo, next, previous]);

  if (!progress || !step) return null;

  // The welcome card isn't counted: "1 of 9" starts at the first feature.
  // Counted among the steps shown on this screen, so a phone reads "of 8"
  // rather than skipping a number. The welcome card isn't counted.
  const count = steps.length - 1;
  const position = steps.indexOf(step);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body" className="fixed inset-0 z-[100] print:hidden">
      {/* Catches clicks so the app underneath can't be used mid-tour. */}
      <div aria-hidden="true" className="absolute inset-0" />
      {rect ? (
        <div aria-hidden="true" className="tour-spotlight pointer-events-none absolute" style={rect} />
      ) : (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[#201a14]/70" />
      )}

      <p className="sr-only" aria-live="polite">
        {searching ? "Loading the next part of the tour" : ""}
      </p>

      {!searching && (
        <div
          ref={tooltip}
          key={step.id}
          className="tour-card absolute w-[min(22rem,calc(100vw-2rem))] space-y-3 rounded-[1.5rem] border border-[#d8c7ad] bg-[#fff9f0] p-5 text-[#201a14] shadow-2xl"
          style={placement ? { top: placement.top, left: placement.left } : { top: 0, left: 0, visibility: "hidden" }}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#7d6c5a]">{step.section}</p>
            {!isFirst && (
              <p className="text-sm font-semibold tabular-nums text-[#665746]">
                {position} of {count}
              </p>
            )}
          </div>
          {!isFirst && (
            <div className="flex gap-1" aria-hidden="true">
              {steps.slice(1).map((item, index) => (
                <span key={item.id} className={`h-1 flex-1 rounded-full ${index < position ? "bg-[#123f38]" : "bg-[#e0d2bc]"}`} />
              ))}
            </div>
          )}
          <h2 id="tour-title" className="font-display text-2xl font-semibold leading-tight text-[#123f38]">
            {step.title}
          </h2>
          <p id="tour-body" className="text-[0.95rem] leading-6 text-[#4d4135]">
            {step.body}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {isFirst ? (
              <>
                <button type="button" onClick={end} className="h-10 rounded-full border border-[#cdbb9d] bg-[#fff8ee] px-4 text-sm font-medium hover:bg-white">
                  Not now
                </button>
                <button
                  ref={primary}
                  type="button"
                  onClick={() => next !== null && goTo(next)}
                  className="ml-auto h-10 rounded-full bg-[#123f38] px-5 text-sm font-medium text-[#fff7ea] hover:bg-[#0f332d]"
                >
                  Show me around
                </button>
              </>
            ) : (
              <>
                {!isLast && (
                  <button type="button" onClick={end} className="min-h-10 text-sm font-medium text-[#665746] underline underline-offset-4 hover:text-[#201a14]">
                    Skip tour
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => previous !== null && goTo(previous)}
                  className="ml-auto h-10 rounded-full border border-[#cdbb9d] bg-[#fff8ee] px-4 text-sm font-medium hover:bg-white"
                >
                  Back
                </button>
                <button
                  ref={primary}
                  type="button"
                  onClick={isLast ? end : () => goTo(next)}
                  className="h-10 rounded-full bg-[#123f38] px-5 text-sm font-medium text-[#fff7ea] hover:bg-[#0f332d]"
                >
                  {isLast ? "Finish" : "Next"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
