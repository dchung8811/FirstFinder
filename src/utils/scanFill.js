// Turns what the scan-to-fill route read off a cover and a copyright page into
// Quick Add fields.
//
// The model is only ever asked to transcribe: the title as printed, the
// edition statement as printed, the number line digit for digit. Deciding what
// those mean -- which printing a number line is, whether "First Edition" over a
// line ending in 3 is a first printing -- happens here, in code, so the answer
// is the same every time, can be tested, and comes with a reason the collector
// can check against the book in their hand. That is the difference between
// this feature and the search-grounded identification: nothing here is a
// guess dressed up as a finding.

import { authoredCategories, quickCategories } from "./constants";

const ordinalWords = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];

// The Edition and Printing selects stop at Fifth. Anything later is "Other",
// with the exact number kept in the reason so it isn't lost.
const printingLabels = ["First", "Second", "Third", "Fourth", "Fifth"];

export function printingLabel(number) {
  if (!Number.isInteger(number) || number < 1) return "";
  return printingLabels[number - 1] || "Other";
}

function ordinal(number) {
  const word = ordinalWords[number - 1];
  if (word) return word;
  const tens = number % 100;
  const suffix = tens >= 11 && tens <= 13 ? "th" : { 1: "st", 2: "nd", 3: "rd" }[number % 10] || "th";
  return `${number}${suffix}`;
}

// The printing a number line records: the lowest number still on it. Each
// reprint knocks the lowest number off the plate, so "10 9 8 7 6 5 4 3" is a
// third printing however the digits are arranged -- descending, ascending, or
// alternating ("1 3 5 7 9 10 8 6 4 2").
//
// Two kinds of number are ignored, because they are year codes rather than
// printings: zero-padded ones ("05 06 07"), and anything over 30 ("82 83 84").
// Year codes run alongside the printing digits on many lines
// ("81 82 83 84 10 9 8 7 6 5 4 3 2 1"), and are always higher than the
// printing they sit next to, so dropping them never hides the lowest number.
//
// A single number is not a line -- it is too easily a page number or a stray
// digit from the address block -- so this wants at least two.
export function printingFromNumberLine(numberLine) {
  const tokens = String(numberLine || "").match(/\b\d{1,2}\b/g) || [];
  const printings = tokens
    .filter((token) => !(token.length === 2 && token.startsWith("0")))
    .map(Number)
    .filter((value) => value >= 1 && value <= 30);

  if (printings.length < 2) return null;
  return Math.min(...printings);
}

// "Second printing", "3rd printing, May 1962" -- an explicit statement beats a
// number line when a book has both, because it is the publisher saying it in
// words.
export function printingFromStatement(statement) {
  const text = String(statement || "").toLowerCase();
  const word = text.match(new RegExp(`\\b(${ordinalWords.join("|")})\\s+printing\\b`));
  if (word) return ordinalWords.indexOf(word[1]) + 1;
  const numeral = text.match(/\b(\d{1,2})(?:st|nd|rd|th)\s+printing\b/);
  if (numeral) return Number(numeral[1]);
  return null;
}

// The edition a statement on the copyright page claims, as one of the Edition
// select's values. A book club edition is never a first edition in the sense a
// collector means, whatever else the page says, so it is checked first.
export function editionFromStatement(statement) {
  const text = String(statement || "").toLowerCase();
  if (!text.trim()) return "";
  if (/book\s*club/.test(text)) return "Other";
  const word = text.match(new RegExp(`\\b(${ordinalWords.slice(0, 5).join("|")})\\b(?:\\s+[a-z.]+)?\\s+edition\\b`));
  if (word) return printingLabels[ordinalWords.indexOf(word[1])];
  if (/\bfirst\s+printing\b/.test(text)) return "First";
  if (/\bedition\b/.test(text)) return "Other";
  return "";
}

