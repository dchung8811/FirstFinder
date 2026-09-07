import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { monthLabel, monthlyBuckets, applyDashboardFilters, dashboardDateFor, dashboardRangeStart } from "./dashboard";

describe("monthLabel", () => {
  it("renders a bucket key as a short month and year", () => {
    expect(monthLabel("2026-01")).toBe("Jan 26");
    expect(monthLabel("2026-12")).toBe("Dec 26");
  });
});

describe("monthlyBuckets", () => {
  const item = (purchaseDate, purchasePrice) => ({ purchaseDate, purchasePrice });

  it("returns nothing when no item carries a usable date", () => {
    expect(monthlyBuckets([item("", "10"), item("nonsense", "10")], "purchaseDate", "purchasePrice")).toEqual([]);
    expect(monthlyBuckets([], "purchaseDate", "purchasePrice")).toEqual([]);
  });

  it("counts and sums the items in a month", () => {
    const buckets = monthlyBuckets(
      [item("2026-01-05", "10"), item("2026-01-20", "15")],
      "purchaseDate",
      "purchasePrice"
    );
    expect(buckets).toHaveLength(1);
    expect(buckets[0]).toMatchObject({ key: "2026-01", count: 2, amount: 25 });
  });

  // Collapsing empty months would turn an 18-month gap into a single tick and
  // misrepresent the pace of collecting.
  it("fills in the months where nothing happened", () => {
    const buckets = monthlyBuckets(
      [item("2026-01-05", "10"), item("2026-03-05", "20")],
      "purchaseDate",
      "purchasePrice"
    );
    expect(buckets.map((bucket) => bucket.key)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(buckets[1]).toMatchObject({ count: 0, amount: 0 });
  });

  it("spans a year boundary", () => {
    const buckets = monthlyBuckets(
      [item("2025-11-05", "10"), item("2026-02-05", "20")],
      "purchaseDate",
      "purchasePrice"
    );
    expect(buckets.map((bucket) => bucket.key)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });

  it("ignores items with no date rather than bucketing them somewhere wrong", () => {
    const buckets = monthlyBuckets(
      [item("2026-01-05", "10"), item("", "999")],
      "purchaseDate",
      "purchasePrice"
    );
    expect(buckets).toHaveLength(1);
    expect(buckets[0].amount).toBe(10);
  });
});

describe("dashboardDateFor", () => {
  // "This year" has to mean the same thing on every panel: what I did this
  // year. A sold item belongs to the period it sold in, not when it was bought.
  it("uses the sale date for a sold item", () => {
    expect(dashboardDateFor({ status: "Sold", soldDate: "2026-06-01", purchaseDate: "2020-01-01" })).toBe("2026-06-01");
  });

  it("uses the purchase date for anything still held", () => {
    expect(dashboardDateFor({ status: "Owned", soldDate: "", purchaseDate: "2020-01-01" })).toBe("2020-01-01");
  });
});

describe("applyDashboardFilters", () => {
  const inventory = [
    { category: "Book", status: "Owned", purchaseDate: "2026-08-01", soldDate: "" },
    { category: "Book", status: "Owned", purchaseDate: "2019-01-01", soldDate: "" },
    { category: "Comic", status: "Owned", purchaseDate: "2026-08-01", soldDate: "" },
    { category: "Book", status: "Owned", purchaseDate: "", soldDate: "" }
  ];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-07T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns everything when nothing is filtered", () => {
    const { visible, undatedExcluded } = applyDashboardFilters(inventory, "", "all");
    expect(visible).toHaveLength(4);
    expect(undatedExcluded).toBe(0);
  });

  it("filters by category", () => {
    expect(applyDashboardFilters(inventory, "Comic", "all").visible).toHaveLength(1);
  });

  it("filters by period", () => {
    const { visible } = applyDashboardFilters(inventory, "", "12m");
    expect(visible).toHaveLength(2);
  });

  it("scopes year-to-date to this calendar year", () => {
    const { visible } = applyDashboardFilters(inventory, "", "ytd");
    expect(visible.every((entry) => entry.purchaseDate.startsWith("2026"))).toBe(true);
  });

  // Undated items genuinely cannot belong to "this year", but dropping them
  // silently would make the totals look wrong for no visible reason.
  it("reports how many items were dropped for having no date", () => {
    expect(applyDashboardFilters(inventory, "", "12m").undatedExcluded).toBe(1);
  });

  it("does not drop undated items when no period is applied", () => {
    expect(applyDashboardFilters(inventory, "", "all").undatedExcluded).toBe(0);
  });

  it("combines a category and a period", () => {
    const { visible } = applyDashboardFilters(inventory, "Book", "12m");
    expect(visible).toHaveLength(1);
  });
});

describe("dashboardRangeStart", () => {
  it("has no start for all time", () => {
    expect(dashboardRangeStart("all")).toBe(null);
  });

  it("has no start for a range it does not recognise", () => {
    expect(dashboardRangeStart("nonsense")).toBe(null);
  });

  it("starts a year-to-date range on January 1", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-07T12:00:00Z"));
    const start = dashboardRangeStart("ytd");
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(0);
    expect(start.getDate()).toBe(1);
    vi.useRealTimers();
  });
});
