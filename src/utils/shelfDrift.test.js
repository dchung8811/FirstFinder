import { describe, expect, it } from "vitest";
import {
  SHELF_MAX_FLING,
  SHELF_SETTLE_SECONDS,
  shelfReleaseVelocity,
  stepShelf,
  wrapShelfOffset
} from "./shelfDrift";

describe("wrapShelfOffset", () => {
  it("keeps an offset inside one span to the left", () => {
    expect(wrapShelfOffset(-250, 1000)).toBe(-250);
    expect(wrapShelfOffset(-1250, 1000)).toBe(-250);
    expect(wrapShelfOffset(-3250, 1000)).toBe(-250);
  });

  it("wraps a strip dragged to the right back onto its halves", () => {
    expect(wrapShelfOffset(250, 1000)).toBe(-750);
    expect(wrapShelfOffset(2250, 1000)).toBe(-750);
  });

  it("treats zero as the identical frame a whole span over", () => {
    expect(wrapShelfOffset(0, 1000)).toBe(-1000);
  });

  it("does not produce NaN before the strip has been measured", () => {
    expect(wrapShelfOffset(-250, 0)).toBe(0);
    expect(wrapShelfOffset(NaN, 1000)).toBe(0);
  });
});

describe("stepShelf", () => {
  const span = 10000;

  it("cruises at the cruise speed when nobody has touched it", () => {
    const next = stepShelf({ offset: -100, velocity: -50, cruise: -50, dt: 1, span });
    expect(next.velocity).toBe(-50);
    expect(next.offset).toBeCloseTo(-150);
  });

  it("eases a fling back toward the cruise instead of stopping", () => {
    let state = { offset: -5000, velocity: -3000 };
    for (let frame = 0; frame < 600; frame += 1) {
      state = stepShelf({ ...state, cruise: -50, dt: 1 / 60, span });
    }
    expect(state.velocity).toBeCloseTo(-50, 1);
  });

  it("turns a fling to the right back into the leftward cruise", () => {
    let state = { offset: -5000, velocity: 2000 };
    for (let frame = 0; frame < 600; frame += 1) {
      state = stepShelf({ ...state, cruise: -50, dt: 1 / 60, span });
    }
    expect(state.velocity).toBeCloseTo(-50, 1);
  });

  it("moves as far in one slow frame as in many quick ones", () => {
    const start = { offset: -5000, velocity: -2000, cruise: -50, span };
    const once = stepShelf({ ...start, dt: 0.5 });
    let many = { offset: start.offset, velocity: start.velocity };
    for (let frame = 0; frame < 50; frame += 1) {
      many = stepShelf({ ...start, ...many, dt: 0.01 });
    }
    expect(once.offset).toBeCloseTo(many.offset, 6);
    expect(once.velocity).toBeCloseTo(many.velocity, 6);
  });

  it("carries a fling further than the cruise alone would", () => {
    const flung = stepShelf({ offset: -5000, velocity: -2000, cruise: -50, dt: 1, span });
    const cruising = stepShelf({ offset: -5000, velocity: -50, cruise: -50, dt: 1, span });
    expect(flung.offset).toBeLessThan(cruising.offset);
    // Bounded by the excess speed times the settle time, however long it runs.
    expect(cruising.offset - flung.offset).toBeLessThan(1950 * SHELF_SETTLE_SECONDS);
  });

  it("stands still on a zero-length frame", () => {
    expect(stepShelf({ offset: -100, velocity: -2000, cruise: -50, dt: 0, span })).toEqual({ offset: -100, velocity: -2000 });
  });
});

describe("shelfReleaseVelocity", () => {
  it("measures the speed of the last stretch of the drag", () => {
    const samples = [
      { t: 0, x: 0 },
      { t: 900, x: 10 },
      { t: 950, x: 60 },
      { t: 1000, x: 110 }
    ];
    // Only the last 100ms count: 100px over 0.1s, not 110px over a second.
    expect(shelfReleaseVelocity(samples, 1000)).toBeCloseTo(1000);
  });

  it("is negative for a drag to the left", () => {
    expect(shelfReleaseVelocity([{ t: 0, x: 300 }, { t: 50, x: 200 }], 50)).toBeCloseTo(-2000);
  });

  it("is zero when the pointer held still before letting go", () => {
    const samples = [
      { t: 0, x: 0 },
      { t: 50, x: 200 }
    ];
    expect(shelfReleaseVelocity(samples, 400)).toBe(0);
  });

  it("is zero with too few samples to tell", () => {
    expect(shelfReleaseVelocity([], 0)).toBe(0);
    expect(shelfReleaseVelocity([{ t: 0, x: 0 }], 10)).toBe(0);
    expect(shelfReleaseVelocity(undefined, 10)).toBe(0);
  });

  it("caps a flick that would blur the covers", () => {
    expect(shelfReleaseVelocity([{ t: 0, x: 0 }, { t: 10, x: 500 }], 10)).toBe(SHELF_MAX_FLING);
    expect(shelfReleaseVelocity([{ t: 0, x: 500 }, { t: 10, x: 0 }], 10)).toBe(-SHELF_MAX_FLING);
  });
});
