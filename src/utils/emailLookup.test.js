import { describe, expect, it } from "vitest";
import { classifySignInMethods, countLookup, normalizeLookupEmail, readLookupAnswer } from "./emailLookup";

describe("normalizeLookupEmail", () => {
  it("trims and lowercases a usable address", () => {
    expect(normalizeLookupEmail("  Collector@Example.COM ")).toBe("collector@example.com");
  });

  it("refuses anything that isn't one address", () => {
    for (const value of [undefined, null, 42, "", "   ", "collector", "@example.com", "a@b@example.com", "a@example", "a@.example.com", "a@example.com.", "a b@example.com"]) {
      expect(normalizeLookupEmail(value)).toBeNull();
    }
  });

  it("refuses an address longer than 254 characters", () => {
    expect(normalizeLookupEmail(`${"a".repeat(250)}@example.com`)).toBeNull();
  });
});

describe("classifySignInMethods", () => {
  it("calls an address with no account new", () => {
    expect(classifySignInMethods(null)).toEqual({ status: "new" });
  });

  // A password anywhere wins: they typed an email, so they likely know it.
  it("asks for a password when the account has one", () => {
    expect(classifySignInMethods(["email"])).toEqual({ status: "password" });
    expect(classifySignInMethods(["email", "google"])).toEqual({ status: "password" });
  });

  // An account with no identity rows at all still signs in with its password.
  it("asks for a password when the account lists no methods", () => {
    expect(classifySignInMethods([])).toEqual({ status: "password" });
  });

  it("points a Google- or Apple-only account at its button", () => {
    expect(classifySignInMethods(["google"])).toEqual({ status: "social", providers: ["google"] });
    expect(classifySignInMethods(["apple", "google"])).toEqual({ status: "social", providers: ["google", "apple"] });
  });

  it("never points at a button the card doesn't have", () => {
    expect(classifySignInMethods(["github"])).toEqual({ status: "password" });
  });

  it("can't tell from a malformed answer", () => {
    expect(classifySignInMethods("email")).toEqual({ status: "unknown" });
  });
});

describe("countLookup", () => {
  const rule = { limit: 2, windowMs: 1000 };

  it("allows up to the limit in one window, then refuses", () => {
    let step = countLookup(undefined, 0, rule);
    expect(step.allowed).toBe(true);
    step = countLookup(step.window, 10, rule);
    expect(step.allowed).toBe(true);
    step = countLookup(step.window, 20, rule);
    expect(step.allowed).toBe(false);
    expect(step.window).toEqual({ count: 3, resetAt: 1000 });
  });

  it("starts a fresh window once the old one ends", () => {
    const step = countLookup({ count: 9, resetAt: 1000 }, 1000, rule);
    expect(step).toEqual({ window: { count: 1, resetAt: 2000 }, allowed: true });
  });
});

describe("readLookupAnswer", () => {
  it("passes through what it recognises", () => {
    expect(readLookupAnswer({ status: "new" })).toEqual({ status: "new" });
    expect(readLookupAnswer({ status: "password" })).toEqual({ status: "password" });
    expect(readLookupAnswer({ status: "social", providers: ["apple"] })).toEqual({ status: "social", providers: ["apple"] });
  });

  // Unknown means the flow from before the lookup: password, then both next steps.
  it("falls back to unknown for anything else", () => {
    expect(readLookupAnswer(null)).toEqual({ status: "unknown" });
    expect(readLookupAnswer({ status: "maybe" })).toEqual({ status: "unknown" });
    expect(readLookupAnswer({ status: "social", providers: ["github"] })).toEqual({ status: "unknown" });
    expect(readLookupAnswer({ status: "social" })).toEqual({ status: "unknown" });
  });
});
