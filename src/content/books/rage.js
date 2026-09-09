// Sourced from stephenkingcollector.com's Rage entry. Facts only -- the
// wording here is ours. That site asks that its material not be reproduced;
// what is taken is the bibliographic facts, which belong to nobody.
//
// Single-sourced. Every claim below is one the source actually makes.
//
// On the withdrawal: it is stated plainly because it is the central
// bibliographic fact about this book. A paperback that sold for $1.50 is worth
// four figures precisely because King let it go out of print and it has never
// come back, so a page that left it out would be describing a different market
// than the one a reader is standing in. It is recorded as what happened, without
// editorialising in either direction -- this is an identification guide, and the
// reader's own view of the book is their business.

export default {
  slug: "rage",
  title: "Rage",
  author: "Stephen King",

  status: "verified",
  verifiedBy: "dchung8811",
  verifiedAt: "2026-09-09",

  quickAnswer:
    "A first edition of Rage is a Signet paperback, not a hardcover — it never had a US hardcover printing. The copyright page reads \"First Printing, September, 1977\" and the number line runs 123456789. Issue price $1.50. It is King's first novel as Richard Bachman, and it is out of print by his own decision.",

  firstEdition: {
    publisher: "Signet (New American Library)",
    year: 1977,
    originalPrice: "$1.50",
    pages: 211,
    editionStatement: "\"First Printing, September, 1977\" on the copyright page, with the number line 123456789."
  },

  identificationPoints: [
    {
      label: "Copyright page",
      detail: "Reads \"First Printing, September, 1977\".",
      sourceIds: ["skc"]
    },
    {
      label: "Number line",
      detail:
        "123456789. A line beginning at any higher number is a later printing — the usual paperback rule, and here it is the check that settles it.",
      sourceIds: ["skc"]
    },
    {
      label: "Format and publisher",
      detail:
        "A Signet mass-market paperback — Signet was an imprint of New American Library. 211 pages, from a first printing of 75,000 copies. There is no US hardcover first edition to look for.",
      sourceIds: ["skc"]
    },
    {
      label: "Cover price",
      detail: "$1.50.",
      sourceIds: ["skc"]
    }
  ],

  notFirstEdition: [
    {
      claim: "Looking for it under King's name",
      why:
        "It was published as by Richard Bachman — King's first novel under that pseudonym — and it was written earlier under the title Getting It On. A catalogue search on King alone can miss it.",
      sourceIds: ["skc"]
    }
  ],

  variants: [],

  value: [],

  photos: [],

  sources: [
    {
      id: "skc",
      title: "Rage — stephenkingcollector.com",
      url: "https://www.stephenkingcollector.com/1st/rage.html",
      accessedAt: "2026-09-09"
    }
  ]
};
