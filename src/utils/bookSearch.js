// Item-name autocomplete for books: what the two tiers are, how they merge, and
// what picking a suggestion writes onto the item.
//
// Everything here is pure. The Supabase call that fetches catalog rows lives in
// the app; this file decides what the collector actually sees and what lands in
// their record, which is the part worth testing.

import { getAllWorks, workPath } from "../content/books";

// Three characters, matching the SQL side. Below this the trigram index cannot
// help, and a two-letter query matches so much that the list is noise anyway.
export const MIN_QUERY_LENGTH = 3;

// Short enough to scan without scrolling. A collector who does not see their
// book in eight rows should keep typing, not read further.
export const MAX_SUGGESTIONS = 8;

// The two tiers, in the order they rank.
//
// "guide" is one of the works in src/content/books: a human checked it against
// sources and it has an identification page to link to.
//
// "catalog" is a bulk-imported Open Library row. It asserts that the book
// exists and nothing else -- no edition points, no first-edition claim. The UI
// has to keep that distinction visible, because a suggestion list that renders
// both identically implies the catalog was checked too.
export const GUIDE_TIER = "guide";
export const CATALOG_TIER = "catalog";

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

// The comparable form of a title, for deciding whether two rows are the same
// book. Open Library's records are not typed to match ours, and three specific
// differences all mean "same book":
//
//   * A dropped leading article. Its Gatsby records are filed as "Great
//     Gatsby", and an exact match against our "The Great Gatsby" guide fails --
//     which put three reprint rows (Arcturus 1951, Benediction 1995) directly
//     underneath the verified Scribner's 1925 one, all claiming to be Gatsby.
//   * A trailing annotation, as in "The Great Gatsby(Published In 1925)".
//   * Punctuation and spacing of any kind.
//
// Getting this wrong is not cosmetic. The whole point of ranking guides first
// is that a collector sees the publisher we have actually verified; a near-miss
// on the title defeats it by showing them a reissue's imprint as well.
function comparableTitle(value) {
  return String(value || "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\([^)]*\)?.*$/g, "")
    .toLowerCase()
    .replace(/^(the|a|an)\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Title plus author is the identity of a work for de-duplication. Publisher is
// deliberately excluded: two catalog rows for the same book from different
// publishers are the same suggestion as far as a collector typing a title is
// concerned, and showing both twice is worse than showing the better one once.
function identityOf(suggestion) {
  return `${comparableTitle(suggestion.title)}|${normalize(suggestion.author)}`;
}

export { comparableTitle };

export function isSearchable(query) {
  return String(query || "").trim().length >= MIN_QUERY_LENGTH;
}

// A verified work turned into a suggestion. firstEdition is where a work keeps
// its publisher and year, and it is the one place in this file where a
// first-edition fact is allowed, because that page was verified.
export function suggestionFromWork(work) {
  return {
    key: `work:${work.slug}`,
    tier: GUIDE_TIER,
    title: work.title,
    author: work.author || "",
    publisher: work.firstEdition?.publisher || "",
    year: work.firstEdition?.year || null,
    guidePath: workPath(work)
  };
}

export function suggestionFromCatalogRow(row) {
  return {
    key: `catalog:${row.id}`,
    tier: CATALOG_TIER,
    title: row.title,
    author: row.author || "",
    publisher: row.publisher || "",
    year: row.first_published_year || null,
    guidePath: null
  };
}

// Ranking inside the guide tier, mirroring what search_book_catalog does in
// SQL so the two halves of one list are not sorted by different rules: exact
// title, then title prefix, then author prefix, then anything else.
function guideRank(work, needle) {
  const title = normalize(work.title);
  const author = normalize(work.author);

  if (title === needle) return 0;
  if (title.startsWith(needle)) return 1;
  if (author.startsWith(needle)) return 2;
  return 3;
}

// The verified works are a local array of eleven, so this is a scan rather than
// a query. Draft works are included: a guide that is still being checked is
// still a book that exists, and its page renders -- it just carries noindex.
export function searchGuides(query, works = getAllWorks()) {
  if (!isSearchable(query)) return [];

  const needle = normalize(query);

  return works
    .filter((work) => `${normalize(work.title)} ${normalize(work.author)}`.includes(needle))
    .map((work) => ({ work, rank: guideRank(work, needle) }))
    .sort((a, b) => a.rank - b.rank || a.work.title.localeCompare(b.work.title))
    .map((entry) => suggestionFromWork(entry.work));
}

// Guides first, always, then the catalog long tail -- and a catalog row for a
// book we already have a guide for is dropped rather than shown twice. The
// collector wants the row that can tell them how to identify their copy, and
// that is never the Open Library one.
export function mergeSuggestions(guides, catalogRows, limit = MAX_SUGGESTIONS) {
  const merged = [];
  const seen = new Set();

  for (const suggestion of [...guides, ...catalogRows.map(suggestionFromCatalogRow)]) {
    if (!suggestion.title) continue;

    const identity = identityOf(suggestion);
    if (seen.has(identity)) continue;

    seen.add(identity);
    merged.push(suggestion);

    if (merged.length >= limit) break;
  }

  return merged;
}

// The one-line description under a suggestion's title.
export function suggestionSubtitle(suggestion) {
  return [suggestion.author, suggestion.publisher, suggestion.year]
    .filter(Boolean)
    .join(" · ");
}

// What picking a suggestion writes onto the item.
//
// A snapshot, not a reference: these values are copied in and belong to the
// collector from that moment on. Nothing written here is a claim about the copy
// in their hand. Edition and Printing are prefilled to "First" because that is
// what someone cataloguing a collectible book is usually recording, and they
// are editable selects sitting directly under the name.
//
// The publisher lands in Make / Publisher / Brand, which is a separate field
// from Author -- and it is the field most worth a second look. For a guide it
// is the verified first-edition publisher (Dune, Chilton Books). For a catalog
// row it is whichever edition Open Library happened to describe, which is
// frequently a later reissue. It is shown in the dropdown before the collector
// picks, and the hint under the field says to check it, but a collector who
// records a first edition should confirm this one against their copy.
//
// Author and publisher belong to the book, so a pick replaces them. Picking a
// second suggestion after mis-picking a first has to leave a coherent record --
// keeping Fitzgerald on the front of The Stand because he got there first is a
// wrong record, and a wrong record is worse than overwriting a name someone
// typed. They fall back to what was already there when the row has neither.
//
// Edition and printing are the opposite case: they describe the copy in the
// collector's hand, not the book, so a value already chosen is information we
// do not have and must not discard.
export function applyBookSuggestion(item, suggestion) {
  return {
    ...item,
    name: suggestion.title,
    category: "Book",
    author: suggestion.author || item.author || "",
    maker: suggestion.publisher || item.maker || "",
    bookEdition: item.bookEdition || "First",
    bookPrinting: item.bookPrinting || "First"
  };
}
