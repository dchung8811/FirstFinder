// Sourced from collectingsanderson.com's entry for the US hardcover first
// state. Facts only -- the wording here is ours.
//
// This is the first guide about STATES rather than editions, and the framing
// differs because the question does. For a 1936 Macmillan the question is "is
// this the first edition"; for a modern Tor hardcover the edition statement is
// printed plainly and the real question is "which state of it". The template
// carries that in `variants` without needing anything new.
//
// Single-sourced, and the page says so.

export default {
  slug: "the-way-of-kings",
  title: "The Way of Kings",
  author: "Brandon Sanderson",

  status: "verified",
  verifiedBy: "dchung8811",
  verifiedAt: "2026-09-09",

  quickAnswer:
    "The US first edition says \"First Edition: August 2010\" on the copyright page — Tor, 2010, jacket priced $27.99. The part collectors care about is the state: on the first state the ornamentation around the series name on the cover is gold. Later states use white, which is also what most photographs online show.",

  firstEdition: {
    publisher: "Tor Books",
    year: 2010,
    originalPrice: "$27.99",
    pages: 1008,
    editionStatement: "\"First Edition: August 2010\" on the copyright page."
  },

  identificationPoints: [
    {
      label: "Copyright page",
      detail: "Reads \"First Edition: August 2010\".",
      sourceIds: ["cs"]
    },
    {
      label: "Cover ornamentation — the first-state point",
      detail:
        "On the first state, the ornamentation around the series name on the cover is gold rather than white. Worth knowing that most images online show the white version, so a photograph is a poor way to check this and the book in your hands is a good one.",
      sourceIds: ["cs"]
    },
    {
      label: "Publisher, format and jacket",
      detail:
        "Tor Books, hardcover, 1008 pages, jacket art by Michael Whelan, priced $27.99 US and $31.99 Canadian. ISBN 9780765326355.",
      sourceIds: ["cs"]
    }
  ],

  notFirstEdition: [
    {
      claim: "A correct copyright page with white cover ornamentation",
      why:
        "That is a later state of the first edition, not a first state. The copyright statement does not change between them, which is exactly why the cover is the thing to look at.",
      sourceIds: ["cs"]
    }
  ],

  // Where a printing-state guide does its real work. The source maps each state
  // to the printings it covers; a reader with a copy in hand wants to know
  // which bracket they are in.
  variants: [
    {
      name: "First state",
      detail: "First printing. Gold ornamentation around the series name on the cover.",
      sourceIds: ["cs"]
    },
    {
      name: "Second state",
      detail: "Third and fourth printings.",
      sourceIds: ["cs"]
    },
    {
      name: "Third state",
      detail: "Sixth printing.",
      sourceIds: ["cs"]
    },
    {
      name: "Fourth state",
      detail: "Ninth printing.",
      sourceIds: ["cs"]
    },
    {
      name: "Fifth state",
      detail: "Fourteenth printing.",
      sourceIds: ["cs"]
    },
    {
      name: "Sixth state",
      detail: "Sixteenth printing.",
      sourceIds: ["cs"]
    }
  ],

  value: [],

  photos: [],

  sources: [
    {
      id: "cs",
      title: "The Way of Kings, US HC 1st State — collectingsanderson.com",
      url: "https://collectingsanderson.com/book/319",
      accessedAt: "2026-09-09"
    }
  ]
};
