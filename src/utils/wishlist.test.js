import { describe, it, expect } from "vitest";
import {
  emptyWant,
  priorityOptions,
  priorityLabel,
  isWantSaveable,
  meetsConditionFloor,
  describeCriteria,
  sortWants,
  openWants,
  foundWants,
  summarizeWants,
  buildWantSearchLinks,
  wantToItem,
  compareToCeiling
} from "./wishlist";

const want = (over = {}) => ({ ...emptyWant, id: "w1", name: "Blood Meridian", maker: "Cormac McCarthy", ...over });

describe("isWantSaveable", () => {
  // A collector who knows only "a first of Suttree, eventually" should not have
  // to fill in a form before the app will remember it.
  it("needs a name and nothing else", () => {
    expect(isWantSaveable(want({ name: "Suttree" }))).toBe(true);
    expect(isWantSaveable({ ...emptyWant, name: "" })).toBe(false);
    expect(isWantSaveable({ ...emptyWant, name: "   " })).toBe(false);
    expect(isWantSaveable(undefined)).toBe(false);
  });
});

describe("meetsConditionFloor", () => {
  it("accepts the floor and everything better", () => {
    expect(meetsConditionFloor("Near Fine/Fine", "Very Good/Good")).toBe(true);
    expect(meetsConditionFloor("Very Good/Good", "Very Good/Good")).toBe(true);
  });

  it("rejects what falls below it", () => {
    expect(meetsConditionFloor("Fair", "Very Good/Good")).toBe(false);
    expect(meetsConditionFloor("Poor", "Near Fine/Fine")).toBe(false);
  });

  // No stated minimum cannot exclude anything.
  it("accepts everything when no floor is set", () => {
    expect(meetsConditionFloor("Poor", "")).toBe(true);
    expect(meetsConditionFloor("", "")).toBe(true);
  });

  // Most listings say nothing about condition. Treating silence as "Poor"
  // would hide half the market from someone who set a floor.
  it("does not treat an ungraded copy as a failure", () => {
    expect(meetsConditionFloor("", "Near Fine/Fine")).toBe(true);
    expect(meetsConditionFloor("Reading copy", "Near Fine/Fine")).toBe(true);
  });
});

describe("describeCriteria", () => {
  it("phrases the spec the way a collector would say it", () => {
    const chips = describeCriteria(
      want({
        wantedEdition: "First",
        wantedPrinting: "First",
        publisher: "Random House, 1985",
        jacketRequirement: "required",
        minCondition: "Near Fine/Fine",
        signatureRequirement: "signed"
      })
    );
    expect(chips.map((chip) => chip.text)).toEqual([
      "First edition · First printing",
      "Random House, 1985",
      "Jacket required",
      "Near Fine/Fine or better",
      "Signed"
    ]);
  });

  // withClarifyingWord's job: a field typed as just "First" reads as "First
  // edition", but "First edition" is not turned into "First edition edition".
  it("does not double a noun the collector already typed", () => {
    const chips = describeCriteria(want({ wantedEdition: "First edition", wantedPrinting: "Second printing" }));
    expect(chips[0].text).toBe("First edition · Second printing");
  });

  // "Don't mind" is the absence of a criterion, so it must not render as one.
  it("says nothing about requirements that were not set", () => {
    const chips = describeCriteria(want({ jacketRequirement: "any", signatureRequirement: "any" }));
    expect(chips).toEqual([]);
  });

  it("renders a lone printing without inventing an edition", () => {
    const chips = describeCriteria(want({ wantedPrinting: "First" }));
    expect(chips.map((chip) => chip.text)).toEqual(["First printing"]);
  });
});

describe("sortWants", () => {
  const wants = [
    want({ id: "a", priority: "someday", createdAt: "2026-01-01" }),
    want({ id: "b", priority: "grail", createdAt: "2026-02-01" }),
    want({ id: "c", priority: "hunting", createdAt: "2026-03-01" }),
    want({ id: "d", priority: "grail", createdAt: "2026-04-01" })
  ];

  it("puts grails first and newest first within a priority", () => {
    expect(sortWants(wants).map((row) => row.id)).toEqual(["d", "b", "c", "a"]);
  });

  it("treats a want with no priority as actively hunting rather than last", () => {
    const mixed = [want({ id: "none", priority: "", createdAt: "2026-05-01" }), want({ id: "s", priority: "someday", createdAt: "2026-06-01" })];
    expect(sortWants(mixed).map((row) => row.id)).toEqual(["none", "s"]);
  });

  it("leaves the caller's array alone", () => {
    const original = [...wants];
    sortWants(wants);
    expect(wants).toEqual(original);
  });
});

describe("openWants / foundWants", () => {
  const wants = [want({ id: "open" }), want({ id: "found", foundAt: "2026-06-01T00:00:00Z" })];

  // A found want is kept, not deleted: how long something was hunted is the
  // interesting half of collecting.
  it("splits the hunt from its history", () => {
    expect(openWants(wants).map((row) => row.id)).toEqual(["open"]);
    expect(foundWants(wants).map((row) => row.id)).toEqual(["found"]);
  });
});

