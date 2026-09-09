// Extracted from app/InventoryApp.jsx. These are pure functions with no DOM,
// network, or React dependency, which is what makes them testable in isolation
// -- and what makes them a readable reference for any other client that has to
// reproduce the same arithmetic.

import { authoredCategories, conditionOptions, mockAutofillOptions } from "./constants";
import { toNumber, hasValue, formatCurrency } from "./format";

// Books and comics carry an author; everything else is only ever made or
// branded by someone. The forms use this to decide whether to offer the
// Author field at all, so a trading card never asks who wrote it.
export function usesAuthorField(category) {
  return authoredCategories.includes(category);
}

// The one line under a title, everywhere an item is listed. An author and a
// publisher are both worth showing when both are known ("Stephen King ·
// Doubleday"), and either one alone still reads correctly.
//
// The author is shown only for the categories that offer the field, so what a
// card displays is always something the form lets you edit. Recategorizing a
// book as a record hides the author rather than orphaning it on screen; the
// value is kept in the row, and comes back with the category (and still
// leaves in a CSV export either way).
export function itemCredit(item) {
  const credits = usesAuthorField(item?.category) ? [item?.author, item?.maker] : [item?.maker];
  return credits.map((value) => String(value || "").trim()).filter(Boolean).join(" · ");
}

// Case/punctuation-insensitive comparison key so "The Gunslinger" and "the
// gunslinger." match, and blank fields don't accidentally match each other.
export function normalizeForMatch(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

// Edition/printing signature used to tell "same copy" from "different
// collectible copy." Books compare edition+printing; everything else
// compares the free-text edition/variant field.
export function editionMatchKey(entry) {
  return entry.category === "Book"
    ? normalizeForMatch(`${entry.bookEdition} ${entry.bookPrinting}`)
    : normalizeForMatch(entry.edition);
}

// Flags items already in the collection that look like the one being added.
// There's no ISBN/barcode yet (see issue #43), so matching is loose: same
// normalized name + credit. Author and maker are compared as one joined key
// rather than field by field, so a copy catalogued before those were separate
// fields (author in maker, or the reverse) still matches the same book.
// Non-blocking by design -- collectors legitimately
// keep multiple copies, upgrades, and variant states (issue #47) -- so this
// only informs, it never prevents the save.
export function creditMatchKey(entry) {
  return normalizeForMatch(`${entry.author || ""} ${entry.maker || ""}`);
}

export function findPossibleDuplicates(candidate, inventory) {
  const name = normalizeForMatch(candidate.name);
  if (!name) return [];
  const credit = creditMatchKey(candidate);
  const candidateEditionKey = editionMatchKey(candidate);
  const candidateConditionRank = conditionOptions.indexOf(candidate.condition);

  const matches = inventory
    .filter((entry) => normalizeForMatch(entry.name) === name && creditMatchKey(entry) === credit)
    .map((entry) => {
      const editionKey = editionMatchKey(entry);
      const sameEdition = Boolean(candidateEditionKey) && candidateEditionKey === editionKey;
      const entryConditionRank = conditionOptions.indexOf(entry.condition);
      // Lower index in conditionOptions means better condition (see its
      // definition), so a smaller rank than the existing copy is an upgrade.
      const isUpgrade = sameEdition && candidateConditionRank !== -1 && entryConditionRank !== -1 && candidateConditionRank < entryConditionRank;

      let matchType = "possible_duplicate";
      if (isUpgrade) matchType = "potential_upgrade";
      else if (candidateEditionKey && editionKey && !sameEdition) matchType = "different_copy";

      return { entry, matchType };
    });

  const priority = { possible_duplicate: 0, potential_upgrade: 1, different_copy: 2 };
  return matches.sort((a, b) => priority[a.matchType] - priority[b.matchType]);
}

// Builds marketplace search URLs for "find similar copies" -- plain search
// links, no API keys or scraping involved.
// Appends a clarifying word (e.g. "edition") only if the value doesn't
// already contain it, so a field typed as just "First" becomes "First
// edition" while "First edition" isn't turned into "First edition edition".
export function withClarifyingWord(value, word) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return trimmed;
  return trimmed.toLowerCase().includes(word.toLowerCase()) ? trimmed : `${trimmed} ${word}`;
}

