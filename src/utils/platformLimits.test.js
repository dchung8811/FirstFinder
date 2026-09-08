import { describe, it, expect } from "vitest";
import {
  STATUS,
  FREE_PLAN,
  PAUSE_AFTER_IDLE_DAYS,
  statusFromRatio,
  worstStatus,
  formatBytes,
  formatPercent,
  daysBetween,
  buildPlatformChecks
} from "./platformLimits";

// Every interesting state here is one this project has never been in -- the
// database is at 2% of its allowance and the token does not expire. Fabricated
// numbers are the only way to find out whether the warnings actually fire, so
// that is most of what this file does.

const NOW = new Date("2026-09-08T12:00:00Z");

function checkFor(key, input) {
  return buildPlatformChecks({ now: NOW, ...input }).find((check) => check.key === key);
}

describe("statusFromRatio", () => {
  it("stays ok below the watch threshold", () => {
    expect(statusFromRatio(0)).toBe(STATUS.OK);
    expect(statusFromRatio(0.69)).toBe(STATUS.OK);
  });

  it("warns from 70% and escalates at 90%", () => {
    expect(statusFromRatio(0.7)).toBe(STATUS.WATCH);
    expect(statusFromRatio(0.89)).toBe(STATUS.WATCH);
    expect(statusFromRatio(0.9)).toBe(STATUS.ACT);
    expect(statusFromRatio(2)).toBe(STATUS.ACT);
  });

  // A missing limit must not read as an emergency, or an unconfigured check
  // would light the whole dashboard red.
  it("treats an unknown ratio as ok", () => {
    expect(statusFromRatio(NaN)).toBe(STATUS.OK);
    expect(statusFromRatio(null)).toBe(STATUS.OK);
  });
});

describe("worstStatus", () => {
  it("returns the most severe status, not the alphabetical one", () => {
    // "act" sorts before "ok" and "watch", so a naive comparison gets this
    // exactly backwards -- which is the point of the test.
    expect(worstStatus([{ status: STATUS.OK }, { status: STATUS.ACT }, { status: STATUS.WATCH }])).toBe(STATUS.ACT);
    expect(worstStatus([{ status: STATUS.OK }, { status: STATUS.WATCH }])).toBe(STATUS.WATCH);
    expect(worstStatus([{ status: STATUS.OK }])).toBe(STATUS.OK);
  });

  it("is ok when there is nothing to judge", () => {
    expect(worstStatus([])).toBe(STATUS.OK);
    expect(worstStatus(undefined)).toBe(STATUS.OK);
  });
});

describe("formatBytes", () => {
  it("scales through the units", () => {
    expect(formatBytes(512)).toBe("512 B");
    // Past 10 the decimal stops earning its place: "12 MB of 500 MB" carries
    // every bit of the meaning "11.7 MB of 500 MB" does.
    expect(formatBytes(12266643)).toBe("12 MB");
    expect(formatBytes(4482839)).toBe("4.3 MB");
    expect(formatBytes(FREE_PLAN.storageBytes)).toBe("1 GB");
  });

  it("drops the decimal once the number is big enough not to need it", () => {
    expect(formatBytes(1024 * 1024 * 40)).toBe("40 MB");
  });

  it("does not invent a size it was not given", () => {
    expect(formatBytes(null)).toBe("--");
    expect(formatBytes(-1)).toBe("--");
  });
});

describe("formatPercent", () => {
  // Rounding 0.4% down to "0%" would report "nothing stored" for a bucket that
  // has files in it -- a small lie that reads as reassurance.
  it("never rounds a real usage down to zero", () => {
    expect(formatPercent(0.004)).toBe("<1%");
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(0.5)).toBe("50%");
  });
});

describe("daysBetween", () => {
  it("measures forward in days", () => {
    expect(daysBetween("2026-09-08T12:00:00Z", "2026-09-01T12:00:00Z")).toBe(7);
  });

  it("returns null rather than NaN for an unparseable date", () => {
    expect(daysBetween("nonsense", NOW)).toBeNull();
  });
});

