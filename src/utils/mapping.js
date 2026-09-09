// Translation between the app's camelCase item objects and the snake_case
// inventory_items rows in Postgres.
//
// The null-vs-zero handling on estimated_value and sold_price lives here, and is
// load-bearing: null means "no estimate yet", 0 means "estimated at nothing".

import { toNumber, hasValue } from "./format";

// Plain text columns that map straight across for a CSV-driven update.
// Dates, numbers, and the sold-status fields need extra handling and are
// applied separately in csvUpdateRow.
export const csvFieldToColumn = {
  name: "name",
  category: "category",
  author: "author",
  maker: "maker",
  edition: "edition",
  bookGenre: "book_genre",
  bookEdition: "book_edition",
  bookPrinting: "book_printing",
  status: "status",
  condition: "condition",
  source: "source",
  notes: "notes"
};

// Builds the row sent for a CSV-driven update. Only touches columns whose
// header was present in the uploaded file, and deliberately never includes the
// photo columns, so a bulk edit can't wipe someone's uploaded images.
export function csvUpdateRow(existing, fields, userId) {
  const merged = { ...existing, ...fields };
  const row = { id: existing.id, user_id: userId, updated_at: new Date().toISOString() };

  Object.entries(csvFieldToColumn).forEach(([field, column]) => {
    if (field in fields) row[column] = fields[field] || "";
  });

  if ("purchaseDate" in fields) row.purchase_date = fields.purchaseDate || null;
  if ("purchasePrice" in fields) row.purchase_price = toNumber(fields.purchasePrice);
  if ("estimatedValue" in fields) row.estimated_value = hasValue(fields.estimatedValue) ? toNumber(fields.estimatedValue) : null;

  // A CSV edit can flip an item into or out of "Sold" just like the edit modal
  // can, so keep the sale fields consistent with whichever status wins.
  if ("status" in fields || "soldPrice" in fields || "soldDate" in fields) {
    const isNowSold = merged.status === "Sold";
    const wasSold = existing.status === "Sold";
    row.previous_status = !isNowSold ? null : wasSold ? existing.previousStatus || "Owned" : existing.status || "Owned";
    row.sold_price = isNowSold && hasValue(merged.soldPrice) ? toNumber(merged.soldPrice) : null;
    row.sold_date = isNowSold ? merged.soldDate || null : null;
  }

  return row;
}

export function toDbItem(item, userId, itemPhotoCount = 0, receiptPhotoCount = 0) {
  return {
    user_id: userId,
    reference_number: item.referenceNumber ?? null,
    name: item.name || "",
    category: item.category || "Other",
    author: item.author || "",
    maker: item.maker || "",
    edition: item.edition || "",
    book_genre: item.bookGenre || "",
    book_edition: item.bookEdition || "",
    book_printing: item.bookPrinting || "",
    status: item.status || "Owned",
    condition: item.condition || "",
    // A brand-new item can be created with status already set to "Sold"
    // (quick add, tutorial, or CSV import) -- capture the sale fields the
    // same way an existing item marked sold would.
    previous_status: item.status === "Sold" ? "Owned" : null,
    sold_price: item.status === "Sold" && hasValue(item.soldPrice) ? toNumber(item.soldPrice) : null,
    sold_date: item.status === "Sold" ? item.soldDate || null : null,
    purchase_date: item.purchaseDate || null,
    source: item.source || "",
    purchase_price: toNumber(item.purchasePrice),
    // Store null (not 0) when the user hasn't entered an estimate, so "no
    // estimate yet" stays distinguishable from "estimated at $0" after a
    // save/reload round-trip.
    estimated_value: hasValue(item.estimatedValue) ? toNumber(item.estimatedValue) : null,
    notes: item.notes || "",
    item_photo_count: itemPhotoCount,
    receipt_photo_count: receiptPhotoCount
  };
}

export function fromDbPhotoList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((photo) => photo && photo.path)
    .map((photo) => ({ id: photo.path, path: photo.path, name: photo.name || "photo" }));
}

