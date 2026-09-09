// Fills public.book_catalog from Open Library.
//
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-book-catalog.mjs
//   node scripts/seed-book-catalog.mjs --dry-run        # fetch, print, write nothing
//   node scripts/seed-book-catalog.mjs --authors "Frank Herbert"
//   node scripts/seed-book-catalog.mjs --out books.json # save what was collected
//   node scripts/seed-book-catalog.mjs --in books.json  # upload that, no fetching
//
// Run supabase/book-catalog.sql first -- this writes to a table that file
// creates. Safe to re-run: rows are upserted on the Open Library work key, so a
// second run corrects what changed upstream rather than duplicating it.
//
// Uses the service role key, because book_catalog has no insert policy for
// anyone. That is the point: the catalog is read-only to the app, and the only
// things that write to it run outside the browser. Never put this key in
// NEXT_PUBLIC_ anything.
//
// On being a good citizen: Open Library is a free service run by a nonprofit.
// This identifies itself, asks for one page at a time, and sleeps between
// requests. Do not raise the concurrency to make a one-off seed finish faster.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AUTHORS, SUBJECTS } from "./catalog-seed-list.mjs";

const OPEN_LIBRARY = "https://openlibrary.org/search.json";
const USER_AGENT = "FirstFinder catalog seed (https://github.com/dchung8811/FirstFinder)";

// Results are relevance-ordered, so the first sixty for an author are the books
// they are known for and the tail is omnibus reprints, foreign editions, and
// criticism about them. Sixty across roughly a hundred and twenty authors plus
// six subject sweeps lands the catalog in the low thousands once duplicates and
// the filters in toRow have taken their cut -- which is the size the catalog
// wants to be. Ten thousand rows of long tail would only make the eleven
// verified guides harder to find in a dropdown.
const PER_QUERY = 60;
const REQUEST_PAUSE_MS = 1200;
const UPSERT_BATCH = 500;

// Anything before this is almost always a catalogue record for something that
// is not the book: a later reissue misdated, or a serial. Anything after is
// still in print and not yet collectible.
const EARLIEST_YEAR = 1700;
const LATEST_YEAR = new Date().getFullYear();

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

function flagValue(flag) {
  const at = args.indexOf(flag);
  return at === -1 ? null : args[at + 1] || null;
}

// Collecting takes about fifteen minutes of deliberately slow requests, so a
// failure in the write half should not cost that again. --out saves what was
// collected; --in uploads it without touching Open Library at all.
const outFile = flagValue("--out");
const inFile = flagValue("--in");
const authorOverride = args.includes("--authors")
  ? args[args.indexOf("--authors") + 1]?.split(",").map((name) => name.trim()).filter(Boolean)
  : null;

// .env.local is what the app uses, so the seed reads the same file rather than
// asking anyone to keep a second copy of the same two secrets.
function loadEnvLocal() {
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const value = match[2].replace(/^["']|["']$/g, "");
      if (!process.env[match[1]]) process.env[match[1]] = value;
    }
  } catch {
    // No .env.local is fine -- the variables may come from the shell.
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Open Library's author search is a token match, not a phrase match, and it
// ignores quoting: asking for author:"Frank Herbert" returns Henry William
// Herbert, who wrote sporting sketches in the 1830s. Sorting oldest-first then
// puts him at the top of the results. Every one of those rows would be a wrong
// answer in a collector's dropdown, so the author is checked again here.
//
// Punctuation and accents are stripped before comparing, so "J.R.R. Tolkien"
// matches "J. R. R. Tolkien" and "John le Carre" matches "John le Carré".
function normalizeName(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Open Library is inconsistent about spacing in initials, and the phrase query
// is not: author:"J. R. R. Tolkien" finds two records, both of them conference
// proceedings, while author:"J.R.R. Tolkien" finds three hundred and forty-five.
// Rather than hand-maintaining which spelling each name wants, ask for the
// spaced form and fall back to the compressed one when nothing matched.
function authorQueryVariants(name) {
  const compressed = name.replace(/\b([A-Za-z])\.\s+(?=[A-Za-z]\.)/g, "$1.");
  return compressed === name ? [name] : [name, compressed];
}

function matchesAuthor(doc, expected) {
  if (!expected) return true;

  const wanted = normalizeName(expected);
  return (doc.author_name || []).some((name) => normalizeName(name) === wanted);
}

async function fetchPage(params) {
  const url = `${OPEN_LIBRARY}?${new URLSearchParams({
    ...params,
    fields: "key,title,author_name,first_publish_year,publisher,cover_i",
    limit: String(PER_QUERY)
  })}`;

  // A hundred and thirty sequential requests will hit a blip somewhere. Losing
  // an author's whole bibliography to one dropped connection is not worth it.
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });

      // 429 and 5xx are worth retrying; a 400 means the query is wrong and
      // asking again more slowly will not fix it.
      if (response.status === 429 || response.status >= 500) {
        throw new Error(`Open Library returned ${response.status}`);
      }
      if (!response.ok) {
        return { docs: [], fatal: `Open Library returned ${response.status}` };
      }

      return { docs: (await response.json()).docs || [] };
    } catch (error) {
      lastError = error;
      await sleep(attempt * 2000);
    }
  }

  return { docs: [], fatal: lastError?.message || "request failed" };
}

