import { NextResponse } from "next/server";
import { loadExploreCollections } from "../../../src/lib/sharedCollection";
import { featuredShelves } from "../../../src/utils/explore";

// The few Explore shelves the home page shows.
//
// A route the home page fetches, rather than data loaded by app/page.js and
// passed down, because "/" is also the signed-in app's front door. Loading
// shelves there would make every visit to the app pay for an Explore query
// whether or not the home page is ever on screen; here only the home page asks.
//
// Never cached, for the same reason /explore is rendered per request: switching
// Explore off has to take a shelf off the home page when it is pressed, not
// when a cache window expires. The signed cover URLs are also only good for an
// hour, so a cached response would eventually serve broken images.
export const dynamic = "force-dynamic";

export async function GET() {
  // loadExploreCollections already returns [] on any failure; the home page
  // hides the section when there is nothing to show.
  const shelves = await loadExploreCollections({ pick: featuredShelves });
  return NextResponse.json({ shelves }, { headers: { "Cache-Control": "no-store" } });
}
