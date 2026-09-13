import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// The recovery pass that adopts files present in an item's folder but missing
// from its row, and the guard that keeps it from writing in a loop.
const APP = resolve(process.cwd(), "app/InventoryApp.jsx");
const source = readFileSync(APP, "utf8");

describe("photo recovery", () => {
  it("lists the folder and reconciles against the row", () => {
    expect(source).toContain("listItemPhotoPaths(userId, entryId)");
    expect(source).toContain("reconcilePhotoLists(folderPaths");
  });

  // A failed listing is not an empty folder. Acting on null would conclude
  // every photo is missing.
  it("does nothing when the listing itself failed", () => {
    expect(source).toMatch(/folderPaths === null\) return;/);
  });

  it("writes the recovered lists back through the retry", () => {
    const writer = /async function recoverItemPhotos\([\s\S]*?\n  \}/.exec(source);
    expect(writer).not.toBeNull();
    expect(writer[0]).toContain("withWriteRetry");
    expect(writer[0]).toContain("item_photos");
    expect(writer[0]).toContain("receipt_photos");
  });

  // `entry` is captured when the viewer opens and never gains what this
  // recovers, so without a once-per-item guard the write's own re-render
  // re-enters with the same stale entry and writes again, forever.
  it("cannot re-enter for an item it has already reconciled", () => {
    expect(source).toContain("recoveredItemRef");
    expect(source).toMatch(/if \(recoveredItemRef\.current === entryId\) return;/);
    expect(source).toMatch(/recoveredItemRef\.current = entryId;/);
  });

  // Depending on the parent's callback identity would re-run the effect on
  // renders that changed nothing here.
  it("does not depend on the parent's callback identity", () => {
    expect(source).toContain("onRecoveredRef");
    const deps = /\/\/ eslint-disable-next-line react-hooks\/exhaustive-deps\s*\n\s*\}, \[entryId, userId\]\);/.exec(source);
    expect(deps).not.toBeNull();
  });

  // Handed a path and no URL, SignedPhoto opens failed and makes the reader
  // press Try again to see a photo that was there all along.
  it("signs recovered photos before showing them", () => {
    expect(source).toMatch(/const signed = await fetchSignedPhotoUrls\(recovered\);/);
  });

  it("respects which photos the viewer is showing", () => {
    expect(source).toMatch(/receiptsOnly \? \[\] : reconciled\.itemPhotos/);
  });

  it("does not run for a queued item that has no row yet", () => {
    const writer = /async function recoverItemPhotos\([\s\S]*?\n  \}/.exec(source);
    expect(writer[0]).toContain("isPendingId(itemId)");
  });
});
