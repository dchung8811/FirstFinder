// Sourced from stephenkingcollector.com's It entry. Facts only -- the wording
// here is ours. That site asks that its material not be reproduced; what is
// taken is the bibliographic facts, which belong to nobody.
//
// Single-sourced. Every claim below is one the source actually makes.
//
// Note what is NOT here: the source carries a reader-contributed account of how
// the 800,000-copy print run was split, credited to a former Viking employee.
// It is interesting and it may well be right, but it is second-hand recollection
// rather than bibliography, and an identification page is the wrong place for a
// fact nobody can check against a copy in their hands.

export default {
  slug: "it",
  title: "It",
  author: "Stephen King",

  status: "verified",
  verifiedBy: "dchung8811",
  verifiedAt: "2026-09-09",

  quickAnswer:
    "A first edition of It says \"First published in 1986 by Viking Penguin Inc.\" on the copyright page, has grey endpapers, and carries a $22.95 jacket. Viking, 1986. Unlike King's Doubleday titles there is no gutter code to check — the copyright page and the jacket price are the marks.",

  firstEdition: {
    publisher: "Viking",
    year: 1986,
    originalPrice: "$22.95",
    pages: 1138,
    editionStatement: "\"First published in 1986 by Viking Penguin Inc.\" on the copyright page."
  },

  identificationPoints: [
    {
      label: "Copyright page",
      detail: "Should read \"First published in 1986 by Viking Penguin Inc.\"",
      sourceIds: ["skc"]
    },
    {
      label: "Endpapers",
      detail: "Grey.",
      sourceIds: ["skc"]
    },
    {
      label: "Jacket price",
      detail:
        "$22.95 — at the time the most expensive book Viking had published. A clipped flap removes the clearest dated marker on the jacket.",
      sourceIds: ["skc"]
    },
    {
      label: "Publisher, year and size of the printing",
      detail: "Viking, copyright 15 September 1986. 1,138 pages, from a first printing of 800,000 copies.",
      sourceIds: ["skc"]
    }
  ],

  notFirstEdition: [
    {
      claim: "Assuming scarcity from the title's fame",
      why:
        "The first printing ran to 800,000 copies. It is a famous book but not a rare one in first edition, and condition does almost all the work in what a copy is worth.",
      sourceIds: ["skc"]
    }
  ],

  variants: [],

  value: [],

  photos: [],

  sources: [
    {
      id: "skc",
      title: "It — stephenkingcollector.com",
      url: "https://www.stephenkingcollector.com/1st/it.html",
      accessedAt: "2026-09-09"
    }
  ]
};
