import { describe, it, expect } from "vitest";
import { isCollectibleShape, titleHead } from "./seed-book-catalog.mjs";

// Every case below is a real row that came back from Open Library during the
// first seed of the catalog. The rejections are what a collector should never
// be offered; the acceptances are the genuine first editions that earlier,
// greedier versions of these rules threw away.

const accepts = (title, author = "Someone", publisher = "Scribner") =>
  isCollectibleShape(title, author, publisher);

describe("titleHead", () => {
  // Open Library's annotations describe its own edition record, not the book.
  // Testing them is how a real first edition gets mistaken for a set.
  it("drops bracketed and parenthetical annotations", () => {
    expect(titleHead("The Adventures of Sherlock Holmes [12 stories]")).toBe("The Adventures of Sherlock Holmes");
    expect(titleHead("Cover Her Face (Adam Dalgliesh Mystery Series #1)")).toBe("Cover Her Face");
    expect(titleHead("Dune")).toBe("Dune");
  });
});

describe("isCollectibleShape — rejects what is not a collectible book", () => {
  it("rejects print-on-demand reprints of public-domain classics", () => {
    // The most misleading row shape there is: Open Library reports the work's
    // year, so this arrives looking like an 1818 Frankenstein.
    expect(isCollectibleShape("Frankenstein", "Mary Shelley", "CreateSpace Independent Publishing Platform")).toBe(false);
    expect(isCollectibleShape("Persuasion", "Jane Austen", "Independently Published")).toBe(false);
  });

  it("rejects omnibuses, boxed sets and collected works", () => {
    expect(accepts("The Foundation Trilogy")).toBe(false);
    expect(accepts("The Earthsea Quartet")).toBe(false);
    expect(accepts("The Roald Dahl Omnibus")).toBe(false);
    expect(accepts("Harry Potter Boxed Set")).toBe(false);
    expect(accepts("Complete prose works")).toBe(false);
    expect(accepts("The collected poems of Ernest Hemingway")).toBe(false);
    expect(accepts("Three Novels by Samuel Beckett")).toBe(false);
    expect(accepts("Works")).toBe(false);
  });

  it("rejects split-volume scans and series bundles", () => {
    expect(accepts("Wuthering Heights [1/2]")).toBe(false);
    expect(accepts("A Tramp Abroad in two volumes. 2/2")).toBe(false);
    expect(accepts("Harry Potter (series) 1-7")).toBe(false);
  });

  it("rejects study aids, tie-ins and things that are not books", () => {
    expect(accepts("Dune (Movie Tie-In)")).toBe(false);
    expect(accepts("Sula (SparkNotes Literature Guide)")).toBe(false);
    expect(accepts("Jemima Puddle-duck Coloring Book")).toBe(false);
    expect(accepts("The Golden Compass Graphic Novel")).toBe(false);
  });

  it("rejects a title that is only the author's name", () => {
    expect(isCollectibleShape("Henry James", "Henry James", "Dutton")).toBe(false);
    // Case and spacing shouldn't rescue it.
    expect(isCollectibleShape("  virginia woolf ", "Virginia Woolf", "Hogarth")).toBe(false);
  });
});

describe("isCollectibleShape — keeps genuine first editions", () => {
  // Each of these was destroyed by an earlier draft of the rules.
  it("keeps a book whose title merely contains a rejected word", () => {
    expect(accepts("The Illustrated Man", "Ray Bradbury")).toBe(true);
    expect(accepts("The Second Common Reader", "Virginia Woolf")).toBe(true);
    expect(accepts("Metaphysics as a guide to morals", "Iris Murdoch")).toBe(true);
  });

  it("keeps single volumes that list several works in the title", () => {
    expect(accepts("The merry men, and other tales and fables", "Robert Louis Stevenson")).toBe(true);
    expect(accepts("Dickens, Dali & Others", "George Orwell")).toBe(true);
    expect(accepts("Tom Sawyer Abroad, Tom Sawyer Detective and Other Stories", "Mark Twain")).toBe(true);
  });

  it("keeps a book carrying an Open Library annotation", () => {
    expect(accepts("The Adventures of Sherlock Holmes [12 stories]", "Arthur Conan Doyle")).toBe(true);
    expect(accepts("Cover Her Face (Adam Dalgliesh Mystery Series #1)", "P. D. James")).toBe(true);
    expect(accepts("A Wind in the Door (Time Quintet #2)", "Madeleine L'Engle")).toBe(true);
  });

  // "Collected Stories of William Faulkner" won the National Book Award and is
  // a real first edition. "Collected Works" is a set. The rule lists the nouns
  // that make a set, and "stories" is deliberately not one of them.
  it("keeps a collected-stories volume that is itself a first edition", () => {
    expect(accepts("Collected Stories of William Faulkner", "William Faulkner")).toBe(true);
  });

  it("keeps ordinary books", () => {
    expect(accepts("Dune", "Frank Herbert")).toBe(true);
    expect(accepts("The Great Gatsby", "F. Scott Fitzgerald")).toBe(true);
    expect(accepts("Blood Meridian", "Cormac McCarthy")).toBe(true);
  });
});
