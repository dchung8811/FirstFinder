import { describe, it, expect } from "vitest";
import {
  buildExploreShelf,
  sortExploreShelves,
  canShowOnExplore,
  shareSettingsChanged,
  defaultShareSettings,
  alwaysPublicItemFields,
  EXPLORE_COVER_LIMIT
} from "./publicCollection";
import { toDbShareRow, fromDbShareSettings } from "./mapping";

// Everything private set, so a leak onto Explore shows up as a recognisable
// value rather than an empty default.
const row = (over = {}) => ({
  id: `item-${Math.random()}`,
  name: "The Gunslinger",
  author: "Stephen King",
  maker: "Grant",
  category: "Book",
  bookEdition: "First",
  bookPrinting: "First",
  status: "Owned",
  hiddenFromShare: false,
  itemPhotos: [{ path: "user/item/front.jpg", name: "front.jpg" }],
  estimatedValue: "850",
  purchasePrice: "40",
  notes: "top shelf, study",
  source: "estate sale",
  createdAt: "2026-09-01T00:00:00Z",
  ...over
});

const edition = (over = {}) => ({ bookEdition: "First", bookPrinting: "First", status: "Owned", hiddenFromShare: false, ...over });

describe("canShowOnExplore", () => {
  it("is only possible while the page is listed", () => {
    expect(canShowOnExplore("listed")).toBe(true);
    // Unlisted is link-only. A public index of pages would undo that.
    expect(canShowOnExplore("unlisted")).toBe(false);
    expect(canShowOnExplore("off")).toBe(false);
    expect(canShowOnExplore(undefined)).toBe(false);
  });
});

describe("Explore opt-in persistence", () => {
  it("defaults to off, so nobody appears on Explore without choosing to", () => {
    expect(defaultShareSettings.showOnExplore).toBe(false);
    expect(fromDbShareSettings({}).showOnExplore).toBe(false);
  });

  it("saves the opt-in when the page is listed", () => {
    expect(toDbShareRow({ visibility: "listed", showOnExplore: true }, "u", "s").show_on_explore).toBe(true);
  });

  it("clears the opt-in when the page moves off listed, so switching back needs a fresh yes", () => {
    expect(toDbShareRow({ visibility: "unlisted", showOnExplore: true }, "u", "s").show_on_explore).toBe(false);
    expect(toDbShareRow({ visibility: "off", showOnExplore: true }, "u", "s").show_on_explore).toBe(false);
  });

  it("round-trips through the database row", () => {
    expect(fromDbShareSettings({ show_on_explore: true }).showOnExplore).toBe(true);
  });

  it("counts as an unsaved edit in the share dialog", () => {
    const saved = { ...defaultShareSettings, visibility: "listed" };
    expect(shareSettingsChanged(saved, { ...saved, showOnExplore: true })).toBe(true);
    expect(shareSettingsChanged(saved, { ...saved })).toBe(false);
  });
});

describe("buildExploreShelf", () => {
  // The owner's own page shows everything, and Explore still shows no money.
  const ledger = { ...defaultShareSettings, visibility: "listed", showEstimatedValue: true, showPrices: true, showNotes: true, showProvenance: true };

  it("never shows prices, notes or provenance, even when the owner's page does", () => {
    const shelf = buildExploreShelf({ settings: ledger, slug: "s", recentItems: [row()], editions: [edition()] });
    const keys = Object.keys(shelf.covers[0]);
    keys.forEach((key) => expect(alwaysPublicItemFields).toContain(key));
    expect(JSON.stringify(shelf)).not.toContain("850");
    expect(JSON.stringify(shelf)).not.toContain("top shelf");
    expect(JSON.stringify(shelf)).not.toContain("estate sale");
  });

  it("caps the strip and counts the rest as +N more", () => {
    const recentItems = Array.from({ length: EXPLORE_COVER_LIMIT + 3 }, () => row());
    const editions = Array.from({ length: 30 }, () => edition());
    const shelf = buildExploreShelf({ settings: ledger, slug: "s", recentItems, editions });
    expect(shelf.covers).toHaveLength(EXPLORE_COVER_LIMIT);
    expect(shelf.itemCount).toBe(30);
    expect(shelf.moreCount).toBe(30 - EXPLORE_COVER_LIMIT);
  });

  it("leaves out items the owner's own page would hide", () => {
    const shelf = buildExploreShelf({
      settings: { ...defaultShareSettings, visibility: "listed" },
      slug: "s",
      recentItems: [row({ status: "Sold" }), row({ hiddenFromShare: true }), row({ name: "Kept" })],
      editions: [edition({ status: "Sold" }), edition({ hiddenFromShare: true }), edition({ bookPrinting: "Second" })]
    });
    expect(shelf.covers.map((item) => item.name)).toEqual(["Kept"]);
    expect(shelf.itemCount).toBe(1);
    expect(shelf.firstEditionCount).toBe(0);
  });

  it("counts first editions the same way the collection page does", () => {
    const shelf = buildExploreShelf({
      settings: ledger,
      slug: "s",
      editions: [edition(), edition(), edition({ bookPrinting: "Second" }), edition({ bookEdition: "" })]
    });
    expect(shelf.firstEditionCount).toBe(2);
    expect(shelf.covers).toEqual([]);
    expect(shelf.moreCount).toBe(4);
  });

  it("titles a shelf by its page title, then its owner, never anything else", () => {
    expect(buildExploreShelf({ settings: { title: "Steinbeck shelf" }, slug: "s" }).title).toBe("Steinbeck shelf");
    expect(buildExploreShelf({ settings: {}, slug: "s", ownerName: "Ada" }).title).toBe("Ada's collection");
    expect(buildExploreShelf({ settings: {}, slug: "s" }).title).toBe("A FirstFinder collection");
  });
});

describe("sortExploreShelves", () => {
  it("puts the most recently added-to shelf first, and empty shelves last", () => {
    const sorted = sortExploreShelves([
      { slug: "old", lastAddedAt: "2025-01-01T00:00:00Z" },
      { slug: "empty", lastAddedAt: "" },
      { slug: "new", lastAddedAt: "2026-09-01T00:00:00Z" }
    ]);
    expect(sorted.map((shelf) => shelf.slug)).toEqual(["new", "old", "empty"]);
  });
});
