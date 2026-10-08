import { isPrivateView, pathForView, viewTitle } from "../src/utils/appNav";

// Titles for the app's own pages, through the root layout's "%s | FirstFinder"
// template. The public pages are worth finding in search; the rest are a
// collector's own screens or a login form, and are kept out of the index --
// there is nothing on them for a stranger, and a search result that opens on
// a login form is a bad first impression.

const INDEXED = new Set(["about", "roadmap", "features", "contribute", "privacy", "terms"]);

export function viewMetadata(view) {
  const metadata = {
    title: viewTitle(view),
    alternates: { canonical: pathForView(view) }
  };
  if (!INDEXED.has(view) || isPrivateView(view)) metadata.robots = { index: false, follow: true };
  return metadata;
}

export const INDEXED_VIEWS = [...INDEXED];
