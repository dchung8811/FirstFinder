import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// The two photo-URL lifetimes, and the fact that they are deliberately not the
// same number.
//
// This exists because the divergence looks exactly like a mistake. Someone
// reading both files in the same sitting sees one TTL of a week and one of an
// hour, assumes a missed find-and-replace, and unifies them -- and whichever
// way they unify, something real breaks:
//
//   raise the shared one  -> a URL scraped off a public collection outlives
//                            the owner's decision to stop sharing by a week
//   lower the owner one   -> every photo on screen is re-downloaded roughly
//                            every 48 minutes again, which is the ~350MB a day
//                            of origin egress this pair of changes removed
//
// Read as text rather than imported, for the reason adminChecksWiring.test.js
// gives: InventoryApp.jsx is a "use client" component that drags in the
// Supabase browser client, and the thing worth protecting here is the value of
// a constant, not the behaviour of the module around it.
const OWNER = resolve(process.cwd(), "app/InventoryApp.jsx");
const SHARED = resolve(process.cwd(), "src/lib/sharedCollection.js");

const HOUR = 3600;
const DAY = 86400;

function constantValue(source, name) {
  const match = new RegExp(`${name}\\s*=\\s*(\\d+)`).exec(source);
  return match ? Number(match[1]) : null;
}

describe("photo URL lifetimes", () => {
  const ownerSource = readFileSync(OWNER, "utf8");
  const sharedSource = readFileSync(SHARED, "utf8");

  const ownerTtl = constantValue(ownerSource, "SIGNED_URL_TTL_SECONDS");
  const sharedTtl = constantValue(sharedSource, "PHOTO_URL_TTL_SECONDS");

  it("gives the owner's own photos a URL that outlives a browsing session", () => {
    expect(ownerTtl).not.toBeNull();
    // A day is the floor, not the target. The point is that a session, and the
    // browser cache behind it, survives without re-signing; an hour did not.
    expect(ownerTtl).toBeGreaterThanOrEqual(DAY);
  });

  it("keeps shared-collection URLs short, because unsharing cannot revoke them", () => {
    expect(sharedTtl).not.toBeNull();
    // The objects still exist after a collection is unshared, so an issued
    // token still resolves. This TTL is the only bound on that window.
    expect(sharedTtl).toBeLessThanOrEqual(HOUR);
  });

  it("keeps the two apart on purpose", () => {
    expect(ownerTtl).not.toEqual(sharedTtl);
  });

  // The owner path signs in two places. One of them used to carry a bare 3600
  // that did not move when the constant did.
  it("signs owner URLs from the constant, never a literal", () => {
    const signings = ownerSource.match(/createSignedUrls\([^)]*\)/g) || [];
    expect(signings.length).toBeGreaterThan(0);
    signings.forEach((call) => {
      expect(call).toContain("SIGNED_URL_TTL_SECONDS");
    });
  });

  // Not the header the rendered photos actually use -- the signed path sends
  // an `Expires` from the token instead, so SIGNED_URL_TTL_SECONDS governs
  // there. This pins the object's own cache-control for the authenticated
  // download path, and pins the claim that these objects are immutable.
  it("uploads photos as long-lived, immutable objects", () => {
    const upload = /\.upload\([^;]*?\)/s.exec(ownerSource);
    expect(upload).not.toBeNull();
    const cacheControl = /cacheControl:\s*"(\d+)"/.exec(upload[0]);
    expect(cacheControl).not.toBeNull();
    expect(Number(cacheControl[1])).toBeGreaterThanOrEqual(30 * DAY);
  });

  // The long max-age is only safe while paths are unique per upload. If
  // upsert ever appears here, a replaced photo keeps serving the old bytes.
  it("never overwrites a photo in place", () => {
    const upload = /\.upload\([^;]*?\)/s.exec(ownerSource);
    expect(upload[0]).not.toContain("upsert");
  });
});

// That the cache is still joined to the signing path at all.
//
// The same failure adminChecksWiring.test.js was written for: between #178 and
// #180 an unrelated change quietly removed a call, every unit test still
// passed because the module it tested was untouched, and the only symptom was
// a feature silently not happening. A cache that is imported but never
// consulted looks exactly like this one working.
describe("signed URL cache wiring", () => {
  const source = readFileSync(OWNER, "utf8");
  const funnel = /async function fetchSignedPhotoUrls\([\s\S]*?\n}/.exec(source);

  it("has a signing funnel to attach to", () => {
    expect(funnel).not.toBeNull();
  });

  it("reads the stored URLs before signing", () => {
    expect(funnel[0]).toContain("readSignedUrls");
    expect(funnel[0]).toContain("selectCachedUrls");
  });

  it("signs only what the cache could not answer", () => {
    // Not the full path list -- passing `paths` here would sign everything on
    // every load and quietly undo the whole thing while still passing every
    // test above.
    expect(funnel[0]).toMatch(/createSignedUrls\(\s*needSigning/);
  });

  it("writes newly signed URLs back, pruned", () => {
    expect(funnel[0]).toContain("writeSignedUrls");
    expect(funnel[0]).toContain("pruneSignedUrls");
  });

  // Signed URLs are bearer tokens sitting on disk for up to a week. Both exits
  // have to take them, not just one.
  it("clears them on sign-out and on account deletion", () => {
    const clears = source.match(/clearSignedUrls\(/g) || [];
    expect(clears.length).toBeGreaterThanOrEqual(2);
  });

  // The recovery path must not be served from the cache. resign() runs
  // because a photo failed to load, and the stored URL is what failed --
  // handing it back makes the automatic retry a no-op and leaves the reader's
  // "Try again" button unable to produce anything different, forever.
  it("always signs fresh when recovering from a URL that did not work", () => {
    const batcher = /createSignedUrlBatcher\([\s\S]*?\n\}\);/.exec(source);
    expect(batcher).not.toBeNull();
    expect(batcher[0]).toContain("bypassCache: true");
  });

  it("still offers a way to bypass the cache at all", () => {
    expect(funnel[0]).toContain("bypassCache");
  });

  it("clears them everywhere the offline snapshot is cleared", () => {
    const offline = (source.match(/clearOfflineCollection\(currentUser\?\.id\)/g) || []).length;
    const signed = (source.match(/clearSignedUrls\(currentUser\?\.id\)/g) || []).length;
    expect(signed).toEqual(offline);
  });
});
