import { describe, it, expect } from "vitest";
import {
  shouldAttemptPlay,
  isPermanentPlayRefusal,
  hasStartedPlaying,
  shouldSkipAutoplay,
  nextWatchdogDelayMs,
  WATCHDOG_PATIENCE_MS,
  WATCHDOG_HARD_CAP_MS
} from "./videoPlayback";

const abort = () => new DOMException("paused to save power", "AbortError");

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
  // Chrome pausing a hidden tab is temporary and self-correcting; a play button
  // there would be reacting to something about to fix itself.
  it("treats an abort on a hidden page as temporary", () => {
    expect(isPermanentPlayRefusal(abort(), { pageHidden: true })).toBe(false);
  });

  // The regression this argument exists for. The same error on a page the
  // visitor is looking at has nothing coming to rescue it, and swallowing it
  // left an iOS home-screen web app showing a poster that never played and
  // could not be played.
  it("treats an abort on a visible page as needing a play button", () => {
    expect(isPermanentPlayRefusal(abort(), { pageHidden: false })).toBe(true);
    expect(isPermanentPlayRefusal(abort())).toBe(true);
  });

  it("treats a real autoplay refusal as permanent either way", () => {
    const refused = new DOMException("not allowed", "NotAllowedError");
    expect(isPermanentPlayRefusal(refused, { pageHidden: false })).toBe(true);
    expect(isPermanentPlayRefusal(refused, { pageHidden: true })).toBe(true);
    expect(isPermanentPlayRefusal(new DOMException("no source", "NotSupportedError"))).toBe(true);
  });

  it("is not fooled by a missing error", () => {
    expect(isPermanentPlayRefusal(undefined)).toBe(false);
    expect(isPermanentPlayRefusal(null, { pageHidden: true })).toBe(false);
  });
});

describe("hasStartedPlaying", () => {
  it("recognises a film that is actually running", () => {
    expect(hasStartedPlaying({ paused: false, currentTime: 0.4, readyState: 4 })).toBe(true);
  });

  // Each of these is a way to look like playback without any of it happening,
  // and each would previously have left a motionless poster on screen.
  it("is not satisfied by a play request that went nowhere", () => {
    expect(hasStartedPlaying({ paused: true, currentTime: 0.4, readyState: 4 })).toBe(false);
    expect(hasStartedPlaying({ paused: false, currentTime: 0, readyState: 4 })).toBe(false);
    expect(hasStartedPlaying({ paused: false, currentTime: 0.4, readyState: 0 })).toBe(false);
    expect(hasStartedPlaying({ paused: false, currentTime: 0, readyState: 0 })).toBe(false);
  });
});

describe("nextWatchdogDelayMs", () => {
  // The ordinary case: plenty of the hard cap left, so a progress event buys
  // the full patience window.
  it("grants the full patience window when the cap is far off", () => {
    expect(nextWatchdogDelayMs({ now: 0, deadline: WATCHDOG_HARD_CAP_MS })).toBe(WATCHDOG_PATIENCE_MS);
  });

  // Downloading, but not for much longer: the cap is what still catches a
  // download that keeps trickling data forever without ever playing.
  it("shortens to whatever is left of the cap once that is the binding constraint", () => {
    const now = WATCHDOG_HARD_CAP_MS - 1500;
    expect(nextWatchdogDelayMs({ now, deadline: WATCHDOG_HARD_CAP_MS })).toBe(1500);
  });

  // Past the cap: check right away rather than scheduling a negative delay.
  it("never returns a negative delay once the cap has passed", () => {
    expect(nextWatchdogDelayMs({ now: WATCHDOG_HARD_CAP_MS + 500, deadline: WATCHDOG_HARD_CAP_MS })).toBe(0);
  });

  it("accepts a custom patience window", () => {
    expect(nextWatchdogDelayMs({ now: 0, deadline: 100000, patience: 1000 })).toBe(1000);
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
