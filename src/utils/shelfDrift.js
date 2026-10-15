// The physics behind the home page's shelf strip (FeaturedShelves in
// InventoryApp), kept here so it can be tested without a browser. The strip
// cruises left on its own, can be grabbed and dragged, and when flung keeps
// going on its own momentum before easing back into the cruise -- it never
// coasts to a dead stop, because a strip that has stopped reads as broken.
//
// Offsets are the track's translateX in pixels; velocities are pixels per
// second, negative meaning leftward. "span" is the width of one of the track's
// two identical halves: shifting by a whole span lands on an identical frame,
// which is what lets the loop wrap without a visible jump.

// How quickly a fling settles back to the cruise. After this many seconds
// about two thirds of the extra speed is gone; after three times it, nearly
// all. Long enough that a hard flick sends several covers past, short enough
// that the strip is drifting normally again within a couple of seconds.
export const SHELF_SETTLE_SECONDS = 0.7;

// A flick on a trackpad or a fast phone can report speeds that would blur the
// covers past in a frame or two. Faster than this stops reading as momentum.
export const SHELF_MAX_FLING = 4000;

// Movement under this many pixels is a tap, not a drag, so the cover under the
// finger still opens. Large enough to absorb the wobble of a real tap.
export const SHELF_DRAG_THRESHOLD = 6;

// Release speed is measured over this last stretch of the drag only. Over the
// whole drag, a slow pull that ends in a flick would launch at an average of
// the two; and someone who drags, holds still, then lets go has no speed at
// all, which is what they meant.
export const SHELF_VELOCITY_WINDOW_MS = 100;

// Wraps an offset into [-span, 0). Both ends of that range show the same
// frame, so the strip can be dragged or flung any distance in either
// direction and stay on its two halves.
export function wrapShelfOffset(offset, span) {
  if (!(span > 0) || !Number.isFinite(offset)) return 0;
  return (((offset % span) + span) % span) - span;
}

// Advances the strip by dt seconds while nobody is holding it. The velocity
// approaches the cruise exponentially, and the distance is the exact integral
// of that curve rather than velocity * dt, so a slow frame moves the strip as
// far as several fast ones would have.
export function stepShelf({ offset, velocity, cruise, dt, span, settleSeconds = SHELF_SETTLE_SECONDS }) {
  if (!(dt > 0)) return { offset: wrapShelfOffset(offset, span), velocity };
  const decay = Math.exp(-dt / settleSeconds);
  const excess = velocity - cruise;
  return {
    offset: wrapShelfOffset(offset + cruise * dt + excess * settleSeconds * (1 - decay), span),
    velocity: cruise + excess * decay
  };
}

// The speed the strip is let go at, from the pointer positions recorded during
// the drag: [{ t, x }] with t in milliseconds and x in pixels. Measured up to
// the moment of release, so a pointer that stopped moving before it was lifted
// counts as stopped.
export function shelfReleaseVelocity(samples, releasedAt, { windowMs = SHELF_VELOCITY_WINDOW_MS, max = SHELF_MAX_FLING } = {}) {
  const recent = (samples || []).filter((sample) => releasedAt - sample.t <= windowMs);
  if (recent.length < 2) return 0;
  const first = recent[0];
  const last = recent[recent.length - 1];
  const seconds = (releasedAt - first.t) / 1000;
  if (!(seconds > 0)) return 0;
  const velocity = (last.x - first.x) / seconds;
  return Math.max(-max, Math.min(max, velocity));
}
