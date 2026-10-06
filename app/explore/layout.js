import Link from "next/link";

// The shell around /explore.
//
// Duplicated from app/c/layout.js rather than shared, for the reason given
// there: the app's own nav lives inside the one "use client" InventoryApp
// component, which can't be imported into a server component. The footer
// differs too: here it describes a page of other people's collections, not
// one collector's.
export default function ExploreLayout({ children }) {
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
          Back to FirstFinder
        </Link>
      </header>

      {children}

      <footer className="mx-auto max-w-5xl px-6 py-12 text-sm leading-6 text-[#665746]">
        <p>
          Every collection here was catalogued in{" "}
          <Link href="/" className="font-medium text-[#123f38] underline underline-offset-4">
            FirstFinder
          </Link>{" "}
          by its owner, who chose to show it on Explore. Editions and condition are their own record, not an appraisal,
          and not verified by FirstFinder.
        </p>
      </footer>
    </div>
  );
}
