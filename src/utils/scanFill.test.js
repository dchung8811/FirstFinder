import { describe, it, expect } from "vitest";
import {
  printingLabel,
  printingFromNumberLine,
  printingFromStatement,
  editionFromStatement,
  readEditionAndPrinting,
  scanResultToFields,
  mergeScanIntoItem
} from "./scanFill";
import { emptyItem } from "./constants";

describe("printingFromNumberLine", () => {
  it("reads the lowest number on a descending line", () => {
    expect(printingFromNumberLine("10 9 8 7 6 5 4 3 2 1")).toBe(1);
    expect(printingFromNumberLine("10 9 8 7 6 5 4 3")).toBe(3);
  });

  it("reads alternating and ascending lines the same way", () => {
    expect(printingFromNumberLine("1 3 5 7 9 10 8 6 4 2")).toBe(1);
    expect(printingFromNumberLine("3 5 7 9 10 8 6 4")).toBe(3);
    expect(printingFromNumberLine("2 3 4 5 6 7 8 9 10")).toBe(2);
  });

  it("ignores year codes running alongside the printing digits", () => {
    expect(printingFromNumberLine("81 82 83 84 85 10 9 8 7 6 5 4 3 2")).toBe(2);
    expect(printingFromNumberLine("05 06 07 08 RRD 10 9 8 7 6 5 4")).toBe(4);
  });

  it("ignores printer codes and stray letters", () => {
    expect(printingFromNumberLine("BVG 10 9 8 7 6 5 4 3 2 1")).toBe(1);
    expect(printingFromNumberLine("Q-FF 5 4 3 2")).toBe(2);
  });

  it("refuses to call a single number, or nothing, a number line", () => {
    expect(printingFromNumberLine("7")).toBeNull();
    expect(printingFromNumberLine("")).toBeNull();
    expect(printingFromNumberLine(undefined)).toBeNull();
    expect(printingFromNumberLine("A B C D E")).toBeNull();
  });

  it("never reads a four-digit year as part of the line", () => {
    expect(printingFromNumberLine("© 1982")).toBeNull();
  });
});

describe("printingFromStatement", () => {
  it("reads printings stated in words or numerals", () => {
    expect(printingFromStatement("Second printing, May 1962")).toBe(2);
    expect(printingFromStatement("FIRST PRINTING")).toBe(1);
    expect(printingFromStatement("7th printing")).toBe(7);
  });

  it("returns null when no printing is stated", () => {
    expect(printingFromStatement("First Edition")).toBeNull();
    expect(printingFromStatement("")).toBeNull();
  });
});

describe("editionFromStatement", () => {
  it("maps stated editions onto the Edition select", () => {
    expect(editionFromStatement("First Edition")).toBe("First");
    expect(editionFromStatement("FIRST AMERICAN EDITION")).toBe("First");
    expect(editionFromStatement("First U.S. Edition")).toBe("First");
    expect(editionFromStatement("Second Edition")).toBe("Second");
    expect(editionFromStatement("First printing")).toBe("First");
  });

  it("never calls a book club edition a first", () => {
    expect(editionFromStatement("Book Club Edition")).toBe("Other");
    expect(editionFromStatement("First Edition — Book Club")).toBe("Other");
  });

  it("files other editions as Other, and nothing as nothing", () => {
    expect(editionFromStatement("Revised edition")).toBe("Other");
    expect(editionFromStatement("")).toBe("");
    expect(editionFromStatement("Printed in the USA")).toBe("");
  });
});

describe("printingLabel", () => {
  it("names the first five and files the rest as Other", () => {
    expect(printingLabel(1)).toBe("First");
    expect(printingLabel(5)).toBe("Fifth");
    expect(printingLabel(6)).toBe("Other");
    expect(printingLabel(0)).toBe("");
  });
});