// Rows that are not a collectible book, whatever else they are.
//
// This is the seed-time half of a rule enforced in two places; the other half
// is supabase/book-catalog-cleanup.sql, which removed 461 of these from an
// already-seeded catalog. Both lists have to say the same thing, or a re-run
// puts back what the cleanup took out.
//
// Each pattern earned its place by showing up in the first real seed:
//
//   * Print-on-demand houses reprinting public-domain classics. Open Library
//     reports the WORK's year, so these arrive looking like "Frankenstein,
//     1818, CreateSpace" -- which is the most misleading row shape possible for
//     someone cataloguing a first edition. 368 of the 461 were these.
//   * Omnibuses, boxed sets and collected works. Real books, but not a first
//     edition of anything.
//   * Study aids, colouring books, graphic novel adaptations, tie-ins.
//   * Rows whose title is just the author's name, which is how Open Library
//     files critical selections.
//
// Deliberately NOT excluded, having been caught by earlier, greedier versions
// of these rules: anything merely containing "illustrated" or "annotated"
// (which killed Bradbury's The Illustrated Man), and titles listing several
// works (which killed Stevenson's The Merry Men and Orwell's Dickens, Dali &
// Others). Both are ordinary shapes for a genuine first edition. When a rule
// here is uncertain, it should let the row through -- a junk suggestion costs a
// scroll, and a missing one costs the collector the feature.
const REJECT_PUBLISHER = /(independently published|createspace|lulu\.com|bookrix|blurb|authorhouse|xlibris|iuniverse|outskirts press|dorrance|vdm publishing|alpha edition|sagwan|palala|wentworth press|trieste publishing|hansebooks|nabu press|forgotten books|bibliolife|kessinger|legare street|franklin classics|scholar select|creative media partners)/i;

