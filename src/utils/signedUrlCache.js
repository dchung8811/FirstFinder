// Keeping issued photo URLs so a page load can reuse one instead of minting
// another.
//
// SIGNED_URL_TTL_SECONDS made URLs last a week, which stopped an open tab
// re-downloading every photo every 48 minutes. It did not stop a *fresh load*
// doing the same, and that is the bigger half: each signing mints a token
// carrying its own `iat`, so two signings of the same photo produce two
// different URLs, and to a browser cache a different URL is a file it has
// never seen. Signing on every load therefore guarantees a miss on every
// photo no matter how long the token lives.
//
// So the URL itself has to survive the load. Held here, reused while it has
// life left, and re-signed only when it genuinely runs down.
//
// Pure, so the reuse rule can be tested against a clock that does not move.
// The localStorage half lives in src/lib/signedUrlStore.js.

export const SIGNED_URL_CACHE_VERSION = 1;

// Reuse while less than 80% of the life is gone -- the same fraction
// SignedPhoto uses to decide a URL on screen is due for replacement. Matching
// it is the point: a URL this hands back has at least a fifth of a week left,
// so it cannot expire between being read here and being rendered there.
export const REUSE_RATIO = 0.8;

export function signedUrlCacheKey(ownerId) {
  return `firstfinder:photo-urls:v${SIGNED_URL_CACHE_VERSION}:${ownerId || "anonymous"}`;
}

// Photos live at <ownerId>/<itemId>/<file>, so the path already says who owns
// the photo. Read from the path rather than passed in, for the reason
// listItemPhotoPaths reads the folder rather than the row: the path is the
// truth, and a caller cannot get it wrong by forgetting to thread an argument
// through.
export function ownerIdFromPath(path) {
  if (typeof path !== "string") return "";

  // A real photo path is <ownerId>/<itemId>/<file>, so a string with no
  // separator is not one. Returning its whole self as the owner would file it
  // under an owner that does not exist and leave a stray key in storage named
  // after a filename.
  const separator = path.indexOf("/");
  if (separator <= 0) return "";

  return path.slice(0, separator);
}

export function groupPathsByOwner(paths) {
  const byOwner = new Map();

  (paths || []).forEach((path) => {
    const owner = ownerIdFromPath(path);
    if (!owner) return;
    const existing = byOwner.get(owner);
    if (existing) existing.push(path);
    else byOwner.set(owner, [path]);
  });

  return byOwner;
}

// Anything that is not a {url, signedAt} pair is dropped rather than repaired.
// A half-written or hand-edited entry is indistinguishable from a valid one
// once it is in the map, and the cost of dropping it is one signing call.
export function parseSignedUrls(raw) {
  if (!raw) return {};

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

  const entries = {};
  Object.keys(parsed).forEach((path) => {
    const entry = parsed[path];
    if (!entry || typeof entry !== "object") return;
    if (typeof entry.url !== "string" || !entry.url) return;
    if (!Number.isFinite(entry.signedAt)) return;
    entries[path] = { url: entry.url, signedAt: entry.signedAt };
  });

  return entries;
}

export function serializeSignedUrls(entries) {
  return JSON.stringify(entries || {});
}

export function isReusable(entry, { now = Date.now(), ttlSeconds, reuseRatio = REUSE_RATIO } = {}) {
  if (!entry || typeof entry.url !== "string" || !entry.url) return false;
  if (!Number.isFinite(entry.signedAt)) return false;
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) return false;

  const age = now - entry.signedAt;
  // A negative age means a clock that moved backwards, or an entry written by
  // a device an hour ahead. Treated as unusable rather than as infinitely
  // fresh: re-signing costs a request, trusting it costs a broken photo.
  if (age < 0) return false;

  return age < ttlSeconds * 1000 * reuseRatio;
}

// Splits what was asked for into what can be answered from the cache and what
// still has to be signed. The caller signs only the second list, which on a
// warm load is empty.
export function selectCachedUrls(entries, paths, { now = Date.now(), ttlSeconds, reuseRatio = REUSE_RATIO } = {}) {
  const reusable = {};
  const missing = [];

  (paths || []).forEach((path) => {
    if (!path) return;
    const entry = (entries || {})[path];
    if (isReusable(entry, { now, ttlSeconds, reuseRatio })) reusable[path] = entry.url;
    else if (!missing.includes(path)) missing.push(path);
  });

  return { reusable, missing };
}

export function mergeSignedUrls(entries, freshByPath, { now = Date.now() } = {}) {
  const merged = { ...(entries || {}) };

  Object.keys(freshByPath || {}).forEach((path) => {
    const url = freshByPath[path];
    if (typeof url !== "string" || !url) return;
    merged[path] = { url, signedAt: now };
  });

  return merged;
}

// Dropped once a URL is past reuse, not once it is past expiry. An entry this
// no longer hands out is dead weight, and the store is one localStorage value
// with a quota to stay inside.
export function pruneSignedUrls(entries, { now = Date.now(), ttlSeconds, reuseRatio = REUSE_RATIO } = {}) {
  const kept = {};

  Object.keys(entries || {}).forEach((path) => {
    if (isReusable(entries[path], { now, ttlSeconds, reuseRatio })) kept[path] = entries[path];
  });

  return kept;
}
