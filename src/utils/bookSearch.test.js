import { describe, it, expect } from "vitest";
import {
  MIN_QUERY_LENGTH,
  GUIDE_TIER,
  CATALOG_TIER,
  isSearchable,
  searchGuides,
  suggestionFromWork,
  suggestionFromCatalogRow,
  mergeSuggestions,
  suggestionSubtitle,
  applyBookSuggestion
} from "./bookSearch";
import { emptyItem } from "./constants";

// A stand-in for src/content/books, so these tests describe the ranking rules
// rather than the eleven guides that happen to exist today.
const works = [
  { slug: "dune", title: "Dune", author: "Frank Herbert", status: "verified", firstEdition: { publisher: "Chilton Books", year: 1965 } },
  { slug: "dune-messiah", title: "Dune Messiah", author: "Frank Herbert", status: "verified", firstEdition: { publisher: "Putnam", year: 1969 } },
  { slug: "it", title: "It", author: "Stephen King", status: "verified", firstEdition: { publisher: "Viking", year: 1986 } },
  { slug: "the-dune-encyclopedia", title: "The Dune Encyclopedia", author: "Willis McNelly", status: "draft", firstEdition: { publisher: "Berkley", year: 1984 } }
];

const catalogRow = (over = {}) => ({
  id: "c1",
  title: "Children of Dune",
  author: "Frank Herbert",
  publisher: "Berkley",
  first_published_year: 1976,
  cover_id: "",
  source: "openlibrary",
  ...over
});

describe("isSearchable", () => {
  // Three letters is the product rule and the technical floor -- below it the
  // trigram index cannot help, so the query would scan the whole table.
  it("needs three non-space characters", () => {
    expect(MIN_QUERY_LENGTH).toBe(3);
    expect(isSearchable("du")).toBe(false);
    expect(isSearchable("  d  ")).toBe(false);
    expect(isSearchable("dun")).toBe(true);
    expect(isSearchable("  dune  ")).toBe(true);
    expect(isSearchable("")).toBe(false);
    expect(isSearchable(undefined)).toBe(false);
  });
});

describe("searchGuides", () => {
  it("returns nothing below the minimum length", () => {
    expect(searchGuides("du", works)).toEqual([]);
  });

  // The whole point of the ranking: typing a title should put that title first,
  // not a longer book that merely contains the word.
  it("ranks an exact title above a prefix match above a mere contains", () => {
    const titles = searchGuides("dune", works).map((entry) => entry.title);
    expect(titles).toEqual(["Dune", "Dune Messiah", "The Dune Encyclopedia"]);
  });

  it("matches on author as well as title", () => {
    const titles = searchGuides("herbert", works).map((entry) => entry.title);
    expect(titles).toEqual(["Dune", "Dune Messiah"]);
  });

  it("is case and whitespace insensitive", () => {
    expect(searchGuides("  DUNE ", works).map((entry) => entry.title)).toEqual([
      "Dune",
      "Dune Messiah",
      "The Dune Encyclopedia"
    ]);
  });

  // A guide still being checked is still a book that exists. Its page renders
  // with noindex; there is no reason to hide it from someone typing its title.
  it("includes draft works", () => {
    expect(searchGuides("encyclopedia", works)).toHaveLength(1);
  });

  it("returns no match rather than everything when nothing matches", () => {
    expect(searchGuides("blood meridian", works)).toEqual([]);
  });
});

describe("suggestion shapes", () => {
  it("carries the guide tier and a path to the identification page", () => {
    const suggestion = suggestionFromWork(works[0]);
    expect(suggestion).toMatchObject({
      tier: GUIDE_TIER,
      title: "Dune",
      author: "Frank Herbert",
      publisher: "Chilton Books",
      year: 1965,
      guidePath: "/books/dune/first-edition"
    });
  });

  // No guide path, because there is no verified page behind a bulk import.
  it("carries the catalog tier and no guide path", () => {
    const suggestion = suggestionFromCatalogRow(catalogRow());
    expect(suggestion).toMatchObject({
      tier: CATALOG_TIER,
      title: "Children of Dune",
      publisher: "Berkley",
      year: 1976,
      guidePath: null
    });
  });

  it("tolerates a catalog row with nothing but a title", () => {
    const suggestion = suggestionFromCatalogRow({ id: "c2", title: "Untitled" });
    expect(suggestion.author).toBe("");
    expect(suggestion.publisher).toBe("");
    expect(suggestion.year).toBeNull();
  });
});

