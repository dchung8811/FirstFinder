import { getVerifiedWorks, workPath } from "../src/content/books";

const SITE_URL = "https://firstfinder.app";

// Only verified identification pages are listed. A draft page also carries
// noindex, so the two halves of the gate agree: nothing unchecked is offered to
// search engines.
export default function sitemap() {
  const books = getVerifiedWorks().map((work) => ({
    url: `${SITE_URL}${workPath(work)}`,
    lastModified: work.verifiedAt ? new Date(work.verifiedAt) : new Date(),
    changeFrequency: "monthly",
    priority: 0.8
  }));

  return [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    // The hub. Listed even with nothing published under it yet -- it is a real
    // page, and it is what the footer links to.
    { url: `${SITE_URL}/books`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    ...books
  ];
}
