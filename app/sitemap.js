import { getVerifiedWorks, workPath } from "../src/content/books";
import { listListedCollectionSlugs } from "../src/lib/sharedCollection";

const SITE_URL = "https://firstfinder.app";

// The shared-collection half of this file reads the database, so the sitemap
// can't be baked once at build time and left alone -- a collector who lists
// their page today should not have to wait for the next deploy to be indexed.
// An hour is well inside how often crawlers refetch it.
export const revalidate = 3600;

// Only verified identification pages are listed. A draft page also carries
// noindex, so the two halves of the gate agree: nothing unchecked is offered to
// search engines.
//
// Shared collection pages follow the same shape of rule, for privacy rather
// than accuracy: only the ones whose owner chose "listed" appear here.
// Unlisted pages are left out AND carry noindex of their own -- being absent
// from a sitemap is not on its own an instruction to stay out of an index.
export default async function sitemap() {
  const books = getVerifiedWorks().map((work) => ({
    url: `${SITE_URL}${workPath(work)}`,
    lastModified: work.verifiedAt ? new Date(work.verifiedAt) : new Date(),
    changeFrequency: "monthly",
    priority: 0.8
  }));

  const collections = (await listListedCollectionSlugs()).map((row) => ({
    url: `${SITE_URL}/c/${row.slug}`,
    lastModified: row.updated_at ? new Date(row.updated_at) : new Date(),
    changeFrequency: "weekly",
    priority: 0.5
  }));

  return [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    // The hub. Listed even with nothing published under it yet -- it is a real
    // page, and it is what the footer links to.
    { url: `${SITE_URL}/books`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    ...books,
    ...collections
  ];
}