describe("mergeSuggestions", () => {
  it("puts every guide above every catalog row", () => {
    const merged = mergeSuggestions(searchGuides("dune", works), [catalogRow()]);
    expect(merged.map((entry) => entry.tier)).toEqual([
      GUIDE_TIER,
      GUIDE_TIER,
      GUIDE_TIER,
      CATALOG_TIER
    ]);
  });

  // The catalog is seeded from Open Library and the guides cover books people
  // actually collect, so overlap is the normal case, not an edge case.
  it("drops a catalog row for a book that already has a guide", () => {
    const merged = mergeSuggestions(
      [suggestionFromWork(works[0])],
      [catalogRow({ id: "c9", title: "Dune", author: "Frank Herbert", publisher: "Ace" })]
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].tier).toBe(GUIDE_TIER);
  });

  it("treats differing case and spacing as the same book", () => {
    const merged = mergeSuggestions(
      [suggestionFromWork(works[0])],
      [catalogRow({ id: "c9", title: "  dune  ", author: "FRANK HERBERT" })]
    );
    expect(merged).toHaveLength(1);
  });

  it("keeps same-titled books by different authors apart", () => {
    const merged = mergeSuggestions(
      [suggestionFromWork(works[2])],
      [catalogRow({ id: "c9", title: "It", author: "Alexa Chung" })]
    );
    expect(merged).toHaveLength(2);
  });

  it("caps the list", () => {
    const rows = Array.from({ length: 30 }, (_, index) =>
      catalogRow({ id: `c${index}`, title: `Book ${index}` })
    );
    expect(mergeSuggestions([], rows)).toHaveLength(8);
    expect(mergeSuggestions([], rows, 3)).toHaveLength(3);
  });

  it("skips a row with no title rather than rendering a blank option", () => {
    expect(mergeSuggestions([], [catalogRow({ title: "" })])).toEqual([]);
  });
});

describe("suggestionSubtitle", () => {
  it("joins what it has and omits what it doesn't", () => {
    expect(suggestionSubtitle(suggestionFromWork(works[0]))).toBe("Frank Herbert · Chilton Books · 1965");
    expect(suggestionSubtitle({ author: "Frank Herbert", publisher: "", year: null })).toBe("Frank Herbert");
    expect(suggestionSubtitle({ author: "", publisher: "", year: null })).toBe("");
  });
});

describe("applyBookSuggestion", () => {
  const suggestion = suggestionFromWork(works[0]);

  it("copies a snapshot of the fields the issue asks for", () => {
    expect(applyBookSuggestion(emptyItem, suggestion)).toMatchObject({
      name: "Dune",
      category: "Book",
      author: "Frank Herbert",
      bookEdition: "First",
      bookPrinting: "First"
    });
  });

  // Author and Make / Publisher / Brand are two different fields on this form.
  // Putting the author in the publisher field is the bug this test exists for.
  it("puts the author in Author and the publisher in Make / Publisher / Brand", () => {
    const item = applyBookSuggestion(emptyItem, suggestion);
    expect(item.author).toBe("Frank Herbert");
    expect(item.maker).toBe("Chilton Books");
  });

  it("leaves everything the collector already typed alone", () => {
    const started = { ...emptyItem, purchasePrice: "45", source: "Estate sale", notes: "jacket chipped" };
    expect(applyBookSuggestion(started, suggestion)).toMatchObject({
      purchasePrice: "45",
      source: "Estate sale",
      notes: "jacket chipped"
    });
  });

  // Prefilling is a default, not a correction. Someone who already said this is
  // a second printing is telling us about the copy in their hand.
  it("does not overwrite an edition or printing already chosen", () => {
    const started = { ...emptyItem, bookEdition: "Other", bookPrinting: "Second" };
    expect(applyBookSuggestion(started, suggestion)).toMatchObject({
      bookEdition: "Other",
      bookPrinting: "Second"
    });
  });

  // Picking a second suggestion after mis-picking a first has to leave a
  // coherent record, not Fitzgerald on the front of The Stand.
  it("replaces the author and publisher of an earlier pick", () => {
    const misPicked = applyBookSuggestion(emptyItem, suggestionFromWork(works[0]));
    const corrected = applyBookSuggestion(misPicked, suggestionFromWork(works[2]));

    expect(corrected).toMatchObject({
      name: "It",
      author: "Stephen King",
      maker: "Viking"
    });
  });

  it("falls back to what was there when the suggestion has neither", () => {
    const started = { ...emptyItem, author: "F. Herbert", maker: "Chilton" };
    const sparse = { ...suggestion, author: "", publisher: "" };
    expect(applyBookSuggestion(started, sparse)).toMatchObject({
      author: "F. Herbert",
      maker: "Chilton"
    });
  });

  it("leaves the fields blank rather than writing undefined when both are empty", () => {
    const sparse = { ...suggestion, author: "", publisher: "" };
    expect(applyBookSuggestion(emptyItem, sparse)).toMatchObject({ author: "", maker: "" });
  });

  it("returns a new object rather than mutating the item", () => {
    const started = { ...emptyItem };
    const result = applyBookSuggestion(started, suggestion);
    expect(started.name).toBe("");
    expect(result).not.toBe(started);
  });
});
