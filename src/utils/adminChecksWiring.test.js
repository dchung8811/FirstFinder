import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// A guard against the compute checks being disconnected without anyone
// noticing, which is exactly what happened between #178 and #180: an
// unrelated change reverted the admin route's wiring, and nothing failed.
//
// Everything that could fail did not: the compute tests exercise
// computeMetrics.js, which was untouched, so all 408 passed. The build
// passed, because a route that imports less still compiles. The only signal
// was four rows quietly missing from a page nobody looks at daily.
//
// This reads the route as text rather than importing it. A Next route handler
// drags in the Supabase admin client and the whole request/response
// machinery, none of which this project can exercise in a plain unit test --
// and the thing worth protecting is not the route's behaviour but the fact
// that these two modules are still joined at all. Text is a crude assertion
// and a truthful one.
const ROUTE = resolve(process.cwd(), "app/api/admin/stats/route.js");

describe("admin stats route wiring", () => {
  const source = readFileSync(ROUTE, "utf8");

  it("still reads the instance's compute metrics", () => {
    expect(source).toContain("readComputeMetrics");
  });

  it("still builds the compute checks", () => {
    expect(source).toContain("buildComputeChecks");
  });

  // The bug was not a missing import -- it was the call disappearing from the
  // array the page renders. Both halves have to be asserted.
  it("still includes them in the checks the page renders", () => {
    expect(source).toMatch(/checks\s*=\s*\[[\s\S]*buildComputeChecks\(/);
  });

  it("still reads the plan quotas alongside them", () => {
    expect(source).toContain("buildPlatformChecks");
  });
});
