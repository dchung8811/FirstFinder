// A standalone shell for the feature guides, for the same reason the /books
// guides have one: the app's nav and footer live inside the "use client"
// InventoryApp.jsx and can't be imported into a server component. See
// app/books/layout.js. Duplicating a header is the cheaper mistake.
//
// It sits on [slug] rather than on /features so that /features itself is the
// app's own Features page (app/features/page.js), nav bar and all, which every
// guide links back to.

export default function FeaturesLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#f6efe3] text-[#201a14]">
      <header className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-5">
        <a href="/" className="flex min-w-0 items-center gap-3">
          <img src="/firstfinder-mark-exact.png" alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover" />
          <span className="min-w-0">
            <span className="block truncate text-xl font-semibold tracking-tight">FirstFinder</span>
            <span className="hidden truncate text-xs uppercase tracking-[0.22em] text-[#746655] sm:block">Your collection, catalogued</span>
          </span>
        </a>
        <a
          href="/"
          className="shrink-0 rounded-full bg-[#123f38] px-5 py-2.5 text-sm font-medium text-[#fff7ea] transition hover:bg-[#0f332d]"
        >
          Open the app
        </a>
      </header>

      {children}

      <footer className="mx-auto max-w-4xl px-6 py-12 text-sm leading-6 text-[#665746]">
        <p>
          FirstFinder is a free, open-source catalog for collectors.{" "}
          <a href="/" className="font-medium text-[#123f38] underline underline-offset-4">
            Start your collection
          </a>
          .
        </p>
      </footer>
    </div>
  );
}
