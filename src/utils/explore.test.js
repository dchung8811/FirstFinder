import { describe, expect, it } from "vitest";
import {
  EXPLORE_STRIP_LIMIT,
  EXPLORE_QUERY_MAX,
  EXPLORE_SEARCH_LIMIT,
  buildExploreCollection,
  capExploreSearch,
  cleanExploreQuery,
  collectionMonogram,
  featuredShelves,
  interleaveShelfCovers,
  normalizeExplorePicks,
  orderExploreMatches,
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

  it("prefers photographed items when falling back, keeping newest-first within each", () => {
    const mixed = [{ id: "bare1" }, { id: "pic1", photos: [{ path: "p" }] }, { id: "bare2" }, { id: "pic2", photos: [{ path: "q" }] }];
    expect(ids(selectExploreItems(mixed, [], 3))).toEqual(["pic1", "pic2", "bare1"]);
  });

  it("keeps a photoless pick where the owner put it", () => {
    const mixed = [{ id: "bare1" }, { id: "pic1", photos: [{ path: "p" }] }];
    expect(ids(selectExploreItems(mixed, ["bare1", "pic1"]))).toEqual(["bare1", "pic1"]);
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

describe("buildExploreCollection with a search", () => {
  const items = [
    item("a", { name: "East of Eden", author: "John Steinbeck", bookEdition: "First Edition" }),
    item("b", { name: "Cannery Row", author: "John Steinbeck", itemPhotos: [] }),
    item("c", { name: "Beloved", author: "Toni Morrison" }),
    item("d", { name: "Jane Eyre", author: "Charlotte Brontë" })
  ];

  it("fills the strip with the shelf's matches and counts them", () => {
    const row = buildExploreCollection({ slug: "s", settings, items, query: "steinbeck" });
    expect(ids(row.covers)).toEqual(["a", "b"]);
    expect(row.matchCount).toBe(2);
    expect(row.itemCount).toBe(4);
    expect(row.moreCount).toBe(0);
  });

  it("matches every term across fields, and ignores accents", () => {
    expect(ids(buildExploreCollection({ slug: "s", settings, items, query: "steinbeck first" }).covers)).toEqual(["a"]);
    expect(ids(buildExploreCollection({ slug: "s", settings, items, query: "bronte" }).covers)).toEqual(["d"]);
  });

  it("puts the owner's picks first but still shows every other match", () => {
    const picked = { ...settings, exploreItemIds: ["b", "c"] };
    expect(ids(buildExploreCollection({ slug: "s", settings: picked, items, query: "steinbeck" }).covers)).toEqual(["b", "a"]);
  });

  it("is not cut to the eight-cover strip", () => {
    const many = Array.from({ length: EXPLORE_STRIP_LIMIT + 3 }, (_, index) => item(`m${index}`, { author: "Ray Bradbury" }));
    const row = buildExploreCollection({ slug: "s", settings, items: many, query: "bradbury" });
    expect(row.covers).toHaveLength(EXPLORE_STRIP_LIMIT + 3);
    expect(row.moreCount).toBe(0);
  });

  it("still cuts the strip to the picks when nobody searched", () => {
    const picked = { ...settings, exploreItemIds: ["b"] };
    expect(ids(buildExploreCollection({ slug: "s", settings: picked, items }).covers)).toEqual(["b"]);
  });

  it("never matches notes or provenance, even when the owner's page shows them", () => {
    const generous = { ...settings, showNotes: true, showProvenance: true };
    const row = buildExploreCollection({
      slug: "s",
      settings: generous,
      items: [item("a", { source: "Estate sale on Elm Street" })],
      query: "private seller"
    });
    expect(row.matchCount).toBe(0);
    expect(buildExploreCollection({ slug: "s", settings: generous, items: [item("a", { source: "Estate sale on Elm Street" })], query: "elm" }).matchCount).toBe(0);
  });

  it("reports matchCount as null when nobody searched", () => {
    expect(buildExploreCollection({ slug: "s", settings, items }).matchCount).toBeNull();
  });
});

describe("orderExploreMatches", () => {
  const withPhoto = (id) => ({ id, photos: [{ path: `p/${id}` }] });
  const bare = (id) => ({ id, photos: [] });

  it("leads with surviving picks, then photographed, then the rest, dropping nothing", () => {
    const matches = [bare("n1"), withPhoto("p1"), bare("n2"), withPhoto("p2")];
    expect(ids(orderExploreMatches(matches, ["n2", "gone"]))).toEqual(["n2", "p1", "p2", "n1"]);
  });

  it("handles no picks and no matches", () => {
    expect(ids(orderExploreMatches([bare("a"), withPhoto("b")], []))).toEqual(["b", "a"]);
    expect(orderExploreMatches(undefined, ["a"])).toEqual([]);
  });
});

describe("capExploreSearch", () => {
  const shelf = (slug, count) => ({
    slug,
    itemCount: 100,
    matchCount: count,
    covers: Array.from({ length: count }, (_, index) => ({ id: `${slug}${index}` }))
  });

  it("shares the cap across shelves instead of letting the biggest take it all", () => {
    const capped = capExploreSearch([shelf("big", 204), shelf("small", 5), shelf("one", 1)], 60);
    expect(capped.map((row) => row.covers.length)).toEqual([54, 5, 1]);
    expect(capped.map((row) => row.moreCount)).toEqual([150, 0, 0]);
  });

  it("deals in shelf order when the cap runs out mid-round", () => {
    const capped = capExploreSearch([shelf("a", 5), shelf("b", 4), shelf("c", 2)], 7);
    expect(capped.map((row) => row.covers.length)).toEqual([3, 2, 2]);
    expect(capped.map((row) => ids(row.covers))).toEqual([["a0", "a1", "a2"], ["b0", "b1"], ["c0", "c1"]]);
  });

  it("keeps every shelf, so a shelf past the cap still shows its count", () => {
    const capped = capExploreSearch([shelf("a", 3), shelf("b", 3), shelf("c", 3)], 2);
    expect(capped.map((row) => row.slug)).toEqual(["a", "b", "c"]);
    expect(capped.map((row) => row.moreCount)).toEqual([2, 2, 3]);
  });

  it("defaults to EXPLORE_SEARCH_LIMIT", () => {
    const capped = capExploreSearch([shelf("a", EXPLORE_SEARCH_LIMIT + 10)]);
    expect(capped[0].covers).toHaveLength(EXPLORE_SEARCH_LIMIT);
    expect(capped[0].moreCount).toBe(10);
  });
});

describe("cleanExploreQuery", () => {
  it("trims, collapses whitespace, and takes the first of repeated parameters", () => {
    expect(cleanExploreQuery("  east   of\teden ")).toBe("east of eden");
    expect(cleanExploreQuery(["first", "second"])).toBe("first");
    expect(cleanExploreQuery(undefined)).toBe("");
  });

  it("caps the length", () => {
    expect(cleanExploreQuery("x".repeat(500))).toHaveLength(EXPLORE_QUERY_MAX);
  });
});

describe("sortExploreCollections", () => {
  it("puts the most matches first when searching, and drops shelves with none", () => {
    const sorted = sortExploreCollections([
      { slug: "one", itemCount: 9, matchCount: 1, lastActivity: "2026-10-01T00:00:00.000Z" },
      { slug: "none", itemCount: 9, matchCount: 0, lastActivity: "2026-10-02T00:00:00.000Z" },
      { slug: "many", itemCount: 9, matchCount: 5, lastActivity: "2026-01-01T00:00:00.000Z" },
      { slug: "one-newer", itemCount: 9, matchCount: 1, lastActivity: "2026-10-05T00:00:00.000Z" }
    ]);
    expect(sorted.map((row) => row.slug)).toEqual(["many", "one-newer", "one"]);
  });

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

describe("featuredShelves", () => {
  const shelf = (slug, coverCount, itemCount) => ({
    slug,
    itemCount,
    covers: Array.from({ length: coverCount }, (_, index) => ({ id: `${slug}-${index}` })),
    moreCount: itemCount - coverCount
  });

  it("keeps the first three shelves, in the order given", () => {
    const shelves = ["a", "b", "c", "d", "e"].map((slug) => shelf(slug, 2, 2));
    expect(featuredShelves(shelves).map((entry) => entry.slug)).toEqual(["a", "b", "c"]);
  });

  it("shortens the strip and recounts what is left behind it", () => {
    const [trimmed] = featuredShelves([shelf("a", 8, 197)]);
    expect(trimmed.covers).toHaveLength(6);
    expect(trimmed.moreCount).toBe(191);
  });

  it("leaves a short shelf alone", () => {
    const [trimmed] = featuredShelves([shelf("a", 1, 1)]);
    expect(trimmed.covers).toHaveLength(1);
    expect(trimmed.moreCount).toBe(0);
  });

  it("treats anything but a list as no shelves", () => {
    expect(featuredShelves(undefined)).toEqual([]);
  });
});

describe("interleaveShelfCovers", () => {
  const shelf = (slug, coverIds) => ({ slug, title: `Shelf ${slug}`, covers: coverIds.map((id) => ({ id })) });

  it("deals one cover from each shelf in turn, carrying its shelf along", () => {
    const dealt = interleaveShelfCovers([shelf("a", ["a1", "a2", "a3"]), shelf("b", ["b1"]), shelf("c", ["c1", "c2"])]);
    expect(ids(dealt)).toEqual(["a1", "b1", "c1", "a2", "c2", "a3"]);
    expect(dealt[1]).toMatchObject({ shelfSlug: "b", shelfTitle: "Shelf b" });
  });

  it("treats anything but a list as no covers", () => {
    expect(interleaveShelfCovers(undefined)).toEqual([]);
    expect(interleaveShelfCovers([])).toEqual([]);
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
