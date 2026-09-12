import { describe, it, expect } from "vitest";
import {
  signedUrlCacheKey,
  ownerIdFromPath,
  groupPathsByOwner,
  parseSignedUrls,
  serializeSignedUrls,
  isReusable,
  selectCachedUrls,
  mergeSignedUrls,
  pruneSignedUrls,
  REUSE_RATIO
} from "./signedUrlCache";

const WEEK = 604800;
const NOW = 1_700_000_000_000;
const opts = { now: NOW, ttlSeconds: WEEK };

// Age as a fraction of the TTL, so the tests read in the same units the reuse
// rule is written in rather than in milliseconds nobody can eyeball.
function signedAgo(fraction) {
  return NOW - WEEK * 1000 * fraction;
}

describe("ownerIdFromPath", () => {
  it("reads the owner from the storage path", () => {
    expect(ownerIdFromPath("user-1/item-2/photo.jpg")).toBe("user-1");
  });

  it("has no owner for junk", () => {
    expect(ownerIdFromPath("")).toBe("");
    expect(ownerIdFromPath(null)).toBe("");
    expect(ownerIdFromPath(undefined)).toBe("");
    expect(ownerIdFromPath(42)).toBe("");
  });
});

describe("groupPathsByOwner", () => {
  it("keeps each owner's paths together", () => {
    const grouped = groupPathsByOwner(["a/1/x.jpg", "b/2/y.jpg", "a/3/z.jpg"]);
    expect(grouped.get("a")).toEqual(["a/1/x.jpg", "a/3/z.jpg"]);
    expect(grouped.get("b")).toEqual(["b/2/y.jpg"]);
  });

  it("drops paths with no owner rather than filing them under a blank key", () => {
    expect(groupPathsByOwner(["", null, "photo.jpg"]).size).toBe(0);
  });
});

describe("signedUrlCacheKey", () => {
  it("namespaces by owner", () => {
    expect(signedUrlCacheKey("abc")).toContain("abc");
    expect(signedUrlCacheKey("abc")).not.toEqual(signedUrlCacheKey("def"));
  });

  it("does not key everyone together when the owner is missing", () => {
    expect(signedUrlCacheKey(null)).toContain("anonymous");
  });
});

describe("parseSignedUrls", () => {
  it("round-trips what serialize wrote", () => {
    const entries = { "a/1/x.jpg": { url: "https://example.test/x", signedAt: NOW } };
    expect(parseSignedUrls(serializeSignedUrls(entries))).toEqual(entries);
  });

  it("survives junk instead of throwing", () => {
    expect(parseSignedUrls(null)).toEqual({});
    expect(parseSignedUrls("")).toEqual({});
    expect(parseSignedUrls("not json")).toEqual({});
    expect(parseSignedUrls("[1,2,3]")).toEqual({});
    expect(parseSignedUrls('"a string"')).toEqual({});
  });

  // A half-written entry is indistinguishable from a good one once it is in
  // the map, and handing one out shows a broken photo.
  it("drops entries that are not a url and a timestamp", () => {
    const raw = JSON.stringify({
      good: { url: "https://example.test/x", signedAt: NOW },
      noUrl: { signedAt: NOW },
      emptyUrl: { url: "", signedAt: NOW },
      noTime: { url: "https://example.test/y" },
      badTime: { url: "https://example.test/z", signedAt: "yesterday" },
      notAnObject: "nope"
    });
    expect(Object.keys(parseSignedUrls(raw))).toEqual(["good"]);
  });
});

describe("isReusable", () => {
  it("reuses a URL with most of its life left", () => {
    expect(isReusable({ url: "u", signedAt: signedAgo(0.1) }, opts)).toBe(true);
  });

  it("stops reusing at the same 80% mark SignedPhoto re-signs at", () => {
    expect(REUSE_RATIO).toBe(0.8);
    expect(isReusable({ url: "u", signedAt: signedAgo(0.79) }, opts)).toBe(true);
    expect(isReusable({ url: "u", signedAt: signedAgo(0.81) }, opts)).toBe(false);
  });

  it("refuses an entry signed in the future", () => {
    // A clock that moved backwards, or a value written by a device running
    // ahead. Trusting it costs a broken photo; re-signing costs a request.
    expect(isReusable({ url: "u", signedAt: NOW + 60_000 }, opts)).toBe(false);
  });

  it("refuses malformed entries and a missing TTL", () => {
    expect(isReusable(null, opts)).toBe(false);
    expect(isReusable({ url: "", signedAt: NOW }, opts)).toBe(false);
    expect(isReusable({ url: "u", signedAt: NaN }, opts)).toBe(false);
    expect(isReusable({ url: "u", signedAt: signedAgo(0.1) }, { now: NOW })).toBe(false);
    expect(isReusable({ url: "u", signedAt: signedAgo(0.1) }, { now: NOW, ttlSeconds: 0 })).toBe(false);
  });
});

