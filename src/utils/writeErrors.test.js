import { describe, expect, it } from "vitest";
import { describeWriteError, isNoRowWrittenError, SIGNED_OUT_WRITE_MESSAGE } from "./writeErrors";

// Shaped like what supabase-js returned for the real failure.
const ZERO_ROWS = {
  code: "PGRST116",
  message: "Cannot coerce the result to a single JSON object",
  details: "The result contains 0 rows"
};

describe("isNoRowWrittenError", () => {
  it("recognises PostgREST's zero-row refusal", () => {
    expect(isNoRowWrittenError(ZERO_ROWS)).toBe(true);
  });

  it("does not claim other failures", () => {
    expect(isNoRowWrittenError({ code: "23505", message: "duplicate key" })).toBe(false);
    expect(isNoRowWrittenError({ message: "504 Gateway Timeout" })).toBe(false);
    expect(isNoRowWrittenError(null)).toBe(false);
  });
});

describe("describeWriteError", () => {
  it("tells a signed-out reader to sign in instead of quoting PostgREST", () => {
    expect(describeWriteError(ZERO_ROWS)).toBe(SIGNED_OUT_WRITE_MESSAGE);
    expect(describeWriteError(ZERO_ROWS)).not.toMatch(/coerce/);
  });

  it("passes other errors through unchanged", () => {
    expect(describeWriteError({ code: "23505", message: "duplicate key value" })).toBe("duplicate key value");
  });

  it("never returns an empty toast for an error without a message", () => {
    expect(describeWriteError({ code: "XX000" })).not.toBe("");
  });
});
