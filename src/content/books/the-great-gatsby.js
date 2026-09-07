// Sourced from fedpo.com's The Great Gatsby entry, rewritten in our own words.
//
// This is the hardest of the three to get right and the one most worth a
// careful verification pass: the first-state text points are the whole game on
// Gatsby, and several of them are recorded here as page/line locations whose
// corrected readings our source does not spell out. Those are flagged
// individually rather than filled in from memory.

export default {
  slug: "the-great-gatsby",
  title: "The Great Gatsby",
  author: "F. Scott Fitzgerald",

  status: "draft",
  verifiedBy: null,
  verifiedAt: null,

  quickAnswer:
    "A first edition of The Great Gatsby was published by Charles Scribner's Sons in 1925, in dark green cloth, with the Scribner seal on the copyright page and no printing statement. The first printing is distinguished by a set of textual errors later corrected — the best known is \"sick in tired\" on page 205. The dust jacket is where most of the value sits, and it is very widely faked.",

  firstEdition: {
    publisher: "Charles Scribner's Sons",
    year: 1925,
    originalPrice: "$2.00",
    pages: 218,
    editionStatement:
      "The Scribner seal on the copyright page, with no statement of any later printing."
  },

  identificationPoints: [
    {
      label: "Copyright page",
      detail:
        "Carries the Charles Scribner's Sons seal and names no later printing. A copyright page missing the seal, or carrying a printing statement, is a later printing.",
      sourceIds: ["fedpo"]
    },
    {
      label: "Binding",
      detail:
        "Dark green cloth. Title and author blind-stamped on the front board; title, author's surname and publisher in gilt on the spine.",
      sourceIds: ["fedpo"]
    },
    {
      label: "First-state text — page 205",
      detail:
        "Lines 9–10 read \"sick in tired\" where later printings read \"sick and tired\". The best known of the first-state points.",
      sourceIds: ["fedpo"]
    },
    {
      label: "First-state text — further points",
      detail:
        "Four more locations distinguish the first state: page 60 line 16, page 119 line 22, page 165 line 16, and page 211 lines 7–8 (\"Union Street station\").",
      sourceIds: ["fedpo"],
      needsVerification:
        "Our source records these locations but not the corrected readings for all of them. Each needs its first-state and corrected wording written out from a bibliography before this page goes live — a half-stated issue point is worse than none, because a reader cannot check their copy against it."
    },
    {
      label: "Dust jacket — the lowercase j",
      detail:
        "On the first-issue jacket, \"jay Gatsby\" appears on the rear panel with a lowercase j, which was corrected to an uppercase J.",
      sourceIds: ["fedpo"],
      needsVerification:
        "Accounts differ on whether the correction was printed or made by hand in ink on some copies. Worth settling before publishing, since it changes what a reader should expect to see."
    }
  ],

  notFirstEdition: [
    {
      claim: "A first edition book in a facsimile jacket",
      why:
        "Almost all of Gatsby's value is in the jacket, which makes it one of the most reproduced jackets in modern collecting. A facsimile is usually detectable by paper feel and by the crispness of the printing under magnification. Treat any Gatsby jacket as suspect until proven otherwise.",
      sourceIds: ["fedpo"]
    },
    {
      claim: "A correct-looking copyright page, on its own",
      why:
        "On this title the text points are what settle it. A copyright page can be reproduced — reprint houses working from the original plates and book clubs both carry the printing history over — so the ABAA's advice is to read it against the foot of the spine, and here against the page 205 reading as well.",
      sourceIds: ["abaa"]
    }
  ],

  variants: [],
  value: [],
  photos: [],

  sources: [
    {
      id: "fedpo",
      title: "The Great Gatsby — First Edition Identification, fedpo.com",
      url: "https://www.fedpo.com/BookDetail.php/The-Great-Gatsby",
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
