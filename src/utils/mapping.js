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
    itemPhotoCount: itemPhotos.length || row.item_photo_count || 0,
    receiptPhotoCount: receiptPhotos.length || row.receipt_photo_count || 0,
    itemPhotos,
    receiptPhotos,
    savedAt: row.created_at || row.updated_at || new Date().toISOString()
  };
}
