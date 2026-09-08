import Link from "next/link";

// The shell around a public collection page.
//
// Same reasoning as app/books/layout.js: the app's own nav and footer live
// inside app/InventoryApp.jsx, which is one "use client" component and can't
// be imported into a server component. Duplicating a header is the cheaper
// mistake than cutting one out of a 5,500-line file.
//
// Internal links go through next/link rather than a bare <a>: a visitor
// arriving here cold is the most likely person in the app to click through to
// the home page, and a client-side transition is the difference between that
// feeling instant and feeling like a new site.
//
// This header is deliberately not the app's. A visitor here is usually not a
// FirstFinder user -- they followed a link a collector sent them -- so the
// only thing to offer is an explanation of what they are looking at.

export default function SharedCollectionLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#f6efe3] text-[#201a14]">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-5">
        <Link href="/" className="flex items-center gap-3">
          <img src="/firstfinder-mark-exact.png" alt="" className="h-10 w-10 rounded-xl object-cover" />
          <span>
            <span className="block text-xl font-semibold tracking-tight">FirstFinder</span>
            <span className="block text-xs uppercase tracking-[0.22em] text-[#746655]">Your collection, catalogued</span>
          </span>
        </Link>
        <Link
          href="/"
          className="shrink-0 rounded-full bg-[#123f38] px-5 py-2.5 text-sm font-medium text-[#fff7ea] transition hover:bg-[#0f332d]"
        >
          Start your collection
        </Link>
      </header>

      {children}

      <footer className="mx-auto max-w-5xl px-6 py-12 text-sm leading-6 text-[#665746]">
        <p>
          This collection was catalogued in{" "}
          <Link href="/" className="font-medium text-[#123f38] underline underline-offset-4">
            FirstFinder
          </Link>
          , a free, open-source catalog for collectors. Photograph a book and find out what you have.
        </p>
        <p className="mt-3">
          Everything here was entered by its owner. Editions, condition, and any values shown are their record of their
          own collection — not an appraisal, and not verified by FirstFinder.
        </p>
      </footer>
    </div>
  );
}
