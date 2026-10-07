import { describe, expect, it } from "vitest";
import { features } from "../content/features";
import { formatFeatureDate, groupFeaturesByMonth } from "./features";

describe("groupFeaturesByMonth", () => {
  it("groups by month, newest month and newest entry first", () => {
    const groups = groupFeaturesByMonth([
      { date: "2026-08-01", title: "A" },
      { date: "2026-09-12", title: "B" },
      { date: "2026-08-07", title: "C" }
    ]);
    expect(groups.map((g) => g.label)).toEqual(["September 2026", "August 2026"]);
    expect(groups[1].entries.map((e) => e.title)).toEqual(["C", "A"]);
  });

  it("handles an empty list", () => {
    expect(groupFeaturesByMonth([])).toEqual([]);
    expect(groupFeaturesByMonth(undefined)).toEqual([]);
  });
});

describe("formatFeatureDate", () => {
  // Read in local time, a US browser would turn the 1st into the 31st.
  it("prints the calendar day it was given, in any time zone", () => {
    expect(formatFeatureDate("2026-08-01")).toBe("Aug 1, 2026");
  });
});

describe("the Features page content", () => {
  it("gives every entry a real date, a title, a description, and its PRs", () => {
    for (const entry of features) {
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(new Date(`${entry.date}T00:00:00Z`).getTime())).toBe(false);
      expect(entry.title.trim()).not.toBe("");
      expect(entry.description.trim()).not.toBe("");
      expect(entry.prs.length).toBeGreaterThan(0);
    }
  });

  it("is kept newest first, so the file reads the way the page does", () => {
    const dates = features.map((entry) => entry.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });
});
