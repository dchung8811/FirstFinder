import { describe, it, expect } from "vitest";
import { gtagCommand, queueAnalyticsUser, supabaseStorageKey, userIdFromStoredSession } from "./analytics";

const GA_ID = "G-TEST000000";
const USER_ID = "0b6c1e2a-5f3d-4c8e-9a7b-1d2e3f4a5b6c";

describe("queueAnalyticsUser", () => {
  it("queues set user_id as an arguments object, not an array", () => {
    const win = {};
    expect(queueAnalyticsUser(win, GA_ID, USER_ID)).toBe(true);

    expect(win.dataLayer).toHaveLength(1);
    const command = win.dataLayer[0];
    // gtag skips arrays; only arguments objects are treated as commands.
    expect(Array.isArray(command)).toBe(false);
    expect(Object.prototype.toString.call(command)).toBe("[object Arguments]");
    expect(Array.from(command)).toEqual(["set", { user_id: USER_ID }]);
  });

  it("clears the user with null after sign-out", () => {
    const win = {};
    queueAnalyticsUser(win, GA_ID, null);
    expect(Array.from(win.dataLayer[0])).toEqual(["set", { user_id: null }]);
  });

  it("sends nothing but the id", () => {
    const win = {};
    queueAnalyticsUser(win, GA_ID, USER_ID);
    expect(Object.keys(win.dataLayer[0][1])).toEqual(["user_id"]);
  });

  it("keeps entries already in the dataLayer and appends after them", () => {
    const existing = gtagCommand("js", new Date(0));
    const win = { dataLayer: [existing] };
    queueAnalyticsUser(win, GA_ID, USER_ID);

    expect(win.dataLayer).toHaveLength(2);
    expect(win.dataLayer[0]).toBe(existing);
    expect(Array.from(win.dataLayer[1])).toEqual(["set", { user_id: USER_ID }]);
  });

  it("does nothing when GA is not configured", () => {
    const win = {};
    expect(queueAnalyticsUser(win, undefined, USER_ID)).toBe(false);
    expect(queueAnalyticsUser(win, "", USER_ID)).toBe(false);
    expect(win.dataLayer).toBeUndefined();
  });

  it("does nothing without a window", () => {
    expect(queueAnalyticsUser(undefined, GA_ID, USER_ID)).toBe(false);
  });

  it("swallows a dataLayer that throws instead of breaking the page", () => {
    const win = { dataLayer: { push() { throw new Error("blocked"); } } };
    expect(queueAnalyticsUser(win, GA_ID, USER_ID)).toBe(false);
  });
});

describe("supabaseStorageKey", () => {
  it("matches the key supabase-js derives from the project URL", () => {
    expect(supabaseStorageKey("https://abcdefgh.supabase.co")).toBe("sb-abcdefgh-auth-token");
  });

  it("returns null for a missing or malformed URL", () => {
    expect(supabaseStorageKey(undefined)).toBeNull();
    expect(supabaseStorageKey("not a url")).toBeNull();
  });
});

describe("userIdFromStoredSession", () => {
  it("reads the user id from a stored session", () => {
    const raw = JSON.stringify({ access_token: "x", user: { id: USER_ID, email: "someone@example.com" } });
    expect(userIdFromStoredSession(raw)).toBe(USER_ID);
  });

  it("returns only a UUID, never another field or a malformed id", () => {
    expect(userIdFromStoredSession(JSON.stringify({ user: { id: "someone@example.com" } }))).toBeNull();
    expect(userIdFromStoredSession(JSON.stringify({ user: { id: 42 } }))).toBeNull();
    expect(userIdFromStoredSession(JSON.stringify({ user: {} }))).toBeNull();
  });

  it("treats empty or unreadable storage as signed out", () => {
    expect(userIdFromStoredSession(null)).toBeNull();
    expect(userIdFromStoredSession("")).toBeNull();
    expect(userIdFromStoredSession("{not json")).toBeNull();
    expect(userIdFromStoredSession("null")).toBeNull();
  });
});
