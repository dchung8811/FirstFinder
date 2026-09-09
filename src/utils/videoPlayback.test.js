import { describe, it, expect } from "vitest";
import { shouldAttemptPlay, isPermanentPlayRefusal, shouldSkipAutoplay } from "./videoPlayback";

describe("shouldAttemptPlay", () => {
  it("plays only what is on screen on a visible page", () => {
    expect(shouldAttemptPlay({ onScreen: true, pageHidden: false })).toBe(true);
  });

  // Asking a hidden tab to play a muted video earns an AbortError from Chrome's
  // power saving and nothing else, so the request is not worth making.
  it("does not ask a hidden tab to play", () => {
    expect(shouldAttemptPlay({ onScreen: true, pageHidden: true })).toBe(false);
  });

  it("does not play what has scrolled away", () => {
    expect(shouldAttemptPlay({ onScreen: false, pageHidden: false })).toBe(false);
    expect(shouldAttemptPlay({ onScreen: false, pageHidden: true })).toBe(false);
  });
});

describe("isPermanentPlayRefusal", () => {
  // The distinction the whole fix rests on. Chrome pausing a background tab is
  // temporary and self-correcting; putting controls on that video would be
  // reacting to something that was about to fix itself.
  it("treats a background-tab abort as temporary", () => {
    expect(isPermanentPlayRefusal(new DOMException("paused to save power", "AbortError"))).toBe(false);
  });

  it("treats a real autoplay refusal as permanent", () => {
    expect(isPermanentPlayRefusal(new DOMException("not allowed", "NotAllowedError"))).toBe(true);
    expect(isPermanentPlayRefusal(new DOMException("no source", "NotSupportedError"))).toBe(true);
  });

  it("is not fooled by a missing error", () => {
    expect(isPermanentPlayRefusal(undefined)).toBe(false);
    expect(isPermanentPlayRefusal(null)).toBe(false);
  });
});

describe("shouldSkipAutoplay", () => {
  it("respects a reduced-motion request", () => {
    expect(shouldSkipAutoplay({ reducedMotion: true, hasIntersectionObserver: true })).toBe(true);
  });

  // Nothing would ever start playback, and without controls that is a poster
  // frame the visitor cannot play -- indistinguishable from a broken image.
  it("skips autoplay where nothing could drive it", () => {
    expect(shouldSkipAutoplay({ reducedMotion: false, hasIntersectionObserver: false })).toBe(true);
  });

  it("autoplays otherwise", () => {
    expect(shouldSkipAutoplay({ reducedMotion: false, hasIntersectionObserver: true })).toBe(false);
  });
});
