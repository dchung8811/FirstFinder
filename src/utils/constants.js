// Shared option lists, field shapes, and CSV column definitions.
//
// These are the vocabularies the whole app agrees on: the statuses an item can
// hold, the conditions it can be graded at, and the exact column order of the
// CSV. Changing one here changes it everywhere, which is the point.

export const emptyItem = {
  name: "",
  category: "Book",
  maker: "",
  edition: "",
  bookGenre: "",
  bookEdition: "",
  bookPrinting: "",
  status: "Owned",
  condition: "",
  purchaseDate: "",
  source: "",
  purchasePrice: "",
  estimatedValue: "",
  soldPrice: "",
  soldDate: "",
  notes: ""
};

export const sampleItems = [
  {
    name: "The Gunslinger",
    category: "Book",
    maker: "Stephen King",
    edition: "First edition candidate",
    status: "Owned",
    purchaseDate: "2026-05-12",
    source: "Used bookstore",
    purchasePrice: "45",
    estimatedValue: "850",
    notes: "Need to confirm jacket state. Receipt saved."
  },
  {
    name: "Beloved",
    category: "Book",
    maker: "Toni Morrison",
    edition: "Signed copy candidate",
    status: "Researching",
    purchaseDate: "2026-05-08",
    source: "Estate sale",
    purchasePrice: "30",
    estimatedValue: "300",
    notes: "Need signature verification before listing."
  },
  {
    name: "Vintage Phillies Program",
    category: "Sports memorabilia",
    maker: "Philadelphia Phillies",
    edition: "1970s program",
    status: "Owned",
    purchaseDate: "2026-04-28",
    source: "Flea market",
    purchasePrice: "12",
    estimatedValue: "40",
    notes: "Good condition, minor corner wear."
  }
];

export const itemPhotoPrompts = ["Front", "Back", "Details", "Condition", "Signature/markings"];
export const receiptPhotoPrompts = ["Receipt", "Invoice", "Order confirmation", "Auction record"];
// "Wishlist" was removed here when wants became their own table -- see
// supabase/wishlist.sql. A want is a specification for a copy nobody has yet,
// and it was never expressible as a status on a row that otherwise records
// facts about a copy in hand. Nothing migrated: no row in the database used it.
//
// Rows in a fork that still carry the old status keep working as ordinary
// items; the value simply stops being offered as a choice.
export const statuses = ["Owned", "Researching", "For sale", "Sold"];
export const quickCategories = ["Book", "Sports memorabilia", "Trading card", "Comic", "Record", "Art", "Toy", "Other"];
export const conditionOptions = ["Near Fine/Fine", "Very Good/Good", "Fair", "Poor"];
export const bookEditionOptions = ["First", "Second", "Third", "Fourth", "Fifth", "Other"];
export const bookPrintingOptions = ["First", "Second", "Third", "Fourth", "Fifth", "Other"];
// Columns that map 1:1 onto item fields. Kept separate from csvHeaders because
// the file also carries two control columns that aren't item data: "ref" (the
// matching key) and "delete" (the row action).
export const csvItemFields = ["name", "category", "maker", "edition", "bookGenre", "bookEdition", "bookPrinting", "status", "condition", "purchaseDate", "source", "purchasePrice", "estimatedValue", "soldPrice", "soldDate", "notes"];
export const csvHeaders = ["ref", ...csvItemFields, "delete"];
export const csvTemplateRows = [
  ["", "The Gunslinger", "Book", "Stephen King", "First edition candidate", "Fantasy", "First", "First", "Owned", "Near Fine/Fine", "2026-05-12", "Used bookstore", "45", "850", "", "", "Need to confirm jacket state", ""],
  ["", "Vintage Phillies Program", "Sports memorabilia", "Philadelphia Phillies", "1970s program", "", "", "", "Sold", "Very Good/Good", "2026-04-28", "Flea market", "12", "", "40", "2026-06-01", "Minor corner wear. Sold at a local card show.", ""]
];
// Values accepted in the "delete" column. Deliberately generous, since people
// will type whatever feels natural in a spreadsheet.
export const csvDeleteTokens = ["y", "yes", "true", "x", "1", "delete", "remove"];


export const mockAutofillOptions = [
  {
    match: "receipt",
    data: {
      name: "Receipt upload detected",
      category: "Book",
      maker: "Unknown",
      edition: "Needs item photo",
      status: "Owned",
      purchaseDate: "2026-05-12",
      source: "Receipt scan",
      purchasePrice: "45",
      estimatedValue: "",
      notes: "Autofilled from receipt photo. Review merchant, date, and purchase price."
    }
  },
  {
    match: "card",
    data: {
      name: "Collectible trading card",
      category: "Trading card",
      maker: "Unknown",
      edition: "Card photo detected",
      status: "Researching",
      purchaseDate: "2026-05-12",
      source: "Photo upload",
      purchasePrice: "",
      estimatedValue: "",
      notes: "Autofilled from item photo. Add grade, year, player/character, and set details."
    }
  },
  {
    match: "program",
    data: {
      name: "Vintage Phillies Program",
      category: "Sports memorabilia",
      maker: "Philadelphia Phillies",
      edition: "Program / publication",
      status: "Owned",
      purchaseDate: "2026-05-12",
      source: "Photo upload",
      purchasePrice: "12",
      estimatedValue: "40",
      notes: "Autofilled from photo. Review condition and event/year details."
    }
  },
  {
    match: "book",
    data: {
      name: "Book photo detected",
      category: "Book",
      maker: "Unknown author",
      edition: "Needs edition details",
      status: "Researching",
      purchaseDate: "2026-05-12",
      source: "Photo upload",
      purchasePrice: "",
      estimatedValue: "",
      notes: "Autofilled from book photo. Add author, edition, condition, and receipt proof."
    }
  }
];