describe("buildPlatformChecks: quotas", () => {
  const capacity = {
    db_bytes: 12266643,
    storage_bytes: 4482839,
    storage_objects: 13,
    mau_30d: 2,
    last_activity_at: "2026-09-08T11:00:00Z"
  };

  it("reports today's real numbers as ok with nothing to do", () => {
    const checks = buildPlatformChecks({ capacity, now: NOW });
    expect(worstStatus(checks)).toBe(STATUS.OK);
    expect(checks.every((check) => check.action === null)).toBe(true);
  });

  it("escalates the database check and says what to do", () => {
    const check = checkFor("database", { capacity: { ...capacity, db_bytes: FREE_PLAN.dbBytes * 0.95 } });
    expect(check.status).toBe(STATUS.ACT);
    expect(check.action).toMatch(/identify_usage/);
  });

  it("quotes no free-plan allowances once the project is on a paid plan", () => {
    // The limits differ on Pro, so quoting free-tier numbers there would be
    // confidently wrong rather than merely unhelpful.
    const checks = buildPlatformChecks({ capacity, plan: "pro", now: NOW });
    expect(checks.find((check) => check.key === "database")).toBeUndefined();
    expect(checks.find((check) => check.key === "mau")).toBeUndefined();
  });
});

describe("buildPlatformChecks: free-project pause", () => {
  it("is quiet while the project is being used", () => {
    const check = checkFor("pause", { capacity: { last_activity_at: "2026-09-08T09:00:00Z" } });
    expect(check.status).toBe(STATUS.OK);
    expect(check.value).toBe("Active today");
  });

  it("warns as the idle window fills and explains the fix", () => {
    // Five days idle out of seven is 71% -- just past the watch threshold.
    const check = checkFor("pause", { capacity: { last_activity_at: "2026-09-03T12:00:00Z" } });
    expect(check.status).toBe(STATUS.WATCH);
    expect(check.value).toBe(`Idle 5 of ${PAUSE_AFTER_IDLE_DAYS} days`);
    expect(check.action).toMatch(/signed-in visit resets this/);
  });

  it("caps the bar at full rather than overflowing once the window has passed", () => {
    const check = checkFor("pause", { capacity: { last_activity_at: "2026-08-01T12:00:00Z" } });
    expect(check.status).toBe(STATUS.ACT);
    expect(check.ratio).toBe(1);
  });

  it("is skipped entirely when there has never been any activity to measure", () => {
    expect(checkFor("pause", { capacity: {} })).toBeUndefined();
  });
});

describe("buildPlatformChecks: GitHub", () => {
  const github = { authenticated: true, rateLimit: 5000, rateUsed: 0 };

  it("reads the rate limit from what GitHub reported", () => {
    const check = checkFor("github-rate", { capacity: {}, github: { ...github, rateUsed: 4800 } });
    expect(check.status).toBe(STATUS.ACT);
    // Thousands separators: "4,800 of 5,000" reads as a limit being consumed,
    // "4800 of 5000" reads like a typo.
    expect(check.value).toBe("4,800 of 5,000");
  });

  it("tells an unauthenticated deployment to set a token", () => {
    const check = checkFor("github-rate", {
      capacity: {},
      github: { authenticated: false, rateLimit: 60, rateUsed: 55 }
    });
    expect(check.action).toMatch(/GITHUB_TOKEN/);
  });

  it("warns before a fine-grained token expires, since filing fails silently", () => {
    const check = checkFor("github-token", { capacity: {}, github: { ...github, tokenExpiresAt: "2026-09-11T12:00:00Z" } });
    expect(check.status).toBe(STATUS.ACT);
    expect(check.value).toBe("3 days left");
  });

  it("says so plainly once it has lapsed", () => {
    const check = checkFor("github-token", { capacity: {}, github: { ...github, tokenExpiresAt: "2026-09-01T12:00:00Z" } });
    expect(check.value).toBe("Expired");
    expect(check.status).toBe(STATUS.ACT);
  });

  // Classic tokens send no expiry header at all. Inventing one would either
  // nag forever or promise safety we cannot verify.
  it("omits the expiry check when GitHub reports no expiry", () => {
    expect(checkFor("github-token", { capacity: {}, github })).toBeUndefined();
  });

  it("drops the GitHub checks rather than guessing when GitHub is unreachable", () => {
    const checks = buildPlatformChecks({ capacity: {}, github: null, now: NOW });
    expect(checks.some((check) => check.key.startsWith("github"))).toBe(false);
  });
});
