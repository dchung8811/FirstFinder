// Picks the first edition of a work out of Open Library's edition records, and
// decides which search results are the same book.
//
// Pure, so it is unit-tested; scripts/seed-book-catalog.mjs does the fetching.
//
// Why this exists: the first seed took `publisher[0]` and `first_publish_year`
// straight off Open Library's search results. The year was usually right, but
// the publisher was whichever imprint the search index happened to list first
// -- Dune came back as Ace, Blood Meridian as Plaza y Janés -- and the same book
// arrived three or four times under separate work records. A catalog for people
// recording first editions was mostly suggesting reissues, several times each.
//
// The editions list for a work has what the search result flattens away: every
// edition with its own date, publisher, language and format. The first edition
// is the oldest one in there -- but only after accounting for how that list is
// wrong, which is in three consistent ways:
//
//   * Reprints carry the original's date. In Dune's 1965 editions sit Ace and
//     Recorded Books next to seven Chilton records; in The Hobbit's 1937, Del
//     Rey and Random House next to Allen & Unwin. So within the oldest year the
//     publisher is a VOTE, not the first record found.
//   * Reprint houses date their records by the original publication. Penguin
//     has two "1933" Down and Out in Paris and Londons against one Gollancz, and
//     Vintage four "2006" The Roads against one Knopf. So a known reprinter only
//     gets a vote when nobody else claims that year.
//   * Strays predate the book. Catch-22 has a lone "1955 Dell" record, six years
//     before Simon & Schuster published it. So a single record standing years
//     ahead of a run of others is not trusted.
//   * Spellings vary. "Chilton Book Company", "Chilton Books" and "Chilton" are
//     one publisher, and a vote that counted them separately would let a
//     single Ace record tie them.

const MIN_YEAR = 1450;

// Editions that are not a printed book, or not a book a collector would hold.
const NON_PRINT_FORMAT = /(audio|cassette|\bcd\b|mp3|e-?book|kindle|electronic|digital|online|microform|microfiche)/i;

// Print-on-demand houses reprinting public-domain text. Open Library reports
// the WORK's year on the search result, so these once arrived looking like
// "Frankenstein, 1818, CreateSpace". The seed script rejects a work's search
// row with this too; it lives here so there is one list.
export const PRINT_ON_DEMAND = /(independently published|createspace|lulu\.com|lulu press|bookrix|blurb|authorhouse|xlibris|iuniverse|outskirts press|dorrance|vdm publishing|alpha edition|sagwan|palala|wentworth press|trieste publishing|hansebooks|nabu press|forgotten books|bibliolife|bibliobazaar|kessinger|legare street|franklin classics|scholar select|creative media partners|cosimo|dodo press|start publishing|echo library|book jungle|wildside|digireads|aegypan|filiquarian|general books|rarebooksclub|sahara publisher|e-kitap|planet ebook|bibliotech press|benediction|arcturus|clydesdale)/i;

// Audio and e-text publishers: real editions, never the first one.
const NEVER_FIRST_PUBLISHER = /(standard ebooks|project gutenberg|librivox|recorded books|audible|blackstone|brilliance|tantor|caedmon|books on tape|random house audio|harperaudio|simon & schuster audio|listening library|^e-?book$)/i;

// Paperback and classics lines that reissue other houses' books -- and in Open
// Library, frequently date them by the original. They do publish the odd
// original, so they are outranked rather than excluded: when they are the only
// house claiming the oldest year, they win it. "penguin press" is the
// hardcover imprint, which publishes firsts, so it is let past.
const REPRINT_PUBLISHER = /(penguin(?! press)|signet|new american library|\bvintage\b|bantam|\bdell\b|\bpan\b|picador|perennial|modern library|everyman|wordsworth|dover|mariner|anchor books|turtleback|perfection learning|demco|longman|\bsfbc\b|book club)/i;

// Words that say nothing about WHICH publisher, so "Doubleday & Company, Inc."
// and "Doubleday Books" compare equal. "house" and "press" are here because
// Open Library records "Random House" and "Random House Publishing Group"
// interchangeably, and "Viking Press" and "Viking" likewise.
const PUBLISHER_NOISE = new Set([
  "the", "and", "co", "company", "inc", "incorporated", "ltd", "limited", "llc",
  "corp", "corporation", "publisher", "publishers", "publishing", "publications",
  "book", "books", "press", "group", "house", "sons", "son", "brand", "pub",
  "pubs", "imprint", "of"
]);

const ENGLISH = "/languages/eng";

