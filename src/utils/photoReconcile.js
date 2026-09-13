// Adopting files that are in an item's folder but not on its row.
//
// Photos are uploaded before the row is told about them, so a write that fails
// in between leaves files in the bucket with nothing pointing at them. The
// retry in the save paths makes that rare; it cannot make it impossible, and
// it does nothing for the rows already stranded that way.
//
// The folder is the truth, which is the same reasoning listItemPhotoPaths
// gives for deleting by listing rather than by asking the row: photos live at
// <userId>/<itemId>/<file>, so everything an item ever stored is in one place
// regardless of what the row remembers. If the folder holds a file the row
// does not list, the row is the thing that is wrong.
//
// This turns a failed link from lost photos into a delay.

// Written by uploadPhotoList as `${kind}-${Date.now()}-${random}-${safeName}`.
// Matched strictly: a file that does not carry one of the two known prefixes
// was not written by that function, and guessing which list it belongs on
// would put receipts in among the item photos.
const KNOWN_KINDS = ["item", "receipt"];

export function photoKindFromPath(path) {
  const file = String(path || "").split("/").pop() || "";
  const kind = file.split("-")[0];
  return KNOWN_KINDS.includes(kind) ? kind : null;
}

// `${kind}-${timestamp}-${random}-` then the name. safeName may itself contain
// dashes, so everything past the third one is rejoined rather than taken as a
// single segment.
export function originalNameFromPath(path) {
  const file = String(path || "").split("/").pop() || "";
  const parts = file.split("-");
  if (parts.length < 4) return file;
  return parts.slice(3).join("-");
}

// Returns the two lists with anything unaccounted for appended, plus how many
// were adopted so a caller can decide whether a write is even needed.
//
// Existing entries are left exactly as they are, in their existing order:
// their `name` is what the reader typed or the file they picked, and a
// reconstructed one is strictly worse. Adopted files go on the end, because
// there is no honest way to know where they belonged.
export function reconcilePhotoLists(folderPaths, itemPhotos, receiptPhotos) {
  const currentItem = Array.isArray(itemPhotos) ? itemPhotos : [];
  const currentReceipt = Array.isArray(receiptPhotos) ? receiptPhotos : [];

  const known = new Set(
    [...currentItem, ...currentReceipt].map((photo) => photo && photo.path).filter(Boolean)
  );

  const adoptedItem = [];
  const adoptedReceipt = [];

  (folderPaths || []).forEach((path) => {
    if (!path || known.has(path)) return;
    // Guards a folder listing that somehow repeats a path, which would
    // otherwise adopt it twice.
    known.add(path);

    const kind = photoKindFromPath(path);
    if (!kind) return;

    const entry = { path, name: originalNameFromPath(path) };
    if (kind === "receipt") adoptedReceipt.push(entry);
    else adoptedItem.push(entry);
  });

  return {
    itemPhotos: adoptedItem.length > 0 ? [...currentItem, ...adoptedItem] : currentItem,
    receiptPhotos: adoptedReceipt.length > 0 ? [...currentReceipt, ...adoptedReceipt] : currentReceipt,
    adopted: adoptedItem.length + adoptedReceipt.length
  };
}
