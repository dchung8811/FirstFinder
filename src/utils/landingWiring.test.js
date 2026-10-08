import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// Where a signed-in visit lands is decided by whichever of getSession and
// onAuthStateChange's INITIAL_SESSION answers first, and the order between
// them isn't fixed. The first spends the address the visit asked for. If the
// second were also allowed to place the visit, it would find nothing left to
// spend and send a collector who opened /feedback -- or refreshed
// /collection -- to the dashboard. It shipped that way once, and passed every
// signed-out check.
//
// Read as text rather than imported, for the reason adminChecksWiring.test.js
// gives: InventoryApp.jsx is a "use client" component that drags in the
// Supabase browser client.
const source = readFileSync(resolve(process.cwd(), "app/InventoryApp.jsx"), "utf8");

describe("signed-in landing", () => {
  it("is decided once, behind the same guard that loads the inventory once", () => {
    const all = source.match(/land\(takeLandingView\(true\)\)/g) || [];
    const guarded = source.match(/if \(loadedUserIdRef\.current !== [^)]+\) \{[^}]*land\(takeLandingView\(true\)\)/g) || [];
    expect(all.length).toBeGreaterThan(0);
    expect(guarded.length).toBe(all.length);
  });
});