export function editionYear(publishDate) {
  const match = String(publishDate || "").match(/\b(1[4-9]\d\d|20\d\d)\b/);
  if (!match) return null;

  const year = Number(match[1]);
  return year >= MIN_YEAR ? year : null;
}

// The comparable form of a publisher name: its distinctive words, with
// initials dropped so "G. Allen & Unwin" and "George Allen & Unwin" meet.
export function publisherTokens(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/'s\b/g, "")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1 && !PUBLISHER_NOISE.has(token));
}

function isSubset(small, large) {
  return small.every((token) => large.includes(token));
}

// Two names are one publisher when one's distinctive words are all in the
// other's: "scribner" inside "charles scribner", "allen unwin" inside "george
// allen unwin". A name with no distinctive words at all ("Books & Co.") joins
// nothing and counts for nothing.
function samePublisher(a, b) {
  if (!a.length || !b.length) return false;
  return a.length <= b.length ? isSubset(a, b) : isSubset(b, a);
}

// Reduces an Open Library editions.json entry to the four things this file
// reads. Also the shape the seed caches on disk, so a re-run need not refetch.
export function compactEdition(entry) {
  return {
    year: editionYear(entry.publish_date),
    publishers: (entry.publishers || []).map((name) => String(name).trim()).filter(Boolean),
    languages: (entry.languages || []).map((language) => language.key),
    format: entry.physical_format || ""
  };
}

// An edition that could be the first one a collector is holding: printed, in
// English, dated, and with a publisher worth voting for.
//
// English, because the title in the catalog is the English title. For a book
// written in English that changes nothing. For a translated one it means the
// first English edition -- One Hundred Years of Solitude as Harper & Row 1970,
// not Sudamericana 1967 -- which is the book the English title names. Records
// with no language at all are kept: that is most of the older ones.
function isCandidate(edition) {
  if (!edition.year) return false;
  if (NON_PRINT_FORMAT.test(edition.format)) return false;
  if (edition.languages.length && !edition.languages.includes(ENGLISH)) return false;

  const publisher = edition.publishers[0];
  if (!publisher || NEVER_FIRST_PUBLISHER.test(publisher) || PRINT_ON_DEMAND.test(publisher)) return false;
  return publisherTokens(publisher).length > 0;
}

// Groups publisher names into clusters of "the same publisher".
function clusterPublishers(names) {
  const clusters = [];

  for (const name of names) {
    const tokens = publisherTokens(name);
    const home = clusters.find((cluster) => samePublisher(cluster.tokens, tokens));

    if (home) {
      home.names.push(name);
      // The cluster is identified by its shortest spelling, so a later
      // "Chilton" still joins a cluster started by "Chilton Book Company".
      if (tokens.length < home.tokens.length) home.tokens = tokens;
    } else {
      clusters.push({ tokens, names: [name] });
    }
  }

  return clusters;
}

function mostCommon(names) {
  const counts = new Map();
  for (const name of names) counts.set(name, (counts.get(name) || 0) + 1);

  // Ties go to the shorter spelling, which is the one with less noise attached.
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0][0];
}

// A single record this many years ahead of the next ones is a stray, when the
// next year has more than one record to vouch for it. A real first edition
// with a single record usually has its UK edition or first reprint the very
// next year -- Suttree is Random House 1979 then Chatto 1980 -- while The
// Beautiful and Damned has a lone "1920" Scribner two years before the real
// 1922 run. An obscure book whose next record is decades later has nothing to
// outvote it, so its one record stands.
const STRAY_GAP_YEARS = 2;

