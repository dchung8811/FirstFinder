import { describe, expect, it } from "vitest";
import {
  EXPLORE_STRIP_LIMIT,
  buildExploreCollection,
  collectionMonogram,
  normalizeExplorePicks,
  selectExploreItems,
  sortExploreCollections,
  toggleExplorePick,
  updatedAgo
} from "./explore";
import { fromDbShareSettings, toDbShareRow } from "./mapping";
import { defaultShareSettings } from "./publicCollection";

const settings = { ...defaultShareSettings, visibility: "listed", showOnExplore: true, exploreItemIds: [] };

function item(id, overrides = {}) {
  return {
    id,
    name: `Book ${id}`,
    author: "An Author",
    category: "Book",
    status: "Owned",
    bookEdition: "",
    bookPrinting: "",
    itemPhotos: [{ path: `user/${id}/cover.jpg`, name: "cover.jpg" }],
    receiptPhotos: [{ path: `user/${id}/receipt.jpg` }],
    estimatedValue: "900",
    purchasePrice: "120",
    notes: "Bought from a private seller",
    ...overrides
  };
}

const ids = (list) => list.map((entry) => entry.id);

describe("normalizeExplorePicks", () => {
  it("keeps order, drops repeats and non-strings, and caps at the limit", () => {
    expect(normalizeExplorePicks(["b", "a", "b", null, 3, ""])).toEqual(["b", "a"]);
    const many = Array.from({ length: 12 }, (_, index) => `id${index}`);
    expect(normalizeExplorePicks(many)).toHaveLength(EXPLORE_STRIP_LIMIT);
    expect(normalizeExplorePicks(undefined)).toEqual([]);
  });
});

describe("toggleExplorePick", () => {
  it("adds and removes", () => {
    expect(toggleExplorePick([], "a")).toEqual(["a"]);
    expect(toggleExplorePick(["a", "b"], "a")).toEqual(["b"]);
  });

  it("refuses a ninth pick instead of dropping an earlier one", () => {
    const full = Array.from({ length: EXPLORE_STRIP_LIMIT }, (_, index) => `id${index}`);
    expect(toggleExplorePick(full, "extra")).toEqual(full);
  });
});

describe("selectExploreItems", () => {
  const publicItems = ["n1", "n2", "n3", "n4", "n5", "n6", "n7", "n8", "n9", "n10"].map((id) => ({ id }));

  it("falls back to the newest items when nothing is picked", () => {
    expect(ids(selectExploreItems(publicItems, []))).toEqual(["n1", "n2", "n3", "n4", "n5", "n6", "n7", "n8"]);
  });

  it("shows exactly the picks, in the owner's order, without topping up", () => {
    expect(ids(selectExploreItems(publicItems, ["n9", "n2", "n5"]))).toEqual(["n9", "n2", "n5"]);
  });

  it("drops picks that are no longer public, and falls back if none survive", () => {
    expect(ids(selectExploreItems(publicItems, ["gone", "n3"]))).toEqual(["n3"]);
    expect(ids(selectExploreItems(publicItems, ["gone"]))).toHaveLength(EXPLORE_STRIP_LIMIT);
  });
});

