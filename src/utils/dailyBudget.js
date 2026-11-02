// How much of today's photo identification and scanning a collector has left.
//
// The routes that spend money (app/api/identify-book, app/api/scan-book) and
// the route that only reports the allowance (app/api/identify-budget) all read
// their limits from here, so the number a collector is shown before taking a
// photo is the same number the server enforces after.
//
// Both counters reset at midnight UTC, the date Postgres's claim functions
// count by. The app says "UTC" rather than converting: a reset at 7pm local
// time is surprising enough without also being unexplained.

// IDENTIFY_DAILY_LIMIT, defaulting to two. Kept exactly as identify-book has
// always read it, including that 0 or garbage falls back to the default
// rather than switching identification off -- turning it off is done per
// account with a 0 in identify_limits.
export function identifyDailyLimit(raw) {
  return Number(raw) || 2;
}

// SCAN_DAILY_LIMIT: unset or not a whole number means no cap (null); 0 means
// scanning is switched off. Scans cost about a tenth of a cent, which is why
// the default is no cap at all.
export function scanDailyLimit(raw) {
  const parsed = Number(raw);
  return raw && Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function nextUtcMidnight(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

export function todayUtc(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

// One counter's allowance. A per-account override (identify_limits) wins over
// the default, as it does in claim_identify_call. A null limit means
// unlimited, and then nothing is "remaining" in a countable sense either.
export function dailyBudget({ used, defaultLimit, overrideLimit = null, now = new Date() }) {
  const dailyLimit = Number.isInteger(overrideLimit) ? overrideLimit : defaultLimit;
  const count = Number.isInteger(used) && used > 0 ? used : 0;
  return {
    used: count,
    dailyLimit,
    remaining: dailyLimit === null ? null : Math.max(0, dailyLimit - count),
    resetsAt: nextUtcMidnight(now).toISOString()
  };
}
