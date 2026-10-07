// What the Features page lists, newest first.
//
// Each date is the day the work merged to main, in US Eastern time, which is
// the day it went live: main deploys to production on merge. The `prs` are
// there so a date can be checked against GitHub rather than trusted.
//
// Only things a collector can see or use belong here. Fixes, refactors, and
// infrastructure are real work, but a list of them reads as a changelog, not
// as a reason to try something. When a feature ships, add it at the top.

export const features = [
  {
    date: "2026-10-06",
    title: "Explore other collectors' shelves",
    description: "A new Explore page shows collections whose owners have chosen to be on it, each with a strip of covers they picked. Being on it is a separate switch from sharing your page at all, and it never shows prices.",
    prs: [202]
  },
  {
    date: "2026-09-12",
    title: "Posters, ephemera, magazines, and periodicals",
    description: "Two new categories for the paper that isn't a book: posters and ephemera, and magazines and periodicals.",
    prs: [184, 190]
  },
  {
    date: "2026-09-09",
    title: "Works with no signal",
    description: "Install FirstFinder to your home screen and your collection opens even in a basement with no signal. Finds, edits, and sales made offline wait on your phone and go up when the connection comes back, photos included.",
    prs: [148, 149]
  },
  {
    date: "2026-09-09",
    title: "Book details that fill themselves in",
    description: "Start typing a title and pick the book from the list: author, publisher, edition, and printing come with it. Titles with an identification guide come first and link to it.",
    prs: [143]
  },
  {
    date: "2026-09-09",
    title: "Recent finds that take you to the book",
    description: "The dashboard's recent finds are ordered by when you bought each one, and tapping a cover opens that book's record in your collection.",
    prs: [151, 161]
  },
  {
    date: "2026-09-08",
    title: "A wishlist of its own",
    description: "Keep what you're hunting for in its own tab, with the most you'd pay. Share it on your public page without sharing that ceiling. When you find a copy, photograph it right there and it moves into your collection.",
    prs: [125, 126, 130]
  },
  {
    date: "2026-09-08",
    title: "A shareable collection page",
    description: "Publish a read-only page of your collection at a link you control: choose what it shows, keep it unlisted or let search engines find it. Visitors can search, filter, switch layouts, and open the photos.",
    prs: [116, 123, 130]
  },
  {
    date: "2026-09-07",
    title: "First-edition identification guides",
    description: "Sourced guides to telling a true first edition from a later printing, for Dune, The Great Gatsby, East of Eden, The Stand, and more, grouped by author.",
    prs: [97, 133, 134, 135]
  },
  {
    date: "2026-09-07",
    title: "Dashboard filters",
    description: "Narrow the dashboard to one category or one stretch of time, and the totals and charts follow.",
    prs: [101]
  },
  {
    date: "2026-09-06",
    title: "Duplicate warnings",
    description: "Adding something you already have? FirstFinder points out the possible duplicate before you save it.",
    prs: [80]
  },
  {
    date: "2026-09-06",
    title: "Free and open source",
    description: "FirstFinder's code is public under the AGPL, and anyone can contribute. Feedback you send from the app becomes a public issue, without your email address or account attached.",
    prs: [82, 88]
  },
  {
    date: "2026-08-08",
    title: "Values from real sales, not guesses",
    description: "Estimated values for books come from a live search of what copies are actually listed for, rather than from memory.",
    prs: [67]
  },
  {
    date: "2026-08-07",
    title: "Identify an item from a photo",
    description: "Take a picture of the cover and FirstFinder fills in the details, with an estimated value, for you to check before saving. Two a day, free.",
    prs: [66]
  },
  {
    date: "2026-08-07",
    title: "The dashboard",
    description: "Your collection at a glance: what it's worth, what you paid, how it has grown, and what you found most recently.",
    prs: [65]
  },
  {
    date: "2026-08-04",
    title: "Edit everything at once",
    description: "Export your collection to CSV, change it in a spreadsheet, and upload it back to update or remove items in bulk. Or edit right in the table, one cell at a time.",
    prs: [64]
  },
  {
    date: "2026-08-01",
    title: "Condition grades and sharper filters",
    description: "Record each item's condition, and filter your collection by category, genre, edition, and printing.",
    prs: [11, 36]
  },
  {
    date: "2026-08-01",
    title: "Collection reports for insurance",
    description: "Print or save a PDF of your collection and what it's worth, ready for an insurer, or download it as a CSV.",
    prs: [11, 40]
  },
  {
    date: "2026-08-01",
    title: "Track what you sold",
    description: "Mark an item sold and record what it sold for and when. The estimate from before the sale is kept, so you can see how you did.",
    prs: [7, 11]
  },
  {
    date: "2026-08-01",
    title: "Find similar copies",
    description: "One tap searches AbeBooks and eBay for copies like yours, edition and printing included.",
    prs: [11]
  },
  {
    date: "2026-07-31",
    title: "Your photos and receipts, kept",
    description: "Photos of each item and its receipt are stored privately with your account, visible only to you unless you share them.",
    prs: [2]
  },
  {
    date: "2026-07-31",
    title: "Your own account",
    description: "Sign up with an email and password or with Google, and reset your password if you forget it.",
    prs: [1]
  }
];
