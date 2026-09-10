// The rules behind the looping home-page films.
//
// Extracted from the component because none of this can be tested where it
// runs: a headless or unpainted page never fires IntersectionObserver and never
// reports itself visible, so the interesting paths -- resume after a background
// tab, offer controls after a refusal -- cannot be exercised in a browser
// harness. They can be exercised here.

// Whether to ask the element to play right now.
//
// The page check is the load-bearing half. Chrome pauses muted, video-only
// media on a hidden tab to save power, so asking a hidden tab to play earns an
// AbortError and nothing else.
export function shouldAttemptPlay({ onScreen, pageHidden }) {
  return Boolean(onScreen) && !pageHidden;
}

// Whether a play() rejection means the visitor needs a play button, as opposed
// to "not just now".
//
// AbortError on a HIDDEN page is Chrome's background-tab power saving: the same
// element plays fine when the tab is looked at again, so a play button there
// would be reacting to something about to fix itself.
//
// AbortError on a VISIBLE page is a different animal and was previously treated
// the same, which is the bug this argument exists for. Nothing is coming to
// rescue a visible page -- the visitor is looking at it right now -- so
// swallowing it leaves a poster frame that never plays and cannot be played.
// An iOS home-screen web app reached exactly that state.
//
// Everything else -- NotAllowedError from autoplay being switched off or iOS
// Low Power Mode above all -- is permanent for this visit either way.
//
// A third case belongs here too, and is not about the page at all: an
// AbortError we caused ourselves. The observer below calls video.pause()
// whenever the film scrolls (or is measured as) out of view, and pausing a
// video whose play() is still pending is exactly what produces this error --
// it is not the browser declining anything, it is our own code interrupting
// its own request. That happens on any platform where the intersection ratio
// can wobble across the 0.25 threshold right after load, as fonts swap in or
// images above the film settle and shift its position -- a cold PWA launch
// is not exempt from this, and reported reproducing there as readily as in a
// mobile browser tab is what pointed at this rather than at anything to do
// with autoplay policy. Nothing was refused; the next intersection (or the
// visibilitychange listener) will ask again, and selfInterrupted says so
// takes priority over the error's own name.
export function isPermanentPlayRefusal(error, { pageHidden = false, selfInterrupted = false } = {}) {
  if (!error) return false;
  if (selfInterrupted) return false;
  if (error.name === "AbortError") return !pageHidden;
  return true;
}

// Whether a video that was asked to play has actually got going.
//
// The watchdog behind "never stuck". play() can resolve, or never settle, and
// still leave nothing on screen -- WebKit has more than one way to accept a
// play request and then not play. Rather than enumerate them, this asks the
// only question that matters a moment later: is a frame moving? If not, the
// visitor gets controls, whatever the reason was.
export function hasStartedPlaying({ paused, currentTime, readyState }) {
  return !paused && currentTime > 0 && readyState >= 2;
}

// How long the watchdog waits before checking hasStartedPlaying, in
// milliseconds -- and the reason it is not one fixed number.
//
// A slow mobile connection is not a refusal. play() on a video with nothing
// buffered yet does not reject; it just stays pending until enough data
// arrives, and that can easily take longer than a couple of seconds on
// cellular for a multi-megabyte clip. The original fixed 2.5s watchdog could
// not tell "still downloading" from "never going to play", and reaching for a
// bigger fixed number only moves where that line is drawn wrong.
//
// So the deadline moves instead: every `progress` event (fired as bytes
// actually arrive) pushes it out by PATIENCE_MS, which is what tells a slow
// download apart from a stalled one -- a video that keeps receiving data
// keeps earning more time, one that stops receiving data does not. HARD_CAP_MS
// is the backstop that keeps this from waiting forever: the pathological case
// #146 exists for (data present, decoder simply never starts) downloads its
// whole preload="none" fetch in one burst of progress events and then goes
// quiet, so the cap is what still catches it.
export const WATCHDOG_PATIENCE_MS = 4000;
export const WATCHDOG_HARD_CAP_MS = 15000;

// The delay to arm the next watchdog check with, given how much of the hard
// cap is left. Clamped at both ends: never negative (the cap has already
// passed -- check immediately), never longer than the ordinary patience
// window (progress alone should not buy unlimited time).
export function nextWatchdogDelayMs({ now, deadline, patience = WATCHDOG_PATIENCE_MS }) {
  return Math.max(0, Math.min(patience, deadline - now));
}

// Whether to skip autoplay entirely and hand the visitor a normal video.
//
// Reduced motion is a request, not a preference to weigh. No
// IntersectionObserver means nothing would ever start playback, which without
// controls leaves a poster that cannot be played at all.

export function shouldSkipAutoplay({ reducedMotion, hasIntersectionObserver }) {
  return Boolean(reducedMotion) || !hasIntersectionObserver;
}
