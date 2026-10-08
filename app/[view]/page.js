import InventoryApp from "../InventoryApp";
import { VIEW_PATHS } from "../../src/utils/appNav";
import { viewMetadata } from "../viewMetadata";

// Every page of the app at its own address: /collection, /login, /about and
// the rest. They all render the same InventoryApp, opened on the view the
// address names; the app keeps the address in step as you move around, so
// refresh, bookmarks, shared links and the back button all work.
//
// Home is app/page.js and Features is app/features/page.js -- "/" can't be a
// [view], and /features is already a folder for the feature guides.

const SEGMENTS = Object.entries(VIEW_PATHS)
  .filter(([view]) => view !== "home" && view !== "features")
  .map(([view, path]) => ({ view, segment: path.slice(1) }));

// Built once at deploy time, like the home page. Anything not on the list is
// a real 404 rather than the app quietly opening its front door.
export const dynamicParams = false;

export function generateStaticParams() {
  return SEGMENTS.map(({ segment }) => ({ view: segment }));
}

function viewForSegment(segment) {
  return SEGMENTS.find((entry) => entry.segment === segment)?.view;
}

// params is a Promise in Next 16 -- see app/books/[work]/first-edition/page.js
export async function generateMetadata({ params }) {
  const { view: segment } = await params;
  return viewMetadata(viewForSegment(segment));
}

export default async function ViewPage({ params }) {
  const { view: segment } = await params;
  const view = viewForSegment(segment);
  // A private page renders empty on the server -- it can't know who is asking
  // -- and fills in, or turns into the login form, once the session lookup in
  // the browser answers.
  return <InventoryApp initialView={view} />;
}
