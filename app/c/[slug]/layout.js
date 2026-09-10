import { notFound } from "next/navigation";
import { sharedCollectionExists } from "../../../src/lib/sharedCollection";

// Decides the status code before anything is flushed.
//
// loading.js below puts the page behind a Suspense boundary, which is what
// lets the skeleton paint immediately -- but it also means the response has
// already gone out with a 200 by the time the page body runs, so a notFound()
// in there could only swap the body and would leave a dead link answering 200.
//
// A layout renders outside that boundary, so this is the last place a 404 can
// still be decided. It asks the cheapest possible version of the question --
// one indexed row, no items, no photo signing -- and leaves the expensive
// half to stream.
export default async function SharedCollectionSlugLayout({ params, children }) {
  const { slug } = await params;
  if (!(await sharedCollectionExists(slug))) notFound();
  return children;
}
