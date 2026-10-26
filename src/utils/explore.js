// What the Explore page (/explore) shows of each collection on it.
//
// Explore is a wall of shelves: one row per collection, an identity line over
// a strip of covers. Everything a row carries is built here from the public
// view of the collection -- buildPublicCollection, the same allowlist that
// gates /c/<slug> -- so Explore can never show more than the collection's own
// page would. It shows less: no values, no prices, no notes, whatever the
// owner has switched on for their page. A browse page that lists dollar
// figures side by side is a leaderboard, and a list of targets.

import { buildPublicCollection } from "./publicCollection";
import { matchesQuery } from "./publicCollectionBrowse";

// Covers per strip. Each one is a signed image a first-time visitor downloads,
// so this is the number that sets what Explore costs in egress. Mirrored by a
// check constraint in supabase/explore-opt-in.sql.
export const EXPLORE_STRIP_LIMIT = 8;

// Room for a few sentences on why the collection is worth a look, without
// letting one description swallow the Explore page. The page clamps it to
// three lines anyway; this keeps the full text readable on /c/<slug>.
export const SHARE_BLURB_MAX = 280;

// Explore's search box, in ?q=. Long enough for a title and an author; a query
// past this is pasted text, and every character is matched against every
// public item on every shelf.
export const EXPLORE_QUERY_MAX = 100;

// What ?q= arrived as, made safe to search with and to print back. Next hands
// a repeated parameter over as an array; the first one wins.
export function cleanExploreQuery(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  return String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, EXPLORE_QUERY_MAX);
}

// The fields an Explore search can match: the ones Explore itself shows on a
// cover or the shelf pages it links to, and no others. Not the item as
// buildPublicCollection returns it -- that carries notes and provenance when
// the owner shows them on their own page, and a search that matched them here
// would answer "whose notes mention this address" one shelf at a time,
// without ever displaying the notes. Same reasoning as the forced-off flags
// in loadExploreCollections, applied again so neither has to be trusted alone.
function searchableExploreItem(item) {
  return {
    name: item.name,
    author: item.author,
    maker: item.maker,
    category: item.category,
    edition: item.edition,
    bookEdition: item.bookEdition,
    bookPrinting: item.bookPrinting,
    bookGenre: item.bookGenre,
    status: item.status
  };
}

// The owner's picks, cleaned: strings only, no repeats, at most the limit, in
// the order given. Used on the way into the database and on the way out of it,
// so a hand-edited row can't make the strip misbehave.
export function normalizeExplorePicks(ids, limit = EXPLORE_STRIP_LIMIT) {
  if (!Array.isArray(ids)) return [];
  const seen = new Set();
  const picks = [];
  for (const id of ids) {
    if (typeof id !== "string" || !id || seen.has(id)) continue;
    seen.add(id);
    picks.push(id);
    if (picks.length >= limit) break;
  }
  return picks;
}

// The share dialog's checkbox. Adding past the limit is refused rather than
// pushing the oldest pick out: silently un-choosing something the collector
// chose is worse than making them un-choose it themselves.
export function toggleExplorePick(ids, id, limit = EXPLORE_STRIP_LIMIT) {
  const picks = normalizeExplorePicks(ids, limit);
  if (picks.includes(id)) return picks.filter((pick) => pick !== id);
  if (picks.length >= limit) return picks;
  return [...picks, id];
}

// Which public items lead the strip.
//
// Picks come first, in the owner's order, but only those still in the public
// collection: an item hidden, sold or deleted since it was picked is simply
// not in `publicItems` any more, and drops out here without anyone having to
// tidy the stored ids. With no surviving picks the strip falls back to the
// newest items, which is what every collector who never opens the picker gets
// -- photographed ones first, since a cover is the reason anyone clicks a
// shelf, and a strip of title cards reads as a shelf with nothing on it.
//
// When some picks survive, the strip is just those -- not topped up with recent
// items. Three chosen books is a statement about which three; padding it with
// whatever was added last would undo the choice.
export function selectExploreItems(publicItems, picks, limit = EXPLORE_STRIP_LIMIT) {
  const items = Array.isArray(publicItems) ? publicItems : [];
  const byId = new Map(items.map((item) => [item.id, item]));
  const chosen = normalizeExplorePicks(picks, limit).map((id) => byId.get(id)).filter(Boolean);
  if (chosen.length > 0) return chosen;
  // publicItems arrive newest first, the order the server queries them in;
  // the partition keeps that order within each half.
  const hasPhoto = (item) => Array.isArray(item.photos) && item.photos.length > 0;
  return [...items.filter(hasPhoto), ...items.filter((item) => !hasPhoto(item))].slice(0, limit);
}

function newestDate(values) {
  const times = values.map((value) => (value ? Date.parse(value) : NaN)).filter((time) => !Number.isNaN(time));
  return times.length > 0 ? new Date(Math.max(...times)).toISOString() : null;
}

