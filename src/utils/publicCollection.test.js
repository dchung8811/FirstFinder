import { describe, it, expect } from "vitest";
import {
  defaultShareSettings,
  publicItemFields,
  alwaysPublicItemFields,
  shareFieldGroups,
  sharePresets,
  matchingPresetId,
  applyPreset,
  isItemShared,
  buildPublicItem,
  publicWantFields,
  buildPublicWant,
  isWantShared,
  buildPublicWishlist,
  buildPublicCollection,
  summarizeCollection,
  summaryLine,
  generateShareSlug,
  isValidShareSlug,
  SLUG_LENGTH
} from "./publicCollection";

// A row with something private in every field, so a leak anywhere shows up as
// a recognisable string rather than an empty default.
const privateItem = (over = {}) => ({
  id: "row-1",
  referenceNumber: 4,
  name: "The Gunslinger",
  author: "Stephen King",
  maker: "Donald M. Grant",
  category: "Book",
  edition: "",
  bookEdition: "First",
  bookPrinting: "First",
  bookGenre: "Fantasy",
  condition: "Near Fine/Fine",
  status: "Owned",
  purchaseDate: "2026-05-12",
  source: "Ferndale Books, back room",
  purchasePrice: "45",
  estimatedValue: "850",
  previousStatus: "",
  soldPrice: "",
  soldDate: "",
  notes: "Kept in the safe in the study, combo in my phone",
  hiddenFromShare: false,
  itemPhotos: [{ id: "p1", path: "user/item/front.jpg", name: "front.jpg" }],
  receiptPhotos: [{ id: "r1", path: "user/item/receipt.jpg", name: "receipt.jpg" }],
  itemPhotoCount: 1,
  receiptPhotoCount: 1,
  savedAt: "2026-05-12T00:00:00.000Z",
  ...over
});

// Every on/off combination of the six switches. The privacy guarantees below
// are only worth anything if they hold across all of them, not just the
// defaults and the everything-on case.
const toggleKeys = shareFieldGroups.map((group) => group.key);
const everySettingsCombination = Array.from({ length: 2 ** toggleKeys.length }, (_, mask) => {
  const settings = { ...defaultShareSettings, visibility: "unlisted" };
  toggleKeys.forEach((key, index) => {
    settings[key] = Boolean(mask & (1 << index));
  });
  return settings;
});

describe("buildPublicItem field allowlist", () => {
  // The load-bearing test. buildPublicItem copies named fields rather than
  // spreading the row, so a column added to inventory_items later cannot
  // reach a public page without someone also adding it to publicItemFields --
  // at which point they have to think about whether it belongs there.
  it("never emits a key outside the allowlist, under any combination of settings", () => {
    everySettingsCombination.forEach((settings) => {
      const keys = Object.keys(buildPublicItem(privateItem(), settings));
      const unexpected = keys.filter((key) => !publicItemFields.includes(key));
      expect(unexpected).toEqual([]);
    });
  });

  it("emits only the shelf fields when every switch is off", () => {
    const keys = Object.keys(buildPublicItem(privateItem(), defaultShareSettings));
    const unexpected = keys.filter((key) => !alwaysPublicItemFields.includes(key));
    expect(unexpected).toEqual([]);
  });

  it("never publishes a receipt photo path, under any combination of settings", () => {
    everySettingsCombination.forEach((settings) => {
      const serialized = JSON.stringify(buildPublicItem(privateItem(), settings));
      expect(serialized).not.toContain("receipt.jpg");
      expect(serialized).not.toContain("receiptPhotos");
    });
  });

  it("never publishes the reference number, under any combination of settings", () => {
    everySettingsCombination.forEach((settings) => {
      expect(buildPublicItem(privateItem(), settings).referenceNumber).toBeUndefined();
    });
  });

  it("reports that a receipt exists without exposing it", () => {
    expect(buildPublicItem(privateItem(), defaultShareSettings).hasReceipt).toBe(true);
    expect(buildPublicItem(privateItem({ receiptPhotos: [], receiptPhotoCount: 0 }), defaultShareSettings).hasReceipt).toBe(false);
  });

  it("publishes both halves of the credit line", () => {
    const result = buildPublicItem(privateItem(), defaultShareSettings);
    expect(result.author).toBe("Stephen King");
    expect(result.maker).toBe("Donald M. Grant");
  });

  it("publishes item photos as path and name only", () => {
    expect(buildPublicItem(privateItem(), defaultShareSettings).photos).toEqual([{ path: "user/item/front.jpg", name: "front.jpg" }]);
  });
});

