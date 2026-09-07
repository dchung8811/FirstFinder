import { describe, it, expect } from "vitest";
import { formatReference, parseReference, toNumber, formatCurrency, hasValue, todayIso } from "./format";

describe("toNumber", () => {
  it("reads a plain number", () => {
    expect(toNumber("42")).toBe(42);
    expect(toNumber(42)).toBe(42);
    expect(toNumber("12.50")).toBe(12.5);
  });

  it("strips currency formatting a user pasted in", () => {
    expect(toNumber("$1,200")).toBe(1200);
    expect(toNumber("$1,200.75")).toBe(1200.75);
  });

  it("keeps negatives", () => {
    expect(toNumber("-50")).toBe(-50);
  });

  // Every total in the app sums toNumber() output, so anything unparseable has
  // to land on 0 rather than NaN -- one NaN poisons a whole column.
  it("falls back to 0 rather than NaN", () => {
    expect(toNumber("")).toBe(0);
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber("not a price")).toBe(0);
  });
});

describe("hasValue", () => {
  it("treats zero as a real value", () => {
    expect(hasValue(0)).toBe(true);
    expect(hasValue("0")).toBe(true);
  });

  it("treats blank and missing as absent", () => {
    expect(hasValue("")).toBe(false);
    expect(hasValue(null)).toBe(false);
    expect(hasValue(undefined)).toBe(false);
  });
});

describe("formatCurrency", () => {
  it("renders whole dollars", () => {
    expect(formatCurrency(1234)).toBe("$1,234");
    expect(formatCurrency("")).toBe("$0");
  });
});

describe("reference numbers", () => {
  it("renders as FF-0001", () => {
    expect(formatReference(1)).toBe("FF-0001");
    expect(formatReference(4267)).toBe("FF-4267");
  });

  it("renders nothing when unset", () => {
    expect(formatReference(null)).toBe("");
    expect(formatReference(undefined)).toBe("");
    expect(formatReference("")).toBe("");
  });

  // The CSV round trip depends on this: what buildCsvExport writes has to come
  // back through parseReference unchanged, however the user's spreadsheet
  // mangled it.
  it("parses back whatever a spreadsheet produced", () => {
    expect(parseReference("FF-0042")).toBe(42);
    expect(parseReference("42")).toBe(42);
    expect(parseReference("  FF-0007  ")).toBe(7);
    expect(parseReference("ff-0007")).toBe(7);
  });

  it("returns null when there is no number to read", () => {
    expect(parseReference("")).toBe(null);
    expect(parseReference(null)).toBe(null);
    expect(parseReference("none")).toBe(null);
  });

  it("survives a round trip", () => {
    expect(parseReference(formatReference(931))).toBe(931);
  });
});

describe("todayIso", () => {
  it("returns a bare YYYY-MM-DD date", () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