// The first edition of a work: { year, publisher }, or null when the records
// cannot support a claim. Null means the book is left out of the catalog -- a
// row that cannot say which edition is the first is not one this catalog wants.
export function pickFirstEdition(editions) {
  // A work with no edition explicitly in English is a translation Open Library
  // filed as its own work -- "La Fattoria degli Animali" -- whose language
  // fields happen to be blank. Most real books have at least one tagged.
  if (!editions.some((edition) => edition.languages.includes(ENGLISH))) return null;

  const candidates = editions.filter(isCandidate);
  if (!candidates.length) return null;

  const byYear = new Map();
  for (const edition of candidates) {
    if (!byYear.has(edition.year)) byYear.set(edition.year, []);
    byYear.get(edition.year).push(edition);
  }

  const years = [...byYear.keys()].sort((a, b) => a - b);
  const isStray = (y, i) => {
    const next = years[i + 1];
    return byYear.get(y).length === 1 && next !== undefined && next - y >= STRAY_GAP_YEARS && byYear.get(next).length >= 2;
  };
  const year = years.find((y, i) => !isStray(y, i)) ?? years[0];

  const claimants = byYear.get(year);
  const originals = claimants.filter((edition) => !REPRINT_PUBLISHER.test(edition.publishers[0]));
  const voters = originals.length ? originals : claimants;

  // Votes come from the first year; ties are broken by how often each
  // publisher shows up across every year. The house that published the first
  // edition usually kept the book in print -- Scribner's Gatsby has a 1925
  // record and a run of 1950s ones, the 1925-dated New Directions reissue
  // has only itself.
  const clusters = clusterPublishers(voters.map((edition) => edition.publishers[0]));
  const allNames = candidates.map((edition) => edition.publishers[0]);
  const lifetime = (cluster) => allNames.filter((name) => samePublisher(cluster.tokens, publisherTokens(name))).length;

  const winner = clusters
    .map((cluster) => ({ cluster, votes: cluster.names.length, lifetime: lifetime(cluster) }))
    .sort((a, b) => b.votes - a.votes || b.lifetime - a.lifetime)[0].cluster;

  return { year, publisher: mostCommon(winner.names).slice(0, 120) };
}

// The comparable form of a title, for deciding two works are one book. Matches
// comparableTitle in src/utils/bookSearch.js, which collapses the same rows in
// the dropdown -- the seed doing it first means the dropdown no longer has to.
export function titleKey(title) {
  return String(title || "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\([^)]*\)?.*$/g, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^(the|a|an)\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function authorKey(author) {
  return String(author || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Groups search results into books. Open Library often holds one book as
// several work records -- Catch-22 is three of them -- and every one became its
// own catalog row. Each group's editions are pooled before the first edition is
// picked, because the record with the true first is not always the biggest.
//
// A same-titled book by someone outside the seed list is dropped when a seed
// author has it: the subject sweeps turn up "Animal Farm" by the illustrator of
// a graphic adaptation and "The Hobbit" by the artist of the comic, and neither
// is the book a collector typing that title means. A different author with the
// same title who IS on the list -- Jack London and Cormac McCarthy both wrote
// The Road -- keeps both.
export function groupWorks(docs, seedAuthors = []) {
  const seed = new Set(seedAuthors.map(authorKey));
  const groups = new Map();

  for (const doc of docs) {
    const id = `${titleKey(doc.title)}|${authorKey(doc.author)}`;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(doc);
  }

  const seedTitles = new Set(
    [...groups.values()].filter((works) => seed.has(authorKey(works[0].author))).map((works) => titleKey(works[0].title))
  );

  return [...groups.values()]
    .filter((works) => seed.has(authorKey(works[0].author)) || !seedTitles.has(titleKey(works[0].title)))
    .map((works) =>
      // The record Open Library has the most editions under is the one it
      // treats as canonical, so its key and title stand for the group.
      [...works].sort((a, b) => (b.edition_count || 0) - (a.edition_count || 0))
    );
}

// A namesake's share of the matched editions, below which they are dropped.
// Joseph Heller the historian came to 15% of Joseph Heller the novelist --
// Open Library also files some of the novels under both records, which props
// him up -- so the line sits above that.
const NAMESAKE_SHARE = 0.25;

// Of the search results that carry an author's NAME, the ones by that author.
//
// Name matching lets namesakes through: "Joseph Heller" also brought in a
// historian's British Policy towards the Ottoman Empire, and "Cormac McCarthy"
// a physician's Pathobiology of Rare Lung Diseases. Open Library gives each
// author record its own key, so the books are grouped by the key under the
// matching name, and a key whose books add up to a sliver of the main one's
// editions is a different person. It is a share rather than "the top key
// only" because Open Library sometimes splits one real author across two
// records, and both of those carry real weight.
export function keepMainAuthor(docs, expected) {
  const wanted = authorKey(expected);
  const keyOf = (doc) => {
    const at = (doc.author_name || []).findIndex((name) => authorKey(name) === wanted);
    return at === -1 ? null : doc.author_key?.[at] || "";
  };

  const weight = new Map();
  for (const doc of docs) {
    const key = keyOf(doc);
    if (key === null) continue;
    weight.set(key, (weight.get(key) || 0) + (doc.edition_count || 1));
  }

  const heaviest = Math.max(0, ...weight.values());
  return docs.filter((doc) => {
    const key = keyOf(doc);
    return key !== null && weight.get(key) >= heaviest * NAMESAKE_SHARE;
  });
}
