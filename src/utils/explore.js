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

// Covers per strip. Each one is a signed image a first-time visitor downloads,
// so this is the number that sets what Explore costs in egress. Mirrored by a
// check constraint in supabase/explore-opt-in.sql.
export const EXPLORE_STRIP_LIMIT = 8;

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
// newest items, which is what every collector who never opens the picker gets.
//
// When some picks survive, the strip is just those -- not topped up with recent
// items. Three chosen books is a statement about which three; padding it with
// whatever was added last would undo the choice.
export function selectExploreItems(publicItems, picks, limit = EXPLORE_STRIP_LIMIT) {
  const items = Array.isArray(publicItems) ? publicItems : [];
  const byId = new Map(items.map((item) => [item.id, item]));
  const chosen = normalizeExplorePicks(picks, limit).map((id) => byId.get(id)).filter(Boolean);
  if (chosen.length > 0) return chosen;
  // publicItems arrive newest first, the order the server queries them in.
  return items.slice(0, limit);
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
export function buildExploreCollection({ slug, settings, items, ownerName = "", updatedAt = null, createdAtById = {} }) {
  const collection = buildPublicCollection(items, settings, { ownerName });
  const strip = selectExploreItems(collection.items, settings?.exploreItemIds);

  return {
    slug,
    title: collection.title,
    blurb: collection.blurb,
    itemCount: collection.summary.itemCount,
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
    moreCount: Math.max(0, collection.summary.itemCount - strip.length)
  };
}

// Most recently active first. An active collector is more interesting to
// browse than a large dormant one. Collections with nothing shared are dropped:
// an empty row on a browse page is just noise.
export function sortExploreCollections(collections) {
  return (Array.isArray(collections) ? collections : [])
    .filter((collection) => collection.itemCount > 0)
    .sort((a, b) => (Date.parse(b.lastActivity || 0) || 0) - (Date.parse(a.lastActivity || 0) || 0));
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
