import { describe, it, expect } from "vitest";
import { EDGE, GAP, TOUR_STEPS, nearbyStep, placeTooltip, shouldAutoStartTour, stepFits, tourStepsFor } from "./tour";
import { VIEW_PATHS } from "./appNav";

describe("TOUR_STEPS", () => {
  it("has unique ids and opens with a welcome card", () => {
    const ids = TOUR_STEPS.map((step) => step.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(TOUR_STEPS[0].id).toBe("welcome");
    expect(TOUR_STEPS[0].targets).toBeUndefined();
  });

  it("only opens views the app actually has", () => {
    for (const step of TOUR_STEPS) {
      if (step.view) expect(VIEW_PATHS[step.view], step.id).toBeTruthy();
    }
  });

  it("gives every step a title and some words", () => {
    for (const step of TOUR_STEPS) {
      expect(step.title, step.id).toBeTruthy();
      expect(step.body.length, step.id).toBeGreaterThan(20);
    }
  });
});

describe("nearbyStep", () => {
  it("moves one step either way and stops at the ends", () => {
    expect(nearbyStep(0, 1, true)).toBe(1);
    expect(nearbyStep(3, -1, true)).toBe(2);
    expect(nearbyStep(0, -1, true)).toBeNull();
    expect(nearbyStep(TOUR_STEPS.length - 1, 1, true)).toBeNull();
  });

  it("steps over the CSV import on a phone, both ways", () => {
    const bulk = TOUR_STEPS.findIndex((step) => step.id === "bulk");
    expect(nearbyStep(bulk - 1, 1, false)).toBe(bulk + 1);
    expect(nearbyStep(bulk + 1, -1, false)).toBe(bulk - 1);
    expect(nearbyStep(bulk - 1, 1, true)).toBe(bulk);
  });
});

describe("tourStepsFor", () => {
  it("leaves the CSV import out on a phone and in on anything wider", () => {
    expect(tourStepsFor(false).map((step) => step.id)).not.toContain("bulk");
    expect(tourStepsFor(true)).toHaveLength(TOUR_STEPS.length);
    expect(tourStepsFor(false)).toHaveLength(TOUR_STEPS.length - 1);
  });

  it("only ever skips steps marked wide-screen only", () => {
    for (const step of TOUR_STEPS) expect(stepFits(step, false), step.id).toBe(!step.wideScreenOnly);
  });
});

describe("shouldAutoStartTour", () => {
  const newCollector = { isLoggedIn: true, tourState: undefined, collectionLoaded: true, collectionSize: 0, view: "dashboard" };

  it("starts for a signed-in collector with an empty collection who hasn't seen it", () => {
    expect(shouldAutoStartTour(newCollector)).toBe(true);
  });

  it("never starts again once taken or skipped", () => {
    expect(shouldAutoStartTour({ ...newCollector, tourState: "done" })).toBe(false);
  });

  it("leaves established collectors alone", () => {
    expect(shouldAutoStartTour({ ...newCollector, collectionSize: 12 })).toBe(false);
  });

  it("waits for the collection to load before judging it empty", () => {
    expect(shouldAutoStartTour({ ...newCollector, collectionLoaded: false })).toBe(false);
  });

  it("doesn't start signed out or over a half-finished task", () => {
    expect(shouldAutoStartTour({ ...newCollector, isLoggedIn: false })).toBe(false);
    expect(shouldAutoStartTour({ ...newCollector, view: "identify" })).toBe(false);
    expect(shouldAutoStartTour({ ...newCollector, view: "tutorial" })).toBe(false);
    expect(shouldAutoStartTour({ ...newCollector, view: "home" })).toBe(false);
  });
});

describe("placeTooltip", () => {
  const viewport = { width: 390, height: 844 };
  const tooltip = { width: 320, height: 200 };

  it("centres the card when there's nothing to point at", () => {
    const placement = placeTooltip(null, tooltip, viewport);
    expect(placement.side).toBe("center");
    expect(placement.left).toBe(35);
    expect(placement.top).toBe(322);
  });

  it("goes below the target when there is room", () => {
    const placement = placeTooltip({ top: 100, left: 20, width: 350, height: 60 }, tooltip, viewport);
    expect(placement).toEqual({ top: 160 + GAP, left: 35, side: "below" });
  });

  it("goes above when below would run off the screen", () => {
    const placement = placeTooltip({ top: 600, left: 20, width: 350, height: 100 }, tooltip, viewport);
    expect(placement.side).toBe("above");
    expect(placement.top).toBe(600 - GAP - 200);
  });

  it("pins to the bottom for a target taller than the screen", () => {
    const placement = placeTooltip({ top: 50, left: 0, width: 390, height: 780 }, tooltip, viewport);
    expect(placement.side).toBe("pinned");
    expect(placement.top).toBe(844 - 200 - EDGE);
  });

  it("keeps the card on screen beside a target at the edge", () => {
    const placement = placeTooltip({ top: 20, left: 340, width: 40, height: 40 }, tooltip, viewport);
    expect(placement.left).toBe(390 - 320 - EDGE);
  });
});
