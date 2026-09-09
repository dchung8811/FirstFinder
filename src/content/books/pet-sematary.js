// Sourced from stephenkingcollector.com's Pet Sematary entry. Facts only --
// the wording here is ours. That site asks that its material not be
// reproduced, and a page that reads like a copy of another page is also the
// exact thing Google penalises. What is taken is the bibliographic facts, which
// belong to nobody: publisher, price, edition statement, gutter code.
//
// Single-sourced, and the page says so. The three guides published before this
// one each cite two sources; this one rests on one, which is worth stating
// plainly on a page people spend money against rather than leaving a reader to
// assume more corroboration than there is.
//
// Every claim below is one the source actually makes. Doubleday gutter codes
// have a wider literature -- what they encode, how they run across the King
// titles -- and none of it is here, because this source does not state it and
// an identification page is the wrong place to be approximately right.

export default {
  slug: "pet-sematary",
  title: "Pet Sematary",
  author: "Stephen King",

  status: "verified",
  verifiedBy: "dchung8811",
  verifiedAt: "2026-09-09",

  quickAnswer:
    "A first edition of Pet Sematary says \"First Edition\" on the copyright page and carries the code Y38 in the gutter of page 374 — the last page. Doubleday, 1983, first printing of 250,000 copies, jacket priced $15.95. Check both: the code is what separates this printing from the ones that followed.",

  firstEdition: {
    publisher: "Doubleday",
    year: 1983,
    originalPrice: "$15.95",
    pages: 374,
    editionStatement: "\"First Edition\" stated on the copyright page, together with the code Y38 on page 374."
  },

  identificationPoints: [
    {
      label: "Copyright page",
      detail: "Reads \"First Edition\".",
      sourceIds: ["skc"]
    },
    {
      label: "The code on page 374",
      detail:
        "Y38, printed in the gutter — the inner margin — of the last page. Look for it alongside the copyright page statement rather than instead of it.",
      sourceIds: ["skc"]
    },
    {
      label: "Publisher, year and size of the printing",
      detail: "Doubleday, 1983. 374 pages, from a first printing of 250,000 copies.",
      sourceIds: ["skc"]
    },
    {
      label: "Jacket price",
      detail:
        "$15.95. A clipped flap removes the one dated marker on the jacket, and costs a first edition real money.",
      sourceIds: ["skc"]
    }
  ],

  notFirstEdition: [
    {
      claim: "A copyright page that reads \"First Edition\", on its own",
      why:
        "The source gives two marks for this book, not one. Read the code on page 374 as well before concluding anything — a first printing carries both.",
      sourceIds: ["skc"]
    }
  ],

  variants: [],

  value: [],

  photos: [],

  sources: [
    {
      id: "skc",
      title: "Pet Sematary — stephenkingcollector.com",
      url: "https://www.stephenkingcollector.com/1st/petsematary.html",
      accessedAt: "2026-09-09"
    }
  ]
};
