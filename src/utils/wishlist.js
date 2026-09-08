// The wishlist: copies a collector is looking for but does not own.
//
// The distinction this module exists to hold: an inventory item records FACTS
// about a copy in hand, a want records a SPECIFICATION for one that does not
// exist in the collection yet. "Won't pay over $3,500" is not a property of a
// book you already bought, and "Near Fine" on a want means "at worst Near
// Fine", not "is Near Fine". Every function below is about criteria, and none
// of them can be reused on an owned item without meaning something else.
//
// Pure functions with no React, network or DOM, matching the rest of
// src/utils -- the arithmetic here (does this copy clear the bar? does it come
// in under the ceiling?) is exactly what wants testing without a browser.

import { conditionOptions } from "./constants";
import { toNumber, hasValue } from "./format";
import { withClarifyingWord } from "./items";

// Sorted best-first, which is also how the list renders. A want with no
// priority set is treated as "hunting" rather than dropped to the bottom: it
// was typed in by someone who wanted something.
export const priorityOptions = [
  {
    value: "grail",
    label: "Grail",
    detail: "The one you'd drop everything for."
  },
  {
    value: "hunting",
    label: "Actively hunting",
    detail: "Checking regularly, ready to buy the right copy."
  },
  {
    value: "someday",
    label: "Someday",
    detail: "On the list, no rush."
  }
];

export const jacketOptions = [
  { value: "required", label: "Required", short: "Jacket required" },
  { value: "preferred", label: "Nice to have", short: "Jacket preferred" },
  { value: "any", label: "Don't mind", short: "" },
  { value: "na", label: "N/A", short: "" }
];

// Ascending scarcity, but deliberately NOT a threshold -- see the note in
// supabase/wishlist.sql. Someone hunting an association copy is not served by a
// merely signed one, so this is displayed as a preference and never used to
// filter a candidate out.
export const signatureOptions = [
  { value: "any", label: "Any", short: "" },
  { value: "signed", label: "Signed", short: "Signed" },
  { value: "inscribed", label: "Inscribed", short: "Inscribed" },
  { value: "association", label: "Association copy", short: "Association copy" }
];

export const emptyWant = {
  name: "",
  maker: "",
  category: "Book",
  wantedEdition: "",
  wantedPrinting: "",
  publisher: "",
  minCondition: "",
  jacketRequirement: "any",
  signatureRequirement: "any",
  maxPrice: "",
  preferredSource: "",
  priority: "hunting",
  upgradeForItemId: "",
  notes: ""
};

const PRIORITY_RANK = { grail: 0, hunting: 1, someday: 2 };

export function priorityLabel(priority) {
  return priorityOptions.find((option) => option.value === priority)?.label || "Actively hunting";
}

// A want is worth saving if it names something. Everything else is optional --
// a collector who knows only "a first of Suttree, eventually" should not be
// made to fill in a form before the app will remember it.
export function isWantSaveable(want) {
  return Boolean(String(want?.name || "").trim());
}

// conditionOptions is ordered best to worst, so a smaller index is a better
// copy and "acceptable" is an index comparison. Returns true when no floor is
// set: no stated minimum cannot exclude anything.
export function meetsConditionFloor(condition, minCondition) {
  if (!minCondition) return true;
  const floor = conditionOptions.indexOf(minCondition);
  if (floor === -1) return true;
  const actual = conditionOptions.indexOf(condition);
  // An ungraded copy is not a failure -- most listings say nothing about
  // condition, and treating silence as "Poor" would hide half the market.
  if (actual === -1) return true;
  return actual <= floor;
}

// The criteria, phrased the way a collector would say them, for the chip row
// on a want. Order is deliberate: edition first (the thing most likely to rule
// a copy out), then the physical requirements, then condition.
export function describeCriteria(want) {
  const chips = [];

  const edition = [
    want.wantedEdition && withClarifyingWord(want.wantedEdition, "edition"),
    want.wantedPrinting && withClarifyingWord(want.wantedPrinting, "printing")
  ]
    .filter(Boolean)
    .join(" · ");
  if (edition) chips.push({ text: edition, tone: "green" });

  if (want.publisher) chips.push({ text: want.publisher, tone: "green" });

  const jacket = jacketOptions.find((option) => option.value === want.jacketRequirement)?.short;
  if (jacket) chips.push({ text: jacket, tone: "neutral" });

  if (want.minCondition) chips.push({ text: `${want.minCondition} or better`, tone: "neutral" });

  const signature = signatureOptions.find((option) => option.value === want.signatureRequirement)?.short;
  if (signature) chips.push({ text: signature, tone: "green" });

  return chips;
}

