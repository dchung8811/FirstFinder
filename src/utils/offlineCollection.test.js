import { describe, it, expect } from "vitest";
import {
  OFFLINE_CACHE_VERSION,
  offlineCacheKey,
  stripPhotos,
  serializeCollection,
  parseCollection,
  syncAgeLabel
} from "./offlineCollection";

const USER = "11111111-1111-1111-1111-111111111111";
const OTHER_USER = "22222222-2222-2222-2222-222222222222";

const item = (over = {}) => ({
  id: "row-1",
  referenceNumber: 1,
  name: "Dune",
  author: "Frank Herbert",
  maker: "",
  category: "Book",
  status: "Owned",
  itemPhotos: [{ id: "p1", path: "user/item/front.jpg", name: "front.jpg" }],
  receiptPhotos: [],
  itemPhotoCount: 1,
  receiptPhotoCount: 0,
  ...over
});

describe("offlineCacheKey", () => {
  it("namespaces the snapshot per user and per version", () => {
    expect(offlineCacheKey(USER)).toBe(`firstfinder:collection:v${OFFLINE_CACHE_VERSION}:${USER}`);
    expect(offlineCacheKey(USER)).not.toBe(offlineCacheKey(OTHER_USER));
  });

  it("still produces a key with no user, rather than one ending in undefined", () => {
    expect(offlineCacheKey(undefined)).toContain("anonymous");
  });
});

describe("stripPhotos", () => {
  // Photos are the only unbounded field, and a cached path is useless without
  // a network to sign it with -- so the snapshot keeps the count, not the list.
  it("drops the photo lists but keeps the counts", () => {
    const stripped = stripPhotos(item({ receiptPhotos: [{ id: "r1", path: "user/item/receipt.jpg" }] }));
    expect(stripped.itemPhotos).toEqual([]);
    expect(stripped.receiptPhotos).toEqual([]);
    expect(stripped.itemPhotoCount).toBe(1);
    expect(stripped.receiptPhotoCount).toBe(1);
  });

  it("keeps a count already on the row when the lists were never loaded", () => {
    const stripped = stripPhotos({ id: "a", itemPhotos: undefined, itemPhotoCount: 4 });
    expect(stripped.itemPhotoCount).toBe(4);
  });

  it("leaves the rest of the row alone", () => {
    expect(stripPhotos(item()).author).toBe("Frank Herbert");
  });
});

describe("serializeCollection and parseCollection", () => {
  it("round-trips a collection", () => {
    const raw = serializeCollection([item()], { userId: USER, syncedAt: "2026-09-09T10:00:00.000Z" });
    const parsed = parseCollection(raw, { userId: USER });
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].name).toBe("Dune");
    expect(parsed.syncedAt).toBe("2026-09-09T10:00:00.000Z");
  });

  it("stamps a time when none was given", () => {
    const parsed = parseCollection(serializeCollection([], { userId: USER }), { userId: USER });
    expect(Number.isNaN(new Date(parsed.syncedAt).getTime())).toBe(false);
  });

  it("survives an empty collection", () => {
    expect(parseCollection(serializeCollection([], { userId: USER }), { userId: USER }).items).toEqual([]);
  });

  // The whole point of the user check. A snapshot is a copy of one person's
  // shelf sitting in a browser two people share.
  it("refuses a snapshot belonging to a different account", () => {
    const raw = serializeCollection([item()], { userId: OTHER_USER });
    expect(parseCollection(raw, { userId: USER })).toBe(null);
  });

  it("refuses a snapshot with no owner recorded", () => {
    const raw = JSON.stringify({ version: OFFLINE_CACHE_VERSION, items: [], syncedAt: "" });
    expect(parseCollection(raw, { userId: USER })).toBe(null);
  });

  // A snapshot written by an older build describes a shape this build does not
  // know. It is a copy of rows that still exist in Postgres, so discarding it
  // costs one sync and no data.
  it("discards a snapshot from an older cache version", () => {
    const raw = JSON.stringify({ version: OFFLINE_CACHE_VERSION - 1, userId: USER, items: [item()] });
    expect(parseCollection(raw, { userId: USER })).toBe(null);
  });

  it("returns null rather than throwing on junk", () => {
    expect(parseCollection("not json at all", { userId: USER })).toBe(null);
    expect(parseCollection("null", { userId: USER })).toBe(null);
    expect(parseCollection('"a string"', { userId: USER })).toBe(null);
    expect(parseCollection("", { userId: USER })).toBe(null);
    expect(parseCollection(null, { userId: USER })).toBe(null);
  });

  it("returns null when the payload has no item list", () => {
    const raw = JSON.stringify({ version: OFFLINE_CACHE_VERSION, userId: USER, items: "everything" });
    expect(parseCollection(raw, { userId: USER })).toBe(null);
  });

  it("drops entries that are not rows", () => {
    const raw = JSON.stringify({ version: OFFLINE_CACHE_VERSION, userId: USER, items: [item(), null, "nonsense"] });
    expect(parseCollection(raw, { userId: USER }).items).toHaveLength(1);
  });

  it("never carries a photo list across, even if one was written by hand", () => {
    const raw = JSON.stringify({
      version: OFFLINE_CACHE_VERSION,
      userId: USER,
      items: [{ id: "a", itemPhotos: [{ path: "user/item/front.jpg" }] }]
    });
    expect(parseCollection(raw, { userId: USER }).items[0].itemPhotos).toEqual([]);
  });
});

describe("syncAgeLabel", () => {
  const now = new Date("2026-09-09T12:00:00.000Z");
  const ago = (ms) => new Date(now.getTime() - ms).toISOString();

  it("reads as just now for a fresh sync", () => {
    expect(syncAgeLabel(ago(30 * 1000), now)).toBe("just now");
  });

  it("counts minutes, then hours, then days, then months", () => {
    expect(syncAgeLabel(ago(20 * 60 * 1000), now)).toBe("20 minutes ago");
    expect(syncAgeLabel(ago(60 * 60 * 1000), now)).toBe("an hour ago");
    expect(syncAgeLabel(ago(5 * 60 * 60 * 1000), now)).toBe("5 hours ago");
    expect(syncAgeLabel(ago(24 * 60 * 60 * 1000), now)).toBe("yesterday");
    expect(syncAgeLabel(ago(9 * 24 * 60 * 60 * 1000), now)).toBe("9 days ago");
    expect(syncAgeLabel(ago(45 * 24 * 60 * 60 * 1000), now)).toBe("a month ago");
    expect(syncAgeLabel(ago(200 * 24 * 60 * 60 * 1000), now)).toBe("6 months ago");
  });

  // A wrong-looking date in the banner would undermine the banner itself.
  it("says something honest about a missing or impossible timestamp", () => {
    expect(syncAgeLabel("", now)).toBe("at some point");
    expect(syncAgeLabel("whenever", now)).toBe("at some point");
    expect(syncAgeLabel(ago(-60 * 60 * 1000), now)).toBe("at some point");
  });
});
