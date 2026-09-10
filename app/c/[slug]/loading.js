// What a visitor sees while the collection is still being read.
//
// The page is force-dynamic and needs the whole collection before it can
// render a single word of it: the settings row, the items, and a signed URL
// for every photo, all awaited on the server. Measured against the real
// database that is a third to eight tenths of a second before the first byte
// leaves, and a phone on mobile data pays its own latency on top. Until this
// file existed, all of that was a blank white tab -- most visibly from the
// share dialog's "Open preview", which opens the page in a new tab where
// there is not even a previous page left on screen to look at.
//
// Being a loading.js is what makes the difference: it wraps the page in a
// Suspense boundary, so the layout's header and this skeleton flush
// immediately and the collection streams in behind them.
//
// The shapes below mirror app/c/[slug]/page.js and ItemCard exactly -- the
// same max-width, the same rule under the header block, the same h-56 photo
// well and rounded-[2rem] card in the same three-column grid. A skeleton that
// does not match is worse than none: the page jumps when the real thing
// arrives, which reads as breakage rather than as loading.

function Line({ className = "" }) {
  return <div className={`rounded-full bg-[#e7d7bd] motion-safe:animate-pulse ${className}`} />;
}

function CardSkeleton() {
  return (
    <article className="overflow-hidden rounded-[2rem] border border-[#d8c7ad] bg-[#fff9f0] shadow-sm">
      {/* Same fixed h-56 well the real card reserves for its photo. */}
      <div className="h-56 w-full bg-[#f0e2cf] motion-safe:animate-pulse" />
      <div className="flex flex-col gap-3 p-5">
        <Line className="h-5 w-3/4" />
        <Line className="h-4 w-1/2" />
        <div className="flex gap-2 pt-1">
          <Line className="h-6 w-24" />
          <Line className="h-6 w-16" />
        </div>
      </div>
    </article>
  );
}

export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl px-6 pb-6" aria-busy="true">
      {/* Announced once, rather than leaving a screen reader to narrate a
          screenful of empty boxes. */}
      <p role="status" className="sr-only">
        Loading this collection.
      </p>

      <section className="border-b border-[#e0d2bc] pb-10">
        {/* Real text, not a grey box: this line is true before anything has
            loaded, and it tells the visitor what they have opened while the
            rest arrives. */}
        <div className="font-ledger inline-flex items-center gap-2 rounded-full border border-[#d9c9b0] bg-[#fff8ee] px-4 py-2 text-xs uppercase tracking-[0.2em] text-[#655644]">
          A shared collection
        </div>

        {/* Stands in for the h1, at the height it occupies on each breakpoint.
            Two lines rather than one: at 375px a collection title of any
            ordinary length wraps, so a single line would leave everything
            below it to jump down when the real title lands. The second line
            is short, the way a wrapped last line is. */}
        <Line className="mt-5 h-10 w-full max-w-2xl md:h-14" />
        <Line className="mt-2 h-10 w-1/2 max-w-md md:h-14" />
        <Line className="mt-5 h-5 w-full max-w-2xl" />

        <div className="mt-6 flex flex-wrap gap-3">
          <Line className="h-8 w-28" />
          <Line className="h-8 w-36" />
        </div>
      </section>

      {/* Six is what fills the grid on a laptop without inventing a number:
          enough to read as a shelf, few enough that a small collection does
          not shrink when the real items land. */}
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>
    </main>
  );
}
