import { describe, it, expect } from "vitest";
import {
  withWriteRetry,
  isRetryableWriteError,
  RECORD_WRITE_RETRY_DELAYS_MS
} from "./retryWrite";

// A sleep that records what it was asked to wait rather than waiting, so the
// schedule can be asserted without spending twelve seconds proving it.
function fakeSleep() {
  const waited = [];
  return { waited, sleep: async (ms) => { waited.push(ms); } };
}

const GATEWAY_504 = { message: "Gateway Timeout" };            // no SQLSTATE
const TIMEOUT = { code: "57014", message: "statement timeout" };
const CONNECTION = { code: "08006", message: "connection failure" };
const RESOURCES = { code: "53300", message: "too many connections" };
const CONSTRAINT = { code: "23505", message: "duplicate key" };
const NOT_FOUND = { code: "PGRST116", message: "no rows" };

describe("isRetryableWriteError", () => {
  it("retries a failure that never reached Postgres", () => {
    // A 502/504 or a dropped connection carries no SQLSTATE, because the
    // database never got as far as having an opinion.
    expect(isRetryableWriteError(GATEWAY_504)).toBe(true);
    expect(isRetryableWriteError({ message: "fetch failed" })).toBe(true);
  });

  it("retries timeouts, connection failures and resource exhaustion", () => {
    expect(isRetryableWriteError(TIMEOUT)).toBe(true);
    expect(isRetryableWriteError(CONNECTION)).toBe(true);
    expect(isRetryableWriteError(RESOURCES)).toBe(true);
  });

  // Retrying these only makes the reader wait twelve seconds for the same
  // refusal.
  it("does not retry a statement the database rejected on its merits", () => {
    expect(isRetryableWriteError(CONSTRAINT)).toBe(false);
    expect(isRetryableWriteError(NOT_FOUND)).toBe(false);
    expect(isRetryableWriteError({ code: "42703", message: "no such column" })).toBe(false);
  });

  it("is not an error at all when there is no error", () => {
    expect(isRetryableWriteError(null)).toBe(false);
    expect(isRetryableWriteError(undefined)).toBe(false);
  });
});

describe("withWriteRetry", () => {
  it("does not retry something that worked", async () => {
    const { waited, sleep } = fakeSleep();
    let calls = 0;
    const result = await withWriteRetry(async () => { calls += 1; return { data: { id: 1 }, error: null }; }, { sleep });

    expect(calls).toBe(1);
    expect(waited).toEqual([]);
    expect(result.data).toEqual({ id: 1 });
    expect(result.attempts).toBe(1);
  });

  // The case this exists for: the PATCH that came back 504 while every photo
  // upload beside it returned 200.
  it("recovers when a later attempt succeeds, and reports how many it took", async () => {
    const { waited, sleep } = fakeSleep();
    let calls = 0;
    const result = await withWriteRetry(
      async () => {
        calls += 1;
        return calls < 3 ? { data: null, error: GATEWAY_504 } : { data: { linked: true }, error: null };
      },
      { sleep }
    );

    expect(calls).toBe(3);
    expect(result.error).toBeFalsy();
    expect(result.data).toEqual({ linked: true });
    expect(result.attempts).toBe(3);
    // Backed off past the observed stall rather than hammering.
    expect(waited).toEqual([1000, 3000]);
  });

  it("gives up after the delays run out and returns the last error", async () => {
    const { waited, sleep } = fakeSleep();
    let calls = 0;
    const result = await withWriteRetry(async () => { calls += 1; return { data: null, error: GATEWAY_504 }; }, { sleep });

    expect(calls).toBe(RECORD_WRITE_RETRY_DELAYS_MS.length + 1);
    expect(result.error).toEqual(GATEWAY_504);
    expect(result.attempts).toBe(4);
    expect(waited).toEqual(RECORD_WRITE_RETRY_DELAYS_MS);
  });

  it("stops immediately on an error that will not change", async () => {
    const { waited, sleep } = fakeSleep();
    let calls = 0;
    const result = await withWriteRetry(async () => { calls += 1; return { data: null, error: CONSTRAINT }; }, { sleep });

    expect(calls).toBe(1);
    expect(waited).toEqual([]);
    expect(result.error).toEqual(CONSTRAINT);
  });

  // The delays climb past the stall that was actually observed: the PATCH
  // failed and an RPC five seconds later failed too, so a single quick retry
  // would have landed inside the same window.
  it("waits longer than the stall that prompted it", async () => {
    expect(RECORD_WRITE_RETRY_DELAYS_MS[0]).toBeGreaterThanOrEqual(1000);
    expect(RECORD_WRITE_RETRY_DELAYS_MS.at(-1)).toBeGreaterThan(5000);
    const total = RECORD_WRITE_RETRY_DELAYS_MS.reduce((sum, ms) => sum + ms, 0);
    expect(total).toBeGreaterThan(5000);
    // ...but not so long that a save appears to hang.
    expect(total).toBeLessThanOrEqual(15000);
  });

  it("passes the attempt number through, so a caller can vary what it sends", async () => {
    const { sleep } = fakeSleep();
    const seen = [];
    await withWriteRetry(async (attempt) => { seen.push(attempt); return { error: GATEWAY_504 }; }, { sleep, delays: [10, 10] });
    expect(seen).toEqual([0, 1, 2]);
  });

  it("treats a missing result as success rather than looping forever", async () => {
    const { sleep } = fakeSleep();
    const result = await withWriteRetry(async () => undefined, { sleep });
    expect(result.attempts).toBe(1);
  });
});
