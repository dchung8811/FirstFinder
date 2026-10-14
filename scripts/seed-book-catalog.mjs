// Fills public.book_catalog from Open Library.
//
//   SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-book-catalog.mjs
//   node scripts/seed-book-catalog.mjs --dry-run        # fetch, print, write nothing
//   node scripts/seed-book-catalog.mjs --authors "Frank Herbert"
//   node scripts/seed-book-catalog.mjs --out books.json # save what was collected
//   node scripts/seed-book-catalog.mjs --in books.json  # upload that, no fetching
//   node scripts/seed-book-catalog.mjs --cache editions.json  # keep fetched editions
//
// Run supabase/book-catalog.sql first -- this writes to a table that file
// creates. Safe to re-run: rows are upserted on the Open Library work key, and
// then every Open Library row the run did NOT produce is deleted, so the table
// ends up holding exactly this run's books. Without that second step, fixing a
// rule here could never take back a row an earlier, looser run let in. Rows
// with any other source (user, verified) are never touched.
//
// Two passes. The first searches, as before, for which books to include. The
// second asks Open Library for each book's editions and keeps the oldest
// printed English one as the first edition -- see scripts/first-edition.mjs for
// how, and why the search result's own publisher is not good enough. That pass
// is one request per work, so a full run is around two hours; --cache makes an
// interrupted run pick up where it stopped.
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
import { compactEdition, groupWorks, keepMainAuthor, pickFirstEdition, PRINT_ON_DEMAND } from "./first-edition.mjs";

const OPEN_LIBRARY = "https://openlibrary.org/search.json";
const OPEN_LIBRARY_WORKS = "https://openlibrary.org";
const USER_AGENT = "FirstFinder catalog seed (https://github.com/dchung8811/FirstFinder)";

// Results are relevance-ordered, so the first sixty for an author are the books
// they are known for and the tail is omnibus reprints, foreign editions, and
// criticism about them. Sixty across roughly a hundred and twenty authors plus
// six subject sweeps lands the catalog in the low thousands once duplicates and
// the filters in toCandidate have taken their cut -- which is the size the catalog
// wants to be. Ten thousand rows of long tail would only make the eleven
// verified guides harder to find in a dropdown.
const PER_QUERY = 60;
const REQUEST_PAUSE_MS = 1200;
const UPSERT_BATCH = 500;
// Open Library's editions endpoint pages at up to a thousand. Gatsby has 1,180.
const EDITIONS_PAGE = 1000;

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
const cacheFile = flagValue("--cache");
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
// answer in a collector's dropdown, so the author is checked again -- by name,
// and then by Open Library author record, which is what tells Joseph Heller the
// novelist from Joseph Heller the historian. See keepMainAuthor.

// Open Library is inconsistent about spacing in initials, and the phrase query
// is not: author:"J. R. R. Tolkien" finds two records, both of them conference
// proceedings, while author:"J.R.R. Tolkien" finds three hundred and forty-five.
// Rather than hand-maintaining which spelling each name wants, ask for the
// spaced form and fall back to the compressed one when nothing matched.
function authorQueryVariants(name) {
  const compressed = name.replace(/\b([A-Za-z])\.\s+(?=[A-Za-z]\.)/g, "$1.");
  return compressed === name ? [name] : [name, compressed];
}


async function fetchPage(params) {
  const url = `${OPEN_LIBRARY}?${new URLSearchParams({
    ...params,
    fields: "key,title,author_name,author_key,first_publish_year,cover_i,language,edition_count",
    limit: String(PER_QUERY)
  })}`;

  const { body, fatal } = await fetchJson(url);
  return { docs: body?.docs || [], fatal };
}

// A few thousand sequential requests will hit a blip somewhere. Losing an
// author's whole bibliography to one dropped connection is not worth it.
async function fetchJson(url) {
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
        return { body: null, fatal: `Open Library returned ${response.status}` };
      }

      return { body: await response.json() };
    } catch (error) {
      lastError = error;
      await sleep(attempt * 2000);
    }
  }

  return { body: null, fatal: lastError?.message || "request failed" };
}

// Every edition of one work, reduced to what pickFirstEdition reads.
async function fetchEditions(workKey) {
  const editions = [];

  for (let offset = 0; ; offset += EDITIONS_PAGE) {
    const url = `${OPEN_LIBRARY_WORKS}${workKey}/editions.json?limit=${EDITIONS_PAGE}&offset=${offset}`;
    const { body, fatal } = await fetchJson(url);
    if (fatal) throw new Error(fatal);

    const entries = body?.entries || [];
    editions.push(...entries.map(compactEdition));

    if (entries.length < EDITIONS_PAGE || editions.length >= (body?.size || 0)) return editions;
    await sleep(REQUEST_PAUSE_MS);
  }
}

// Rows that are not a collectible book, whatever else they are.
//
// supabase/book-catalog-cleanup.sql once applied these same rules to an
// already-seeded catalog, removing 461 rows. It is history now: a full run
// of this script deletes every Open Library row it did not produce, so these
// filters alone decide what is in the catalog.
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
const REJECT_PUBLISHER = PRINT_ON_DEMAND;

