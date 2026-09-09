// The identification pages' content, one module per work.
//
// These are facts about physical books, assembled from named sources and
// checked by a person before they are published. Two rules hold the whole thing
// together:
//
//   1. Every identification claim carries sourceIds pointing at where it came
//      from. validateWork() below refuses to build without them.
//   2. A work is invisible to search until status is "verified". Draft pages
//      still render -- that is how they get reviewed -- but they carry noindex
//      and are left out of the sitemap.
//
// Getting an issue point subtly wrong misleads someone deciding what to pay for
// a book, so the gate is enforced in code rather than by good intentions.
//
// On values: the `value` array exists but is empty on every current work. A
// static price range we cannot source is exactly the kind of confident-sounding
// invention this pipeline is built to prevent, and the app already prices a
// specific copy against live comparables, which a page-level range could not do.

import dune from "./dune";
import eastOfEden from "./east-of-eden";
import theGreatGatsby from "./the-great-gatsby";
import goneWithTheWind from "./gone-with-the-wind";
import petSematary from "./pet-sematary";
import theWayOfKings from "./the-way-of-kings";

const WORKS = [dune, eastOfEden, theGreatGatsby, goneWithTheWind, petSematary, theWayOfKings];

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Runs at module load, so a malformed work fails `npm run build` rather than
// shipping a broken or unsourced page.
function validateWork(work) {
  const where = `src/content/books/${work?.slug || "(unknown)"}.js`;

  if (!work?.slug || !SLUG_PATTERN.test(work.slug)) {
    throw new Error(`${where}: slug must be lowercase kebab-case (it becomes the URL).`);
  }
  for (const field of ["title", "author", "quickAnswer"]) {
    if (!work[field] || typeof work[field] !== "string") {
      throw new Error(`${where}: "${field}" is required.`);
    }
  }
  if (!["draft", "verified"].includes(work.status)) {
    throw new Error(`${where}: status must be "draft" or "verified".`);
  }
  if (work.status === "verified" && !work.verifiedBy) {
    throw new Error(`${where}: a verified work must record who verified it.`);
  }

  const sourceIds = new Set((work.sources || []).map((source) => source.id));
  if (sourceIds.size === 0) {
    throw new Error(`${where}: at least one source is required.`);
  }

  // Every claim has to be traceable to one of this work's own sources. A typo in
  // a sourceId would otherwise render a claim with no citation behind it.
  const claims = [
    ...(work.identificationPoints || []),
    ...(work.notFirstEdition || []),
    ...(work.variants || [])
  ];
  for (const claim of claims) {
    const ids = claim.sourceIds || [];
    if (ids.length === 0) {
      throw new Error(`${where}: every claim needs sourceIds — "${claim.label || claim.claim || claim.name}" has none.`);
    }
    for (const id of ids) {
      if (!sourceIds.has(id)) {
        throw new Error(`${where}: unknown sourceId "${id}" on "${claim.label || claim.claim || claim.name}".`);
      }
    }
  }

  return work;
}

const seen = new Set();
for (const work of WORKS) {
  validateWork(work);
  if (seen.has(work.slug)) throw new Error(`Duplicate book slug "${work.slug}".`);
  seen.add(work.slug);
}

export { WORKS, validateWork };

export function getAllWorks() {
  return WORKS;
}

// Only these get a sitemap entry, JSON-LD, and an indexable page.
export function getVerifiedWorks() {
  return WORKS.filter((work) => work.status === "verified");
}

// Verified guides grouped by author, for the hub.
//
// A flat list was right at three guides and stops being right somewhere around
// a dozen: the page becomes a wall of titles with no way in, and a reader who
// collects one author has to scan all of it. Grouping is the smallest change
// that fixes that, and it needs no new data -- every work already names its
// author.
//
// Authors are ordered by name, and titles within an author likewise, so the
// page does not reshuffle when a guide is added.
export function getVerifiedWorksByAuthor() {
  const byAuthor = new Map();

  for (const work of getVerifiedWorks()) {
    const author = work.author || "Unattributed";
    if (!byAuthor.has(author)) byAuthor.set(author, []);
    byAuthor.get(author).push(work);
  }

  return [...byAuthor.entries()]
    .map(([author, works]) => ({
      author,
      works: [...works].sort((a, b) => a.title.localeCompare(b.title))
    }))
    .sort((a, b) => a.author.localeCompare(b.author));
}

export function getWork(slug) {
  return WORKS.find((work) => work.slug === slug) || null;
}

// One place that knows the URL shape, so the route, the sitemap and any future
// internal links can't drift apart.
export function workPath(work) {
  return `/books/${work.slug}/first-edition`;
}
