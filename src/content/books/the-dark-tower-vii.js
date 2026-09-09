// Sourced from stephenkingcollector.com's entry for the seventh Dark Tower
// volume. Facts only -- the wording here is ours. That site asks that its
// material not be reproduced; what is taken is the bibliographic facts, which
// belong to nobody.
//
// Single-sourced. Every claim below is one the source actually makes.
//
// Like The Gunslinger, this is an issue question rather than an edition
// question: the 2004 Grant is the first edition and the useful distinction is
// which of its two issues you are holding.

export default {
  slug: "the-dark-tower-vii",
  title: "The Dark Tower VII: The Dark Tower",
  author: "Stephen King",

  status: "verified",
  verifiedBy: "dchung8811",
  verifiedAt: "2026-09-09",

  quickAnswer:
    "The Donald M. Grant first edition came in two issues. The signed one is 1,500 slipcased copies in two volumes, numbered and signed by King and Michael Whelan, issued at $225. The Artist Edition is 5,000 copies signed by Whelan alone, issued at $50 — and a few hundred of those carry a small drawing he added while signing.",

  firstEdition: {
    publisher: "Donald M. Grant, Publisher",
    year: 2004,
    originalPrice: "$225.00 (signed and numbered issue)",
    pages: 864,
    editionStatement:
      "Donald M. Grant, 2004, illustrated by Michael Whelan. Issued as 1,500 signed and numbered copies and 5,000 Artist Edition copies."
  },

  identificationPoints: [
    {
      label: "Which issue — who signed it",
      detail:
        "The signed and numbered issue is signed by both King and Whelan and carries a number. The Artist Edition is signed by Whelan alone and is not numbered. That is the quickest way to tell them apart.",
      sourceIds: ["skc"]
    },
    {
      label: "Signed and numbered issue",
      detail:
        "1,500 copies, in two volumes with a slipcase, at an issue price of $225. Release slipped from 21 September into October because the slipcases had not reached Grant in time.",
      sourceIds: ["skc"]
    },
    {
      label: "Artist Edition",
      detail:
        "5,000 copies signed by Michael Whelan, at an issue price of $50. Smyth sewn, a better binding than the trade edition.",
      sourceIds: ["skc"]
    },
    {
      label: "Remarqued copies",
      detail:
        "While signing five thousand sheets Whelan drew small sketches on some of them. He did not keep a record, and puts the number somewhere between 100 and 500 — so a sketch is not something a copy can be assumed to have, and its absence proves nothing about the copy.",
      sourceIds: ["skc"]
    },
    {
      label: "Copies with original art",
      detail:
        "Whelan sold 19 copies carrying an original pencil or pen drawing direct from his own website, alongside pre-sold signed trade copies.",
      sourceIds: ["skc"]
    }
  ],

  notFirstEdition: [],

  variants: [
    {
      name: "Signed and numbered",
      detail: "1,500 copies, two volumes, slipcased, signed by King and Whelan. Issue price $225.",
      sourceIds: ["skc"]
    },
    {
      name: "Artist Edition",
      detail:
        "5,000 copies signed by Whelan, Smyth sewn. Issue price $50. Between 100 and 500 carry a small sketch by him.",
      sourceIds: ["skc"]
    },
    {
      name: "Artist Edition with original art",
      detail: "19 copies with an original pencil or pen drawing, sold direct by Whelan.",
      sourceIds: ["skc"]
    }
  ],

  value: [],

  photos: [],

  sources: [
    {
      id: "skc",
      title: "The Dark Tower — stephenkingcollector.com",
      url: "https://www.stephenkingcollector.com/limited/dt7.html",
      accessedAt: "2026-09-09"
    }
  ]
};