describe("summarizeWants", () => {
  const wants = [
    want({ id: "a", priority: "grail", maxPrice: "3500" }),
    want({ id: "b", priority: "hunting", maxPrice: "450", upgradeForItemId: "item-1" }),
    want({ id: "c", priority: "someday" }),
    want({ id: "d", foundAt: "2026-06-01T00:00:00Z", maxPrice: "9999" })
  ];

  it("counts and totals only what is still being hunted", () => {
    const summary = summarizeWants(wants);
    expect(summary.openCount).toBe(3);
    expect(summary.foundCount).toBe(1);
    // The found want's ceiling is excluded -- that hunt is over.
    expect(summary.ceilingTotal).toBe(3950);
    expect(summary.withCeiling).toBe(2);
    expect(summary.grailCount).toBe(1);
    expect(summary.upgradeCount).toBe(1);
  });

  it("reports zeros rather than blanks for an empty wishlist", () => {
    expect(summarizeWants([])).toEqual({
      openCount: 0,
      foundCount: 0,
      ceilingTotal: 0,
      withCeiling: 0,
      grailCount: 0,
      upgradeCount: 0
    });
  });
});

describe("buildWantSearchLinks", () => {
  it("searches for the copy wanted, not the copy owned", () => {
    const links = buildWantSearchLinks(want({ wantedEdition: "First", wantedPrinting: "First" }));
    expect(decodeURIComponent(links.abebooks)).toContain("Blood Meridian Cormac McCarthy First edition First printing");
    expect(links.ebay).toContain("ebay.com");
  });

  // A signature requirement is a search term, not only a display preference --
  // it is what surfaces the listings worth looking at.
  it("puts a signature requirement into the query", () => {
    const links = buildWantSearchLinks(want({ signatureRequirement: "inscribed" }));
    expect(decodeURIComponent(links.abebooks)).toContain("inscribed");
  });

  it("leaves 'any' out of the query", () => {
    const links = buildWantSearchLinks(want({ signatureRequirement: "any" }));
    expect(decodeURIComponent(links.abebooks)).not.toContain("any");
  });

  it("returns nothing to search when there is nothing to search for", () => {
    expect(buildWantSearchLinks({ ...emptyWant })).toBeNull();
  });
});

describe("wantToItem", () => {
  const source = want({
    wantedEdition: "First",
    wantedPrinting: "First",
    maxPrice: "3500",
    priority: "grail",
    minCondition: "Near Fine/Fine",
    notes: "Jacket must be unrestored.",
    preferredSource: "US sellers"
  });

  it("carries across what the collector already established", () => {
    const item = wantToItem(source, { condition: "Very Good/Good", purchasePrice: "2850", source: "Between the Covers" });
    expect(item.name).toBe("Blood Meridian");
    expect(item.maker).toBe("Cormac McCarthy");
    expect(item.bookEdition).toBe("First");
    expect(item.bookPrinting).toBe("First");
    expect(item.status).toBe("Owned");
    expect(item.notes).toBe("Jacket must be unrestored.");
    expect(item.purchasePrice).toBe("2850");
    expect(item.source).toBe("Between the Covers");
  });

  // The criteria described a search, and the search is over. Carrying the
  // ceiling or the priority onto an owned item would be recording a hope as a
  // fact.
  it("leaves the criteria behind", () => {
    const item = wantToItem(source, { condition: "Very Good/Good" });
    expect(item.maxPrice).toBeUndefined();
    expect(item.priority).toBeUndefined();
    expect(item.minCondition).toBeUndefined();
  });

  // "At worst Near Fine" is not a grade. Seeding it would put a condition in
  // the collection that nobody actually checked.
  it("never guesses the condition from the floor that was set", () => {
    expect(wantToItem(source, {}).condition).toBe("");
  });

  it("falls back to the preferred seller only when no real one was given", () => {
    expect(wantToItem(source, {}).source).toBe("US sellers");
    expect(wantToItem(source, { source: "Heritage" }).source).toBe("Heritage");
  });

  it("does not put book fields on a non-book want", () => {
    const card = wantToItem(want({ category: "Trading card", wantedEdition: "1952 Topps" }), {});
    expect(card.bookEdition).toBe("");
    expect(card.bookPrinting).toBe("");
  });
});

describe("compareToCeiling", () => {
  it("reports coming in under", () => {
    expect(compareToCeiling(want({ maxPrice: "3500" }), "2850")).toEqual({
      ceiling: 3500,
      paid: 2850,
      difference: 650,
      under: true
    });
  });

  it("reports going over", () => {
    const result = compareToCeiling(want({ maxPrice: "3500" }), "3900");
    expect(result.under).toBe(false);
    expect(result.difference).toBe(400);
  });

  // The limit was "won't pay over", so paying exactly it is keeping to it.
  it("counts paying exactly the ceiling as under it", () => {
    expect(compareToCeiling(want({ maxPrice: "3500" }), "3500").under).toBe(true);
  });

  it("has nothing to say when no ceiling was set or nothing was paid", () => {
    expect(compareToCeiling(want({ maxPrice: "" }), "2850")).toBeNull();
    expect(compareToCeiling(want({ maxPrice: "3500" }), "")).toBeNull();
  });
});

describe("priorityLabel", () => {
  it("names each priority", () => {
    expect(priorityOptions.map((option) => option.value)).toEqual(["grail", "hunting", "someday"]);
    expect(priorityLabel("grail")).toBe("Grail");
    expect(priorityLabel("someday")).toBe("Someday");
  });

  it("falls back rather than rendering a blank chip", () => {
    expect(priorityLabel("")).toBe("Actively hunting");
    expect(priorityLabel("nonsense")).toBe("Actively hunting");
  });
});
