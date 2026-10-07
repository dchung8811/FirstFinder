import { describe, it, expect } from "vitest";
import {
  normalizeForMatch,
  editionMatchKey,
  findPossibleDuplicates,
  usesAuthorField,
  itemCredit,
  withClarifyingWord,
  buildSimilarCopyLinks,
  hasEstimate,
  itemValueForTotals,
  calculateGain,
  formatEstimatedValue,
  formatGain,
  getActiveInventory,
  toValueRange,
  firstCollectible
} from "./items";

const book = (over = {}) => ({
  name: "Dune",
  author: "Frank Herbert",
  maker: "",
  category: "Book",
  bookEdition: "First",
  bookPrinting: "First",
  edition: "",
  condition: "",
  status: "Owned",
  purchasePrice: "",
  estimatedValue: "",
  soldPrice: "",
  ...over
});

describe("itemValueForTotals", () => {
  // The whole point of the Sold tab: realized price beats a stale estimate.
  it("prefers what a sold item actually sold for", () => {
    expect(itemValueForTotals(book({ status: "Sold", soldPrice: "100", estimatedValue: "500" }))).toBe(100);
  });

  it("falls back to the estimate when a sold item has no recorded price", () => {
    expect(itemValueForTotals(book({ status: "Sold", soldPrice: "", estimatedValue: "500" }))).toBe(500);
  });

  it("uses the estimate for anything still held", () => {
    expect(itemValueForTotals(book({ estimatedValue: "250" }))).toBe(250);
  });

  // Null and 0 are different answers: null renders "—", 0 renders "$0" and
  // counts as a total loss against cost basis.
  it("returns null when there is no estimate at all", () => {
    expect(itemValueForTotals(book({ estimatedValue: "" }))).toBe(null);
  });

  it("returns 0 when the estimate really is zero", () => {
    expect(itemValueForTotals(book({ estimatedValue: "0" }))).toBe(0);
  });
});

describe("hasEstimate", () => {
  it("distinguishes an entered zero from a blank", () => {
    expect(hasEstimate(book({ estimatedValue: "0" }))).toBe(true);
    expect(hasEstimate(book({ estimatedValue: "" }))).toBe(false);
  });
});

describe("calculateGain", () => {
  it("subtracts cost basis from current value", () => {
    expect(calculateGain(book({ estimatedValue: "100", purchasePrice: "40" }))).toBe(60);
  });

  it("reports a loss as a negative", () => {
    expect(calculateGain(book({ estimatedValue: "10", purchasePrice: "40" }))).toBe(-30);
  });

  it("uses the realized price for a sold item", () => {
    expect(calculateGain(book({ status: "Sold", soldPrice: "90", estimatedValue: "500", purchasePrice: "40" }))).toBe(50);
  });

  // Without an estimate there is no gain to state -- not a gain of zero, and
  // certainly not a loss of the entire purchase price.
  it("returns null rather than inventing a loss when no value is known", () => {
    expect(calculateGain(book({ estimatedValue: "", purchasePrice: "40" }))).toBe(null);
  });

  it("treats a missing cost basis as zero paid", () => {
    expect(calculateGain(book({ estimatedValue: "100", purchasePrice: "" }))).toBe(100);
  });
});

describe("display formatting", () => {
  it("renders an unknown value as an em dash, never $0", () => {
    expect(formatEstimatedValue(book({ estimatedValue: "" }))).toBe("—");
    expect(formatGain(null)).toBe("—");
  });

  it("renders a known value as currency", () => {
    expect(formatEstimatedValue(book({ estimatedValue: "250" }))).toBe("$250");
    expect(formatGain(-30)).toBe("-$30");
  });
});

describe("toValueRange", () => {
  const range = (low, high) => toValueRange({ lo: low, hi: high }, "lo", "hi");

  it("passes a well-formed range through", () => {
    expect(range(50, 100)).toEqual({ low: 50, high: 100 });
  });

  // A search-grounded model with thin evidence can return these; showing a
  // backwards or half-missing range in the UI would look broken.
  it("swaps a backwards range", () => {
    expect(range(100, 50)).toEqual({ low: 50, high: 100 });
  });

  it("mirrors a one-sided range", () => {
    expect(range(0, 50)).toEqual({ low: 50, high: 50 });
    expect(range(50, 0)).toEqual({ low: 50, high: 50 });
  });

  it("returns null when there is no range at all", () => {
    expect(range(0, 0)).toBe(null);
  });

  it("treats unusable input as no range", () => {
    expect(toValueRange({}, "lo", "hi")).toBe(null);
    expect(toValueRange({ lo: "nonsense", hi: null }, "lo", "hi")).toBe(null);
  });
});