describe("selectCachedUrls", () => {
  const entries = {
    "a/1/fresh.jpg": { url: "https://example.test/fresh", signedAt: signedAgo(0.1) },
    "a/2/stale.jpg": { url: "https://example.test/stale", signedAt: signedAgo(0.95) }
  };

  it("answers from the cache where it can and lists the rest", () => {
    const { reusable, missing } = selectCachedUrls(
      entries,
      ["a/1/fresh.jpg", "a/2/stale.jpg", "a/3/unknown.jpg"],
      opts
    );
    expect(reusable).toEqual({ "a/1/fresh.jpg": "https://example.test/fresh" });
    expect(missing).toEqual(["a/2/stale.jpg", "a/3/unknown.jpg"]);
  });

  // The whole point of the change: a warm load signs nothing.
  it("asks for nothing when everything is fresh", () => {
    const { missing } = selectCachedUrls(entries, ["a/1/fresh.jpg"], opts);
    expect(missing).toEqual([]);
  });

  it("asks for a path once even when it is requested twice", () => {
    const { missing } = selectCachedUrls({}, ["a/3/x.jpg", "a/3/x.jpg"], opts);
    expect(missing).toEqual(["a/3/x.jpg"]);
  });

  it("treats an empty cache as all-missing rather than failing", () => {
    expect(selectCachedUrls(null, ["a/1/x.jpg"], opts).missing).toEqual(["a/1/x.jpg"]);
  });
});

describe("mergeSignedUrls", () => {
  it("stamps newly signed URLs with the time they were signed", () => {
    const merged = mergeSignedUrls({}, { "a/1/x.jpg": "https://example.test/x" }, { now: NOW });
    expect(merged["a/1/x.jpg"]).toEqual({ url: "https://example.test/x", signedAt: NOW });
  });

  it("replaces an old URL for the same path", () => {
    const before = { "a/1/x.jpg": { url: "old", signedAt: signedAgo(0.9) } };
    const merged = mergeSignedUrls(before, { "a/1/x.jpg": "new" }, { now: NOW });
    expect(merged["a/1/x.jpg"]).toEqual({ url: "new", signedAt: NOW });
  });

  it("leaves untouched paths alone and does not mutate its input", () => {
    const before = { "a/1/keep.jpg": { url: "keep", signedAt: signedAgo(0.2) } };
    const merged = mergeSignedUrls(before, { "a/2/new.jpg": "new" }, { now: NOW });
    expect(merged["a/1/keep.jpg"]).toEqual(before["a/1/keep.jpg"]);
    expect(Object.keys(before)).toEqual(["a/1/keep.jpg"]);
  });

  it("ignores rows that failed to sign", () => {
    const merged = mergeSignedUrls({}, { "a/1/x.jpg": "", "a/2/y.jpg": null }, { now: NOW });
    expect(merged).toEqual({});
  });
});

describe("pruneSignedUrls", () => {
  it("keeps what is still reusable and drops what is not", () => {
    const entries = {
      "a/1/fresh.jpg": { url: "fresh", signedAt: signedAgo(0.1) },
      "a/2/spent.jpg": { url: "spent", signedAt: signedAgo(0.99) }
    };
    expect(Object.keys(pruneSignedUrls(entries, opts))).toEqual(["a/1/fresh.jpg"]);
  });

  // Otherwise the store grows an entry for every photo ever deleted, and
  // localStorage has a quota.
  it("empties out once everything has aged past reuse", () => {
    const entries = { "a/1/x.jpg": { url: "x", signedAt: signedAgo(2) } };
    expect(pruneSignedUrls(entries, opts)).toEqual({});
  });
});

// The reason the module exists, asserted end to end rather than one function
// at a time. Two loads of the same shelf: the first has to sign, the second
// has to sign nothing and hand back the very same URLs -- same URL being the
// whole mechanism, since a different one is a browser cache miss.
describe("two consecutive loads of the same shelf", () => {
  const paths = ["a/1/x.jpg", "a/2/y.jpg", "a/3/z.jpg"];

  function load(entries, now) {
    const { reusable, missing } = selectCachedUrls(entries, paths, { now, ttlSeconds: WEEK });

    // What the storage client would hand back for the paths that missed.
    const freshly = {};
    missing.forEach((path, index) => {
      freshly[path] = `https://example.test/${path}?token=signed-at-${now}-${index}`;
    });

    const next = pruneSignedUrls(mergeSignedUrls(entries, freshly, { now }), { now, ttlSeconds: WEEK });
    return { signed: missing, urls: { ...reusable, ...freshly }, entries: next };
  }

  it("signs everything cold and nothing warm, with the URLs unchanged", () => {
    const first = load({}, NOW);
    expect(first.signed).toEqual(paths);

    // A day later, well inside the reuse window.
    const second = load(first.entries, NOW + 86_400_000);
    expect(second.signed).toEqual([]);
    expect(second.urls).toEqual(first.urls);
  });

  it("signs again once the URLs have aged past reuse", () => {
    const first = load({}, NOW);
    const later = load(first.entries, NOW + WEEK * 1000 * 0.9);
    expect(later.signed).toEqual(paths);
    expect(later.urls).not.toEqual(first.urls);
  });

  it("signs only the photo that is new to the shelf", () => {
    const first = load({}, NOW);
    const withExtra = selectCachedUrls(first.entries, [...paths, "a/4/new.jpg"], {
      now: NOW + 1000,
      ttlSeconds: WEEK
    });
    expect(withExtra.missing).toEqual(["a/4/new.jpg"]);
  });
});
