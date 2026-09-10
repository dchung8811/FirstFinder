// Collects signed-URL requests that arrive together into a single fetch.
//
// The load path has always been batched: a page works out every photo it is
// about to render and asks for all of those URLs in one call. The refresh path
// was not. Each photo on screen owns its own expiry, notices on its own when a
// URL has gone stale, and asks for a replacement on its own -- so a page full
// of photos coming back from an hour in the background sent one request per
// photo, all in the same instant.
//
// They arrive together for a reason that guarantees the pile-up rather than
// making it unlikely: every URL on the page was signed in that one batched call
// at load, so every URL expires in the same second, so every photo notices in
// the same second. The insurance export is where that bites, since it puts a
// photo of every item on screen at once.
//
// So this sits in front of the fetch and does what the load path does: hold
// what comes in for a moment, send one request for all of it, and give each
// caller back its own answer.
//
// Pure and injectable -- the fetch is a parameter -- so the coalescing rules
// can be tested without a network or a browser.

// Long enough to gather a burst that arrives across a couple of turns of the
// event loop (visibilitychange and pageshow can land in separate tasks), short
// enough that nobody waiting on a photo perceives it.
export const BATCH_WINDOW_MS = 50;

export function createSignedUrlBatcher(fetchBatch, { windowMs = BATCH_WINDOW_MS } = {}) {
  // path -> the resolvers waiting on it. A Map keyed by path is also what
  // deduplicates: two photos showing the same file ask once and both are
  // answered.
  let pending = new Map();
  let timer = null;

  async function flush() {
    // Swapped out before the await, so requests arriving while this one is in
    // flight start the next batch instead of joining one already sent.
    const batch = pending;
    pending = new Map();
    timer = null;

    let urlByPath = new Map();

    try {
      const results = await fetchBatch([...batch.keys()]);
      urlByPath = new Map((results || []).filter((row) => row && row.path).map((row) => [row.path, row.url || ""]));
    } catch (error) {
      // Deliberately swallowed. Every caller is still answered below, with the
      // blank that means "no URL" -- a rejected batch that left callers
      // hanging would strand each photo mid-load with no failed state and no
      // retry, which is worse than the failure it is reporting.
      console.error("Signed URL batch error:", error?.message || error);
    }

    batch.forEach((resolvers, path) => {
      const url = urlByPath.get(path) || "";
      resolvers.forEach((resolve) => resolve(url));
    });
  }

  return function requestSignedUrl(path) {
    if (!path) return Promise.resolve("");

    return new Promise((resolve) => {
      const waiting = pending.get(path);
      if (waiting) waiting.push(resolve);
      else pending.set(path, [resolve]);

      if (!timer) timer = setTimeout(flush, windowMs);
    });
  };
}