describe("normalizeForMatch", () => {
  it("ignores case and punctuation", () => {
    expect(normalizeForMatch("The Gunslinger.")).toBe("the gunslinger");
    expect(normalizeForMatch("  THE   gunslinger  ")).toBe("the gunslinger");
  });

  it("collapses missing values to an empty key", () => {
    expect(normalizeForMatch(null)).toBe("");
    expect(normalizeForMatch("")).toBe("");
  });
});

describe("editionMatchKey", () => {
  it("uses edition and printing for books", () => {
    expect(editionMatchKey(book())).toBe("first first");
  });

  it("uses the free-text edition for everything else", () => {
    expect(editionMatchKey({ category: "Trading card", edition: "1986 Fleer" })).toBe("1986 fleer");
  });
});

describe("findPossibleDuplicates", () => {
  it("finds nothing for an unnamed candidate", () => {
    expect(findPossibleDuplicates(book({ name: "" }), [book()])).toEqual([]);
  });

  it("ignores items by a different author", () => {
    expect(findPossibleDuplicates(book(), [book({ author: "Someone Else" })])).toEqual([]);
  });

  // The two fields were one until issue #140, and a collection can hold both
  // shapes of the same book -- one catalogued before the split, one after.
  // Matching on the joined credit is what keeps those recognizing each other.
  it("matches a copy catalogued before author and maker were separate fields", () => {
    const found = findPossibleDuplicates(book(), [book({ author: "", maker: "Frank Herbert" })]);
    expect(found).toHaveLength(1);
  });

  it("flags the same edition in the same condition as a possible duplicate", () => {
    const existing = book({ condition: "Fair" });
    const found = findPossibleDuplicates(book({ condition: "Fair" }), [existing]);
    expect(found).toHaveLength(1);
    expect(found[0].matchType).toBe("possible_duplicate");
  });

  // conditionOptions runs best-to-worst, so a lower index is a better copy.
  it("flags a better copy of the same edition as an upgrade", () => {
    const found = findPossibleDuplicates(
      book({ condition: "Near Fine/Fine" }),
      [book({ condition: "Fair" })]
    );
    expect(found[0].matchType).toBe("potential_upgrade");
  });

  it("does not call a worse copy an upgrade", () => {
    const found = findPossibleDuplicates(
      book({ condition: "Poor" }),
      [book({ condition: "Near Fine/Fine" })]
    );
    expect(found[0].matchType).toBe("possible_duplicate");
  });

  it("flags a different edition as a separate copy", () => {
    const found = findPossibleDuplicates(book(), [book({ bookEdition: "Second" })]);
    expect(found[0].matchType).toBe("different_copy");
  });

  it("sorts the likeliest duplicate first", () => {
    const found = findPossibleDuplicates(book({ condition: "Fair" }), [
      book({ bookEdition: "Second" }),
      book({ condition: "Fair" })
    ]);
    expect(found.map((entry) => entry.matchType)).toEqual(["possible_duplicate", "different_copy"]);
  });
});

describe("withClarifyingWord", () => {
  it("adds the word when it is missing", () => {
    expect(withClarifyingWord("First", "edition")).toBe("First edition");
  });

  it("does not double it up", () => {
    expect(withClarifyingWord("First edition", "edition")).toBe("First edition");
    expect(withClarifyingWord("First Edition", "edition")).toBe("First Edition");
  });

  it("leaves a blank value alone", () => {
    expect(withClarifyingWord("", "edition")).toBe("");
  });
});

describe("buildSimilarCopyLinks", () => {
  it("narrows a book search to the exact edition and printing", () => {
    const links = buildSimilarCopyLinks(book({ name: "Dune", author: "Frank Herbert" }));
    expect(decodeURIComponent(links.ebay)).toContain("Dune Frank Herbert First edition First printing");
    expect(links.abebooks).toContain("abebooks.com");
  });

  it("uses the free-text edition for non-books", () => {
    const links = buildSimilarCopyLinks({ name: "Rookie Card", maker: "Fleer", category: "Trading card", edition: "1986" });
    expect(decodeURIComponent(links.ebay)).toContain("Rookie Card Fleer 1986");
  });

  it("returns null when there is nothing to search for", () => {
    expect(buildSimilarCopyLinks({ name: "", maker: "", category: "Other", edition: "" })).toBe(null);
  });

  it("searches on the author and the publisher together", () => {
    const links = buildSimilarCopyLinks(book({ author: "Stephen King", maker: "Doubleday" }));
    expect(decodeURIComponent(links.ebay)).toContain("Dune Stephen King Doubleday");
  });
});