describe("buildPublicItem opt-in groups", () => {
  it("withholds every money, provenance, and notes field by default", () => {
    const result = buildPublicItem(privateItem(), defaultShareSettings);
    expect(result.estimatedValue).toBeUndefined();
    expect(result.purchasePrice).toBeUndefined();
    expect(result.soldPrice).toBeUndefined();
    expect(result.purchaseDate).toBeUndefined();
    expect(result.source).toBeUndefined();
    expect(result.notes).toBeUndefined();
  });

  it("publishes the estimate only when that switch is on", () => {
    expect(buildPublicItem(privateItem(), { ...defaultShareSettings, showEstimatedValue: true }).estimatedValue).toBe("850");
  });

  // "What it's worth" and "what I paid" are separate switches: an estimate is
  // a flex, a purchase price is negotiating leverage.
  it("keeps the purchase price private when only the estimate is shared", () => {
    const result = buildPublicItem(privateItem(), { ...defaultShareSettings, showEstimatedValue: true });
    expect(result.purchasePrice).toBeUndefined();
  });

  it("publishes purchase and sale prices together under one switch", () => {
    const sold = privateItem({ status: "Sold", soldPrice: "1200", soldDate: "2026-07-01" });
    const result = buildPublicItem(sold, { ...defaultShareSettings, showPrices: true });
    expect(result.purchasePrice).toBe("45");
    expect(result.soldPrice).toBe("1200");
    expect(result.soldDate).toBe("2026-07-01");
  });

  it("publishes provenance only when that switch is on", () => {
    const result = buildPublicItem(privateItem(), { ...defaultShareSettings, showProvenance: true });
    expect(result.purchaseDate).toBe("2026-05-12");
    expect(result.source).toBe("Ferndale Books, back room");
  });

  it("publishes notes only when that switch is on", () => {
    expect(buildPublicItem(privateItem(), { ...defaultShareSettings, showNotes: true }).notes).toContain("safe in the study");
  });

  it("omits empty optional fields rather than publishing blanks", () => {
    const sparse = privateItem({ estimatedValue: "", purchasePrice: "", source: "", notes: "" });
    const result = buildPublicItem(sparse, { showEstimatedValue: true, showPrices: true, showProvenance: true, showNotes: true });
    expect("estimatedValue" in result).toBe(false);
    expect("purchasePrice" in result).toBe(false);
    expect("source" in result).toBe(false);
    expect("notes" in result).toBe(false);
  });

  // 0 is a real estimate ("worth nothing"), "" is no estimate at all -- the
  // same null-vs-zero distinction the database schema is careful about.
  it("treats a zero estimate as a real value", () => {
    expect(buildPublicItem(privateItem({ estimatedValue: "0" }), { showEstimatedValue: true }).estimatedValue).toBe("0");
  });
});

describe("isItemShared", () => {
  it("includes active items", () => {
    expect(isItemShared(privateItem({ status: "Owned" }), defaultShareSettings)).toBe(true);
    expect(isItemShared(privateItem({ status: "For sale" }), defaultShareSettings)).toBe(true);
    expect(isItemShared(privateItem({ status: "Researching" }), defaultShareSettings)).toBe(true);
  });

  it("excludes sold and wishlist items until they are opted in", () => {
    expect(isItemShared(privateItem({ status: "Sold" }), defaultShareSettings)).toBe(false);
    expect(isItemShared(privateItem({ status: "Wishlist" }), defaultShareSettings)).toBe(false);
    expect(isItemShared(privateItem({ status: "Sold" }), { ...defaultShareSettings, showSold: true })).toBe(true);
    expect(isItemShared(privateItem({ status: "Wishlist" }), { ...defaultShareSettings, showWishlist: true })).toBe(true);
  });

  // The per-item escape hatch has to win over everything, including a preset
  // that turns each group on.
  it("excludes a hidden item even with every switch on", () => {
    const allOn = everySettingsCombination[everySettingsCombination.length - 1];
    expect(isItemShared(privateItem({ hiddenFromShare: true }), allOn)).toBe(false);
    expect(isItemShared(privateItem({ status: "Sold", hiddenFromShare: true }), allOn)).toBe(false);
  });
});

