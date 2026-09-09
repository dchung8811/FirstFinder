// Sourced from stephenkingcollector.com's Gunslinger entry. Facts only -- the
// wording here is ours. That site asks that its material not be reproduced;
// what is taken is the bibliographic facts, which belong to nobody.
//
// Single-sourced. Every claim below is one the source actually makes.
//
// This is the first guide where the first edition is a small-press book issued
// in several forms at once, and the framing shifts with it. For a Macmillan
// trade novel the question is "is this the first edition"; here the 1982 Grant
// IS the first edition and the real question is which issue of it you have --
// lettered, signed, or trade. Those are issues of one edition rather than
// separate editions, so `variants` carries them and nothing new was needed.

export default {
  slug: "the-gunslinger",
  title: "The Dark Tower: The Gunslinger",
  author: "Stephen King",

  status: "verified",
  verifiedBy: "dchung8811",
  verifiedAt: "2026-09-09",

  quickAnswer:
    "The first edition is the 1982 Donald M. Grant, illustrated by Michael Whelan — not a Viking or Signet copy. It was issued as 52 lettered copies, 500 signed and numbered copies in slipcases, and a 10,000-copy trade hardcover. If yours is the trade issue, the first printing has maroon boards, coloured endpapers, and two prices on the jacket; the second printing has black boards, plain endpapers, and one price.",

  firstEdition: {
    publisher: "Donald M. Grant, Publisher",
    year: 1982,
    originalPrice: "$60.00 (signed and numbered issue)",
    pages: 224,
    editionStatement:
      "Donald M. Grant, 1982, illustrated by Michael Whelan. The signed issue carries a limitation sheet stating the edition is limited to 500 copies signed by the author and the artist."
  },

  identificationPoints: [
    {
      label: "Publisher — the point most copies fail",
      detail:
        "Donald M. Grant, 1982. The book was reissued in 1998 and again by Viking in 2003, and those later printings are common. A Gunslinger from any publisher other than Grant is not the first edition.",
      sourceIds: ["skc"]
    },
    {
      label: "Trade issue — first printing versus second",
      detail:
        "Three marks separate them, and they agree with each other. The first printing has maroon cover boards, coloured endpapers, and two prices printed on the dust jacket. The second printing has black boards, endpapers that are not printed in colour, and a single price on the jacket.",
      sourceIds: ["skc"]
    },
    {
      label: "Signed issue — the limitation sheet",
      detail:
        "500 slipcased copies, signed and numbered by King and Whelan, at an issue price of $60. The limitation sheet states the edition is limited to 500 copies signed by the author and artist, with a blank for the copy's number.",
      sourceIds: ["skc"]
    },
    {
      label: "Lettered issue",
      detail: "52 copies, marked A–Z and AA–AZ.",
      sourceIds: ["skc"]
    },
    {
      label: "Illustrations",
      detail: "Michael Whelan, who also painted the jacket art for the signed issue.",
      sourceIds: ["skc"]
    }
  ],

  notFirstEdition: [
    {
      claim: "The 1998 reissue",
      why:
        "A third printing of 11,000 copies with a redesigned jacket, sold only as part of a three-volume boxed set rather than singly.",
      sourceIds: ["skc"]
    },
    {
      claim: "The 2003 Viking edition",
      why:
        "A reissue of 60,000 copies, revised throughout by King and carrying a new foreword. A different text as well as a different publisher — it was released to coincide with the fifth Dark Tower volume.",
      sourceIds: ["skc"]
    }
  ],

  variants: [
    {
      name: "Lettered copies",
      detail: "52 copies, marked A–Z and AA–AZ.",
      sourceIds: ["skc"]
    },
    {
      name: "Signed and numbered copies",
      detail: "500 slipcased copies signed by King and Whelan. Issue price $60.",
      sourceIds: ["skc"]
    },
    {
      name: "Trade hardcover, first printing",
      detail:
        "10,000 copies with dust jacket, of which roughly 1,500 were misbound. Maroon boards, coloured endpapers, two prices on the jacket.",
      sourceIds: ["skc"]
    },
    {
      name: "Trade hardcover, second printing",
      detail: "10,000 copies. Black boards, plain endpapers, one price on the jacket.",
      sourceIds: ["skc"]
    },
    {
      name: "Reserved copies",
      detail:
        "Copies set aside outside the numbered run and marked accordingly: 12 publisher's copies, 40 author's copies, 10 artist's copies, and roughly 25 presentation copies, which are signed but neither numbered nor slipcased.",
      sourceIds: ["skc"]
    }
  ],

  value: [],

  photos: [],

  sources: [
    {
      id: "skc",
      title: "The Gunslinger — stephenkingcollector.com",
      url: "https://www.stephenkingcollector.com/limited/dt1.html",
      accessedAt: "2026-09-09"
    }
  ]
};
