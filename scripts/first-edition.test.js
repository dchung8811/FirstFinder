import { describe, it, expect } from "vitest";
import { editionYear, groupWorks, keepMainAuthor, pickFirstEdition, publisherTokens, titleKey } from "./first-edition.mjs";

// The edition lists below are trimmed from what Open Library returned for each
// work in October 2026. Each book was wrong in the catalog before this.

const ed = (year, publisher, { lang = [], format = "" } = {}) => ({
  year,
  publishers: publisher ? [publisher] : [],
  languages: lang.map((code) => `/languages/${code}`),
  format
});

// Padding so a work has enough records that a lone stray year is distrusted,
// as it is for every well-known book.
const laterReprints = (publisher, count = 6) =>
  Array.from({ length: count }, (_, i) => ed(2010 + i, publisher, { lang: ["eng"] }));

describe("editionYear", () => {
  it("reads the year out of Open Library's free-text dates", () => {
    expect(editionYear("1965")).toBe(1965);
    expect(editionYear("Jun 14, 1965")).toBe(1965);
    expect(editionYear("21 September 1937")).toBe(1937);
    expect(editionYear("1961-01-01")).toBe(1961);
    expect(editionYear("")).toBe(null);
    expect(editionYear("n.d.")).toBe(null);
  });
});

describe("publisherTokens", () => {
  it("reduces spellings of one publisher to the same words", () => {
    expect(publisherTokens("Chilton Book Company")).toEqual(["chilton"]);
    expect(publisherTokens("Chilton Books")).toEqual(["chilton"]);
    expect(publisherTokens("Doubleday & Company, Inc.")).toEqual(["doubleday"]);
    expect(publisherTokens("C. Scribner's Sons")).toEqual(["scribner"]);
    expect(publisherTokens("G. Allen & Unwin")).toEqual(["allen", "unwin"]);
  });
});

describe("pickFirstEdition", () => {
  it("outvotes reprints that carry the original's year (Dune)", () => {
    // Ace, Putnam and an audiobook all claim 1965. Chilton published it.
    const dune = [
      ed(1965, "Chilton Book Company", { lang: ["eng"] }),
      ed(1965, "Chilton Book Company", { format: "Hardcover" }),
      ed(1965, "Ace", { format: "paperback" }),
      ed(1965, "Chilton Book Company", { format: "Hardcover" }),
      ed(1965, "Chilton"),
      ed(1965, "Recorded Books, LLC", { lang: ["eng"], format: "Audio CD" }),
      ed(1965, "Putnam", { lang: ["eng"] }),
      ed(1965, "Chilton Books", { lang: ["eng"], format: "Hardcover" }),
      ...laterReprints("Ace Books", 10)
    ];
    expect(pickFirstEdition(dune)).toEqual({ year: 1965, publisher: "Chilton Book Company" });
  });

  it("merges spellings that differ by an initial (The Hobbit)", () => {
    const hobbit = [
      ed(1937, "The Random House Publishing Group", { format: "Paperback" }),
      ed(1937, "Del Rey Books"),
      ed(1937, "George Allen & Unwin"),
      ed(1937, "G. Allen & Unwin", { lang: ["eng"], format: "Hardcover" }),
      ed(1938, "Houghton Mifflin", { lang: ["eng"] }),
      ...laterReprints("Del Rey")
    ];
    expect(pickFirstEdition(hobbit).year).toBe(1937);
    expect(publisherTokens(pickFirstEdition(hobbit).publisher)).toEqual(expect.arrayContaining(["allen", "unwin"]));
  });

  it("breaks a tie toward the publisher that kept the book in print (Gatsby)", () => {
    const gatsby = [
      ed(1925, "C. Scribner's Sons", { lang: ["eng"], format: "Hardcover" }),
      ed(1925, "The New Classics (New Directions)", { lang: ["eng"], format: "Hardcover" }),
      ed(1925, "Standard Ebooks", { lang: ["eng"] }),
      ed(1946, "Sagittaire", { lang: ["fre"] }),
      ed(1953, "Charles Scribner's Sons", { lang: ["eng"] }),
      ed(1953, "Charles Scribner's Sons", { lang: ["eng"], format: "Hardcover" }),
      ed(1950, "Penguin Books", { lang: ["eng"] })
    ];
    expect(pickFirstEdition(gatsby)).toEqual({ year: 1925, publisher: "C. Scribner's Sons" });
  });

  it("ignores a lone stray record that predates the book (Catch-22)", () => {
    const catch22 = [
      ed(1955, null, { lang: ["eng"] }),
      ed(1955, "DELL PUBLISHING CO., INC.", { lang: ["eng"] }),
      ed(1961, "Simon and Schuster", { lang: ["eng"] }),
      ed(1961, "Simon & Schuster"),
      ed(1961, "Dell Publishing company", { lang: ["eng"] }),
      ed(1961, "Simon and Schuster", { lang: ["eng"] }),
      ...laterReprints("Dell")
    ];
    expect(pickFirstEdition(catch22)).toEqual({ year: 1961, publisher: "Simon and Schuster" });
  });

  it("trusts a single oldest record when a book has few to go on", () => {
    const obscure = [ed(1951, "Gnome Press"), ed(1980, "Ace", { lang: ["eng"] }), ed(2001, "Tor")];
    expect(pickFirstEdition(obscure)).toEqual({ year: 1951, publisher: "Gnome Press" });
  });

  it("uses the first English edition, not a translation's", () => {
    const translated = [ed(1967, "Sudamericana", { lang: ["spa"] }), ed(1970, "Harper & Row", { lang: ["eng"] })];
    expect(pickFirstEdition(translated)).toEqual({ year: 1970, publisher: "Harper & Row" });
  });

  it("returns null when nothing can be dated or attributed", () => {
    expect(pickFirstEdition([])).toBe(null);
    expect(pickFirstEdition([ed(null, "Scribner"), ed(1990, null)])).toBe(null);
    expect(pickFirstEdition([ed(2001, "Audible", { format: "Audio CD" })])).toBe(null);
  });
});

