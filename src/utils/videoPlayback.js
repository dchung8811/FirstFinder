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
export function isPermanentPlayRefusal(error, { pageHidden = false } = {}) {
  if (!error) return false;
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

// Whether to skip autoplay entirely and hand the visitor a normal video.
//
// Reduced motion is a request, not a preference to weigh. No
// IntersectionObserver means nothing would ever start playback, which without
// controls leaves a poster that cannot be played at all.

export function shouldSkipAutoplay({ reducedMotion, hasIntersectionObserver }) {
  return Boolean(reducedMotion) || !hasIntersectionObserver;
}
