const SITE_URL = "https://firstfinder.app";

// Note what is deliberately absent: there is no Disallow for /c/.
//
// It looks like the obvious way to keep unlisted collection pages out of
// Google, and it is the wrong tool. robots.txt blocks crawling, not indexing:
// a disallowed URL can still be listed from inbound links alone, and because
// the crawler is forbidden from fetching it, it never reads the noindex that
// would have kept it out. Blanket-blocking here would also bury the pages of
// collectors who deliberately chose "listed".
//
// Unlisted pages are kept out by the per-page robots meta tag in
// app/c/[slug]/page.js, plus their absence from the sitemap.
export default function robots() {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${SITE_URL}/sitemap.xml`
  };
}