const REJECT_TITLE = /((movie|film|tv|television) tie[- ]?in|sparknotes|cliffsnotes|cliffs notes|study guide|lesson plans|teacher's guide|workbook|omnibus|boxed set|box set|complete (works|novels|stories|poetical works|writings|series)|collected (works|novels)|the complete sherlock|coloring book|colouring book|activity book|audiobook|audio book|graphic novel|\[audio|dvd|vhs)/i;

const REJECT_AUTHOR = /^(sparknotes|cliffsnotes|bookrags)$/i;

// Set-shaped titles: omnibuses, collected works, split-volume scans, and
// bundles. A set is not a first edition of anything, so none of it belongs in a
// catalog for people cataloguing first editions.
//
// These rules exist twice, here and in supabase/book-catalog-cleanup.sql, and
// the two dialects do not spell things the same way: Postgres writes a word
// boundary \y, JavaScript writes \b. Getting that wrong does not throw -- \y in
// a JS regex quietly means a literal "y" -- so the filter silently passes
// everything. That is what the tests next door are for.
//
// These are tested against the HEAD of the title -- everything before the first
// bracket or parenthesis -- because Open Library appends its own annotations
// there and they describe the edition record rather than the book. Testing the
// raw string is how "The Adventures of Sherlock Holmes [12 stories]" reads as a
// collection, "Cover Her Face (Adam Dalgliesh Mystery Series #1)" reads as a
// series bundle, and two genuine first editions get thrown away.
const SET_TITLE = /(\b(trilogy|tetralogy|quartet|quintet|duology)\b|\b(complete|collected|selected)\s+(prose\s+|poetical\s+)?(works|writings|essays|letters|poems|plays|adventures|novels)\b|\b(books?|vols?\.?|volumes?)\s*\.?\s*\d{1,2}\s*[-–—]\s*\d{1,2}\b|\bin (two|three|four|five) volumes|\b(two|three|four|five|six|seven|eight|nine|ten)\s+(complete\s+)?(novels|books)\b)/i;

// A title that is nothing but a set noun.
const BARE_SET_TITLES = new Set(["trilogy", "omnibus", "collection", "works", "novels", "stories", "complete"]);

// Open Library's split-volume scans ("Wuthering Heights [1/2]") and its series
// bundles ("Harry Potter (series) 1-7"), both of which live in the annotations
// the head strips off -- so these two are tested against the whole title.
const SPLIT_VOLUME = /\[\s*\d+\s*\/\s*\d+\s*\]|\(series\)\s*\d/i;

function titleHead(title) {
  return title.replace(/\[[^\]]*\]/g, "").replace(/\([^)]*\)?.*$/g, "").trim();
}

function isCollectibleShape(title, author, publisher) {
  if (REJECT_PUBLISHER.test(publisher)) return false;
  if (REJECT_TITLE.test(title)) return false;
  if (REJECT_AUTHOR.test(author)) return false;
  if (SPLIT_VOLUME.test(title)) return false;

  const head = titleHead(title);
  if (SET_TITLE.test(head)) return false;
  if (BARE_SET_TITLES.has(head.toLowerCase())) return false;

  // Open Library files critical selections under the subject's own name.
  if (title.trim().toLowerCase() === author.trim().toLowerCase()) return false;

  return true;
}

export { isCollectibleShape, titleHead };

// Turns an Open Library doc into a catalog row, or null if it is not usable.
//
// The filters here are the difference between a catalog and a pile. A record
// with no author, no year, or no work key cannot be told apart from another
// record of the same title, and a suggestion the collector cannot identify is
// worse than no suggestion.
function toRow(doc) {
  const title = (doc.title || "").trim();
  const author = (doc.author_name?.[0] || "").trim();
  const year = doc.first_publish_year;

  if (!title || title.length > 200) return null;
  if (!author) return null;
  if (!doc.key) return null;
  if (!year || year < EARLIEST_YEAR || year > LATEST_YEAR) return null;

  const publisher = (doc.publisher?.[0] || "").trim().slice(0, 120);
  if (!isCollectibleShape(title, author, publisher)) return null;

  return {
    title,
    author,
    // Open Library lists every publisher that ever issued the work and the
    // first is the closest thing it offers to the original -- which is still
    // frequently a later reissue, so this is the field on the add form most
    // worth a collector's second look.
    publisher,
    first_published_year: year,
    cover_id: doc.cover_i ? String(doc.cover_i) : "",
    openlibrary_key: doc.key,
    source: "openlibrary"
  };
}

