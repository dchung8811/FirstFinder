import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadSharedCollection } from "../../../src/lib/sharedCollection";
import { buildPublicCollection, buildPublicWishlist, summaryLine } from "../../../src/utils/publicCollection";
import CollectionBrowser from "./CollectionBrowser";
import { Chip } from "./ItemCard";
import PublicWishlist from "./PublicWishlist";

const SITE_URL = "https://firstfinder.app";

// Rendered fresh on every request rather than cached with ISR.
//
// The deciding case is switching sharing off. With a revalidate window, a page
// someone has just unshared keeps being served to anyone holding the link
// until the window expires -- a privacy setting that does not take effect when
// pressed is not a privacy setting. Rendering per request also means the share
// dialog's "Open preview" always shows the settings just saved, and that
// photo URLs are signed fresh instead of being handed out near expiry.
export const dynamic = "force-dynamic";

// generateMetadata and the page body both need the whole collection, and
// without deduping that is two database round trips and two signing calls for
// every request. cache() collapses them into one per render pass -- note it
// keys on the argument, so both callers must pass the same params promise.
const getCollection = cache(async function getCollection(slugPromise) {
  const { slug } = await slugPromise;
  const shared = await loadSharedCollection(slug);
  if (!shared) return null;

  const collection = buildPublicCollection(shared.items, shared.settings, { ownerName: shared.ownerName });
  // Filtered and stripped here rather than in the page body, so the wishlist
  // goes through the same allowlist on the metadata pass as on the render --
  // there is only one place that decides what a visitor may see.
  const wishlist = buildPublicWishlist(shared.wants, shared.settings);
  return { ...shared, collection, wishlist, slug };
});

export async function generateMetadata({ params }) {
  const shared = await getCollection(params);

  // Nothing to describe, and nothing that should be indexed.
  if (!shared) return { robots: { index: false, follow: false } };

  const { collection, settings, slug } = shared;
  const description = collection.blurb || `${summaryLine(collection.summary)} catalogued in FirstFinder.`;
  const url = `${SITE_URL}/c/${slug}`;

  return {
    title: collection.title,
    description,
    // The other half of what "unlisted" means, alongside being left out of the
    // sitemap. Only a collector who deliberately chose "listed" gets indexed.
    robots: settings.visibility === "listed" ? undefined : { index: false, follow: false },
    alternates: settings.visibility === "listed" ? { canonical: url } : undefined,
    openGraph: {
      title: collection.title,
      description,
      url,
      siteName: "FirstFinder",
      type: "profile",
      images: ["/firstfinder-mark-exact.png"]
    },
    twitter: { card: "summary", title: collection.title, description, images: ["/firstfinder-mark-exact.png"] }
  };
}

export default async function SharedCollectionPage({ params }) {
  const shared = await getCollection(params);

  // An unknown slug and a collection whose owner switched sharing off are the
  // same 404, so a visitor can't tell "never existed" from "taken down".
  if (!shared) notFound();

  const { collection, photoUrls, wishlist } = shared;

  // The cover URL is attached here rather than passed alongside as a Map: the
  // grid is rendered by a client component now, and an item that already
  // carries its own photo URL crosses that boundary as plain data. Only the
  // one signed URL the card actually renders is included -- the rest of an
  // item's photo paths stay on the server, unsigned.
  const items = collection.items.map((item) => ({
    ...item,
    photoUrl: photoUrls.get(item.photos[0]?.path) || null
  }));

  return (
    <main className="mx-auto max-w-5xl px-6 pb-6">
      <section className="border-b border-[#e0d2bc] pb-10">
        <div className="font-ledger inline-flex items-center gap-2 rounded-full border border-[#d9c9b0] bg-[#fff8ee] px-4 py-2 text-xs uppercase tracking-[0.2em] text-[#655644]">
          A shared collection
        </div>
        <h1 className="font-display mt-5 text-4xl font-semibold tracking-tight md:text-6xl">{collection.title}</h1>
        {collection.blurb && <p className="mt-5 max-w-2xl text-lg leading-8 text-[#665746]">{collection.blurb}</p>}

        {/* Counts, never totals. A page that leads with a collection's dollar
            value advertises a target -- see summarizeCollection. */}
        <div className="mt-6 flex flex-wrap gap-3">
          <Chip tone="green">{collection.summary.itemCount} {collection.summary.itemCount === 1 ? "item" : "items"}</Chip>
          {collection.summary.firstEditionCount > 0 && (
            <Chip tone="green">
              {collection.summary.firstEditionCount} first {collection.summary.firstEditionCount === 1 ? "edition" : "editions"}
            </Chip>
          )}
          {collection.summary.gradedCount > 0 && <Chip>{collection.summary.gradedCount} with a condition grade</Chip>}
        </div>
      </section>

      {items.length === 0 ? (
        <div className="mt-10 rounded-[2rem] border border-[#d8c7ad] bg-[#fff9f0] p-8 text-center shadow-sm">
          <h2 className="text-2xl font-semibold">Nothing here yet</h2>
          <p className="mx-auto mt-3 max-w-md leading-7 text-[#665746]">
            This collector hasn&apos;t shared any items on this page yet.
          </p>
        </div>
      ) : (
        /* Every item is sent, and the browser filters what it was given. The
           controls only appear once there is enough here to be worth
           searching -- a shelf of four is faster to read than to filter. */
        <CollectionBrowser items={items} />
      )}

      {/* Below the collection, not above it: the page is a shelf first, and
          what someone is hunting is the postscript. */}
      <PublicWishlist wants={wishlist} />

      <section className="mt-12 rounded-[2rem] border border-[#d8c7ad] bg-[#fff9f0] p-8 text-center shadow-sm">
        <h2 className="text-2xl font-semibold">Catalog your own collection</h2>
        <p className="mx-auto mt-3 max-w-lg leading-7 text-[#665746]">
          FirstFinder is free and open source. Photograph a book and get its edition, condition, and what copies like it
          actually sell for.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-11 items-center rounded-full bg-[#123f38] px-6 text-sm font-medium text-[#fff7ea] transition hover:bg-[#0f332d]"
        >
          Start your collection
        </Link>
      </section>
    </main>
  );
}
