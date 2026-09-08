// What a shared collection page is allowed to show the public.
//
// This module is the single gate between a private inventory row and a page
// anyone on the internet can open. Everything the public page renders comes
// out of buildPublicItem below, and buildPublicItem builds its result by
// copying named fields onto a fresh object -- it never spreads the source
// item. That is deliberate: spreading would mean every column added to
// inventory_items in the future is public by default, and the failure would be
// silent. Here, a new private field is invisible until someone writes a line
// to expose it, and publicCollection.test.js fails if that line escapes the
// allowlists below.
//
// Receipt photos have no toggle anywhere in this file. See buildPublicItem.

import { conditionOptions } from "./constants";
import { hasValue } from "./format";

// off      -- no page at all; the route 404s.
// unlisted -- anyone holding the link can open it, but search engines are told
//             not to index it and it is left out of the sitemap. The slug is
//             random and long, so this is link-only in practice. It is NOT
//             secret: whoever the link is forwarded to can read it, and the UI
//             says so rather than letting "unlisted" imply "private".
// listed   -- indexed, and listed in the sitemap.
export const shareVisibilities = ["off", "unlisted", "listed"];

// Every flag starts false, so switching sharing on for the first time always
// lands on the shelf-only view. Nobody should ever discover a purchase price
// on their public page that they did not deliberately publish.
export const defaultShareSettings = {
  visibility: "off",
  title: "",
  blurb: "",
  showEstimatedValue: false,
  showPrices: false,
  showProvenance: false,
  showNotes: false,
  showSold: false,
  showWishlist: false
};

// The fields that make up "the shelf" -- what a collection page is for. These
// are not switchable; a page without them would have nothing on it.
export const alwaysPublicItemFields = [
  // The row's uuid, used as a render key and as the anchor for a per-item
  // link. Random and non-sequential, and RLS still governs every read, so
  // knowing one grants nothing.
  "id",
  "name",
  "maker",
  "category",
  "edition",
  "bookEdition",
  "bookPrinting",
  "bookGenre",
  "condition",
  "status",
  "photos",
  // Whether a receipt exists -- never the receipt itself.
  "hasReceipt"
];

// The complete set of keys buildPublicItem can ever emit, in any combination
// of settings. The test asserts the real output against this; anything not
// named here cannot reach a public page.
export const publicItemFields = [
  ...alwaysPublicItemFields,
  "estimatedValue",
  "purchasePrice",
  "soldPrice",
  "soldDate",
  "purchaseDate",
  "source",
  "notes"
];

// The toggles, grouped the way a person actually thinks about sharing rather
// than the way the columns happen to be laid out. Order is the order they
// render in the share dialog.
export const shareFieldGroups = [
  {
    key: "showEstimatedValue",
    label: "What it's worth",
    detail: "Your estimated value for each item."
  },
  {
    key: "showPrices",
    label: "What I paid",
    detail: "Purchase prices, and what sold copies sold for."
  },
  {
    key: "showProvenance",
    label: "How I got it",
    detail: "Purchase date and where each item came from."
  },
  {
    key: "showNotes",
    label: "My notes",
    detail: "Your free-text notes, exactly as written.",
    // Notes are the highest-variance field in the app: this is where people
    // record where a book physically lives. Publishing "top shelf, safe in the
    // study" next to an estimated value is a genuinely bad outcome, so the
    // dialog warns before it happens. Warned, not blocked -- provenance notes
    // are also the most interesting thing on many collectors' pages.
    warning: "Notes often hold storage locations. Check them before turning this on."
  },
  {
    key: "showSold",
    label: "Sold items",
    detail: "Include items you've marked sold, showing your trading record."
  },
  {
    key: "showWishlist",
    label: "Wishlist",
    // Reworded when wants became their own thing: this used to include items
    // carrying the old "Wishlist" status, and now publishes the wishlist
    // itself. What it never publishes is the ceiling or the priority -- see
    // buildPublicWant.
    detail: "Publish what you're hunting for. Never your maximum price."
  }
];

// Named starting points, so the switches above are something most people never
// have to reason about individually.
export const sharePresets = [
  {
    id: "showcase",
    label: "Showcase",
    detail: "Titles, editions, condition, and photos. Nothing about money.",
    settings: {
      showEstimatedValue: false,
      showPrices: false,
      showProvenance: false,
      showNotes: false,
      showSold: false,
      showWishlist: false
    }
  },
  {
    id: "notes",
    label: "Collector's notes",
    detail: "Adds where each item came from and your notes on it.",
    settings: {
      showEstimatedValue: false,
      showPrices: false,
      showProvenance: true,
      showNotes: true,
      showSold: false,
      showWishlist: false
    }
  },
  {
    id: "ledger",
    label: "Full ledger",
    detail: "Everything, including prices and your sold record.",
    settings: {
      showEstimatedValue: true,
      showPrices: true,
      showProvenance: true,
      showNotes: true,
      showSold: true,
      showWishlist: true
    }
  }
];

