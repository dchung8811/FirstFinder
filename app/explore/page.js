import Link from "next/link";
import { listExploreShelves } from "../../src/lib/sharedCollection";
import { sharePath } from "../../src/utils/publicCollection";
import { itemCredit } from "../../src/utils/items";
import { Chip } from "../c/[slug]/ItemCard";

const SITE_URL = "https://firstfinder.app";

// Rendered per request, for the same reason as /c/<slug>: switching off "Show on
// Explore" has to take a collection off this page the moment it is saved, not
// at the end of a cache window. It also means cover URLs are always freshly
// signed.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Explore collections",
  description: "Browse the shelves collectors have chosen to share on FirstFinder: first editions, cards, comics and more.",
  alternates: { canonical: `${SITE_URL}/explore` },
  openGraph: {
    title: "Explore collections",
    description: "Browse the shelves collectors have chosen to share on FirstFinder.",
    url: `${SITE_URL}/explore`,
    siteName: "FirstFinder",
    type: "website",
    images: ["/firstfinder-mark-exact.png"]
  }
};

function CoverTile({ item, href }) {
  return (
    <Link
      href={href}
      className="group w-32 shrink-0 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#123f38]/40"
      aria-label={`${item.name || "Untitled item"}, in this collection`}
    >
      <div className="aspect-[3/4] w-full overflow-hidden rounded-2xl border border-[#d8c7ad] bg-[#f0e2cf]">
        {/* A plain <img>, not next/image, for the reason given in ItemCard:
            these are signed URLs into a private bucket, and the optimizer
            would keep copies of them outside it. */}
        {item.photoUrl ? (
          <img src={item.photoUrl} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:opacity-90" />
        ) : (
          /* No photo is a normal state, not a failure. The title stands in for
             the jacket so the tile still reads as a book. */
          <div className="font-display flex h-full w-full items-end p-3 text-sm font-semibold leading-tight text-[#665746]">
            {item.name || "Untitled item"}
          </div>
        )}
      </div>
      <div className="mt-2 truncate text-sm font-medium" title={item.name || "Untitled item"}>{item.name || "Untitled item"}</div>
      <div className="truncate text-xs text-[#7d6c5a]">{itemCredit(item) || "Unknown maker"}</div>
    </Link>
  );
}

function Shelf({ shelf }) {
  const href = sharePath(shelf.slug);
  const initial = (shelf.title.trim()[0] || "F").toUpperCase();

  return (
    <section className="border-b border-[#e0d2bc] py-8 last:border-b-0">
      <div className="mb-4 flex flex-wrap items-start gap-4">
        <div aria-hidden="true" className="font-display grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#123f38] text-lg font-semibold text-[#fff7ea]">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl font-semibold leading-tight">
            <Link href={href} className="hover:underline hover:underline-offset-4">{shelf.title}</Link>
          </h2>
          {shelf.blurb && <p className="mt-1 text-sm leading-6 text-[#665746]">{shelf.blurb}</p>}
          {/* Counts only, as on the collection page itself. Never a value:
              see "No prices anywhere" in buildExploreShelf. */}
          <div className="mt-2 flex flex-wrap gap-2">
            <Chip>{shelf.itemCount} {shelf.itemCount === 1 ? "item" : "items"}</Chip>
            {shelf.firstEditionCount > 0 && (
              <Chip tone="green">
                {shelf.firstEditionCount} first {shelf.firstEditionCount === 1 ? "edition" : "editions"}
              </Chip>
            )}
          </div>
        </div>
        <Link
          href={href}
          className="shrink-0 self-center rounded-full border border-[#cdbb9d] bg-[#fff9f0] px-4 py-2 text-sm font-medium text-[#123f38] transition hover:border-[#123f38] hover:bg-[#123f38] hover:text-[#fff7ea]"
        >
          View collection
        </Link>
      </div>

      {shelf.covers.length > 0 && (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {shelf.covers.map((item) => (
            <CoverTile key={item.id} item={item} href={href} />
          ))}
          {/* Closes the strip where the eye already is after scrolling,
              rather than a "see all" link off to the side. */}
          {shelf.moreCount > 0 && (
            <Link href={href} className="group w-32 shrink-0 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#123f38]/40">
              <div className="grid aspect-[3/4] w-full place-items-center rounded-2xl border border-dashed border-[#cdbb9d] bg-[#f7efe3] text-center transition group-hover:bg-[#f0e2cf]">
                <span>
                  <span className="font-ledger block text-base font-medium text-[#123f38]">+{shelf.moreCount}</span>
                  <span className="mt-1 block text-xs text-[#7d6c5a]">more</span>
                </span>
              </div>
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

export default async function ExplorePage() {
  const shelves = await listExploreShelves();

  return (
    <main className="mx-auto max-w-5xl px-6 pb-6">
      <section className="border-b border-[#e0d2bc] pb-8">
        <div className="font-ledger inline-flex items-center gap-2 rounded-full border border-[#d9c9b0] bg-[#fff8ee] px-4 py-2 text-xs uppercase tracking-[0.2em] text-[#655644]">
          Explore
        </div>
        <h1 className="font-display mt-5 text-4xl font-semibold tracking-tight md:text-6xl">Other collectors&apos; shelves</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-[#665746]">
          Collections their owners chose to show here. Most recently active first. Tap a shelf to see all of it.
        </p>
      </section>

      {shelves.map((shelf) => (
        <Shelf key={shelf.slug} shelf={shelf} />
      ))}

      {/* Always shown, even under a full page: the way onto Explore is a
          setting most people will never find unprompted. */}
      <section className="mt-10 rounded-[2rem] border border-[#d8c7ad] bg-[#fff9f0] p-8 text-center shadow-sm">
        <h2 className="text-2xl font-semibold">{shelves.length === 0 ? "No shelves here yet" : "Add your own shelf"}</h2>
        <p className="mx-auto mt-3 max-w-lg leading-7 text-[#665746]">
          In FirstFinder, open My Collection, choose Share, set it to &ldquo;Listed on search engines&rdquo;, and turn on
          &ldquo;Show on Explore&rdquo;. Your page only ever shows what you choose to share, and never anything about money
          unless you turn that on.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-11 items-center rounded-full bg-[#123f38] px-6 text-sm font-medium text-[#fff7ea] transition hover:bg-[#0f332d]"
        >
          Open FirstFinder
        </Link>
      </section>
    </main>
  );
}
