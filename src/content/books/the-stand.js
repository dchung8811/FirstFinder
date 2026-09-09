// Sourced from stephenkingcollector.com's The Stand entry. Facts only -- the
// wording here is ours. That site asks that its material not be reproduced;
// what is taken is the bibliographic facts, which belong to nobody.
//
// Single-sourced. Every claim below is one the source actually makes.

export default {
  slug: "the-stand",
  title: "The Stand",
  author: "Stephen King",

  status: "verified",
  verifiedBy: "dchung8811",
  verifiedAt: "2026-09-09",

  quickAnswer:
    "A first edition of The Stand says \"First Edition\" on the copyright page and carries the code T39 in the inner margin of page 823 — the last page. Doubleday, 1978, jacket priced $12.95, from a first printing of 70,000. The 1990 \"Complete and Uncut\" edition is a different book, not a later printing of this one.",

  firstEdition: {
    publisher: "Doubleday",
    year: 1978,
    originalPrice: "$12.95",
    pages: 823,
    editionStatement: "\"First Edition\" on the copyright page, together with the code T39 on page 823."
  },

  identificationPoints: [
    {
      label: "Copyright page",
      detail: "Reads \"First Edition\".",
      sourceIds: ["skc"]
    },
    {
      label: "The code on page 823",
      detail:
        "T39, in the inner margin of the last page. Read it alongside the copyright page rather than instead of it — a first printing carries both.",
      sourceIds: ["skc"]
    },
    {
      label: "Publisher, year and size of the printing",
      detail: "Doubleday, 1978. 823 pages, from a first printing of 70,000 copies.",
      sourceIds: ["skc"]
    },
    {
      label: "Jacket price",
      detail: "$12.95.",
      sourceIds: ["skc"]
    }
  ],

  notFirstEdition: [
    {
      claim: "The 1990 \"Complete and Uncut\" edition",
      why:
        "A different book rather than a later printing of this one. Doubleday published it in 1990 at $24.95, in a run of 400,000, and its copyright page reads \"First Trade Edition\" — wording close enough to the real thing to catch a hurried reader. The 1978 text is the shorter one; roughly a quarter of what King wrote was cut from it, and the 1990 edition is where that material was restored.",
      sourceIds: ["skc"]
    }
  ],

  variants: [
    {
      name: "First edition, 1978",
      detail: "Doubleday, 70,000 copies at $12.95. The abridged text.",
      sourceIds: ["skc"]
    },
    {
      name: "Complete and Uncut, 1990",
      detail:
        "Doubleday, 400,000 copies at $24.95, stating \"First Trade Edition\" on the copyright page. The restored text.",
      sourceIds: ["skc"]
    }
  ],

  value: [],

  photos: [],

  sources: [
    {
      id: "skc",
      title: "The Stand — stephenkingcollector.com",
      url: "https://www.stephenkingcollector.com/1st/stand.html",
      accessedAt: "2026-09-09"
    }
  ]
};