describe("titleKey", () => {
  it("treats Open Library's variant titles for one book as the same", () => {
    expect(titleKey("Great Gatsby")).toBe(titleKey("The Great Gatsby"));
    expect(titleKey("The Great Gatsby(Published In 1925)")).toBe(titleKey("The Great Gatsby"));
    expect(titleKey("CATCH-22")).toBe(titleKey("Catch-22"));
  });
});

describe("groupWorks", () => {
  const work = (key, title, author, edition_count = 1) => ({ key, title, author, edition_count });

  it("merges duplicate work records into one book, canonical record first", () => {
    const groups = groupWorks(
      [
        work("/works/OL33936286W", "Catch-22", "Joseph Heller", 16),
        work("/works/OL276798W", "Catch-22", "Joseph Heller", 134),
        work("/works/OL43099122W", "CATCH-22", "Joseph Heller", 1)
      ],
      ["Joseph Heller"]
    );
    expect(groups).toHaveLength(1);
    expect(groups[0][0].key).toBe("/works/OL276798W");
    expect(groups[0]).toHaveLength(3);
  });

  it("drops a same-titled adaptation by someone off the seed list", () => {
    const groups = groupWorks(
      [work("/works/a", "Animal Farm", "George Orwell"), work("/works/b", "Animal Farm", "Odyr")],
      ["George Orwell"]
    );
    expect(groups.map((g) => g[0].author)).toEqual(["George Orwell"]);
  });

  it("keeps same-titled books by two seed authors", () => {
    const groups = groupWorks(
      [work("/works/a", "The Road", "Cormac McCarthy"), work("/works/b", "The Road", "Jack London")],
      ["Cormac McCarthy", "Jack London"]
    );
    expect(groups).toHaveLength(2);
  });

  it("keeps a subject-sweep book nobody on the list wrote", () => {
    const groups = groupWorks([work("/works/a", "Gilead", "Marilynne Robinson"), work("/works/b", "The Overstory", "Richard Powers")], [
      "Marilynne Robinson"
    ]);
    expect(groups).toHaveLength(2);
  });
});

