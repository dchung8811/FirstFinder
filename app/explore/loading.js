// What a visitor sees while Explore's shelves are still being read (#265).
//
// The page is force-dynamic and waits on every listed shelf before it can
// render: the share rows, each owner's items, and a signed URL for every
// cover. On a warm server that is around half a second; on a cold Vercel
// function with a slow phone connection it ran to several seconds, and until
// this file existed all of that was spent frozen on the previous page --
// tapping Explore in the nav appeared to do nothing at all.
//
// Being a loading.js is what fixes that: Next wraps the page in a Suspense
// boundary, so the layout's nav bar and this skeleton show the moment the
// tab is tapped, and the shelves stream in behind them.
//
// The shapes mirror app/explore/page.js -- the same max-width, the same
// heading block, and a Shelf's monogram, title, meta line and strip of 3:4
// covers -- so nothing jumps when the real page lands. The heading and
// description are real text: they are true before anything has loaded.

function Line({ className = "" }) {
  return <div className={`rounded-full bg-[#e7d7bd] motion-safe:animate-pulse ${className}`} />;
}

function ShelfSkeleton() {
  return (
    <section className="border-t border-[#e0d2bc] py-8">
      <div className="flex items-start gap-4">
        {/* The monogram square. */}
        <div className="h-12 w-12 shrink-0 rounded-2xl bg-[#e7d7bd] motion-safe:animate-pulse" />
        <div className="min-w-0 flex-1">
          <Line className="h-6 w-2/3 max-w-sm sm:h-7" />
          <Line className="mt-3 h-4 w-full max-w-xl" />
          <Line className="mt-3 h-4 w-40" />
        </div>
      </div>
      {/* Six covers: enough to fill a laptop's strip and run off a phone's,
          the way the real strip does. */}
      <div className="-mx-4 mt-5 flex gap-4 overflow-hidden px-4 pb-2 sm:mx-0 sm:px-0">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="w-28 shrink-0 sm:w-32">
            <div className="aspect-[3/4] w-full rounded-2xl border border-[#d8c7ad] bg-[#f0e2cf] motion-safe:animate-pulse" />
            <Line className="mt-2 h-4 w-5/6" />
            <Line className="mt-1.5 h-3 w-2/3" />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-6 sm:px-6" aria-busy="true">
      {/* Announced once, rather than leaving a screen reader to narrate a
          screenful of empty boxes. */}
      <p role="status" className="sr-only">
        Loading shelves.
      </p>

      <section className="pb-8">
        <div className="font-ledger inline-flex items-center gap-2 rounded-full border border-[#d9c9b0] bg-[#fff8ee] px-4 py-2 text-xs uppercase tracking-[0.2em] text-[#655644]">
          Explore
        </div>
        <h1 className="font-display mt-5 text-4xl font-semibold tracking-tight md:text-6xl">Shelves worth a look</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-[#665746]">
          Collections their owners have chosen to show off. Titles, editions and photos — never prices.
        </p>
        {/* The search box with its button, and the counts under it. */}
        <div className="mt-8 flex max-w-2xl gap-2">
          <div className="h-11 min-w-0 flex-1 rounded-full border border-[#d8c7ad] bg-[#fffdf8]" />
          <div className="h-11 w-[5.5rem] shrink-0 rounded-full bg-[#e7d7bd] motion-safe:animate-pulse" />
        </div>
        <div className="mt-6 flex gap-3">
          <Line className="h-6 w-28" />
          <Line className="h-6 w-32" />
        </div>
      </section>

      {Array.from({ length: 3 }, (_, index) => (
        <ShelfSkeleton key={index} />
      ))}
    </main>
  );
}
