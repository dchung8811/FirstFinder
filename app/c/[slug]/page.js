import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadSharedCollection } from "../../../src/lib/sharedCollection";
import { buildPublicCollection, summaryLine } from "../../../src/utils/publicCollection";
import { formatCurrency } from "../../../src/utils/format";

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
  return { ...shared, collection, slug };
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

function Chip({ children, tone = "neutral" }) {
  const tones = {
    neutral: "bg-[#f0e2cf] text-[#665746]",
    green: "bg-[#edf4f2] text-[#123f38]",
    amber: "bg-[#fff3d8] text-[#6d5526]"
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

function DetailRow({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-[#eadfcd] pt-2">
      <span className="text-xs uppercase tracking-[0.14em] text-[#8a7a64]">{label}</span>
      <span className="text-right text-sm font-medium text-[#3f352a]">{children}</span>
    </div>
  );
}

function ItemCard({ item, photoUrl }) {
  // "First / First" reads the way collectors say it; either half alone still
  // needs its noun, so a lone printing doesn't render as a bare "Second".
  const editionLine =
    item.category === "Book"
      ? [item.bookEdition && `${item.bookEdition} edition`, item.bookPrinting && `${item.bookPrinting} printing`].filter(Boolean).join(" · ")
      : item.edition;

  const hasDetails = item.estimatedValue || item.purchasePrice || item.soldPrice || item.purchaseDate || item.source || item.notes;

  return (
    <article className="overflow-hidden rounded-[2rem] border border-[#d8c7ad] bg-[#fff9f0] shadow-sm">
      {/* A plain <img>, not next/image: these are short-lived signed URLs
          into a private Supabase bucket, and routing them through the image
          optimizer would cache copies of private photos outside it. */}
      {photoUrl ? (
        <img src={photoUrl} alt={item.name || "Collection item"} className="h-56 w-full bg-[#f0e2cf] object-cover" />
      ) : (
        <div className="flex h-56 w-full items-center justify-center bg-[#f0e2cf] text-sm text-[#8a7a64]">No photo</div>
      )}

      <div className="p-5">
        <h2 className="text-xl font-semibold leading-tight">{item.name || "Untitled item"}</h2>
        {item.maker && <p className="mt-1 text-sm text-[#665746]">{item.maker}</p>}

        <div className="mt-3 flex flex-wrap gap-2">
          {editionLine && <Chip tone="green">{editionLine}</Chip>}
          {item.condition && <Chip>{item.condition}</Chip>}
          {item.bookGenre && <Chip>{item.bookGenre}</Chip>}
          {item.status === "For sale" && <Chip tone="amber">For sale</Chip>}
          {item.status === "Sold" && <Chip tone="amber">Sold</Chip>}
          {item.status === "Wishlist" && <Chip tone="amber">Wanted</Chip>}
          {/* That a receipt exists, never the receipt itself -- see the
              comment on buildPublicItem for why this is a badge and not an
              image. */}
          {item.hasReceipt && <Chip>Receipt on file</Chip>}
        </div>

        {hasDetails && (
          <div className="mt-4 flex flex-col gap-2">
            {item.estimatedValue && <DetailRow label="Est. value">{formatCurrency(item.estimatedValue)}</DetailRow>}
            {item.purchasePrice && <DetailRow label="Paid">{formatCurrency(item.purchasePrice)}</DetailRow>}
            {item.soldPrice && <DetailRow label="Sold for">{formatCurrency(item.soldPrice)}</DetailRow>}
            {item.purchaseDate && <DetailRow label="Acquired">{item.purchaseDate}</DetailRow>}
            {item.source && <DetailRow label="Source">{item.source}</DetailRow>}
            {item.notes && (
              <div className="border-t border-[#eadfcd] pt-2">
                <div className="text-xs uppercase tracking-[0.14em] text-[#8a7a64]">Notes</div>
                <p className="mt-1 whitespace-pre-line text-sm leading-6 text-[#3f352a]">{item.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export default async function SharedCollectionPage({ params }) {
  const shared = await getCollection(params);

  // An unknown slug and a collection whose owner switched sharing off are the
  // same 404, so a visitor can't tell "never existed" from "taken down".
  if (!shared) notFound();

  const { collection, photoUrls } = shared;

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

      {collection.items.length === 0 ? (
        <div className="mt-10 rounded-[2rem] border border-[#d8c7ad] bg-[#fff9f0] p-8 text-center shadow-sm">
          <h2 className="text-2xl font-semibold">Nothing here yet</h2>
          <p className="mx-auto mt-3 max-w-md leading-7 text-[#665746]">
            This collector hasn&apos;t shared any items on this page yet.
          </p>
        </div>
      ) : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {collection.items.map((item) => (
            <ItemCard key={item.id} item={item} photoUrl={photoUrls.get(item.photos[0]?.path)} />
          ))}
        </div>
      )}

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
