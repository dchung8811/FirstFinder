// Sourced from fedpo.com's Dune entry. Facts only -- the wording here is ours,
// both because their prose is theirs and because a page that reads like a copy
// of another page is the exact thing Google penalises.
//
// Status stays "draft" until a human has checked these points against a real
// copy or a second source. Draft pages render but carry noindex and stay out of
// the sitemap, so nothing unverified reaches search.

export default {
  slug: "dune",
  title: "Dune",
  author: "Frank Herbert",

  status: "verified",
  verifiedBy: "dchung8811",
  verifiedAt: "2026-09-07",

  quickAnswer:
    "A true first edition of Dune says \"First Edition\" on the copyright page, names no later printing, and carries no ISBN. It was published by Chilton in 1965 in blue boards with white spine lettering. The book most often mistaken for it is the Book Club edition, which looks almost identical until you compare the jacket art.",

  firstEdition: {
    publisher: "Chilton Books",
    year: 1965,
    originalPrice: "$5.95",
    pages: 412,
    editionStatement: "\"First Edition\" stated on the copyright page, with no mention of any subsequent printing."
  },

  identificationPoints: [
    {
      label: "Copyright page",
      detail:
        "Reads \"First Edition\" and names no later printing. There is no ISBN — the book predates their general use, so an ISBN anywhere on the book rules out the 1965 first.",
      sourceIds: ["fedpo"]
    },
    {
      label: "Publisher",
      detail:
        "Chilton Books. A Dune whose title page names any other publisher is not the 1965 first edition.",
      sourceIds: ["fedpo"]
    },
    {
      label: "Binding",
      detail: "Blue boards with white lettering on the spine, and grey endpapers.",
      sourceIds: ["fedpo"]
    },
    {
      label: "Dust jacket back flap",
      detail:
        "Four lines of publisher identification along the bottom, beginning with \"CHILTON BOOKS\". Later jackets use a different flap layout.",
      sourceIds: ["fedpo"]
    },
    {
      label: "Price",
      detail: "The jacket is priced $5.95.",
      sourceIds: ["fedpo"]
    }
  ],

  notFirstEdition: [
    {
      claim: "The Book Club edition",
      why:
        "The most common false positive. It is close enough to fool a quick look, but the cover art is cropped tighter — noticeably more zoomed in than the true first. Book club copies also typically lack a jacket price and are lighter in the hand.",
      sourceIds: ["fedpo"]
    },
    {
      claim: "A correct-looking copyright page, on its own",
      why:
        "Reprint houses sometimes bought the original printing plates, so their reprints can carry the same copyright page as the first. Book clubs reproduce it too. The ABAA's advice is to check the copyright page against the foot of the spine, where a reprint house usually put its own name.",
      sourceIds: ["abaa"]
    }
  ],

  variants: [],

  // Deliberately empty. See the note in src/content/books/index.js -- we do not
  // publish value ranges we cannot source, and the app itself prices a specific
  // copy against live comparables far better than a static range could.
  value: [],

  photos: [],

  sources: [
    {
      id: "fedpo",
      title: "Dune — First Edition Identification, fedpo.com",
      url: "https://www.fedpo.com/BookDetail.php/Dune",
      accessedAt: "2026-09-07"
    },
    {
      id: "abaa",
      title: "Identifying First Editions — Antiquarian Booksellers' Association of America",
      url: "https://www.abaa.org/blog/post/identifying-first-editions",
      accessedAt: "2026-09-07"
    }
  ]
};