describe("readEditionAndPrinting", () => {
  it("calls a stated first edition over a line ending in 1 a first printing", () => {
    const read = readEditionAndPrinting({ editionStatement: "First Edition", numberLine: "10 9 8 7 6 5 4 3 2 1" });
    expect(read).toMatchObject({ bookEdition: "First", bookPrinting: "First" });
    expect(read.reasons.join(" ")).toMatch(/lowest number on the number line is 1/);
  });

  it("keeps a first edition's later printing as a later printing", () => {
    const read = readEditionAndPrinting({ editionStatement: "First Edition", numberLine: "10 9 8 7 6 5 4 3" });
    expect(read).toMatchObject({ bookEdition: "First", bookPrinting: "Third" });
  });

  it("files a printing past the fifth as Other, naming the number", () => {
    const read = readEditionAndPrinting({ numberLine: "10 9 8 7" });
    expect(read.bookPrinting).toBe("Other");
    expect(read.reasons.join(" ")).toMatch(/is 7, so this is the seventh printing/);
  });

  it("lets a printing stated in words beat the number line", () => {
    const read = readEditionAndPrinting({ printingStatement: "Second printing", numberLine: "10 9 8 7 6 5 4 3 2 1" });
    expect(read.bookPrinting).toBe("Second");
  });

  it("reads a printing stated inside the edition line", () => {
    const read = readEditionAndPrinting({ editionStatement: "First Edition, Third Printing" });
    expect(read).toMatchObject({ bookEdition: "First", bookPrinting: "Third" });
  });

  it("knows Random House first printings start the line at 2", () => {
    const read = readEditionAndPrinting({ editionStatement: "First Edition", numberLine: "9 8 7 6 5 4 3 2", publisher: "Random House" });
    expect(read.bookPrinting).toBe("First");
    expect(read.reasons.join(" ")).toMatch(/Random House/);
  });

  it("does not apply the Random House rule to other publishers, or without the statement", () => {
    expect(readEditionAndPrinting({ editionStatement: "First Edition", numberLine: "9 8 7 6 5 4 3 2", publisher: "Knopf" }).bookPrinting).toBe("Second");
    expect(readEditionAndPrinting({ numberLine: "9 8 7 6 5 4 3 2", publisher: "Random House" }).bookPrinting).toBe("Second");
  });

  it("leaves the printing blank when there is no line to read, and says why", () => {
    const read = readEditionAndPrinting({ editionStatement: "First Edition" });
    expect(read).toMatchObject({ bookEdition: "First", bookPrinting: "" });
    expect(read.reasons.join(" ")).toMatch(/confirm/);
  });

  it("flags a number line it could not read instead of guessing", () => {
    const read = readEditionAndPrinting({ numberLine: "A B C D" });
    expect(read.bookPrinting).toBe("");
    expect(read.reasons.join(" ")).toMatch(/Couldn't read a printing/);
  });
});

describe("scanResultToFields", () => {
  it("maps a book's author and publisher to their own fields", () => {
    const { fields } = scanResultToFields({
      category: "Book",
      title: "Beloved",
      author: "Toni Morrison",
      publisher: "Alfred A. Knopf",
      editionStatement: "First Edition",
      numberLine: "10 9 8 7 6 5 4 3 2 1"
    });
    expect(fields).toEqual({
      category: "Book",
      name: "Beloved",
      author: "Toni Morrison",
      maker: "Alfred A. Knopf",
      bookEdition: "First",
      bookPrinting: "First"
    });
  });

  it("puts the credit in Make / Publisher for categories with no author", () => {
    const { fields } = scanResultToFields({ category: "Record", title: "Kind of Blue", author: "Miles Davis", publisher: "" });
    expect(fields).toEqual({ category: "Record", name: "Kind of Blue", maker: "Miles Davis" });
  });

  it("drops empty values so a cover-only scan can't blank a field", () => {
    const { fields } = scanResultToFields({ category: "Book", title: "Dune", author: "", publisher: "" });
    expect(fields).toEqual({ category: "Book", name: "Dune" });
  });

  it("falls back to Book for a category the form doesn't offer", () => {
    expect(scanResultToFields({ category: "Pamphlet", title: "X" }).fields.category).toBe("Book");
  });
});

describe("mergeScanIntoItem", () => {
  const fresh = { ...emptyItem, purchaseDate: "2026-10-13" };

  it("fills an empty form, including the category", () => {
    const { item, filled } = mergeScanIntoItem(fresh, { category: "Comic", name: "Watchmen", author: "Alan Moore" });
    expect(item).toMatchObject({ category: "Comic", name: "Watchmen", author: "Alan Moore", purchaseDate: "2026-10-13" });
    expect(filled).toEqual(["category", "name", "author"]);
  });

  it("never overwrites what the collector typed", () => {
    const typed = { ...fresh, name: "My title", maker: "Grant" };
    const { item, filled } = mergeScanIntoItem(typed, { category: "Comic", name: "Scanned title", maker: "Scanned", author: "Someone" });
    expect(item).toMatchObject({ category: "Book", name: "My title", maker: "Grant", author: "Someone" });
    expect(filled).toEqual(["author"]);
  });

  it("lets a second scan add what the first couldn't see", () => {
    const afterCover = mergeScanIntoItem(fresh, { category: "Book", name: "Dune", author: "Frank Herbert" }).item;
    const { item, filled } = mergeScanIntoItem(afterCover, { category: "Book", name: "DUNE", maker: "Chilton", bookEdition: "First", bookPrinting: "First" });
    expect(item).toMatchObject({ name: "Dune", maker: "Chilton", bookEdition: "First", bookPrinting: "First" });
    expect(filled).toEqual(["maker", "bookEdition", "bookPrinting"]);
  });
});
