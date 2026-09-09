// Sourced from fedpo.com's Gone with the Wind entry. Facts only -- the wording
// here is ours, both because their prose is theirs and because a page that
// reads like a copy of another page is the exact thing Google penalises.

export default {
  slug: "gone-with-the-wind",
  title: "Gone with the Wind",
  author: "Margaret Mitchell",

  status: "verified",
  verifiedBy: "dchung8811",
  verifiedAt: "2026-09-09",

  quickAnswer:
    "A first edition of Gone with the Wind says \"Published May, 1936\" on the copyright page and nothing else — no later month, no printing statement. Macmillan, 1936, in grey cloth with blue lettering. The month is the whole test: an otherwise identical copy reading \"Published June, 1936\" is a second printing.",

  firstEdition: {
    publisher: "The Macmillan Company",
    year: 1936,
    originalPrice: "$3.00",
    pages: 1037,
    editionStatement: "\"Published May, 1936\" on the copyright page, with no other printing statement of any kind."
  },

  identificationPoints: [
    {
      label: "Copyright page — the month is everything",
      detail:
        "The first printing reads \"Published May, 1936\" and carries no further printing statement. \"Published June, 1936\" is a second printing. Nothing else on the book separates the two as cleanly, so this is the point to check first and the one to trust.",
      sourceIds: ["fedpo"]
    },
    {
      label: "Publisher and binding",
      detail:
        "Macmillan, 1936, in grey cloth boards with blue lettering on the front board and the spine.",
      sourceIds: ["fedpo"]
    },
    {
      label: "Jacket price",
      detail: "$3.00, in the lower corner of the front flap.",
      sourceIds: ["fedpo"]
    },
    {
      label: "Jacket back panel — where the title sits",
      detail:
        "On the first-issue jacket, Gone with the Wind appears in the right-hand column of Macmillan's list of books on the rear panel, and there are no review quotations. Later issues moved the title to the top of the left-hand column, and later printings added reviews. The jacket is the scarce half of this book: first-printing jackets are harder to find than the first-printing book inside them.",
      sourceIds: ["fedpo"]
    }
  ],

  notFirstEdition: [
    {
      claim: "A May copyright page beside a June printing",
      why:
        "Both were on sale at once. Macmillan had roughly ten thousand May-dated copies out alongside the June printing because of the Book-of-the-Month Club's schedule, so the two circulated together from the start. It makes May copies less rare than the date alone suggests — not less genuine, but worth knowing before you pay.",
      sourceIds: ["fedpo"]
    },
    {
      claim: "A facsimile or later reproduction",
      why:
        "The tells are anachronisms rather than anything subtle: a renewed copyright date such as 1964, or an ISBN, which places production in the 1970s or later. Neither belongs on a 1936 sheet.",
      sourceIds: ["fedpo"]
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
      title: "Gone with the Wind — First Edition Identification, fedpo.com",
      url: "https://www.fedpo.com/BookDetail.php/Gone-With-Wind",
      accessedAt: "2026-09-09"
    }
  ]
};