// Edition and printing from everything the scan read, with the reasoning in
// plain words. Every reason names the evidence, so the collector can hold the
// copyright page up next to it.
//
// Random House is the one publisher rule built in, because it is the one that
// turns the general rule upside down for a huge number of books: for decades
// its first printings carried "First Edition" over a number line that starts
// at 2, and dropped the statement on reprinting. Read naively, every one of
// those would be called a second printing.
export function readEditionAndPrinting({ editionStatement, printingStatement, numberLine, publisher } = {}) {
  const reasons = [];
  const bookEdition = editionFromStatement(editionStatement);
  if (bookEdition) reasons.push(`The copyright page says "${String(editionStatement).trim()}".`);

  const stated = printingFromStatement(printingStatement) ?? printingFromStatement(editionStatement);
  if (stated) {
    reasons.push(`It states the ${ordinal(stated)} printing in words.`);
    return { bookEdition: bookEdition || (stated === 1 ? "First" : ""), bookPrinting: printingLabel(stated), reasons };
  }

  const lowest = printingFromNumberLine(numberLine);
  if (lowest === null) {
    if (String(numberLine || "").trim()) {
      reasons.push(`Couldn't read a printing from the number line "${String(numberLine).trim()}". Check it against the book.`);
    } else if (bookEdition === "First") {
      reasons.push("No number line was found, so the printing is left for you to confirm. Some publishers kept the edition statement on later printings.");
    }
    return { bookEdition, bookPrinting: "", reasons };
  }

  if (lowest === 2 && bookEdition === "First" && /random\s+house/i.test(String(publisher || ""))) {
    reasons.push("The number line starts at 2, which on a Random House book stating \"First Edition\" is a first printing. Random House dropped the statement on later printings.");
    return { bookEdition, bookPrinting: "First", reasons };
  }

  reasons.push(`The lowest number on the number line is ${lowest}, so this is the ${ordinal(lowest)} printing.`);
  return { bookEdition, bookPrinting: printingLabel(lowest), reasons };
}

// The route's raw transcription, mapped onto item fields. Only fields with
// something in them are returned, so a cover-only scan never blanks out a
// publisher an earlier copyright-page scan already filled.
export function scanResultToFields(result) {
  const category = quickCategories.includes(result?.category) ? result.category : "Book";
  const title = String(result?.title || "").trim();
  const author = String(result?.author || "").trim();
  const publisher = String(result?.publisher || "").trim();
  const authored = authoredCategories.includes(category);

  const fields = { category, name: title };
  if (authored) {
    fields.author = author;
    fields.maker = publisher;
  } else {
    // Only books and comics have an Author field. For anything else, the
    // publisher is the credit, and failing that whoever is named on it.
    fields.maker = publisher || author;
  }

  let reasons = [];
  if (category === "Book") {
    const read = readEditionAndPrinting({
      editionStatement: result?.editionStatement,
      printingStatement: result?.printingStatement,
      numberLine: result?.numberLine,
      publisher
    });
    fields.bookEdition = read.bookEdition;
    fields.bookPrinting = read.bookPrinting;
    reasons = read.reasons;
  }

  return {
    fields: Object.fromEntries(Object.entries(fields).filter(([, value]) => value)),
    reasons
  };
}

// Folds a scan into the Quick Add form without overwriting the collector. A
// field is filled only while it is still empty, so a second scan (the
// copyright page after the cover) adds what the first couldn't see, and
// anything typed by hand always wins.
//
// Category is the exception, because the form starts on "Book" rather than
// empty: the scan sets it only while the form has no name yet, which is the
// moment nothing on the form is the collector's own.
export function mergeScanIntoItem(item, fields) {
  const next = { ...item };
  const filled = [];

  for (const [key, value] of Object.entries(fields || {})) {
    if (key === "category") {
      if (!String(item?.name || "").trim() && value !== item?.category) {
        next.category = value;
        filled.push(key);
      }
      continue;
    }
    if (!String(item?.[key] ?? "").trim()) {
      next[key] = value;
      filled.push(key);
    }
  }

  return { item: next, filled };
}
