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

// Whether a play() rejection means the browser will never autoplay this, as
// opposed to "not just now".
//
// AbortError is the background-tab power saving above: the same element plays
// fine when the tab is looked at again, so treating it as a refusal would put a
// play button on a video that was about to work on its own.
//
// Everything else -- NotAllowedError from autoplay being switched off or iOS
// Low Power Mode, above all -- is permanent for this visit.
export function isPermanentPlayRefusal(error) {
  if (!error) return false;
  return error.name !== "AbortError";
}

// Whether to skip autoplay entirely and hand the visitor a normal video.
//
// Reduced motion is a request, not a preference to weigh. No
// IntersectionObserver means nothing would ever start playback, which without
// controls leaves a poster that cannot be played at all.
export function shouldSkipAutoplay({ reducedMotion, hasIntersectionObserver }) {
  return Boolean(reducedMotion) || !hasIntersectionObserver;
}
