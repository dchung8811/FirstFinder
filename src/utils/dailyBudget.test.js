import { describe, it, expect } from "vitest";
import { identifyDailyLimit, scanDailyLimit, nextUtcMidnight, todayUtc, dailyBudget } from "./dailyBudget";

const NOW = new Date("2026-11-01T23:30:00Z");

describe("identifyDailyLimit", () => {
  it("defaults to two", () => {
    expect(identifyDailyLimit(undefined)).toBe(2);
    expect(identifyDailyLimit("")).toBe(2);
  });

  it("reads a configured number", () => {
    expect(identifyDailyLimit("5")).toBe(5);
  });

  // Matches the route's long-standing `Number(...) || 2`: switching
  // identification off is a per-account 0 in identify_limits, not this.
  it("treats 0 and garbage as the default", () => {
    expect(identifyDailyLimit("0")).toBe(2);
    expect(identifyDailyLimit("lots")).toBe(2);
  });
});

describe("scanDailyLimit", () => {
  it("is uncapped unless set to a whole number", () => {
    expect(scanDailyLimit(undefined)).toBeNull();
    expect(scanDailyLimit("")).toBeNull();
    expect(scanDailyLimit("2.5")).toBeNull();
    expect(scanDailyLimit("-1")).toBeNull();
  });

  it("reads a cap, and 0 switches scanning off", () => {
    expect(scanDailyLimit("20")).toBe(20);
    expect(scanDailyLimit("0")).toBe(0);
  });
});

describe("the UTC day", () => {
  it("resets at the next midnight UTC, not local midnight", () => {
    expect(nextUtcMidnight(NOW).toISOString()).toBe("2026-11-02T00:00:00.000Z");
    expect(nextUtcMidnight(new Date("2026-12-31T00:00:00Z")).toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("names today by its UTC date", () => {
    expect(todayUtc(NOW)).toBe("2026-11-01");
  });
});

describe("dailyBudget", () => {
  it("counts what is left of the default", () => {
    expect(dailyBudget({ used: 1, defaultLimit: 2, now: NOW })).toEqual({
      used: 1,
      dailyLimit: 2,
      remaining: 1,
      resetsAt: "2026-11-02T00:00:00.000Z"
    });
  });

  it("lets a per-account override win, as claim_identify_call does", () => {
    expect(dailyBudget({ used: 3, defaultLimit: 2, overrideLimit: 10, now: NOW }).remaining).toBe(7);
    expect(dailyBudget({ used: 0, defaultLimit: 2, overrideLimit: 0, now: NOW })).toMatchObject({ dailyLimit: 0, remaining: 0 });
  });

  it("never goes below zero", () => {
    expect(dailyBudget({ used: 5, defaultLimit: 2, now: NOW }).remaining).toBe(0);
  });

  it("treats a missing usage row as nothing used today", () => {
    expect(dailyBudget({ used: undefined, defaultLimit: 2, now: NOW })).toMatchObject({ used: 0, remaining: 2 });
  });

  it("reports an uncapped counter as such", () => {
    expect(dailyBudget({ used: 40, defaultLimit: null, now: NOW })).toMatchObject({ used: 40, dailyLimit: null, remaining: null });
  });
});
