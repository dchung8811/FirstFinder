// Searching, filtering, and sorting a shared collection page.
//
// All of this runs in the visitor's browser against items the server has
// already vetted. That is the important property: buildPublicItem decided what
// may be published, and nothing here can widen it. These functions only ever
// hide items or reorder them -- they never reach for a field that was withheld,
// and a filter cannot make a private value visible by matching on it.
//
// It also means searching costs no round trip. The page is server-rendered
// per request (see the note on `dynamic` in the route), so the whole shared
// collection is already in the payload; filtering it on the client is instant
// and adds no load to the database no matter how much someone types.
//
// Pure functions with no imports, so the matching rules can be tested without
// a browser or a database.

export const sortOptions = [
  // The order the server sent, which is newest-first. Default because a
  // collection page is a shelf someone is adding to, and the new arrivals are
  // what a returning visitor came to see.
  { value: "added", label: "Recently added" },
  { value: "name", label: "Title A–Z" },
  { value: "maker", label: "Maker A–Z" }
];

export const viewModes = ["cards", "records"];

// Everything a text search looks at. Deliberately a list of names rather than
// "every string on the item": notes and source only exist on the object when
// the owner published them, so this stays correct as settings change, and a
// field added to buildPublicItem later is not silently searchable before
// anyone has decided it should be.
const SEARCH_FIELDS = [
  "name",
  "maker",
  "edition",
  "bookEdition",
  "bookPrinting",
  "bookGenre",
  "category",
  "condition",
  "status",
  "source",
  "notes"
];

export function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    // Fold accents, so "Bronte" finds "Brontë". Collectors type the ASCII
    // spelling far more often than the correct one, and a search that fails on
    // a diacritic reads as a search that is broken.
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// Every term must match somewhere on the item, but not necessarily in the same
// field: "steinbeck first" should find a Steinbeck whose edition is First. The
// alternative -- matching the whole phrase against one field -- fails that,
// which is the most natural way to search a collection.
export function matchesQuery(item, query) {
  const terms = normalizeText(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;

  const haystack = SEARCH_FIELDS.map((field) => normalizeText(item[field])).join(" ");
  return terms.every((term) => haystack.includes(term));
}

export function filterPublicItems(items, { query = "", category = "", status = "" } = {}) {
  return (items || []).filter((item) => {
    if (category && item.category !== category) return false;
    if (status && item.status !== status) return false;
    return matchesQuery(item, query);
  });
}

// Sorts a copy: the caller's array is the server's order, and "Recently added"
// has to be able to get back to it.
export function sortPublicItems(items, sort) {
  const sorted = [...(items || [])];

  if (sort === "name" || sort === "maker") {
    // localeCompare so accented and cased titles land where a reader expects.
    // Items missing the field sort last rather than clustering at the top --
    // an untitled row is not the first thing anyone wants to see.
    sorted.sort((a, b) => {
      const left = String(a[sort] || "").trim();
      const right = String(b[sort] || "").trim();
      if (!left && !right) return 0;
      if (!left) return 1;
      if (!right) return -1;
      return left.localeCompare(right, undefined, { sensitivity: "base" });
    });
  }

  return sorted;
}

// The filter values actually present in this collection, so the controls only
// ever offer choices that lead somewhere. A dropdown holding one category, or
// a status filter on a page where everything is owned, is a control that can
// only disappoint -- the page hides those rather than rendering them dead.
export function collectFilterOptions(items) {
  const categories = new Set();
  const statuses = new Set();

  (items || []).forEach((item) => {
    if (item.category) categories.add(item.category);
    if (item.status) statuses.add(item.status);
  });

  return {
    categories: [...categories].sort((a, b) => a.localeCompare(b)),
    statuses: [...statuses].sort((a, b) => a.localeCompare(b))
  };
}

// What the public page calls each status. "Wishlist" is the app's internal
// word for it; on someone else's page the item is something they are looking
// for, which is what the card already says.
export const statusLabels = {
  Owned: "In the collection",
  "For sale": "For sale",
  Sold: "Sold",
  Wishlist: "Wanted"
};

export function statusLabel(status) {
  return statusLabels[status] || status;
}

// The line under the controls: what is being shown, and out of how many. Only
// mentions the total when filtering has actually removed something, so an
// unfiltered page does not read as though it were hiding items.
export function resultSummary(shownCount, totalCount) {
  if (shownCount === totalCount) {
    return `${totalCount} ${totalCount === 1 ? "item" : "items"}`;
  }
  return `${shownCount} of ${totalCount} ${totalCount === 1 ? "item" : "items"}`;
}
