// CSV template, export, parsing, and the create/update/delete batch planner.
//
// parseCsvBatch is the most destructive path in the app -- a malformed file here
// could delete someone's collection -- so its rules stay conservative and its
// failures stay loud.

import { csvHeaders, csvItemFields, csvTemplateRows, csvDeleteTokens, emptyItem, statuses, conditionOptions, bookEditionOptions, bookPrintingOptions } from "./constants";
import { formatReference, parseReference } from "./format";
import { makeSavedItem } from "./items";

export function csvEscape(value) {
  const stringValue = String(value ?? "");
  if (/[",\n]/.test(stringValue)) return `"${stringValue.replace(/"/g, '""')}"`;
  return stringValue;
}

export function buildCsvTemplate() {
  const rows = [csvHeaders, ...csvTemplateRows];
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

// csvHeaders lines up 1:1 with the item objects' own field names, so each
// row is just each header looked up on the item -- no per-column mapping to
// maintain in parallel with the import side.
// Leads with the item's reference number so the exported file can be edited
// and re-uploaded to update or delete those same items. The trailing "delete"
// column is exported blank, ready for the user to mark rows in a spreadsheet.
export function buildCsvExport(items) {
  const rows = items.map((item) => [
    formatReference(item.referenceNumber),
    ...csvItemFields.map((field) => item[field] ?? ""),
    ""
  ]);
  return [csvHeaders, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
}

// Parses the whole CSV text into rows of trimmed values, character by
// character, so a quoted field can contain commas or newlines without
// breaking row boundaries (splitting on "\n" before parsing quotes, as a
// line-by-line parser would, corrupts any quoted multi-line field).
export function parseCsvRows(csvText) {
  const rows = [];
  let currentRow = [];
  let field = "";
  let inQuotes = false;
  const text = String(csvText || "");

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      currentRow.push(field.trim());
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && nextChar === "\n") i += 1;
      currentRow.push(field.trim());
      field = "";
      rows.push(currentRow);
      currentRow = [];
    } else {
      field += char;
    }
  }

  if (field.length > 0 || currentRow.length > 0) {
    currentRow.push(field.trim());
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((value) => value.length > 0));
}

// Only pulls fields whose column was actually present in the uploaded file.
// This matters for updates: if someone exports, deletes a column in their
// spreadsheet, and re-uploads, the absent column must be left alone rather
// than blanking that field on every item.
export function sanitizeCsvFields(row, presentHeaders) {
  const fields = {};

  csvItemFields.forEach((field) => {
    if (presentHeaders.includes(field)) fields[field] = row[field] ?? "";
  });

  // Enum columns fall back to a safe value rather than writing junk.
  //
  // "Wishlist" gets its own landing spot rather than the general fallback.
  // It was a real status until wants moved to their own table, so it turns up
  // in older exports and in files people hand-write -- and defaulting it to
  // "Owned" would silently record that someone owns a book they were still
  // hunting, inflating their collection and its value. "Researching" is the
  // nearest surviving status that claims no ownership. Wants themselves are
  // not importable by CSV yet; the collector re-adds them on the Wishlist tab.
  if ("status" in fields) {
    if (fields.status === "Wishlist") fields.status = "Researching";
    else fields.status = statuses.includes(fields.status) ? fields.status : "Owned";
  }
  if ("condition" in fields) fields.condition = conditionOptions.includes(fields.condition) ? fields.condition : "";
  if ("bookEdition" in fields) fields.bookEdition = bookEditionOptions.includes(fields.bookEdition) ? fields.bookEdition : "";
  if ("bookPrinting" in fields) fields.bookPrinting = bookPrintingOptions.includes(fields.bookPrinting) ? fields.bookPrinting : "";

  return fields;
}

// Reads an uploaded CSV and sorts every row into create / update / delete,
// matching existing items on their reference number.
//
// The rules here are deliberately conservative, because this is the one place
// in the app where a malformed file could destroy data:
//   - a row absent from the file means "leave it alone", never "delete it"
//   - deleting requires an explicit flag AND a reference number
//   - a reference number repeated in one file rejects the whole file rather
//     than guessing which instruction wins
export function parseCsvBatch(csvText, existingItems = []) {
  const empty = { creates: [], updates: [], deletes: [], rejected: [] };
  const rows = parseCsvRows(csvText);

  if (rows.length < 2) {
    return { ...empty, error: "That file has no data rows." };
  }

  const headers = rows[0].map((header) => header.trim());
  const lowerHeaders = headers.map((header) => header.toLowerCase());
  if (!lowerHeaders.includes("name") && !lowerHeaders.includes("ref")) {
    return { ...empty, error: `Couldn't find a "name" or "ref" column. Use the downloaded template so columns match: ${csvHeaders.join(", ")}.` };
  }

  const byReference = new Map(
    existingItems
      .filter((item) => item.referenceNumber !== null && item.referenceNumber !== undefined)
      .map((item) => [item.referenceNumber, item])
  );

  const creates = [];
  const updates = [];
  const deletes = [];
  const rejected = [];
  const seenReferences = new Map();

  for (let index = 1; index < rows.length; index += 1) {
    const values = rows[index];
    const row = headers.reduce((acc, header, position) => ({ ...acc, [header]: values[position] || "" }), {});
    // 1-based line number as the user sees it in a spreadsheet.
    const line = index + 1;

    const reference = parseReference(row.ref);
    const isDelete = csvDeleteTokens.includes(String(row.delete || "").trim().toLowerCase());

    if (reference !== null) {
      if (seenReferences.has(reference)) {
        return {
          ...empty,
          error: `${formatReference(reference)} appears on both line ${seenReferences.get(reference)} and line ${line}. Each reference can only appear once per file, so nothing was changed.`
        };
      }
      seenReferences.set(reference, line);
    }

    if (isDelete && reference === null) {
      rejected.push({ line, reference: "", reason: "Marked for deletion but has no reference number, so there's no way to tell which item you meant." });
      continue;
    }

    if (reference !== null) {
      const existing = byReference.get(reference);
      if (!existing) {
        rejected.push({ line, reference: formatReference(reference), reason: "No item in your collection has this reference number." });
        continue;
      }

      if (isDelete) {
        deletes.push(existing);
      } else {
        updates.push({ existing, fields: sanitizeCsvFields(row, headers) });
      }
      continue;
    }

    // No reference and not a delete: this is a new item. Blank lines are
    // skipped quietly, matching how the import has always behaved.
    const fields = sanitizeCsvFields(row, headers);
    if (String(fields.name || "").trim().length === 0) continue;
    creates.push(makeSavedItem({ ...emptyItem, ...fields }, 0, 0));
  }

  const total = creates.length + updates.length + deletes.length;
  if (total === 0) {
    return {
      ...empty,
      rejected,
      error: rejected.length > 0 ? "No rows could be applied. See the details below." : "No rows in that file had anything to add, change, or remove."
    };
  }

  return { creates, updates, deletes, rejected, error: null };
}