describe("pickFirstEdition — reprinters and lone firsts", () => {
  it("outranks a reprinter's misdated records with the original publisher's one (The Road)", () => {
    const road = [
      ed(2006, "Vintage International", { lang: ["eng"], format: "Paperback" }),
      ed(2006, "Vintage International", { lang: ["eng"], format: "Paperback" }),
      ed(2006, "Picador", { format: "hardcover" }),
      ed(2006, "Alfred A. Knopf", { lang: ["eng"], format: "Hardcover" }),
      ...laterReprints("Vintage")
    ];
    expect(pickFirstEdition(road)).toEqual({ year: 2006, publisher: "Alfred A. Knopf" });
  });

  it("lets a reprinter win a year nobody else claims (Destination Void)", () => {
    const destinationVoid = [ed(1966, "Berkley Pub. Corp.", { lang: ["eng"] }), ed(1967, "Penguin", { lang: ["eng"] }), ed(1967, "Penguin")];
    expect(pickFirstEdition(destinationVoid).year).toBe(1966);
    expect(pickFirstEdition([ed(1967, "Penguin", { lang: ["eng"] })]).publisher).toBe("Penguin");
  });

  it("distrusts a lone record two years ahead of the real run (The Beautiful and Damned)", () => {
    const damned = [
      ed(1920, "Scribner", { lang: ["eng"] }),
      ed(1922, "Charles Scribner's Sons", { lang: ["eng"] }),
      ed(1922, "charles scribner's sons", { lang: ["eng"] }),
      ed(1922, "Penguin book", { lang: ["eng"] }),
      ...laterReprints("Penguin")
    ];
    expect(pickFirstEdition(damned).year).toBe(1922);
  });

  it("never counts a library rebinding as the first edition (Slaughterhouse-Five)", () => {
    const slaughterhouse = [
      ed(1956, "A Delta Book", { lang: ["eng"] }),
      ed(1968, "Peter Smith Pub Inc", { format: "Hardcover" }),
      ed(1969, "dell publishing co., inc.", { lang: ["eng"] }),
      ed(1969, "Dell Pub. Co.", { lang: ["eng"] }),
      ed(1969, "Delacorte Press/Seymour Lawrence"),
      ed(1969, "Delacorte Press"),
      ed(1969, "Delta"),
      ed(1969, "A DELTA BOOK"),
      ...laterReprints("Dell")
    ];
    expect(pickFirstEdition(slaughterhouse).year).toBe(1969);
    expect(pickFirstEdition(slaughterhouse).publisher).toMatch(/^Delacorte Press/);
  });

  it("does not let Peter Smith's rebindings outvote a lone original (Tales of the Grotesque)", () => {
    const tales = [
      ed(1840, "Lea and Blanchard", { lang: ["eng"] }),
      ed(1940, "Peter Smith Pub Inc", { format: "Hardcover" }),
      ed(1965, "Peter Smith , Gloucester, Mass.", { lang: ["eng"] }),
      ed(1965, "P. Smith"),
      ed(1965, "P. Smith", { lang: ["eng"] }),
      ed(2006, "University of North Carolina at Chapel Hill Libraries", { lang: ["eng"] })
    ];
    expect(pickFirstEdition(tales)).toEqual({ year: 1840, publisher: "Lea and Blanchard" });
  });

  it("keeps a single first-edition record followed soon by others (Suttree)", () => {
    const suttree = [
      ed(1979, "Random House", { lang: ["eng"] }),
      ed(1980, "Chatto and Windus", { lang: ["eng"] }),
      ed(1986, "Vintage Books", { lang: ["eng"] }),
      ed(1986, "Vintage Books", { lang: ["eng"] }),
      ...laterReprints("Picador")
    ];
    expect(pickFirstEdition(suttree)).toEqual({ year: 1979, publisher: "Random House" });
  });

  it("drops a work with no edition tagged English (a translation filed as its own work)", () => {
    expect(pickFirstEdition([ed(2021, "Carpentino, Michela"), ed(2021, "Carpentino, Michela")])).toBe(null);
  });
});

describe("keepMainAuthor", () => {
  const doc = (title, key, edition_count) => ({ title, author_name: ["Joseph Heller"], author_key: [key], edition_count });

  it("drops a namesake whose books are a sliver of the author's", () => {
    // The real proportions: Open Library had 46 editions under the historian's
    // record against 312 under the novelist's.
    const docs = [doc("Catch-22", "OL1A", 280), doc("Good as Gold", "OL1A", 32), doc("Stern Gang", "OL9A", 46)];
    expect(keepMainAuthor(docs, "Joseph Heller").map((d) => d.title)).toEqual(["Catch-22", "Good as Gold"]);
  });

  it("keeps an author Open Library split across two records", () => {
    const docs = [doc("Catch-22", "OL1A", 150), doc("Closing Time", "OL2A", 60)];
    expect(keepMainAuthor(docs, "Joseph Heller")).toHaveLength(2);
  });
});
