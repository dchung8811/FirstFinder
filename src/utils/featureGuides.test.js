import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { featureGuides, getGuide, guidePath } from "../content/featureGuides";
import { features } from "../content/features";

// public/ as seen from this file, so a guide can't point at a screenshot that
// was renamed or never committed -- the page would build and show a broken
// image, and no other test would notice.
const PUBLIC_DIR = join(import.meta.dirname, "..", "..", "public");

describe("feature guides", () => {
  it("have unique slugs and the fields the page renders", () => {
    const slugs = featureGuides.map((guide) => guide.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const guide of featureGuides) {
      expect(guide.slug).toMatch(/^[a-z0-9-]+$/);
      expect(guide.title.trim()).not.toBe("");
      expect(guide.summary.trim()).not.toBe("");
      expect(guide.steps.length).toBeGreaterThan(0);
      for (const step of guide.steps) {
        expect(step.title.trim()).not.toBe("");
        expect(step.body.trim()).not.toBe("");
      }
    }
  });

  it("only point at images and videos that exist, each with alt text", () => {
    for (const guide of featureGuides) {
      for (const step of guide.steps) {
        if (!step.image) continue;
        expect(existsSync(join(PUBLIC_DIR, step.image.src)), step.image.src).toBe(true);
        expect(step.image.alt.trim(), step.image.src).not.toBe("");
        expect(step.image.width).toBeGreaterThan(0);
        expect(step.image.height).toBeGreaterThan(0);
      }
      if (guide.video) {
        expect(existsSync(join(PUBLIC_DIR, guide.video.src)), guide.video.src).toBe(true);
        expect(existsSync(join(PUBLIC_DIR, guide.video.poster)), guide.video.poster).toBe(true);
      }
    }
  });

  it("are each linked from exactly one Features entry, and every link resolves", () => {
    const linked = features.filter((entry) => entry.guide).map((entry) => entry.guide);
    for (const slug of linked) expect(getGuide(slug), slug).not.toBeNull();
    expect([...linked].sort()).toEqual(featureGuides.map((guide) => guide.slug).sort());
  });

  it("build their paths under /features", () => {
    expect(guidePath({ slug: "wishlist" })).toBe("/features/wishlist");
    expect(getGuide("no-such-guide")).toBeNull();
  });
});