describe("buildExploreCollection", () => {
  it("never carries money, notes, or receipts -- even when the page shows them", () => {
    const generous = { ...settings, showEstimatedValue: true, showPrices: true, showNotes: true, showProvenance: true };
    const row = buildExploreCollection({ slug: "s", settings: generous, items: [item("a")] });
    const text = JSON.stringify(row);
    expect(text).not.toContain("900");
    expect(text).not.toContain("120");
    expect(text).not.toContain("private seller");
    expect(text).not.toContain("receipt");
    expect(Object.keys(row.covers[0]).sort()).toEqual(["author", "category", "id", "maker", "name", "photoPath"]);
  });

  it("leaves out items the collection page would leave out, even when picked", () => {
    const items = [item("a"), item("hidden", { hiddenFromShare: true }), item("sold", { status: "Sold" })];
    const row = buildExploreCollection({
      slug: "s",
      settings: { ...settings, exploreItemIds: ["hidden", "sold"] },
      items
    });
    expect(row.itemCount).toBe(1);
    expect(ids(row.covers)).toEqual(["a"]);
  });

  it("counts first editions and what doesn't fit in the strip", () => {
    const items = Array.from({ length: 11 }, (_, index) =>
      item(`i${index}`, index < 3 ? { bookEdition: "First", bookPrinting: "First" } : {})
    );
    const row = buildExploreCollection({ slug: "s", settings, items });
    expect(row.firstEditionCount).toBe(3);
    expect(row.covers).toHaveLength(EXPLORE_STRIP_LIMIT);
    expect(row.moreCount).toBe(3);
  });

  it("dates activity by the newest shared item, not just the settings save", () => {
    const row = buildExploreCollection({
      slug: "s",
      settings,
      items: [item("a")],
      updatedAt: "2026-01-01T00:00:00.000Z",
      createdAtById: { a: "2026-09-01T00:00:00.000Z" }
    });
    expect(row.lastActivity).toBe("2026-09-01T00:00:00.000Z");
  });

  it("gives a photoless cover a null path rather than dropping it", () => {
    const row = buildExploreCollection({ slug: "s", settings, items: [item("a", { itemPhotos: [] })] });
    expect(row.covers[0].photoPath).toBeNull();
  });
});

describe("sortExploreCollections", () => {
  it("puts the most recently active first and drops empty shelves", () => {
    const sorted = sortExploreCollections([
      { slug: "old", itemCount: 4, lastActivity: "2026-01-01T00:00:00.000Z" },
      { slug: "empty", itemCount: 0, lastActivity: "2026-10-01T00:00:00.000Z" },
      { slug: "new", itemCount: 2, lastActivity: "2026-09-01T00:00:00.000Z" },
      { slug: "undated", itemCount: 1, lastActivity: null }
    ]);
    expect(sorted.map((row) => row.slug)).toEqual(["new", "old", "undated"]);
  });
});

describe("collectionMonogram", () => {
  it("uses initials from the title", () => {
    expect(collectionMonogram("Sam Rivera's collection")).toBe("SR");
    expect(collectionMonogram("Steinbeck")).toBe("ST");
    expect(collectionMonogram("")).toBe("FF");
  });
});

describe("updatedAgo", () => {
  const now = Date.parse("2026-10-06T12:00:00.000Z");
  it("is coarse", () => {
    expect(updatedAgo("2026-10-06T01:00:00.000Z", now)).toBe("updated today");
    expect(updatedAgo("2026-10-04T12:00:00.000Z", now)).toBe("updated 2d ago");
    expect(updatedAgo("2026-09-15T12:00:00.000Z", now)).toBe("updated 3w ago");
    expect(updatedAgo("2026-05-01T12:00:00.000Z", now)).toBe("updated 5mo ago");
    expect(updatedAgo(null, now)).toBe("");
  });
});

describe("share row mapping for Explore", () => {
  it("never stores Explore as on for a page that isn't listed", () => {
    const row = toDbShareRow({ ...settings, visibility: "unlisted", showOnExplore: true }, "u", "slug");
    expect(row.show_on_explore).toBe(false);
    expect(toDbShareRow(settings, "u", "slug").show_on_explore).toBe(true);
  });

  it("round-trips the picks, cleaned and capped", () => {
    const many = Array.from({ length: 10 }, (_, index) => `id${index}`);
    const row = toDbShareRow({ ...settings, exploreItemIds: ["a", "a", ...many] }, "u", "slug");
    expect(row.explore_item_ids).toHaveLength(EXPLORE_STRIP_LIMIT);
    expect(fromDbShareSettings(row).exploreItemIds).toEqual(row.explore_item_ids);
    expect(fromDbShareSettings({}).exploreItemIds).toEqual([]);
  });
});