describe("usesAuthorField", () => {
  it("offers the field to the categories that have an author", () => {
    expect(usesAuthorField("Book")).toBe(true);
    expect(usesAuthorField("Comic")).toBe(true);
  });

  it("withholds it from everything else", () => {
    expect(usesAuthorField("Trading card")).toBe(false);
    expect(usesAuthorField("Record")).toBe(false);
    expect(usesAuthorField(undefined)).toBe(false);
  });
});

describe("itemCredit", () => {
  it("shows an author and a publisher together", () => {
    expect(itemCredit(book({ author: "Stephen King", maker: "Doubleday" }))).toBe("Stephen King · Doubleday");
  });

  it("reads correctly with either half missing", () => {
    expect(itemCredit(book({ author: "Stephen King", maker: "" }))).toBe("Stephen King");
    expect(itemCredit(book({ author: "", maker: "Doubleday" }))).toBe("Doubleday");
    expect(itemCredit(book({ author: "", maker: "" }))).toBe("");
  });

  it("ignores an author on a category that has no author field", () => {
    expect(itemCredit({ category: "Trading card", author: "Left over", maker: "Topps" })).toBe("Topps");
  });

  it("survives a missing item", () => {
    expect(itemCredit(undefined)).toBe("");
  });
});

describe("getActiveInventory", () => {
  it("drops sold items", () => {
    const active = getActiveInventory([book(), book({ status: "Sold" }), book({ status: "Wishlist" })]);
    expect(active).toHaveLength(2);
    expect(active.every((entry) => entry.status !== "Sold")).toBe(true);
  });
});

describe("firstCollectible", () => {
  const at = (iso) => ({ savedAt: iso });
  const imported = "2026-08-02T03:35:03.350Z";

  it("returns the earliest item when times differ", () => {
    const inventory = [
      { id: "b", name: "Later", ...at("2026-09-01T00:00:00Z") },
      { id: "a", name: "Zebra", ...at("2026-08-01T00:00:00Z") }
    ];
    expect(firstCollectible(inventory).name).toBe("Zebra");
  });

  it("breaks a bulk-import tie by name, whatever order the rows arrive in", () => {
    const rows = [
      { id: "1", name: "The Great Hunt", ...at(imported) },
      { id: "2", name: "The Dark Tower VII", ...at(imported) },
      { id: "3", name: "A Game of Thrones", ...at(imported) }
    ];
    expect(firstCollectible(rows).name).toBe("A Game of Thrones");
    expect(firstCollectible([...rows].reverse()).name).toBe("A Game of Thrones");
  });

  it("ignores case and sorts numbers in titles by value", () => {
    const rows = [
      { id: "1", name: "book 10", ...at(imported) },
      { id: "2", name: "Book 9", ...at(imported) }
    ];
    expect(firstCollectible(rows).name).toBe("Book 9");
  });

  it("ignores leading [tags] when breaking a tie", () => {
    const rows = [
      { id: "1", name: "[LIMITED] The Way of Kings [SIGNED]", ...at(imported) },
      { id: "2", name: "[Paperback] [SIGNED] Dune", ...at(imported) },
      { id: "3", name: "Emma", ...at(imported) }
    ];
    expect(firstCollectible(rows).name).toBe("[Paperback] [SIGNED] Dune");
  });

  it("keeps a name made only of tags as a name, not untitled", () => {
    const rows = [
      { id: "1", name: "", ...at(imported) },
      { id: "2", name: "[SIGNED]", ...at(imported) }
    ];
    expect(firstCollectible(rows).name).toBe("[SIGNED]");
  });

  it("puts untitled items after named ones in a tie", () => {
    const rows = [
      { id: "1", name: "", ...at(imported) },
      { id: "2", name: "Zebra", ...at(imported) }
    ];
    expect(firstCollectible(rows).name).toBe("Zebra");
  });

  it("falls back to id when name and time both tie", () => {
    const rows = [
      { id: "b", name: "Dune", ...at(imported) },
      { id: "a", name: "Dune", ...at(imported) }
    ];
    expect(firstCollectible(rows).id).toBe("a");
    expect(firstCollectible([...rows].reverse()).id).toBe("a");
  });

  it("sorts an unreadable date last rather than first", () => {
    const rows = [
      { id: "1", name: "Broken", savedAt: "not a date" },
      { id: "2", name: "Real", ...at(imported) }
    ];
    expect(firstCollectible(rows).name).toBe("Real");
  });

  it("returns null for an empty collection", () => {
    expect(firstCollectible([])).toBeNull();
    expect(firstCollectible(undefined)).toBeNull();
  });
});