// Which preset the current switches correspond to, or null when they don't
// match one -- which is what makes the dialog show "Custom" without having to
// store a preset choice alongside the switches it would then contradict.
export function matchingPresetId(settings) {
  const preset = sharePresets.find((candidate) =>
    Object.entries(candidate.settings).every(([key, value]) => Boolean(settings?.[key]) === value)
  );
  return preset ? preset.id : null;
}

export function applyPreset(settings, presetId) {
  const preset = sharePresets.find((candidate) => candidate.id === presetId);
  if (!preset) return { ...settings };
  return { ...settings, ...preset.settings };
}

// Membership: which items appear at all. Separate from which *fields* show,
// because "don't show my wishlist" is a different question from "don't show
// prices" -- and because an item hidden here leaks nothing at all, which is
// the strongest guarantee the per-item control can offer.
export function isItemShared(item, settings) {
  if (!item) return false;
  // The per-item escape hatch. All-or-nothing on purpose: per-item field
  // overrides would multiply out into a state space neither the UI nor the
  // reader could keep straight.
  if (item.hiddenFromShare) return false;
  if (item.status === "Sold") return Boolean(settings?.showSold);
  if (item.status === "Wishlist") return Boolean(settings?.showWishlist);
  return true;
}

// Builds the public view of one item.
//
// Note the shape of this function: a literal for the shelf fields, then
// conditional assignment for each opted-in group. No spread of `item`
// anywhere. That is the whole safety property -- read the comment at the top
// of the file before changing it.
export function buildPublicItem(item, settings = defaultShareSettings) {
  const photos = Array.isArray(item.itemPhotos) ? item.itemPhotos : [];
  const receiptCount = Array.isArray(item.receiptPhotos) ? item.receiptPhotos.length : Number(item.receiptPhotoCount || 0);

  const publicItem = {
    id: item.id,
    name: item.name || "",
    maker: item.maker || "",
    category: item.category || "Other",
    edition: item.edition || "",
    bookEdition: item.bookEdition || "",
    bookPrinting: item.bookPrinting || "",
    bookGenre: item.bookGenre || "",
    condition: item.condition || "",
    status: item.status || "Owned",
    // Item photos only. Receipt photos are never published, under any
    // setting, and there is deliberately no flag that would change that: a
    // receipt routinely carries a home address, a card's last four, and the
    // seller's details -- a third party who agreed to nothing. It is also the
    // only field here whose contents the owner cannot see at the moment they
    // publish it, since the risk lives in pixels uploaded months earlier.
    // Collectors who share receipts for provenance get the hasReceipt badge
    // below instead: the signal that proof exists, without the document.
    photos: photos.filter((photo) => photo && photo.path).map((photo) => ({ path: photo.path, name: photo.name || "photo" })),
    hasReceipt: receiptCount > 0
  };

  if (settings?.showEstimatedValue && hasValue(item.estimatedValue)) {
    publicItem.estimatedValue = String(item.estimatedValue);
  }

  if (settings?.showPrices) {
    if (hasValue(item.purchasePrice)) publicItem.purchasePrice = String(item.purchasePrice);
    if (hasValue(item.soldPrice)) publicItem.soldPrice = String(item.soldPrice);
    if (item.soldDate) publicItem.soldDate = item.soldDate;
  }

  if (settings?.showProvenance) {
    if (item.purchaseDate) publicItem.purchaseDate = item.purchaseDate;
    if (item.source) publicItem.source = item.source;
  }

  if (settings?.showNotes && item.notes) {
    publicItem.notes = item.notes;
  }

  return publicItem;
}

// ---------------------------------------------------------------------------
// The public wishlist
// ---------------------------------------------------------------------------

// The complete set of keys buildPublicWant can ever emit. Same contract as
// publicItemFields: the test asserts real output against this, so anything not
// named here cannot reach a public page.
export const publicWantFields = [
  "id",
  "name",
  "maker",
  "category",
  "wantedEdition",
  "wantedPrinting",
  "publisher",
  "minCondition",
  "jacketRequirement",
  "signatureRequirement",
  "wantedSince",
  "notes"
];

// Two fields on a want are withheld from every public page under every
// setting, and there is deliberately no toggle for either.
//
//   maxPrice -- a ceiling is a negotiating position. Publishing it invites a
//     dealer to price exactly at it, and a collector switching on "share my
//     wishlist" is not consenting to that.
//
//   priority -- the same leak wearing different clothes. "Grail" tells a
//     seller you will stretch; it is a statement about how much you would pay,
//     just spelled in words instead of dollars. It looks harmless next to a
//     price, which is exactly why it is worth naming here.
//
// preferredSource and upgradeForItemId are also absent, for a duller reason:
// they are the collector's own operational notes, and no visitor is served by
// them. Nothing here is a judgement call the UI can override.
export function buildPublicWant(want, settings = defaultShareSettings) {
  const publicWant = {
    id: want.id,
    name: want.name || "",
    maker: want.maker || "",
    category: want.category || "Book",
    wantedEdition: want.wantedEdition || "",
    wantedPrinting: want.wantedPrinting || "",
    publisher: want.publisher || "",
    minCondition: want.minCondition || "",
    jacketRequirement: want.jacketRequirement || "any",
    signatureRequirement: want.signatureRequirement || "any",
    // How long someone has been looking is part of what makes a wishlist worth
    // reading, and it gives away nothing about what they would pay.
    wantedSince: want.createdAt || ""
  };

  // Gated by the same toggle item notes use, so "my notes" means one thing
  // across the whole page rather than two.
  if (settings?.showNotes && want.notes) {
    publicWant.notes = want.notes;
  }

  return publicWant;
}

