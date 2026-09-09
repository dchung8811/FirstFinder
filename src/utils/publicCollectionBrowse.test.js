import { describe, it, expect } from "vitest";
import {
  normalizeText,
  matchesQuery,
  filterPublicItems,
  sortPublicItems,
  collectFilterOptions,
  statusLabel,
  resultSummary
} from "./publicCollectionBrowse";

// Shaped like buildPublicItem's output, including the part that matters most
// here: optional fields are absent rather than empty when the owner has not
// published them. Several tests below depend on that distinction.
const item = (over = {}) => ({
  id: "row-1",
  name: "East of Eden",
  author: "John Steinbeck",
  maker: "The Viking Press",
  category: "Book",
  edition: "",
  bookEdition: "First",
  bookPrinting: "First",
  bookGenre: "Fiction",
  condition: "Near Fine/Fine",
  status: "Owned",
  photos: [],
  hasReceipt: false,
  ...over
});

describe("normalizeText", () => {
  it("folds case and accents so the ASCII spelling finds the real one", () => {
    expect(normalizeText("Brontë")).toBe("bronte");
    expect(normalizeText("  Émile  ")).toBe("emile");
  });

  it("survives the fields that are absent rather than empty", () => {
    expect(normalizeText(undefined)).toBe("");
    expect(normalizeText(null)).toBe("");
  });
});

describe("matchesQuery", () => {
  it("matches nothing in particular when nothing was typed", () => {
    expect(matchesQuery(item(), "")).toBe(true);
    expect(matchesQuery(item(), "   ")).toBe(true);
  });

  it("finds a title, a maker, and a genre", () => {
    expect(matchesQuery(item(), "eden")).toBe(true);
    expect(matchesQuery(item(), "steinbeck")).toBe(true);
    expect(matchesQuery(item(), "fiction")).toBe(true);
    expect(matchesQuery(item(), "hemingway")).toBe(false);
  });

  // The whole reason terms are matched independently: this is how people
  // actually search a shelf, and a phrase match against a single field fails
  // it.
  it("lets terms land in different fields", () => {
    expect(matchesQuery(item(), "steinbeck first")).toBe(true);
    expect(matchesQuery(item(), "eden fiction")).toBe(true);
  });

  it("requires every term, not just one", () => {
    expect(matchesQuery(item(), "steinbeck hemingway")).toBe(false);
  });

  it("finds an accented author from the plain spelling", () => {
    expect(matchesQuery(item({ author: "Charlotte Brontë" }), "bronte")).toBe(true);
  });

  it("finds a publisher as well as an author", () => {
    expect(matchesQuery(item(), "viking")).toBe(true);
    expect(matchesQuery(item(), "steinbeck viking")).toBe(true);
  });

  // A withheld field is not on the object at all, so searching for its value
  // must not match -- otherwise the presence of a hit would tell a visitor
  // what a private note said.
  it("cannot match a field the owner did not publish", () => {
    const withNotes = item({ notes: "Stored in the study safe" });
    const withoutNotes = item();
    expect(matchesQuery(withNotes, "safe")).toBe(true);
    expect(matchesQuery(withoutNotes, "safe")).toBe(false);
  });
});

describe("filterPublicItems", () => {
  const items = [
    item({ id: "a", name: "East of Eden", category: "Book", status: "Owned" }),
    item({ id: "b", name: "Rookie card", category: "Card", status: "For sale", maker: "Topps", bookGenre: "" }),
    item({ id: "c", name: "Dune", category: "Book", status: "Sold", maker: "Frank Herbert" })
  ];

  it("returns everything when nothing is set", () => {
    expect(filterPublicItems(items, {})).toHaveLength(3);
    expect(filterPublicItems(items)).toHaveLength(3);
  });

  it("narrows by category and by status", () => {
    expect(filterPublicItems(items, { category: "Book" }).map((row) => row.id)).toEqual(["a", "c"]);
    expect(filterPublicItems(items, { status: "For sale" }).map((row) => row.id)).toEqual(["b"]);
  });

  it("combines a search with a filter", () => {
    expect(filterPublicItems(items, { query: "dune", category: "Book" }).map((row) => row.id)).toEqual(["c"]);
    expect(filterPublicItems(items, { query: "dune", category: "Card" })).toHaveLength(0);
  });

  it("copes with an empty collection", () => {
    expect(filterPublicItems([], { query: "dune" })).toEqual([]);
    expect(filterPublicItems(undefined, {})).toEqual([]);
  });
});