async function collect() {
  const rows = new Map();
  const authors = authorOverride || AUTHORS;
  const subjects = authorOverride ? [] : SUBJECTS;
  // Two things about this query shape were arrived at by watching it fail.
  //
  // It is `q=author:"Name"` rather than `author=Name`, which narrowed a Frank
  // Herbert search from 1402 results to 278 -- the plain parameter matches on
  // any token, so it returns every Herbert who ever wrote anything.
  //
  // And it is relevance-ordered rather than sort=old. Oldest-first sounds right
  // for a first-editions catalog and is exactly wrong here: it fills the first
  // hundred results with whichever nineteenth-century namesake shares a surname
  // with the author, and pushes the actual author off the end. Relevance puts
  // Dune first. The year filter in toRow does the job sort=old was reaching for.
  const queries = [
    ...authors.map((author) => ({ label: author, expectAuthor: author, variants: authorQueryVariants(author) })),
    // No expected author on a subject sweep -- that is the point of it, to pick
    // up the one-book award winner who has no bibliography here.
    ...subjects.map((subject) => ({ label: subject, expectAuthor: null, subject }))
  ];

  let index = 0;
  for (const query of queries) {
    index += 1;
    try {
      // One request for a subject; for an author, the spaced spelling first and
      // the compressed one only if that found nothing of theirs.
      const attempts = query.subject
        ? [{ subject: query.subject }]
        : query.variants.map((variant) => ({ q: `author:"${variant}"` }));

      let kept = 0;
      let seen = 0;

      for (const params of attempts) {
        const { docs, fatal } = await fetchPage(params);
        if (fatal) throw new Error(fatal);
        seen += docs.length;

        for (const doc of docs) {
          if (!matchesAuthor(doc, query.expectAuthor)) continue;

          const row = toRow(doc);
          if (!row) continue;
          // Keyed by work, so an author who also shows up under an award list is
          // one row rather than two.
          if (rows.has(row.openlibrary_key)) continue;
          rows.set(row.openlibrary_key, row);
          kept += 1;
        }

        if (kept > 0) break;
        if (attempts.length > 1) await sleep(REQUEST_PAUSE_MS);
      }

      console.log(`[${index}/${queries.length}] ${query.label}: ${kept} kept of ${seen}`);
    } catch (error) {
      // One bad query should not cost the other hundred and twenty.
      console.warn(`[${index}/${queries.length}] ${query.label}: skipped (${error.message})`);
    }

    await sleep(REQUEST_PAUSE_MS);
  }

  return [...rows.values()];
}

// Writes through PostgREST directly rather than through @supabase/supabase-js.
//
// The client library is the right tool inside the app, and the wrong one here:
// it pulls in a realtime transport that requires a native WebSocket, so on
// Node 20 this script died after collecting six thousand books with a complaint
// about WebSockets it had no reason to need. An upsert is one POST. Depending on
// the runtime's Node version for a bulk insert is a floor worth not having.
async function upsertRows(rows) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (in .env.local or the shell).");
  }

  const endpoint = `${url.replace(/\/$/, "")}/rest/v1/book_catalog?on_conflict=openlibrary_key`;
  let written = 0;

  for (let start = 0; start < rows.length; start += UPSERT_BATCH) {
    const batch = rows.slice(start, start + UPSERT_BATCH);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        // merge-duplicates is what makes this an upsert rather than a conflict;
        // return=minimal keeps six thousand rows from being echoed back.
        Prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify(batch)
    });

    if (!response.ok) {
      throw new Error(`Upsert failed at row ${start}: ${response.status} ${await response.text()}`);
    }

    written += batch.length;
    console.log(`Wrote ${written}/${rows.length}`);
  }

  return written;
}

async function main() {
  loadEnvLocal();

  const rows = inFile
    ? JSON.parse(readFileSync(inFile, "utf8"))
    : await collect();

  console.log(`\n${inFile ? "Loaded" : "Collected"} ${rows.length} books.`);

  if (outFile) {
    writeFileSync(outFile, JSON.stringify(rows, null, 2));
    console.log(`Saved to ${outFile}.`);
  }

  if (dryRun) {
    console.log(rows.slice(0, 20));
    console.log("\n--dry-run: nothing written.");
    return;
  }

  await upsertRows(rows);
  console.log("\nDone.");
}

// Only when run directly. The filters above are exported and unit-tested, and
// importing this file must not kick off a fifteen-minute scrape of Open Library.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
