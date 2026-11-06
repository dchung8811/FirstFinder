import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { AUTO_HIDE_REPORTERS, REPORT_DAILY_LIMIT, buildBlockList, groupReportsByOwner, isUuid, shouldAutoHide, shouldFileBlockReport, validateReport } from "./contentReports";
import { generateShareSlug } from "./publicCollection";

const slug = generateShareSlug();
const itemId = "11111111-2222-4333-8444-555555555555";

describe("validateReport", () => {
  it("accepts a report and trims the details", () => {
    expect(validateReport({ slug, reason: "spam", details: "  ads  ", itemId })).toEqual({
      ok: true,
      value: { slug, reason: "spam", details: "ads", itemId }
    });
  });

  it("does not require an item or details", () => {
    expect(validateReport({ slug, reason: "other" }).value).toEqual({ slug, reason: "other", details: "", itemId: null });
  });

  it("refuses a malformed slug, so the column only sees the expected shape", () => {
    expect(validateReport({ slug: "../../etc", reason: "spam" }).ok).toBe(false);
    expect(validateReport({ reason: "spam" }).ok).toBe(false);
    expect(validateReport(null).ok).toBe(false);
  });

  it("refuses unknown reasons, including the one only a block may file", () => {
    expect(validateReport({ slug, reason: "because" }).ok).toBe(false);
    expect(validateReport({ slug, reason: "blocked" }).ok).toBe(false);
  });

  it("refuses a bad item id and over-long details", () => {
    expect(validateReport({ slug, reason: "spam", itemId: "1 or 1=1" }).ok).toBe(false);
    expect(validateReport({ slug, reason: "spam", details: "x".repeat(1001) }).ok).toBe(false);
  });
});

describe("isUuid", () => {
  it("knows one when it sees one", () => {
    expect(isUuid(itemId)).toBe(true);
    expect(isUuid("nope")).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});

describe("shouldAutoHide", () => {
  const reports = (ids, reason = "offensive") => ids.map((reporter_id) => ({ reporter_id, reason }));

  it("takes the page down at the threshold, not before", () => {
    const people = Array.from({ length: AUTO_HIDE_REPORTERS }, (_, index) => `person-${index}`);
    expect(shouldAutoHide(reports(people.slice(1)))).toBe(false);
    expect(shouldAutoHide(reports(people))).toBe(true);
  });

  it("counts people, so one account can't do it alone", () => {
    expect(shouldAutoHide(reports(Array(10).fill("same-person")))).toBe(false);
  });

  it("doesn't count blocks or reporters whose accounts are gone", () => {
    expect(shouldAutoHide(reports(["a", "b", "c"], "blocked"))).toBe(false);
    expect(shouldAutoHide(reports([null, null, null]))).toBe(false);
  });
});

describe("shouldFileBlockReport", () => {
  it("files the first block of a page", () => {
    expect(shouldFileBlockReport({ reportsToday: 0, openBlockReports: 0 })).toBe(true);
  });

  it("doesn't file again while this person's last one is still open, however often they re-block", () => {
    expect(shouldFileBlockReport({ reportsToday: 1, openBlockReports: 1 })).toBe(false);
  });

  it("stops at the daily limit, so re-blocking after a dismissal can't fill the queue", () => {
    expect(shouldFileBlockReport({ reportsToday: REPORT_DAILY_LIMIT - 1, openBlockReports: 0 })).toBe(true);
    expect(shouldFileBlockReport({ reportsToday: REPORT_DAILY_LIMIT, openBlockReports: 0 })).toBe(false);
  });

  it("treats a missing count as none", () => {
    expect(shouldFileBlockReport({ reportsToday: null, openBlockReports: null })).toBe(true);
  });
});

describe("buildBlockList", () => {
  const block = { id: "b1", owner_id: "owner", slug_at_block: "old-slug" };

  it("shows a listed page, even at a new slug, because that link is public", () => {
    expect(buildBlockList([block], [{ user_id: "owner", slug: "new-slug", title: " Shelf ", visibility: "listed" }]))
      .toEqual([{ id: "b1", slug: "new-slug", title: "Shelf" }]);
  });

  it("shows an unlisted page only at the link the blocker already had", () => {
    expect(buildBlockList([block], [{ user_id: "owner", slug: "old-slug", title: "Shelf", visibility: "unlisted" }]))
      .toEqual([{ id: "b1", slug: "old-slug", title: "Shelf" }]);
  });

  it("never reveals a reset unlisted link or its title", () => {
    expect(buildBlockList([block], [{ user_id: "owner", slug: "new-slug", title: "Shelf", visibility: "unlisted" }]))
      .toEqual([{ id: "b1", slug: null, title: "A collector" }]);
  });

  it("keeps the block when the page is off or gone, so it can still be undone", () => {
    expect(buildBlockList([block], [{ user_id: "owner", slug: "old-slug", title: "Shelf", visibility: "off" }]))
      .toEqual([{ id: "b1", slug: null, title: "A collector" }]);
    expect(buildBlockList([block], [])).toEqual([{ id: "b1", slug: null, title: "A collector" }]);
  });

  it("never returns the owner's account id", () => {
    const [entry] = buildBlockList([block], [{ user_id: "owner", slug: "old-slug", title: "Shelf", visibility: "listed" }]);
    expect(JSON.stringify(entry)).not.toContain("owner");
  });
});

describe("groupReportsByOwner", () => {
  it("makes one card per page, in the order reports arrived", () => {
    const groups = groupReportsByOwner(
      [
        { id: "r3", owner_id: "b", slug: "s-b", reason: "spam", details: "", created_at: "3" },
        { id: "r2", owner_id: "a", slug: "s-a", reason: "other", details: "x", created_at: "2" },
        { id: "r1", owner_id: "b", slug: "s-b", reason: "offensive", details: "", created_at: "1" }
      ],
      [{ user_id: "b", slug: "current", title: "Bee" }]
    );
    expect(groups.map((group) => group.ownerId)).toEqual(["b", "a"]);
    expect(groups[0]).toMatchObject({ slug: "current", title: "Bee" });
    expect(groups[0].reports.map((report) => report.id)).toEqual(["r3", "r1"]);
    expect(groups[1]).toMatchObject({ slug: "s-a", title: "Untitled collection" });
  });
});

// A takedown only means something if every public way to a page checks it. Read
// as text, like the other wiring tests: importing the module would drag in the
// Supabase admin client.
describe("takedown wiring", () => {
  const source = readFileSync(resolve(process.cwd(), "src/lib/sharedCollection.js"), "utf8");

  it.each(["sharedCollectionExists", "loadSharedCollection", "listListedCollectionSlugs", "loadExploreCollections"])(
    "%s checks for a takedown",
    (name) => {
      const start = source.indexOf(`export async function ${name}`);
      expect(start).toBeGreaterThan(-1);
      const next = source.indexOf("\nexport ", start + 1);
      const body = source.slice(start, next === -1 ? undefined : next);
      expect(body).toMatch(/isOwnerHidden|loadHiddenOwnerIds/);
    }
  );
});
