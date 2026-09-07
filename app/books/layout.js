// A standalone shell for the identification pages.
//
// The app's own nav and footer live inside app/InventoryApp.jsx, which is a
// single "use client" component -- they can't be imported into a server
// component, and cutting them out of a 6,000-line file to share ~30 lines of
// markup is the kind of whole-file surgery that has already cost this repo one
// regression. Duplicating the header here is the cheaper mistake.

export default function BooksLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#f6efe3] text-[#201a14]">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
        <a href="/" className="flex items-center gap-3">
          <img src="/firstfinder-mark-exact.png" alt="" className="h-10 w-10 rounded-xl object-cover" />
          <span>
            <span className="block text-xl font-semibold tracking-tight">FirstFinder</span>
            <span className="block text-xs uppercase tracking-[0.22em] text-[#746655]">Your collection, catalogued</span>
          </span>
        </a>
        <a
          href="/"
          className="rounded-full bg-[#123f38] px-5 py-2.5 text-sm font-medium text-[#fff7ea] transition hover:bg-[#0f332d]"
        >
          Open the app
        </a>
      </header>

      {children}

      <footer className="mx-auto max-w-3xl px-6 py-12 text-sm leading-6 text-[#665746]">
        <p>
          FirstFinder is a free, open-source catalog for collectors.{" "}
          <a href="/" className="font-medium text-[#123f38] underline underline-offset-4">
            Photograph a book and find out what you have
          </a>
          .
        </p>
        <p className="mt-3">
          Identification guides are compiled from published references and checked by hand. They are a starting point,
          not an appraisal — condition, jacket and provenance decide what a copy is actually worth.
        </p>
      </footer>
    </div>
  );
}