export function fromDbItem(row) {
  const itemPhotos = fromDbPhotoList(row.item_photos);
  const receiptPhotos = fromDbPhotoList(row.receipt_photos);

  return {
    id: row.id,
    referenceNumber: row.reference_number ?? null,
    name: row.name || "",
    category: row.category || "Other",
    author: row.author || "",
    maker: row.maker || "",
    edition: row.edition || "",
    bookGenre: row.book_genre || "",
    bookEdition: row.book_edition || "",
    bookPrinting: row.book_printing || "",
    status: row.status || "Owned",
    condition: row.condition || "",
    purchaseDate: row.purchase_date || "",
    source: row.source || "",
    purchasePrice: String(row.purchase_price ?? ""),
    estimatedValue: row.estimated_value === null || row.estimated_value === undefined ? "" : String(row.estimated_value),
    previousStatus: row.previous_status || "",
    soldPrice: row.sold_price === null || row.sold_price === undefined ? "" : String(row.sold_price),
    soldDate: row.sold_date || "",
    notes: row.notes || "",
    // Whether this item is kept off the owner's public collection page. Not
    // written by toDbItem: it is toggled on its own, so a normal item save
    // can't quietly re-share something the owner hid.
    hiddenFromShare: Boolean(row.hidden_from_share),
    itemPhotoCount: itemPhotos.length || row.item_photo_count || 0,
    receiptPhotoCount: receiptPhotos.length || row.receipt_photo_count || 0,
    itemPhotos,
    receiptPhotos,
    savedAt: row.created_at || row.updated_at || new Date().toISOString()
  };
}

// ---------------------------------------------------------------------------
// shared_collections: the settings behind a public /c/<slug> page.
// ---------------------------------------------------------------------------
// Same camelCase/snake_case split as the item mappers above. The visibility
// and field flags are read back by the app (to render the share dialog) and by
// the server (to build the public page), so keeping one translation for both
// is what stops the two drifting into disagreeing about what is shared.

export function fromDbShareSettings(row) {
  return {
    slug: row.slug || "",
    visibility: row.visibility || "off",
    title: row.title || "",
    blurb: row.blurb || "",
    showEstimatedValue: Boolean(row.show_estimated_value),
    showPrices: Boolean(row.show_prices),
    showProvenance: Boolean(row.show_provenance),
    showNotes: Boolean(row.show_notes),
    showSold: Boolean(row.show_sold),
    showWishlist: Boolean(row.show_wishlist)
  };
}

export function toDbShareRow(settings, userId, slug) {
  return {
    user_id: userId,
    slug,
    visibility: settings.visibility || "off",
    title: (settings.title || "").trim(),
    blurb: (settings.blurb || "").trim(),
    show_estimated_value: Boolean(settings.showEstimatedValue),
    show_prices: Boolean(settings.showPrices),
    show_provenance: Boolean(settings.showProvenance),
    show_notes: Boolean(settings.showNotes),
    show_sold: Boolean(settings.showSold),
    show_wishlist: Boolean(settings.showWishlist),
    updated_at: new Date().toISOString()
  };
}

// ---------------------------------------------------------------------------
// wishlist_items
// ---------------------------------------------------------------------------
// Deliberately its own pair rather than a variant of toDbItem/fromDbItem: the
// columns describe criteria, not facts, and sharing a mapper with inventory
// would be the first step back toward the merged shape supabase/wishlist.sql
// exists to get away from.

export function fromDbWant(row) {
  return {
    id: row.id,
    name: row.name || "",
    maker: row.maker || "",
    category: row.category || "Book",
    wantedEdition: row.wanted_edition || "",
    wantedPrinting: row.wanted_printing || "",
    publisher: row.publisher || "",
    minCondition: row.min_condition || "",
    jacketRequirement: row.jacket_requirement || "any",
    signatureRequirement: row.signature_requirement || "any",
    // Same null-vs-zero rule as estimated_value: null is "no ceiling set",
    // which is not the same claim as "would pay nothing".
    maxPrice: row.max_price === null || row.max_price === undefined ? "" : String(row.max_price),
    preferredSource: row.preferred_source || "",
    priority: row.priority || "hunting",
    upgradeForItemId: row.upgrade_for_item_id || "",
    notes: row.notes || "",
    hiddenFromShare: Boolean(row.hidden_from_share),
    foundAt: row.found_at || "",
    foundItemId: row.found_item_id || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}

export function toDbWant(want, userId) {
  return {
    user_id: userId,
    name: (want.name || "").trim(),
    maker: (want.maker || "").trim(),
    category: want.category || "Book",
    wanted_edition: want.wantedEdition || "",
    wanted_printing: want.wantedPrinting || "",
    publisher: want.publisher || "",
    min_condition: want.minCondition || "",
    jacket_requirement: want.jacketRequirement || "any",
    signature_requirement: want.signatureRequirement || "any",
    max_price: hasValue(want.maxPrice) ? toNumber(want.maxPrice) : null,
    preferred_source: want.preferredSource || "",
    priority: want.priority || "hunting",
    // A blank select must become null, not "": the column is a uuid foreign
    // key and an empty string is not one.
    upgrade_for_item_id: want.upgradeForItemId || null,
    notes: want.notes || "",
    hidden_from_share: Boolean(want.hiddenFromShare),
    updated_at: new Date().toISOString()
  };
}
