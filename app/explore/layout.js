import Link from "next/link";

// The shell around /explore. Same header as app/c/layout.js and for the same
// reason -- the app's own nav lives inside the one "use client" InventoryApp
// component and can't be imported here. The button says "Open FirstFinder"
// rather than "Start your collection" because, unlike a shared link, Explore
// is reached from the app's own nav by people who already have one.

export default function ExploreLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#f6efe3] text-[#201a14]">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <img src="/firstfinder-mark-exact.png" alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover" />
          <span className="min-w-0">
            <span className="block truncate text-xl font-semibold tracking-tight">FirstFinder</span>
            <span className="hidden truncate text-xs uppercase tracking-[0.22em] text-[#746655] sm:block">Your collection, catalogued</span>
          </span>
        </Link>
        <Link
          href="/"
          className="shrink-0 rounded-full bg-[#123f38] px-5 py-2.5 text-sm font-medium text-[#fff7ea] transition hover:bg-[#0f332d]"
        >
          Open FirstFinder
        </Link>
      </header>

      {children}

      <footer className="mx-auto max-w-5xl px-4 py-12 text-sm leading-6 text-[#665746] sm:px-6">
        <p>
          Every shelf here was put on Explore by its owner, who can take it off again at any time. Editions and
          condition are their own record of their own collection — not an appraisal, and not verified by FirstFinder.
        </p>
      </footer>
    </div>
  );
}
