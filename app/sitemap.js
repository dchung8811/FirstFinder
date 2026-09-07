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
    ...books
  ];
}
