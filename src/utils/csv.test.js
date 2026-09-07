import { describe, it, expect } from "vitest";
import { csvEscape, buildCsvTemplate, buildCsvExport, parseCsvRows, sanitizeCsvFields, parseCsvBatch } from "./csv";
import { csvHeaders } from "./constants";

describe("csvEscape", () => {
  it("leaves plain values alone", () => {
    expect(csvEscape("Dune")).toBe("Dune");
  });

  it("quotes anything containing a comma, quote, or newline", () => {
    expect(csvEscape("Herbert, Frank")).toBe('"Herbert, Frank"');
    expect(csvEscape('a "quoted" word')).toBe('"a ""quoted"" word"');
    expect(csvEscape("line\nbreak")).toBe('"line\nbreak"');
  });

  it("renders missing values as empty", () => {
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
  });
});

describe("parseCsvRows", () => {
  it("splits simple rows", () => {
    expect(parseCsvRows("a,b,c\n1,2,3")).toEqual([["a", "b", "c"], ["1", "2", "3"]]);
  });

  // Splitting on newlines before handling quotes would corrupt any quoted
  // field containing a comma or a line break -- notes routinely contain both.
  it("keeps commas inside a quoted field", () => {
    expect(parseCsvRows('a,"b,c",d')).toEqual([["a", "b,c", "d"]]);
  });

  it("keeps newlines inside a quoted field", () => {
    expect(parseCsvRows('a,"line one\nline two",c')).toEqual([["a", "line one\nline two", "c"]]);
  });

  it("unescapes doubled quotes", () => {
    expect(parseCsvRows('a,"say ""hi""",c')).toEqual([["a", 'say "hi"', "c"]]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsvRows("a,b\r\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("drops entirely blank rows", () => {
    expect(parseCsvRows("a,b\n\n1,2\n,,\n")).toEqual([["a", "b"], ["1", "2"]]);
  });
});

describe("buildCsvTemplate and buildCsvExport", () => {
  it("writes the agreed header row", () => {
    expect(buildCsvTemplate().split("\n")[0]).toBe(csvHeaders.join(","));
    expect(buildCsvExport([]).split("\n")[0]).toBe(csvHeaders.join(","));
  });

  // The export is the input to the bulk edit path, so it has to lead with the
  // matching key and leave the delete column blank and ready to mark.
  it("leads with the reference number and ends with a blank delete column", () => {
    const line = buildCsvExport([{ referenceNumber: 12, name: "Dune", category: "Book" }]).split("\n")[1];
    const cells = parseCsvRows(line)[0];
    expect(cells[0]).toBe("FF-0012");
    expect(cells[cells.length - 1]).toBe("");
  });

  it("round-trips through the parser", () => {
    const csv = buildCsvExport([{ referenceNumber: 1, name: "Herbert, Frank", category: "Book", notes: 'said "hi"' }]);
    const cells = parseCsvRows(csv)[1];
    expect(cells[1]).toBe("Herbert, Frank");
    expect(cells).toContain('said "hi"');
  });
});

describe("sanitizeCsvFields", () => {
  it("only reads columns the file actually had", () => {
    const fields = sanitizeCsvFields({ name: "Dune", notes: "ignored" }, ["name"]);
    expect(fields).toEqual({ name: "Dune" });
  });

  it("falls back to a safe value for an unrecognised status", () => {
    expect(sanitizeCsvFields({ status: "Lent to Bob" }, ["status"]).status).toBe("Owned");
    expect(sanitizeCsvFields({ status: "Wishlist" }, ["status"]).status).toBe("Wishlist");
  });

  it("blanks an unrecognised condition rather than writing junk", () => {
    expect(sanitizeCsvFields({ condition: "Mint-ish" }, ["condition"]).condition).toBe("");
    expect(sanitizeCsvFields({ condition: "Fair" }, ["condition"]).condition).toBe("Fair");
  });

  it("validates the book edition and printing enums", () => {
    expect(sanitizeCsvFields({ bookEdition: "Zeroth" }, ["bookEdition"]).bookEdition).toBe("");
    expect(sanitizeCsvFields({ bookPrinting: "Third" }, ["bookPrinting"]).bookPrinting).toBe("Third");
  });
});

describe("parseCsvBatch", () => {
  const header = csvHeaders.join(",");
  const existing = [
    { id: "a", referenceNumber: 1, name: "Dune", status: "Owned" },
    { id: "b", referenceNumber: 2, name: "Beloved", status: "Owned" }
  ];
  // Column order follows csvHeaders: ref, then the item fields, then delete.
  const row = (ref, name, del = "") => [ref, name, ...Array(csvHeaders.length - 3).fill(""), del].join(",");

  it("rejects a file with no data rows", () => {
    expect(parseCsvBatch(header, existing).error).toBe("That file has no data rows.");
    expect(parseCsvBatch("", existing).error).toBe("That file has no data rows.");
  });

  it("rejects a file whose columns do not line up", () => {
    expect(parseCsvBatch("colour,size\nred,large", existing).error).toMatch(/Couldn't find a "name" or "ref" column/);
  });

  it("treats a row with no reference as a new item", () => {
    const result = parseCsvBatch(`${header}\n${row("", "The Gunslinger")}`, existing);
    expect(result.error).toBe(null);
    expect(result.creates).toHaveLength(1);
    expect(result.creates[0].name).toBe("The Gunslinger");
    expect(result.updates).toHaveLength(0);
  });

  it("treats a row with a known reference as an update", () => {
    const result = parseCsvBatch(`${header}\n${row("FF-0001", "Dune Revised")}`, existing);
    expect(result.updates).toHaveLength(1);
    expect(result.updates[0].existing.id).toBe("a");
    expect(result.updates[0].fields.name).toBe("Dune Revised");
  });

  it("deletes only when the row is explicitly marked", () => {
    const result = parseCsvBatch(`${header}\n${row("FF-0002", "Beloved", "yes")}`, existing);
    expect(result.deletes).toHaveLength(1);
    expect(result.deletes[0].id).toBe("b");
  });

  it("accepts the delete tokens a person would actually type", () => {
    for (const token of ["y", "yes", "TRUE", "x", "1", "delete", "Remove"]) {
      const result = parseCsvBatch(`${header}\n${row("FF-0001", "Dune", token)}`, existing);
      expect(result.deletes, `token ${token}`).toHaveLength(1);
    }
  });

  // A row simply absent from the file means "leave it alone". Anything else
  // would make an edited export silently destructive.
  it("leaves items out of the file untouched", () => {
    const result = parseCsvBatch(`${header}\n${row("FF-0001", "Dune")}`, existing);
    expect(result.deletes).toHaveLength(0);
    expect(result.updates).toHaveLength(1);
  });

  it("refuses to guess when a reference appears twice", () => {
    const csv = `${header}\n${row("FF-0001", "Dune")}\n${row("FF-0001", "Dune again")}`;
    const result = parseCsvBatch(csv, existing);
    expect(result.error).toMatch(/FF-0001 appears on both line 2 and line 3/);
    // Nothing is applied -- not even the rows that were fine.
    expect(result.creates).toHaveLength(0);
    expect(result.updates).toHaveLength(0);
    expect(result.deletes).toHaveLength(0);
  });

  it("rejects a delete that names no item", () => {
    const result = parseCsvBatch(`${header}\n${row("", "Mystery", "yes")}`, existing);
    expect(result.deletes).toHaveLength(0);
    expect(result.rejected[0].reason).toMatch(/no reference number/);
  });

  it("rejects a reference that is not in the collection", () => {
    const result = parseCsvBatch(`${header}\n${row("FF-0099", "Ghost")}`, existing);
    expect(result.updates).toHaveLength(0);
    expect(result.rejected[0].reference).toBe("FF-0099");
  });

  it("skips unnamed rows quietly instead of creating blanks", () => {
    const result = parseCsvBatch(`${header}\n${row("", "")}\n${row("", "Real Item")}`, existing);
    expect(result.creates).toHaveLength(1);
    expect(result.creates[0].name).toBe("Real Item");
  });

  it("explains itself when nothing could be applied", () => {
    const result = parseCsvBatch(`${header}\n${row("FF-0099", "Ghost")}`, existing);
    expect(result.error).toMatch(/No rows could be applied/);
  });

  it("handles creates, updates, and deletes in one file", () => {
    const csv = [header, row("", "New Find"), row("FF-0001", "Dune Revised"), row("FF-0002", "Beloved", "y")].join("\n");
    const result = parseCsvBatch(csv, existing);
    expect(result.error).toBe(null);
    expect(result.creates).toHaveLength(1);
    expect(result.updates).toHaveLength(1);
    expect(result.deletes).toHaveLength(1);
  });
});
