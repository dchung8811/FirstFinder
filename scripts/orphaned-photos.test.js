import { describe, it, expect } from "vitest";
import { classifyPhotoFolders, deletionBlocker, ownerLookupVerdict } from "./orphaned-photos.mjs";

const alice = "0b7e4c1a-2f3d-4e5f-8a9b-0c1d2e3f4a5b";
const bob = "9f8e7d6c-5b4a-4321-8fed-cba987654321";
const gone = "11111111-2222-4333-8444-555555555555";

describe("classifyPhotoFolders", () => {
  it("keeps folders whose user still exists", () => {
    const result = classifyPhotoFolders([alice, bob], [alice, bob]);
    expect(result).toEqual({ owned: [alice, bob], orphaned: [], unrecognized: [] });
  });

  it("flags a user-id folder whose user is gone", () => {
    const result = classifyPhotoFolders([alice, gone], [alice]);
    expect(result.orphaned).toEqual([gone]);
    expect(result.owned).toEqual([alice]);
  });

  it("matches ids regardless of case", () => {
    const result = classifyPhotoFolders([alice.toUpperCase()], [alice]);
    expect(result.owned).toEqual([alice.toUpperCase()]);
    expect(result.orphaned).toEqual([]);
  });

  // Anything not shaped like a user id was put there by hand, not by the app.
  // It must never land in the list that --delete acts on.
  it("never calls a name that isn't a user id orphaned", () => {
    const result = classifyPhotoFolders(["public", "backup-2026", ".emptyFolderPlaceholder", `${gone}-old`], [alice]);
    expect(result.orphaned).toEqual([]);
    expect(result.unrecognized).toEqual(["public", "backup-2026", ".emptyFolderPlaceholder", `${gone}-old`]);
  });

  it("accepts any iterable of user ids", () => {
    const result = classifyPhotoFolders([alice, gone], new Set([alice]));
    expect(result.orphaned).toEqual([gone]);
  });
});

describe("deletionBlocker", () => {
  it("allows a normal cleanup", () => {
    expect(deletionBlocker({ userCount: 2, owned: [alice], orphaned: [gone] })).toBeNull();
  });

  it("allows a run with nothing to delete", () => {
    expect(deletionBlocker({ userCount: 2, owned: [alice, bob], orphaned: [] })).toBeNull();
  });

  // Wrong project or key: users list empty, so every folder looks orphaned.
  it("refuses when no users came back", () => {
    expect(deletionBlocker({ userCount: 0, owned: [], orphaned: [gone] })).toMatch(/No users came back/);
  });

  it("refuses when every folder looks orphaned", () => {
    expect(deletionBlocker({ userCount: 5, owned: [], orphaned: [gone, alice] })).toMatch(/Every photo folder looks orphaned/);
  });
});

// Shapes below are what auth.admin.getUserById returned from the real project.
describe("ownerLookupVerdict", () => {
  it("calls a user gone only on Supabase's own not-found answer", () => {
    const error = { status: 404, code: "user_not_found" };
    expect(ownerLookupVerdict({ data: { user: null }, error })).toBe("gone");
  });

  it("recognizes a user who still exists", () => {
    expect(ownerLookupVerdict({ data: { user: { id: alice } }, error: null })).toBe("exists");
  });

  // Each of these would otherwise delete a real collector's photos.
  it.each([
    ["an outage", { status: 500, code: "unexpected_failure" }],
    ["a bad key", { status: 401, code: "bad_jwt" }],
    ["a rate limit", { status: 429, code: "over_request_rate_limit" }],
    ["a network failure with no status", { message: "fetch failed" }],
    ["a 404 from something other than auth", { status: 404 }]
  ])("is unsure after %s", (_name, error) => {
    expect(ownerLookupVerdict({ data: { user: null }, error })).toBe("unknown");
  });

  it("is unsure when the answer has neither a user nor an error", () => {
    expect(ownerLookupVerdict({ data: { user: null }, error: null })).toBe("unknown");
    expect(ownerLookupVerdict()).toBe("unknown");
  });
});
