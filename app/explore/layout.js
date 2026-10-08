import ExploreNav from "./ExploreNav";

// The shell around /explore. Unlike /c/<slug> and the guides, it wears the
// app's own nav bar: Explore is one of that bar's tabs, so arriving here from
// the app should not look like leaving it. A visitor who isn't signed in gets
// the signed-out tabs and a Log in button, the same as on the home page.

export default function ExploreLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#f6efe3] text-[#201a14]">
      <ExploreNav />

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