// One row of Explore.
//
// `items` are the raw shared rows for one collector, newest first; `settings`
// their share settings. The cover keeps its photo *path* only -- the server
// signs the paths of the covers that are actually shown and swaps in the URL,
// so nothing past the eighth item is ever signed.
//
// With a `query`, the strip is the shelf's matches instead -- still the
// owner's picks first among them, then photographed ones -- and matchCount
// says how many there are. Without one, matchCount is null, which is how the
// page tells "not searching" from "searching and found nothing here".
export function buildExploreCollection({ slug, settings, items, ownerName = "", updatedAt = null, createdAtById = {}, query = "" }) {
  const collection = buildPublicCollection(items, settings, { ownerName });
  const candidates = query
    ? collection.items.filter((item) => matchesQuery(searchableExploreItem(item), query))
    : collection.items;
  const strip = selectExploreItems(candidates, settings?.exploreItemIds);

  return {
    slug,
    title: collection.title,
    blurb: collection.blurb,
    itemCount: collection.summary.itemCount,
    matchCount: query ? candidates.length : null,
    firstEditionCount: collection.summary.firstEditionCount,
    // "Recently updated" means the shelf changed, not that the share settings
    // were last saved: a collector adding a book a week should rise even if
    // they set their page up a year ago.
    lastActivity: newestDate([updatedAt, ...collection.items.map((item) => createdAtById[item.id])]),
    covers: strip.map((item) => ({
      id: item.id,
      name: item.name,
      author: item.author,
      maker: item.maker,
      category: item.category,
      photoPath: item.photos[0]?.path || null
    })),
    moreCount: Math.max(0, candidates.length - strip.length)
  };
}

// Most recently active first. An active collector is more interesting to
// browse than a large dormant one. Collections with nothing shared are dropped:
// an empty row on a browse page is just noise.
//
// Search results drop shelves with no match and put the most matches first:
// someone looking for Steinbeck is better served by the shelf with twelve of
// them than by whichever shelf was touched last. Activity breaks ties.
export function sortExploreCollections(collections) {
  const activity = (collection) => Date.parse(collection.lastActivity || 0) || 0;
  return (Array.isArray(collections) ? collections : [])
    .filter((collection) => collection.itemCount > 0 && collection.matchCount !== 0)
    .sort((a, b) => (b.matchCount ?? 0) - (a.matchCount ?? 0) || activity(b) - activity(a));
}

// The home page's preview of Explore: the first few shelves, each cut to a
// short strip. Applied before any cover is signed, so a shelf or cover that
// the home page doesn't show never gets a URL. That matters more here than on
// /explore itself -- every first-time visitor sees the home page, and each
// cover is a full-size photo downloaded from storage.
//
// moreCount is recomputed against the shorter strip so the "+N more" tile
// still adds up to the shelf's real size.
export const HOME_SHELF_LIMIT = 3;
export const HOME_COVER_LIMIT = 6;

export function featuredShelves(collections, { shelves = HOME_SHELF_LIMIT, covers = HOME_COVER_LIMIT } = {}) {
  return (Array.isArray(collections) ? collections : []).slice(0, shelves).map((collection) => {
    const strip = collection.covers.slice(0, covers);
    return { ...collection, covers: strip, moreCount: Math.max(0, collection.itemCount - strip.length) };
  });
}

// The two-letter mark beside each row's title.
export function collectionMonogram(title) {
  const words = String(title || "")
    .replace(/'s collection$/i, "")
    .split(/\s+/)
    .map((word) => word.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  if (words.length === 0) return "FF";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

// The home page's moving strip: covers dealt from each featured shelf in
// turn -- first of each, then second of each -- so the strip shows several
// collections side by side instead of one shelf and then the next. Each
// cover keeps a note of which shelf it came from, which is where it opens.
export function interleaveShelfCovers(shelves) {
  const list = Array.isArray(shelves) ? shelves : [];
  const longest = Math.max(0, ...list.map((shelf) => shelf.covers?.length || 0));
  const dealt = [];
  for (let index = 0; index < longest; index += 1) {
    for (const shelf of list) {
      const cover = shelf.covers?.[index];
      if (cover) dealt.push({ ...cover, shelfSlug: shelf.slug, shelfTitle: shelf.title });
    }
  }
  return dealt;
}

// Jacket colours for covers nobody has photographed, all drawn from the
// existing palette. Chosen by item id so a book keeps its colour between
// visits instead of reshuffling on every render -- and between /explore and
// the home page, which both draw these jackets.
const JACKET_TONES = ["bg-[#123f38]", "bg-[#3f352a]", "bg-[#6d5526]", "bg-[#8f3524]"];

export function jacketTone(id) {
  let hash = 0;
  for (const char of String(id)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return JACKET_TONES[hash % JACKET_TONES.length];
}

// "updated 2d ago" on each row. Coarse on purpose: an exact timestamp on a
// public page says when someone was home cataloguing, and nobody browsing
// needs that.
export function updatedAgo(iso, now = Date.now()) {
  const then = iso ? Date.parse(iso) : NaN;
  if (Number.isNaN(then)) return "";
  const days = Math.floor(Math.max(0, now - then) / 86400000);
  if (days < 1) return "updated today";
  if (days < 7) return `updated ${days}d ago`;
  if (days < 60) return `updated ${Math.floor(days / 7)}w ago`;
  if (days < 730) return `updated ${Math.floor(days / 30)}mo ago`;
  return `updated ${Math.floor(days / 365)}y ago`;
}