const REJECT_TITLE = /((movie|film|tv|television) tie[- ]?in|sparknotes|cliffsnotes|cliffs notes|study guide|lesson plans|teacher's guide|workbook|omnibus|boxed set|box set|complete (works|novels|stories|poetical works|writings|series)|collected (works|novels)|the complete sherlock|coloring book|colouring book|activity book|audiobook|audio book|graphic novel|\[audio|dvd|vhs|cassette|\bwith connections\b|\(adaptation\)|\ba dramati[sz]ation\b|\b(hardcover|paperback|mass market)\b|\[collection|\bbooks? set\b|\d+\s*-?\s*books?\s+(set|collection|bundle)|\bbox\s*$)/i;

const REJECT_AUTHOR = /^(sparknotes|cliffsnotes|bookrags)$/i;

// Set-shaped titles: omnibuses, collected works, split-volume scans, and
// bundles. A set is not a first edition of anything, so none of it belongs in a
// catalog for people cataloguing first editions.
//
// These began as a port of supabase/book-catalog-cleanup.sql, and the two
// dialects do not spell things the same way: Postgres writes a word boundary
// \y, JavaScript writes \b. Getting that wrong does not throw -- \y in a JS
// regex quietly means a literal "y" -- so the filter silently passes
// everything. That is what the tests next door are for.
//
// These are tested against the HEAD of the title -- everything before the first
// bracket or parenthesis -- because Open Library appends its own annotations
// there and they describe the edition record rather than the book. Testing the
// raw string is how "The Adventures of Sherlock Holmes [12 stories]" reads as a
// collection, "Cover Her Face (Adam Dalgliesh Mystery Series #1)" reads as a
// series bundle, and two genuine first editions get thrown away.
const SET_TITLE = /(\b(trilogy|tetralogy|quartet|quintet|duology)\b|\b(complete|collected|selected)\s+(prose\s+|poetical\s+)?(works|writings|essays|letters|poems|plays|adventures|novels)\b|\b(books?|vols?\.?|volumes?)\s*\.?\s*\d{1,2}\s*[-–—]\s*\d{1,2}\b|\bin (two|three|four|five) volumes|\b(two|three|four|five|six|seven|eight|nine|ten)\s+(complete\s+)?(novels|books)\b)/i;

// Several works bound or listed as one record: "The Great Gatsby / The Last
// Tycoon", "The Orchard Keeper / Suttree / Blood Meridian". A slash with spaces
// round it is how Open Library writes a binding of separate books; no single
// title in the seed list contains one.
const SLASH_BUNDLE = /\s\/\s/;

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
  if (SLASH_BUNDLE.test(title)) return false;

  const head = titleHead(title);
  if (SET_TITLE.test(head)) return false;
  if (BARE_SET_TITLES.has(head.toLowerCase())) return false;

  // Open Library files critical selections under the subject's own name.
  if (title.trim().toLowerCase() === author.trim().toLowerCase()) return false;

  // Bookseller listings copied in as titles: "Catch-22, Joseph Heller",
  // "Catch-22 by Heller, Joseph (2011) Hardcover". The author's surname after a
  // comma or "by" is a listing, not a title -- "The Notebooks of Frank
  // Herbert's Dune" survives because it is neither.
  const surname = author.trim().split(/\s+/).pop()?.toLowerCase();
  if (surname && surname.length > 2) {
    const lower = title.toLowerCase();
    if (lower.includes(` by ${surname}`) || lower.includes(`, ${author.trim().toLowerCase()}`)) return false;
  }

  return true;
}

export { isCollectibleShape, titleHead };

// Turns an Open Library search doc into a candidate work, or null if it is
// not usable. Publisher and year are not taken from here -- the search result's
// publisher is whichever imprint the index lists first -- they come from the
// editions pass.
//
// The filters here are the difference between a catalog and a pile. A record
// with no author, no year, or no work key cannot be told apart from another
// record of the same title, and a suggestion the collector cannot identify is
// worse than no suggestion.
function toCandidate(doc) {
  // Open Library's own annotations come off the stored title: "The Great
  // Gatsby(Published In 1925)" is not what a collector types or expects to see.
  const rawTitle = (doc.title || "").trim();
  const title = titleHead(rawTitle) || rawTitle;
  const author = (doc.author_name?.[0] || "").trim();
  const year = doc.first_publish_year;

  if (!title || title.length > 200) return null;
  if (!author) return null;
  if (!doc.key) return null;
  if (!year || year < EARLIEST_YEAR || year > LATEST_YEAR) return null;

  // A work with no English edition at all is a translation filed as its own
  // work -- "'1984' i esse raznykh let" -- not the book the English title means.
  // No language list at all is let through; old records often lack one.
  if (doc.language?.length && !doc.language.includes("eng")) return null;

  if (!isCollectibleShape(rawTitle, author, "")) return null;

  return {
    title,
    author,
    key: doc.key,
    edition_count: doc.edition_count || 0,
    cover_id: doc.cover_i ? String(doc.cover_i) : ""
  };
}