describe("buildPublicCollection", () => {
  const items = [
    privateItem({ id: "a", status: "Owned" }),
    privateItem({ id: "b", status: "Sold" }),
    privateItem({ id: "c", status: "Wishlist" }),
    privateItem({ id: "d", hiddenFromShare: true })
  ];

  it("returns only the shared items", () => {
    expect(buildPublicCollection(items, defaultShareSettings).items.map((item) => item.id)).toEqual(["a"]);
  });

  it("honours the sold and wishlist switches", () => {
    const settings = { ...defaultShareSettings, showSold: true, showWishlist: true };
    expect(buildPublicCollection(items, settings).items.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("falls back to the owner's name when no title is set", () => {
    expect(buildPublicCollection(items, defaultShareSettings, { ownerName: "Dennies" }).title).toBe("Dennies's collection");
  });

  it("prefers the title the owner typed", () => {
    const settings = { ...defaultShareSettings, title: "  Modern Firsts  " };
    expect(buildPublicCollection(items, settings, { ownerName: "Dennies" }).title).toBe("Modern Firsts");
  });

  it("has a title even with no owner name to fall back on", () => {
    expect(buildPublicCollection(items, defaultShareSettings).title).toBe("A FirstFinder collection");
  });

  it("tolerates a missing inventory", () => {
    expect(buildPublicCollection(undefined, defaultShareSettings).items).toEqual([]);
  });
});

describe("summarizeCollection", () => {
  it("counts items and true firsts", () => {
    const publicItems = [
      { bookEdition: "First", bookPrinting: "First", condition: "Near Fine/Fine" },
      { bookEdition: "First", bookPrinting: "Second", condition: "" },
      { bookEdition: "", bookPrinting: "", condition: "Fair" }
    ];
    expect(summarizeCollection(publicItems)).toEqual({ itemCount: 3, firstEditionCount: 1, gradedCount: 2 });
  });

  // No money in the summary, ever -- see the comment on summarizeCollection.
  it("reports no totals of any kind", () => {
    const summary = summarizeCollection([{ estimatedValue: "850", purchasePrice: "45" }]);
    expect(Object.keys(summary)).toEqual(["itemCount", "firstEditionCount", "gradedCount"]);
  });

  it("reads naturally for one item", () => {
    expect(summaryLine({ itemCount: 1, firstEditionCount: 1 })).toBe("1 item · 1 first edition");
    expect(summaryLine({ itemCount: 12, firstEditionCount: 0 })).toBe("12 items");
  });
});

describe("presets", () => {
  it("matches the default settings to Showcase", () => {
    expect(matchingPresetId(defaultShareSettings)).toBe("showcase");
  });

  it("reports no preset once the switches are customised", () => {
    expect(matchingPresetId({ ...defaultShareSettings, showPrices: true })).toBe(null);
  });

  it("round-trips every preset", () => {
    sharePresets.forEach((preset) => {
      expect(matchingPresetId(applyPreset(defaultShareSettings, preset.id))).toBe(preset.id);
    });
  });

  it("leaves the title and visibility alone when a preset is applied", () => {
    const settings = { ...defaultShareSettings, visibility: "listed", title: "Modern Firsts" };
    const applied = applyPreset(settings, "ledger");
    expect(applied.visibility).toBe("listed");
    expect(applied.title).toBe("Modern Firsts");
  });

  it("ignores an unknown preset id", () => {
    expect(applyPreset(defaultShareSettings, "nope")).toEqual(defaultShareSettings);
  });
});

describe("share slugs", () => {
  const sequentialBytes = (size) => Uint8Array.from({ length: size }, (_, index) => index);

  it("produces a slug of the expected length and alphabet", () => {
    const slug = generateShareSlug(sequentialBytes);
    expect(slug).toHaveLength(SLUG_LENGTH);
    expect(isValidShareSlug(slug)).toBe(true);
  });

  // Characters that get misread in a screenshot or read aloud over a table.
  it("leaves out the ambiguous characters", () => {
    const slug = generateShareSlug((size) => globalThis.crypto.getRandomValues(new Uint8Array(size)));
    expect(slug).not.toMatch(/[0O1lI]/);
  });

  it("rejects slugs that are the wrong shape", () => {
    expect(isValidShareSlug("")).toBe(false);
    expect(isValidShareSlug("short")).toBe(false);
    expect(isValidShareSlug("a".repeat(SLUG_LENGTH - 1))).toBe(false);
    expect(isValidShareSlug(`${"a".repeat(SLUG_LENGTH - 1)}0`)).toBe(false);
    expect(isValidShareSlug(null)).toBe(false);
  });

  it("does not repeat itself", () => {
    const slugs = new Set(Array.from({ length: 200 }, () => generateShareSlug()));
    expect(slugs.size).toBe(200);
  });
});


// ---------------------------------------------------------------------------
// The public wishlist
// ---------------------------------------------------------------------------

// A want with something recognisable in every withheld field, so a leak shows
// up as a findable string rather than an empty default.
const privateWant = (over = {}) => ({
  id: "want-1",
  name: "Blood Meridian",
  maker: "Cormac McCarthy",
  category: "Book",
  wantedEdition: "First",
  wantedPrinting: "First",
  publisher: "Random House, 1985",
  minCondition: "Near Fine/Fine",
  jacketRequirement: "required",
  signatureRequirement: "any",
  maxPrice: "3500",
  preferredSource: "LEAK-preferred-seller",
  priority: "grail",
  upgradeForItemId: "LEAK-item-id",
  notes: "LEAK-notes",
  hiddenFromShare: false,
  foundAt: "",
  createdAt: "2026-03-01T00:00:00Z",
  ...over
});

const allOn = {
  ...defaultShareSettings,
  visibility: "unlisted",
  showEstimatedValue: true,
  showPrices: true,
  showProvenance: true,
  showNotes: true,
  showSold: true,
  showWishlist: true
};

describe("buildPublicWant", () => {
  it("emits nothing outside the declared field list, even with every toggle on", () => {
    const want = buildPublicWant(privateWant(), allOn);
    Object.keys(want).forEach((key) => {
      expect(publicWantFields).toContain(key);
    });
  });

  // The whole reason a ceiling is a column and not a toggle: it is a
  // negotiating position, and no setting may publish it.
  it("never publishes the maximum price under any setting", () => {
    const want = buildPublicWant(privateWant(), allOn);
    expect(want.maxPrice).toBeUndefined();
    expect(JSON.stringify(want)).not.toContain("3500");
  });

  // The same leak in words instead of dollars: "grail" tells a seller you
  // will stretch.
  it("never publishes the priority", () => {
    const want = buildPublicWant(privateWant(), allOn);
    expect(want.priority).toBeUndefined();
    expect(JSON.stringify(want)).not.toContain("grail");
  });

  it("never publishes the collector's own operational fields", () => {
    const serialized = JSON.stringify(buildPublicWant(privateWant(), allOn));
    expect(serialized).not.toContain("LEAK-preferred-seller");
    expect(serialized).not.toContain("LEAK-item-id");
  });

  it("publishes the specification, which is the point of the page", () => {
    const want = buildPublicWant(privateWant(), allOn);
    expect(want.wantedEdition).toBe("First");
    expect(want.wantedPrinting).toBe("First");
    expect(want.publisher).toBe("Random House, 1985");
    expect(want.minCondition).toBe("Near Fine/Fine");
    expect(want.jacketRequirement).toBe("required");
    expect(want.wantedSince).toBe("2026-03-01T00:00:00Z");
  });

  it("gates notes behind the same toggle item notes use", () => {
    expect(buildPublicWant(privateWant(), allOn).notes).toBe("LEAK-notes");
    expect(buildPublicWant(privateWant(), { ...allOn, showNotes: false }).notes).toBeUndefined();
  });
});

describe("isWantShared", () => {
  it("publishes nothing until the collector switches the wishlist on", () => {
    expect(isWantShared(privateWant(), { ...allOn, showWishlist: false })).toBe(false);
    expect(isWantShared(privateWant(), allOn)).toBe(true);
  });

  it("honours the per-want opt-out", () => {
    expect(isWantShared(privateWant({ hiddenFromShare: true }), allOn)).toBe(false);
  });

  // The copy is in the collection now. Publishing it here too would list the
  // same book twice, once as owned and once as wanted.
  it("drops a want once it has been found", () => {
    expect(isWantShared(privateWant({ foundAt: "2026-06-01T00:00:00Z" }), allOn)).toBe(false);
  });

  it("is false for nothing at all", () => {
    expect(isWantShared(null, allOn)).toBe(false);
  });
});

describe("buildPublicWishlist", () => {
  it("filters and builds in one pass", () => {
    const wants = [
      privateWant({ id: "open" }),
      privateWant({ id: "hidden", hiddenFromShare: true }),
      privateWant({ id: "found", foundAt: "2026-06-01T00:00:00Z" })
    ];
    expect(buildPublicWishlist(wants, allOn).map((want) => want.id)).toEqual(["open"]);
  });

  it("publishes nothing when the wishlist is switched off", () => {
    expect(buildPublicWishlist([privateWant()], defaultShareSettings)).toEqual([]);
  });

  it("copes with no wishlist at all", () => {
    expect(buildPublicWishlist(undefined, allOn)).toEqual([]);
  });
});