describe("sortPublicItems", () => {
  const items = [
    item({ id: "a", name: "Dune", author: "Frank Herbert" }),
    item({ id: "b", name: "East of Eden", author: "John Steinbeck" }),
    item({ id: "c", name: "Beloved", author: "Toni Morrison" })
  ];

  it("leaves the server's order alone for 'recently added'", () => {
    expect(sortPublicItems(items, "added").map((row) => row.id)).toEqual(["a", "b", "c"]);
  });

  it("sorts by title and by credit", () => {
    expect(sortPublicItems(items, "name").map((row) => row.id)).toEqual(["c", "a", "b"]);
    expect(sortPublicItems(items, "maker").map((row) => row.id)).toEqual(["a", "b", "c"]);
  });

  // A mixed shelf sorts on whichever credit each row carries, so the cards
  // without an author don't all pile up at the end.
  it("sorts a card by its maker alongside a book by its author", () => {
    const mixed = [
      item({ id: "card", name: "Rookie card", category: "Trading card", author: "", maker: "Topps" }),
      item({ id: "book", name: "Dune", author: "Frank Herbert", maker: "Chilton" })
    ];
    expect(sortPublicItems(mixed, "maker").map((row) => row.id)).toEqual(["book", "card"]);
  });

  // "Recently added" has to be able to get back to the original order, which
  // it cannot do if a previous sort mutated the array in place.
  it("does not disturb the array it was given", () => {
    const original = [...items];
    sortPublicItems(items, "name");
    expect(items).toEqual(original);
  });

  it("sorts untitled items last rather than to the top", () => {
    const withBlank = [item({ id: "blank", name: "" }), ...items];
    expect(sortPublicItems(withBlank, "name").map((row) => row.id).pop()).toBe("blank");
  });
});

describe("collectFilterOptions", () => {
  it("offers only the values the collection actually holds", () => {
    const options = collectFilterOptions([
      item({ category: "Book", status: "Owned" }),
      item({ category: "Book", status: "Sold" }),
      item({ category: "Card", status: "Owned" })
    ]);
    expect(options.categories).toEqual(["Book", "Card"]);
    expect(options.statuses).toEqual(["Owned", "Sold"]);
  });

  it("returns empty lists for an empty collection, so no dead controls render", () => {
    expect(collectFilterOptions([])).toEqual({ categories: [], statuses: [] });
  });
});

describe("statusLabel", () => {
  it("renames only the status whose internal word would confuse a visitor", () => {
    expect(statusLabel("Wishlist")).toBe("Wanted");
  });

  // The Records table is meant to read as the owner's own Collection tab, so
  // the statuses they see there are the statuses a visitor sees here.
  it("keeps the owner's vocabulary everywhere else", () => {
    expect(statusLabel("Owned")).toBe("Owned");
    expect(statusLabel("For sale")).toBe("For sale");
    expect(statusLabel("Sold")).toBe("Sold");
  });

  it("passes through anything it does not have a name for", () => {
    expect(statusLabel("Consigned")).toBe("Consigned");
  });
});

describe("resultSummary", () => {
  it("does not imply filtering when nothing is filtered", () => {
    expect(resultSummary(12, 12)).toBe("12 items");
    expect(resultSummary(1, 1)).toBe("1 item");
  });

  it("shows the total once something has been hidden", () => {
    expect(resultSummary(3, 12)).toBe("3 of 12 items");
    expect(resultSummary(0, 12)).toBe("0 of 12 items");
  });
});
