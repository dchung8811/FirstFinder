import Link from "next/link";
import { loadExploreCollections } from "../../src/lib/sharedCollection";
import { collectionMonogram, updatedAgo } from "../../src/utils/explore";
import { itemCredit } from "../../src/utils/items";
import { Chip } from "../c/[slug]/ItemCard";

// Rendered per request, like /c/<slug>: switching Explore off has to take a
// shelf off this page when it is pressed, not when a cache window expires.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Explore collections",
  description: "Browse the shelves FirstFinder collectors have chosen to share — first editions, signed copies, and the rest.",
  alternates: { canonical: "/explore" }
};

// Jacket colours for covers nobody has photographed, all drawn from the
// existing palette. Chosen by item id so a book keeps its colour between
// visits instead of reshuffling on every render.
const JACKET_TONES = ["bg-[#123f38]", "bg-[#3f352a]", "bg-[#6d5526]", "bg-[#8f3524]"];

function jacketTone(id) {
  let hash = 0;
  for (const char of String(id)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return JACKET_TONES[hash % JACKET_TONES.length];
}

function Cover({ cover, href }) {
  const label = cover.name || "Untitled item";
  const credit = itemCredit(cover);
  return (
    <Link href={href} className="group w-28 shrink-0 sm:w-32" tabIndex={-1}>
      <div className="aspect-[3/4] w-full overflow-hidden rounded-2xl border border-[#d8c7ad] bg-[#f7efe3]">
        {cover.photoUrl ? (
          <img src={cover.photoUrl} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:opacity-90" />
        ) : (
          /* A book nobody has photographed keeps its place -- the owner may
             have picked it -- but drawn as a jacket rather than an empty
             frame. A blank box with a title in it reads as an image that
             failed to load, which is exactly what this isn't. */
          <div className={`flex h-full w-full flex-col justify-between p-3 text-[#fff7ea] ${jacketTone(cover.id)}`}>
            <div className="font-display line-clamp-5 text-sm font-semibold leading-snug">{label}</div>
            {credit && <div className="line-clamp-2 text-[10px] uppercase tracking-[0.14em] text-[#fff7ea]/75">{credit}</div>}
          </div>
        )}
      </div>
      <div className="mt-2 truncate text-sm font-medium" title={label}>{label}</div>
      <div className="truncate text-xs text-[#7d6c5a]" title={credit}>{credit || "Unknown maker"}</div>
    </Link>
  );
}

function Shelf({ collection }) {
  const href = `/c/${collection.slug}`;
  return (
    <section className="border-t border-[#e0d2bc] py-8">
      <div className="flex items-start gap-4">
        <div
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#123f38] text-sm font-semibold tracking-wide text-[#fff7ea]"
        >
          {collectionMonogram(collection.title)}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold leading-tight sm:text-2xl">
            <Link href={href} className="hover:underline hover:underline-offset-4">{collection.title}</Link>
          </h2>
          {/* The owner's own words on why this shelf is worth a look. Clamped so
              one long description can't push every shelf below it off screen;
              the full text is on their page. */}
          {collection.blurb && <p className="mt-1 line-clamp-3 max-w-2xl text-sm leading-6 text-[#665746]">{collection.blurb}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[#7d6c5a]">
            <span>
              {collection.itemCount} {collection.itemCount === 1 ? "item" : "items"}
              {collection.lastActivity && ` · ${updatedAgo(collection.lastActivity)}`}
            </span>
            {/* Its own pill: the one number that separates a serious shelf
                from a merely big one. */}
            {collection.firstEditionCount > 0 && (
              <Chip tone="green">
                {collection.firstEditionCount} first {collection.firstEditionCount === 1 ? "edition" : "editions"}
              </Chip>
            )}
          </div>
        </div>
        <Link href={href} className="hidden shrink-0 text-sm font-medium text-[#123f38] underline underline-offset-4 hover:text-[#0f332d] sm:block">
          View shelf →
        </Link>
      </div>

      {/* Every tile leads to the same shelf: a cover here is a sample of the
          collection, and the collection page is where an item opens. Covers
          are out of the tab order so a keyboard visitor gets one stop per
          shelf (the title) instead of nine. */}
      <div className="-mx-4 mt-5 flex gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {collection.covers.map((cover) => (
          <Cover key={cover.id} cover={cover} href={href} />
        ))}
        {collection.moreCount > 0 && (
          /* Sits where the eye already is after scrolling the strip, and
             doubles as the sign that the strip scrolls at all. */
          <Link href={href} className="w-28 shrink-0 sm:w-32" aria-label={`See all ${collection.itemCount} items in ${collection.title}`}>
            <div className="flex aspect-[3/4] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-[#cdbb9d] bg-[#fff9f0] text-[#123f38] transition hover:bg-white">
              <span className="text-2xl font-semibold">+{collection.moreCount}</span>
              <span className="text-xs uppercase tracking-[0.16em] text-[#7d6c5a]">more</span>
            </div>
          </Link>
        )}
      </div>
    </section>
  );
}

export default async function ExplorePage() {
  const collections = await loadExploreCollections();
  const itemTotal = collections.reduce((sum, collection) => sum + collection.itemCount, 0);

  return (
    <main className="mx-auto max-w-5xl px-4 pb-6 sm:px-6">
      <section className="pb-8">
        <div className="font-ledger inline-flex items-center gap-2 rounded-full border border-[#d9c9b0] bg-[#fff8ee] px-4 py-2 text-xs uppercase tracking-[0.2em] text-[#655644]">
          Explore
        </div>
        <h1 className="font-display mt-5 text-4xl font-semibold tracking-tight md:text-6xl">Shelves worth a look</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-[#665746]">
          Collections their owners have chosen to show off. Titles, editions and photos — never prices.
        </p>
        {collections.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-3">
            <Chip tone="green">{collections.length} {collections.length === 1 ? "collection" : "collections"}</Chip>
            <Chip>{itemTotal} {itemTotal === 1 ? "item" : "items"} shared</Chip>
          </div>
        )}
      </section>

      {collections.map((collection) => (
        <Shelf key={collection.slug} collection={collection} />
      ))}

      {/* Shown whenever the wall is short, not only when it is empty: while
          Explore has a handful of shelves, the most useful thing it can do is
          ask for the next one. */}
      <section className={`${collections.length > 0 ? "mt-4" : ""} rounded-[2rem] border border-[#d8c7ad] bg-[#fff9f0] p-8 text-center shadow-sm`}>
        <h2 className="text-2xl font-semibold">{collections.length === 0 ? "No shelves here yet" : "Put your shelf here"}</h2>
        <p className="mx-auto mt-3 max-w-lg leading-7 text-[#665746]">
          List your collection page, switch on “Show on Explore”, and say what makes your shelf unique. You choose the
          eight items people see first.
        </p>
        {/* Straight to the Explore section of the share dialog rather than
            the app's front door: someone who read "put your shelf here" and
            pressed the button should not then have to find Share themselves.
            InventoryApp reads ?share=explore, asking a signed-out visitor to
            log in first. */}
        <Link
          href="/?share=explore"
          className="mt-6 inline-flex h-11 items-center rounded-full bg-[#123f38] px-6 text-sm font-medium text-[#fff7ea] transition hover:bg-[#0f332d]"
        >
          Add your shelf
        </Link>
      </section>
    </main>
  );
}