// Whether a want appears on the public page at all.
//
// A found want never does: the copy is in the collection now, and publishing
// it here would list the same book twice -- once as owned, once as wanted.
export function isWantShared(want, settings) {
  if (!want) return false;
  if (want.hiddenFromShare) return false;
  if (want.foundAt) return false;
  return Boolean(settings?.showWishlist);
}

export function buildPublicWishlist(wants, settings = defaultShareSettings) {
  return (wants || [])
    .filter((want) => isWantShared(want, settings))
    .map((want) => buildPublicWant(want, settings));
}

// Headline counts for the top of the page.
//
// Counts only, never money -- not even when per-item prices are switched on.
// A visitor can add the visible numbers up themselves, but a page that leads
// with "$180,000 collection" advertises a target, and nobody sharing a shelf
// is asking for that.
export function summarizeCollection(publicItems) {
  const firstEditions = publicItems.filter((item) => item.bookEdition === "First" && item.bookPrinting === "First").length;
  const conditions = publicItems.filter((item) => conditionOptions.includes(item.condition)).length;

  return {
    itemCount: publicItems.length,
    firstEditionCount: firstEditions,
    gradedCount: conditions
  };
}

// The one-line description used for the page's own subtitle and for the link
// preview that shows up when the URL is pasted into a message.
export function summaryLine(summary) {
  const parts = [`${summary.itemCount} ${summary.itemCount === 1 ? "item" : "items"}`];
  if (summary.firstEditionCount > 0) {
    parts.push(`${summary.firstEditionCount} first ${summary.firstEditionCount === 1 ? "edition" : "editions"}`);
  }
  return parts.join(" · ");
}

export function buildPublicCollection(items, settings = defaultShareSettings, { ownerName = "" } = {}) {
  const shared = (Array.isArray(items) ? items : []).filter((item) => isItemShared(item, settings));
  const publicItems = shared.map((item) => buildPublicItem(item, settings));
  const summary = summarizeCollection(publicItems);

  return {
    title: settings?.title?.trim() || (ownerName.trim() ? `${ownerName.trim()}'s collection` : "A FirstFinder collection"),
    blurb: settings?.blurb?.trim() || "",
    items: publicItems,
    summary
  };
}

// Share slugs are random rather than derived from a name or a row id: an
// unlisted page's only protection is that its URL cannot be guessed or walked
// (/c/aaa, /c/aab...), and a sequential or name-based slug would hand away
// every other collector's page along with your own.
//
// 22 characters of this alphabet is ~128 bits. The alphabet drops the
// characters that get misread aloud or in a screenshot (0/O, 1/l/I).
const SLUG_ALPHABET = "23456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
export const SLUG_LENGTH = 22;

// randomBytes is injectable so this stays a pure function under test; in the
// app it comes from the Web Crypto API, never Math.random.
export function generateShareSlug(randomBytes = (size) => globalThis.crypto.getRandomValues(new Uint8Array(size))) {
  const bytes = randomBytes(SLUG_LENGTH);
  let slug = "";
  for (let index = 0; index < SLUG_LENGTH; index += 1) {
    slug += SLUG_ALPHABET[bytes[index] % SLUG_ALPHABET.length];
  }
  return slug;
}

export function isValidShareSlug(value) {
  return typeof value === "string" && new RegExp(`^[${SLUG_ALPHABET}]{${SLUG_LENGTH}}$`).test(value);
}

// Whether the share dialog is holding edits that have not been published yet.
//
// Compares only the fields the dialog can change, so a slug rotation or an
// updated_at coming back from the database doesn't register as an unsaved
// edit and leave the Save button lit forever.
export function shareSettingsChanged(saved, draft) {
  const fields = ["visibility", "title", "blurb", ...shareFieldGroups.map((group) => group.key)];
  return fields.some((field) => {
    const savedValue = saved?.[field];
    const draftValue = draft?.[field];
    if (typeof savedValue === "boolean" || typeof draftValue === "boolean") {
      return Boolean(savedValue) !== Boolean(draftValue);
    }
    return String(savedValue ?? "").trim() !== String(draftValue ?? "").trim();
  });
}

export function sharePath(slug) {
  return `/c/${slug}`;
}
