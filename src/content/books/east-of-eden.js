// Sourced from fedpo.com's East of Eden entry, rewritten in our own words.
// Draft until verified -- see src/content/books/index.js.

export default {
  slug: "east-of-eden",
  title: "East of Eden",
  author: "John Steinbeck",

  status: "verified",
  verifiedBy: "dchung8811",
  verifiedAt: "2026-09-09",

  quickAnswer:
    "A first edition of East of Eden says \"First published by The Viking Press in September 1952\" on the copyright page and names no later printing. The trade issue is in light green boards; a separate signed limited issue of 1,500 copies is in dark green boards with a slipcase. The first state carries a typo on page 281.",

  firstEdition: {
    publisher: "The Viking Press",
    year: 1952,
    originalPrice: "$4.50",
    pages: 602,
    editionStatement:
      "\"First published by The Viking Press in September 1952\" on the copyright page, with no later printing named."
  },

  identificationPoints: [
    {
      label: "Copyright page",
      detail:
        "Reads \"First published by The Viking Press in September 1952\". Any additional printing statement means you have a later printing.",
      sourceIds: ["fedpo"]
    },
    {
      label: "Binding — trade issue",
      detail: "Light green boards. The title page is dated 1952.",
      sourceIds: ["fedpo"]
    },
    {
      label: "Dust jacket",
      detail:
        "Carries a photograph of Steinbeck on the rear panel, and no review quotes or blurbs. A jacket covered in praise is from a later printing.",
      sourceIds: ["fedpo"]
    },
    {
      label: "First-state typo, page 281",
      detail:
        "Line 38 reads \"I remember holding the bite of a line while Tom drove pegs and braided a splice\" — \"bite\" where the word should be \"bight\" (a loop of rope). Published accounts differ on exactly when the reading was corrected, so the absence of the typo does not by itself rule a copy out; weigh it alongside the other points here rather than on its own.",
      sourceIds: ["fedpo"]
    }
  ],

  notFirstEdition: [
    {
      claim: "A dark green copy without a slipcase",
      why:
        "Dark green boards indicate the signed limited issue rather than the trade first. Those were issued in a slipcase and signed by Steinbeck; a dark green copy with neither wants explaining before you pay a limited-issue price for it.",
      sourceIds: ["fedpo"]
    },
    {
      claim: "A correct-looking copyright page, on its own",
      why:
        "Book club editions reproduce the book without changes, printing history included, and reprint houses working from the original plates can do the same. The ABAA's advice is to read the copyright page against the foot of the spine, where a reprint house usually put its own name.",
      sourceIds: ["abaa"]
    }
  ],

  variants: [
    {
      name: "Signed limited issue",
      detail:
        "1,500 copies, signed by Steinbeck, bound in dark green boards and issued in a slipcase. A distinct issue from the light green trade first, not a later printing of it.",
      sourceIds: ["fedpo"]
    }
  ],

  value: [],
  photos: [],

  sources: [
    {
      id: "fedpo",
      title: "East of Eden — First Edition Identification, fedpo.com",
      url: "https://www.fedpo.com/BookDetail.php/East-Of-Eden",
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