export function buildSimilarCopyLinks(item) {
  const parts = [item.name, item.author, item.maker];

  // Book-specific detail fields narrow the search to the exact edition/
  // printing the collector actually has, e.g. "The Gunslinger Stephen King
  // First edition First printing" instead of just the title and author.
  if (item.category === "Book") {
    if (item.bookEdition) parts.push(withClarifyingWord(item.bookEdition, "edition"));
    if (item.bookPrinting) parts.push(withClarifyingWord(item.bookPrinting, "printing"));
  } else if (item.edition) {
    parts.push(item.edition);
  }

  const query = parts.filter(Boolean).join(" ").trim();
  if (!query) return null;
  const encoded = encodeURIComponent(query);
  return {
    abebooks: `https://www.abebooks.com/servlet/SearchResults?kn=${encoded}`,
    ebay: `https://www.ebay.com/sch/i.html?_nkw=${encoded}`
  };
}

export function hasEstimate(item) {
  return hasValue(item.estimatedValue);
}

// Prefers what an item actually sold for over its pre-sale estimate, so
// Sold-tab totals reflect realized value rather than a stale guess. Returns
// null when there's nothing to show yet, so callers can render "—" instead
// of a misleading $0.
export function itemValueForTotals(item) {
  if (item.status === "Sold" && hasValue(item.soldPrice)) return toNumber(item.soldPrice);
  return hasEstimate(item) ? toNumber(item.estimatedValue) : null;
}

export function calculateGain(item) {
  const value = itemValueForTotals(item);
  if (value === null) return null;
  return value - toNumber(item.purchasePrice);
}

// Use for a single item's value/gain display, where "no data yet" should
// read as "—" instead of $0 (which looks like a loss against cost basis).
export function formatEstimatedValue(item) {
  const value = itemValueForTotals(item);
  return value === null ? "—" : formatCurrency(value);
}

export function formatGain(gain) {
  return gain === null ? "—" : formatCurrency(gain);
}

export function makeSavedItem(item, itemPhotos = [], receiptPhotos = []) {
  const itemPhotoList = Array.isArray(itemPhotos) ? itemPhotos : [];
  const receiptPhotoList = Array.isArray(receiptPhotos) ? receiptPhotos : [];
  const itemPhotoCount = Array.isArray(itemPhotos) ? itemPhotos.length : Number(itemPhotos || 0);
  const receiptPhotoCount = Array.isArray(receiptPhotos) ? receiptPhotos.length : Number(receiptPhotos || 0);

  return {
    id: `${item.name || "Untitled"}-${Date.now()}-${Math.random()}`,
    ...item,
    itemPhotoCount,
    receiptPhotoCount,
    itemPhotos: itemPhotoList.map((photo) => ({ ...photo })),
    receiptPhotos: receiptPhotoList.map((photo) => ({ ...photo })),
    savedAt: new Date().toISOString()
  };
}

export function getActiveInventory(inventory) {
  return inventory.filter((entry) => entry.status !== "Sold");
}

export function pickMockAutofill(fileName, photoType) {
  const normalized = String(fileName || "").toLowerCase();
  if (photoType.toLowerCase().includes("receipt")) return mockAutofillOptions[0].data;
  const matched = mockAutofillOptions.find((option) => normalized.includes(option.match));
  return matched?.data || mockAutofillOptions[mockAutofillOptions.length - 1].data;
}

// A model can return low > high, or one side missing, if search evidence
// was thin -- clamp rather than show a nonsensical range in the UI.
export function toValueRange(result, lowKey, highKey) {
  const low = Number(result[lowKey]) || 0;
  const high = Number(result[highKey]) || 0;
  if (low <= 0 && high <= 0) return null;
  if (low <= 0) return { low: high, high };
  if (high <= 0) return { low, high: low };
  return low <= high ? { low, high } : { low: high, high: low };
}