// Pass one: which works belong in the catalog, keyed by Open Library work.
async function searchWorks() {
  const works = new Map();
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
  // Dune first. The year filter in toCandidate does the job sort=old was reaching for.
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

        const matched = query.expectAuthor ? keepMainAuthor(docs, query.expectAuthor) : docs;

        for (const doc of matched) {

          const work = toCandidate(doc);
          if (!work) continue;
          // Keyed by work, so an author who also shows up under an award list is
          // one row rather than two.
          if (works.has(work.key)) continue;
          works.set(work.key, work);
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

  return [...works.values()];
}

function loadCache() {
  if (!cacheFile) return {};
  try {
    return JSON.parse(readFileSync(cacheFile, "utf8"));
  } catch {
    return {};
  }
}

// Pass two: one catalog row per book, carrying its first edition.
//
// Works that are the same book are merged first (groupWorks), and their
// editions pooled, so Catch-22's three work records become one row. A book
// whose editions cannot support a first-edition claim is left out entirely --
// that is the difference between this catalog and the one it replaces.
async function resolveFirstEditions(works) {
  const groups = groupWorks(works, authorOverride || AUTHORS);
  const cache = loadCache();
  const rows = [];
  let fetched = 0;
  let dropped = 0;

  for (const [index, group] of groups.entries()) {
    const editions = [];

    for (const work of group) {
      if (!cache[work.key]) {
        try {
          cache[work.key] = await fetchEditions(work.key);
        } catch (error) {
          console.warn(`  ${work.title}: editions skipped (${error.message})`);
          continue;
        } finally {
          await sleep(REQUEST_PAUSE_MS);
        }
        fetched += 1;
        // Saved every fifty fetches, so a crash costs a minute, not an hour.
        if (cacheFile && fetched % 50 === 0) writeFileSync(cacheFile, JSON.stringify(cache));
      }
      editions.push(...cache[work.key]);
    }

    const canonical = group[0];
    const first = pickFirstEdition(editions);

    if (!first || first.year < EARLIEST_YEAR || first.year > LATEST_YEAR) {
      dropped += 1;
    } else {
      rows.push({
        title: canonical.title,
        author: canonical.author,
        publisher: first.publisher,
        first_published_year: first.year,
        cover_id: group.find((work) => work.cover_id)?.cover_id || "",
        openlibrary_key: canonical.key,
        source: "openlibrary"
      });
    }

    if ((index + 1) % 100 === 0 || index === groups.length - 1) {
      console.log(`[${index + 1}/${groups.length}] books resolved, ${rows.length} kept, ${dropped} without a datable first edition`);
    }
  }

  if (cacheFile) writeFileSync(cacheFile, JSON.stringify(cache));
  return rows;
}

async function collect() {
  const works = await searchWorks();
  console.log(`\nFound ${works.length} candidate works. Fetching editions...`);
  return resolveFirstEditions(works);
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

// Deletes the Open Library rows this run did not produce: the duplicates and
// reissues a looser earlier seed let in. Only after a successful upsert, and
// only source = 'openlibrary' -- user and verified rows are not the seed's to
// remove. Nothing references book_catalog (a pick copies its fields), so a
// deleted row cannot orphan anyone's record.
async function pruneRows(rows) {
  // A short run (--authors) would otherwise wipe the whole catalog down to one
  // author's books. Pruning only makes sense after a full collection.
  if (authorOverride) {
    console.log("--authors run: not pruning rows from other authors.");
    return 0;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const keep = new Set(rows.map((row) => row.openlibrary_key));

  const existing = [];
  for (let offset = 0; ; offset += 1000) {
    const response = await fetch(
      `${url}/rest/v1/book_catalog?select=openlibrary_key&source=eq.openlibrary&order=openlibrary_key&limit=1000&offset=${offset}`,
      { headers }
    );
    if (!response.ok) throw new Error(`Listing failed: ${response.status} ${await response.text()}`);
    const page = await response.json();
    existing.push(...page.map((row) => row.openlibrary_key));
    if (page.length < 1000) break;
  }

  const stale = existing.filter((workKey) => workKey && !keep.has(workKey));

  // In batches small enough that the in.(...) list fits in a URL.
  for (let start = 0; start < stale.length; start += 100) {
    const batch = stale.slice(start, start + 100).map((workKey) => `"${workKey}"`).join(",");
    const response = await fetch(`${url}/rest/v1/book_catalog?source=eq.openlibrary&openlibrary_key=in.(${encodeURIComponent(batch)})`, {
      method: "DELETE",
      headers: { ...headers, Prefer: "return=minimal" }
    });
    if (!response.ok) throw new Error(`Prune failed at row ${start}: ${response.status} ${await response.text()}`);
  }

  console.log(`Removed ${stale.length} rows this run did not produce.`);
  return stale.length;
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
  await pruneRows(rows);
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