// Grail first, then the order they were added. A stable sort within a priority
// keeps the list from reshuffling under someone every time they open it.
export function sortWants(wants) {
  return [...(wants || [])].sort((a, b) => {
    const rank = (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1);
    if (rank !== 0) return rank;
    return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
  });
}

export function openWants(wants) {
  return (wants || []).filter((want) => !want.foundAt);
}

export function foundWants(wants) {
  return (wants || []).filter((want) => want.foundAt);
}

// What the wishlist tab reports. The money figure is deliberately named for
// what it is -- the sum of the ceilings, if every hunt ended at its limit --
// because it is a budget and not a holding, and a collector's totals must
// never quietly gain the value of books they do not own.
export function summarizeWants(wants) {
  const open = openWants(wants);
  const ceilingTotal = open.reduce((sum, want) => (hasValue(want.maxPrice) ? sum + toNumber(want.maxPrice) : sum), 0);

  return {
    openCount: open.length,
    foundCount: foundWants(wants).length,
    ceilingTotal,
    // Only meaningful alongside openCount: three of seven wants having a
    // ceiling makes the total a floor, not an estimate, and the UI says so.
    withCeiling: open.filter((want) => hasValue(want.maxPrice)).length,
    grailCount: open.filter((want) => want.priority === "grail").length,
    upgradeCount: open.filter((want) => want.upgradeForItemId).length
  };
}

// Search links for the hunt. Reuses the query shape buildSimilarCopyLinks uses
// for owned items, but built from the wanted edition rather than the owned one
// -- the point of a want is that the copy in hand is not the copy sought.
export function buildWantSearchLinks(want) {
  const parts = [want.name, want.maker];

  if (want.wantedEdition) parts.push(withClarifyingWord(want.wantedEdition, "edition"));
  if (want.wantedPrinting) parts.push(withClarifyingWord(want.wantedPrinting, "printing"));
  // Signature is a search term, not just a display preference: "signed" in the
  // query is what surfaces the listings worth looking at.
  if (want.signatureRequirement && want.signatureRequirement !== "any") parts.push(want.signatureRequirement);

  const query = parts.filter(Boolean).join(" ").trim();
  if (!query) return null;

  const encoded = encodeURIComponent(query);
  return {
    abebooks: `https://www.abebooks.com/servlet/SearchResults?kn=${encoded}`,
    ebay: `https://www.ebay.com/sch/i.html?_nkw=${encoded}`
  };
}

// The acquisition. Builds the inventory item a found want becomes, carrying
// across everything the want already established so nobody retypes a title
// they have been looking at for a year.
//
// What it deliberately does NOT carry: maxPrice, priority, and the criteria as
// criteria. Those described a search, and the search is over -- the new item
// records what was actually found. The wanted edition seeds the actual edition
// because it is usually right and always editable; the condition does not,
// because "at worst Near Fine" is not a grade and guessing one would put a
// number in the collection that nobody checked.
export function wantToItem(want, found = {}) {
  return {
    name: want.name || "",
    maker: want.maker || "",
    category: want.category || "Book",
    edition: "",
    bookGenre: "",
    bookEdition: want.category === "Book" ? want.wantedEdition || "" : "",
    bookPrinting: want.category === "Book" ? want.wantedPrinting || "" : "",
    status: "Owned",
    condition: found.condition || "",
    purchaseDate: found.purchaseDate || "",
    source: found.source || want.preferredSource || "",
    purchasePrice: found.purchasePrice || "",
    estimatedValue: "",
    soldPrice: "",
    soldDate: "",
    notes: want.notes || ""
  };
}

// How the purchase landed against the ceiling, for the line the found-it
// dialog shows. Null when there was no ceiling or nothing was paid -- there is
// no story to tell about a limit nobody set.
export function compareToCeiling(want, paidPrice) {
  if (!hasValue(want?.maxPrice) || !hasValue(paidPrice)) return null;

  const ceiling = toNumber(want.maxPrice);
  const paid = toNumber(paidPrice);
  const difference = ceiling - paid;

  return {
    ceiling,
    paid,
    difference: Math.abs(difference),
    // Exactly at the ceiling is under it, not over: the limit was "won't pay
    // over", and paying it is keeping to it.
    under: difference >= 0
  };
}
