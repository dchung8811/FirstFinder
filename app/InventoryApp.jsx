"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { sendGAEvent } from "@next/third-parties/google";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../src/lib/supabaseClient";

const emptyItem = {
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

const sampleItems = [
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
    notes: "Need to confirm jacket state. Receipt saved for cost basis."
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

const itemPhotoPrompts = ["Front", "Back", "Details", "Condition", "Signature/markings"];
const receiptPhotoPrompts = ["Receipt", "Invoice", "Order confirmation", "Auction record"];
const statuses = ["Owned", "Researching", "For sale", "Sold", "Wishlist"];
const quickCategories = ["Book", "Sports memorabilia", "Trading card", "Comic", "Record", "Art", "Toy", "Other"];
const conditionOptions = ["Near Fine/Fine", "Very Good/Good", "Fair", "Poor"];
const bookEditionOptions = ["First", "Second", "Third", "Fourth", "Fifth", "Other"];
const bookPrintingOptions = ["First", "Second", "Third", "Fourth", "Fifth", "Other"];
const csvHeaders = ["name", "category", "maker", "edition", "bookGenre", "bookEdition", "bookPrinting", "status", "condition", "purchaseDate", "source", "purchasePrice", "estimatedValue", "soldPrice", "soldDate", "notes"];
const csvTemplateRows = [
  ["The Gunslinger", "Book", "Stephen King", "First edition candidate", "Fantasy", "First", "First", "Owned", "Near Fine/Fine", "2026-05-12", "Used bookstore", "45", "850", "", "", "Need to confirm jacket state"],
  ["Vintage Phillies Program", "Sports memorabilia", "Philadelphia Phillies", "1970s program", "", "", "", "Sold", "Very Good/Good", "2026-04-28", "Flea market", "12", "", "40", "2026-06-01", "Minor corner wear. Sold at a local card show."]
];
const mockAutofillOptions = [
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

function Icon({ name, size = 20, className = "" }) {
  const icons = {
    box: (
      <>
        <path d="M21 8 12 3 3 8l9 5 9-5Z" />
        <path d="M3 8v8l9 5 9-5V8" />
        <path d="M12 13v8" />
      </>
    ),
    camera: (
      <>
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
        <circle cx="12" cy="13" r="3" />
      </>
    ),
    check: <path d="M20 6 9 17l-5-5" />,
    x: <path d="M18 6 6 18M6 6l12 12" />,
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </>
    ),
    save: <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16Z" />,
    receipt: (
      <>
        <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z" />
        <path d="M8 7h8" />
        <path d="M8 11h8" />
        <path d="M8 15h5" />
      </>
    ),
    trash: (
      <>
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="M19 6l-1 14H6L5 6" />
      </>
    ),
    dollar: (
      <>
        <path d="M12 2v20" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14.5a3.5 3.5 0 0 1 0 7H6" />
      </>
    ),
    user: (
      <>
        <path d="M20 21a8 8 0 0 0-16 0" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
    google: (
      <>
        <path d="M21.8 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h5.5a4.7 4.7 0 0 1-2 3.1v2.6h3.2c1.9-1.7 3.1-4.3 3.1-7.4Z" />
        <path d="M12 22c2.7 0 5-0.9 6.7-2.4L15.5 17c-.9.6-2 .9-3.5.9-2.7 0-5-1.8-5.8-4.2H2.9v2.7A10 10 0 0 0 12 22Z" />
        <path d="M6.2 13.7a6 6 0 0 1 0-3.4V7.6H2.9a10 10 0 0 0 0 8.8l3.3-2.7Z" />
        <path d="M12 6.1c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.7 9.7 0 0 0 12 2 10 10 0 0 0 2.9 7.6l3.3 2.7C7 7.9 9.3 6.1 12 6.1Z" />
      </>
    ),
    arrow: <path d="m9 18 6-6-6-6" />,
    play: <path d="m8 5 12 7-12 7V5Z" />,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    home: (
      <>
        <path d="M3 11 12 3l9 8" />
        <path d="M5 10v10h14V10" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    upload: (
      <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <path d="M17 8l-5-5-5 5" />
        <path d="M12 3v12" />
      </>
    ),
    file: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6" />
        <path d="M8 13h8" />
        <path d="M8 17h5" />
      </>
    )
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {icons[name] || icons.box}
    </svg>
  );
}


function trackEvent(eventName, params = {}) {
  try {
    sendGAEvent("event", eventName, params);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("GA event failed:", eventName, error);
    }
  }
}

const PHOTO_BUCKET = "item-photos";

// Shrink an image before upload so photos stay ~200-400KB instead of
// multi-MB phone originals. Falls back to the original file if the browser
// can't decode it (e.g. HEIC in some browsers).
async function compressImage(file, maxDimension = 1600, quality = 0.82) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size < file.size) return blob;
    return file;
  } catch (error) {
    return file;
  }
}

async function uploadPhotoList(userId, itemId, photos, kind) {
  const uploaded = [];
  const failures = [];

  for (const photo of photos) {
    if (!photo.file) continue;
    const blob = await compressImage(photo.file);
    const safeName = String(photo.name || "photo").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
    const path = `${userId}/${itemId}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
    const { error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, blob, { contentType: blob.type || "image/jpeg" });

    if (error) {
      console.error("Photo upload error:", error.message);
      failures.push(photo.name);
    } else {
      uploaded.push({ path, name: photo.name });
    }
  }

  return { uploaded, failures };
}

// Resolves {path, name} photo records to short-lived, viewable signed URLs.
async function fetchSignedPhotoUrls(photos) {
  const paths = photos.filter((photo) => photo.path).map((photo) => photo.path);
  if (paths.length === 0) return photos;

  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 3600);
  if (error) {
    console.error("Signed URL error:", error.message);
    return photos;
  }

  const urlByPath = new Map((data || []).map((row) => [row.path, row.signedUrl]));
  return photos.map((photo) => ({ ...photo, url: photo.path ? urlByPath.get(photo.path) : photo.url }));
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function toNumber(value) {
  const parsed = Number.parseFloat(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(toNumber(value));
}

function hasValue(value) {
  return value !== "" && value !== null && value !== undefined;
}

// Builds marketplace search URLs for "find similar copies" -- plain search
// links, no API keys or scraping involved.
// Appends a clarifying word (e.g. "edition") only if the value doesn't
// already contain it, so a field typed as just "First" becomes "First
// edition" while "First edition" isn't turned into "First edition edition".
function withClarifyingWord(value, word) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return trimmed;
  return trimmed.toLowerCase().includes(word.toLowerCase()) ? trimmed : `${trimmed} ${word}`;
}

function buildSimilarCopyLinks(item) {
  const parts = [item.name, item.maker];

  // Book-specific detail fields narrow the search to the exact edition/
  // printing the collector actually has, e.g. "The Gunslinger Stephen King
  // First edition First printing" instead of just the title and author.
  if (item.category === "Book") {
    if (item.bookEdition) parts.push(withClarifyingWord(item.bookEdition, "edition"));
    if (item.bookPrinting) parts.push(withClarifyingWord(item.bookPrinting, "printing"));
  } else if (item.edition) {
    parts.push(item.edition);
  }

  const query = parts.filter(Boolean).join(" ").trim();
  if (!query) return null;
  const encoded = encodeURIComponent(query);
  return {
    abebooks: `https://www.abebooks.com/servlet/SearchResults?kn=${encoded}`,
    ebay: `https://www.ebay.com/sch/i.html?_nkw=${encoded}`
  };
}

function hasEstimate(item) {
  return hasValue(item.estimatedValue);
}

// Prefers what an item actually sold for over its pre-sale estimate, so
// Sold-tab totals reflect realized value rather than a stale guess. Returns
// null when there's nothing to show yet, so callers can render "—" instead
// of a misleading $0.
function itemValueForTotals(item) {
  if (item.status === "Sold" && hasValue(item.soldPrice)) return toNumber(item.soldPrice);
  return hasEstimate(item) ? toNumber(item.estimatedValue) : null;
}

function calculateGain(item) {
  const value = itemValueForTotals(item);
  if (value === null) return null;
  return value - toNumber(item.purchasePrice);
}

// Use for a single item's value/gain display, where "no data yet" should
// read as "—" instead of $0 (which looks like a loss against cost basis).
function formatEstimatedValue(item) {
  const value = itemValueForTotals(item);
  return value === null ? "—" : formatCurrency(value);
}

function formatGain(gain) {
  return gain === null ? "—" : formatCurrency(gain);
}

function makeSavedItem(item, itemPhotos = [], receiptPhotos = []) {
  const itemPhotoList = Array.isArray(itemPhotos) ? itemPhotos : [];
  const receiptPhotoList = Array.isArray(receiptPhotos) ? receiptPhotos : [];
  const itemPhotoCount = Array.isArray(itemPhotos) ? itemPhotos.length : Number(itemPhotos || 0);
  const receiptPhotoCount = Array.isArray(receiptPhotos) ? receiptPhotos.length : Number(receiptPhotos || 0);

  return {
    id: `${item.name || "Untitled"}-${Date.now()}-${Math.random()}`,
    ...item,
    itemPhotoCount,
    receiptPhotoCount,
    itemPhotos: itemPhotoList.map((photo) => ({ ...photo })),
    receiptPhotos: receiptPhotoList.map((photo) => ({ ...photo })),
    savedAt: new Date().toISOString()
  };
}

function getActiveInventory(inventory) {
  return inventory.filter((entry) => entry.status !== "Sold");
}

function toDbItem(item, userId, itemPhotoCount = 0, receiptPhotoCount = 0) {
  return {
    user_id: userId,
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

function fromDbPhotoList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((photo) => photo && photo.path)
    .map((photo) => ({ id: photo.path, path: photo.path, name: photo.name || "photo" }));
}

function fromDbItem(row) {
  const itemPhotos = fromDbPhotoList(row.item_photos);
  const receiptPhotos = fromDbPhotoList(row.receipt_photos);

  return {
    id: row.id,
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

function csvEscape(value) {
  const stringValue = String(value ?? "");
  if (/[",\n]/.test(stringValue)) return `"${stringValue.replace(/"/g, '""')}"`;
  return stringValue;
}

function buildCsvTemplate() {
  const rows = [csvHeaders, ...csvTemplateRows];
  return rows.map((row) => row.map(csvEscape).join(",")).join("\n");
}

// Parses the whole CSV text into rows of trimmed values, character by
// character, so a quoted field can contain commas or newlines without
// breaking row boundaries (splitting on "\n" before parsing quotes, as a
// line-by-line parser would, corrupts any quoted multi-line field).
function parseCsvRows(csvText) {
  const rows = [];
  let currentRow = [];
  let field = "";
  let inQuotes = false;
  const text = String(csvText || "");

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      currentRow.push(field.trim());
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && nextChar === "\n") i += 1;
      currentRow.push(field.trim());
      field = "";
      rows.push(currentRow);
      currentRow = [];
    } else {
      field += char;
    }
  }

  if (field.length > 0 || currentRow.length > 0) {
    currentRow.push(field.trim());
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((value) => value.length > 0));
}

function parseCsvInventory(csvText) {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) {
    return { items: [], error: "That file has no data rows to import." };
  }

  const headers = rows[0].map((header) => header.trim());
  if (!headers.map((header) => header.toLowerCase()).includes("name")) {
    return { items: [], error: `Couldn't find a "name" column. Use the downloaded template so columns match: ${csvHeaders.join(", ")}.` };
  }

  const items = rows
    .slice(1)
    .map((values) => {
      const row = headers.reduce((acc, header, index) => ({ ...acc, [header]: values[index] || "" }), {});
      const status = statuses.includes(row.status) ? row.status : "Owned";
      const condition = conditionOptions.includes(row.condition) ? row.condition : "";
      const bookEdition = bookEditionOptions.includes(row.bookEdition) ? row.bookEdition : "";
      const bookPrinting = bookPrintingOptions.includes(row.bookPrinting) ? row.bookPrinting : "";
      return makeSavedItem({ ...emptyItem, ...row, status, condition, bookEdition, bookPrinting }, 0, 0);
    })
    .filter((item) => item.name.trim().length > 0);

  return { items, error: items.length === 0 ? "No rows had a value in the name column." : null };
}

function pickMockAutofill(fileName, photoType) {
  const normalized = String(fileName || "").toLowerCase();
  if (photoType.toLowerCase().includes("receipt")) return mockAutofillOptions[0].data;
  const matched = mockAutofillOptions.find((option) => normalized.includes(option.match));
  return matched?.data || mockAutofillOptions[mockAutofillOptions.length - 1].data;
}

function FirstFinderLogoMark({ className = "h-6 w-6" }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M28 91C20 91 15 86 15 79C15 70 22 64 33 64H43C48 64 50 61 51 56L60 22C62 13 68 9 78 9H104C106 9 107 11 106 13C104 25 94 34 81 34H72C68 34 66 36 65 40L53 78C50 87 42 91 28 91Z"
        fill="currentColor"
      />
      <path
        d="M54 101C62 98 67 91 70 80L76 58C78 50 84 46 93 46H109C111 46 112 48 111 50C109 60 101 67 90 67H86C82 67 80 69 79 73L76 83C73 95 64 101 54 101Z"
        fill="currentColor"
      />
      <path
        d="M76 82H102C104 82 105 84 104 86C102 95 94 101 84 101H71C68 101 66 98 67 95L70 86C71 83 73 82 76 82Z"
        fill="currentColor"
      />
    </svg>
  );
}

// Shared modal chrome: closes on Escape or a backdrop click, locks page
// scroll while open, and moves focus into the dialog with basic Tab
// cycling so keyboard users don't fall through to the page behind it.
function ModalShell({ onClose, children, contentClassName = "max-w-3xl" }) {
  const containerRef = useRef(null);
  // Keeps handlers below reading the *current* onClose (e.g. respecting a
  // saving-guarded no-op) without putting onClose in the mount effect's
  // dependency array -- see that effect for why that matters.
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }

      if (event.key === "Tab" && containerRef.current) {
        const focusable = containerRef.current.querySelectorAll(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    containerRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
    // Intentionally empty: this should only run once per modal open (locks
    // scroll, focuses the dialog, wires the listener) -- not on every
    // keystroke-triggered re-render, which is what re-including onClose
    // here caused (it stole focus back to the container after each letter).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget) onCloseRef.current();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={handleBackdropClick}>
      <div
        ref={containerRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className={`max-h-[90vh] w-full overflow-y-auto rounded-[2rem] bg-[#fff9f0] p-6 shadow-2xl outline-none ${contentClassName}`}
      >
        {children}
      </div>
    </div>
  );
}

function ToastStack({ toasts, onDismiss }) {
  const toneStyles = {
    error: "border-[#e2b6a1] bg-[#fbe9e2] text-[#8a3b22]",
    warning: "border-[#e3c98c] bg-[#fff3d8] text-[#6d5526]",
    success: "border-[#bcd7cf] bg-[#edf4f2] text-[#123f38]"
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border px-4 py-3 shadow-xl ${toneStyles[toast.type] || toneStyles.success}`}
          >
            <span className="flex-1 text-sm leading-6">{toast.text}</span>
            <button type="button" onClick={() => onDismiss(toast.id)} className="mt-0.5 shrink-0 opacity-70 hover:opacity-100" aria-label="Dismiss notification">
              <Icon name="x" size={15} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}


export default function FirstFinderApp() {
  const [activeView, setActiveView] = useState("home");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [item, setItem] = useState({ ...emptyItem, ...sampleItems[0] });
  const [quickItem, setQuickItem] = useState({ ...emptyItem, purchaseDate: todayIso() });
  const [inventory, setInventory] = useState([]);
  const [itemPhotos, setItemPhotos] = useState([]);
  const [receiptPhotos, setReceiptPhotos] = useState([]);
  const [quickItemPhotos, setQuickItemPhotos] = useState([]);
  const [quickReceiptPhotos, setQuickReceiptPhotos] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [inventoryViewMode, setInventoryViewMode] = useState("cards");
  const [inventoryStatusView, setInventoryStatusView] = useState("active");
  const [editingItem, setEditingItem] = useState(null);
  const [autofillMessage, setAutofillMessage] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkUploading, setBulkUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const loadedUserIdRef = useRef(null);

  function pushToast(text, type = "error") {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((current) => [...current, { id, text, type }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 5000);
  }

  function dismissToast(id) {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }

  function go(view) {
    setActiveView(view);
    setMobileMenuOpen(false);
  }

  // Tracks every view the nav (desktop, mobile, or a same-page button like
  // "Add inventory") switches to, so navigation doesn't need a manual
  // trackEvent at every call site -- skips the initial mount, which isn't a
  // real navigation.
  const isFirstViewRenderRef = useRef(true);
  useEffect(() => {
    if (isFirstViewRenderRef.current) {
      isFirstViewRenderRef.current = false;
      return;
    }

    trackEvent("view_changed", { view: activeView, auth_state: isLoggedIn ? "logged_in" : "logged_out" });
  }, [activeView, isLoggedIn]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;

      if (error) {
        console.error("Session lookup error:", error.message);
        return;
      }

      if (data.session) {
        setCurrentUser(data.session.user);
        setIsLoggedIn(true);
        setActiveView("dashboard");
        if (loadedUserIdRef.current !== data.session.user.id) {
          loadedUserIdRef.current = data.session.user.id;
          loadInventory(data.session.user.id);
        }
      }
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      setCurrentUser(session?.user ?? null);
      setIsLoggedIn(Boolean(session));

      if (event === "PASSWORD_RECOVERY") {
        setActiveView("resetPassword");
        return;
      }

      if (!session) {
        loadedUserIdRef.current = null;
        setActiveView("home");
        return;
      }

      // Only load inventory and navigate on a genuinely new login, so token
      // refreshes and tab refocus events don't yank the user off their page.
      if (loadedUserIdRef.current !== session.user.id) {
        loadedUserIdRef.current = session.user.id;
        loadInventory(session.user.id);
        setActiveView("dashboard");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const activeInventory = useMemo(() => getActiveInventory(inventory), [inventory]);
  const soldInventory = useMemo(() => inventory.filter((entry) => entry.status === "Sold"), [inventory]);
  const visibleInventory = inventoryStatusView === "sold" ? soldInventory : activeInventory;

  const totalCostBasis = useMemo(() => activeInventory.reduce((sum, entry) => sum + toNumber(entry.purchasePrice), 0), [activeInventory]);
  const totalEstimatedValue = useMemo(
    () => activeInventory.reduce((sum, entry) => { const value = itemValueForTotals(entry); return value === null ? sum : sum + value; }, 0),
    [activeInventory]
  );
  const totalGain = useMemo(
    () => activeInventory.reduce((sum, entry) => { const gain = calculateGain(entry); return gain === null ? sum : sum + gain; }, 0),
    [activeInventory]
  );

  const viewTotalCostBasis = useMemo(() => visibleInventory.reduce((sum, entry) => sum + toNumber(entry.purchasePrice), 0), [visibleInventory]);
  const viewTotalEstimatedValue = useMemo(
    () => visibleInventory.reduce((sum, entry) => { const value = itemValueForTotals(entry); return value === null ? sum : sum + value; }, 0),
    [visibleInventory]
  );
  const viewTotalGain = useMemo(
    () => visibleInventory.reduce((sum, entry) => { const gain = calculateGain(entry); return gain === null ? sum : sum + gain; }, 0),
    [visibleInventory]
  );

  const filteredInventory = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();
    if (!query) return visibleInventory;
    return visibleInventory.filter((entry) => [entry.name, entry.category, entry.maker, entry.source, entry.status, entry.notes, entry.edition].join(" ").toLowerCase().includes(query));
  }, [visibleInventory, searchTerm]);

  async function loadInventory(userId) {
    const { data, error } = await supabase
      .from("inventory_items")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Load inventory error:", error.message);
      pushToast(error.message, "error");
      return;
    }

    setInventory((data || []).map(fromDbItem));
  }


  async function logout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Logout error:", error.message);
      pushToast(error.message, "error");
      return;
    }

    trackEvent("logout");
    loadedUserIdRef.current = null;
    setCurrentUser(null);
    setInventory([]);
    setIsLoggedIn(false);
    setActiveView("home");
  }

  function loadSample(sample) {
    clearPhotoUrls(itemPhotos);
    clearPhotoUrls(receiptPhotos);
    setItem({ ...emptyItem, ...sample });
    setItemPhotos([]);
    setReceiptPhotos([]);
    setActiveView("add");
  }

  function resetFullForm() {
    clearPhotoUrls(itemPhotos);
    clearPhotoUrls(receiptPhotos);
    setItem({ ...emptyItem });
    setItemPhotos([]);
    setReceiptPhotos([]);
  }

  // Only fills fields the user hasn't already entered, so attaching a photo
  // after typing real details never clobbers what was already there.
  function fillEmptyFields(current, inferred) {
    const next = { ...current };
    Object.keys(inferred).forEach((key) => {
      if (!next[key]) next[key] = inferred[key];
    });
    return next;
  }

  function applyAutofill(fileName, photoType) {
    const inferred = pickMockAutofill(fileName, photoType);
    if (photoType.startsWith("quick")) {
      setQuickItem((current) => fillEmptyFields(current, inferred));
    } else {
      setItem((current) => fillEmptyFields(current, inferred));
    }
    setAutofillMessage(`Autofilled empty fields from ${fileName || "uploaded photo"}. Review before saving.`);
  }

  function handlePhotoUpload(event, photoType, shouldAutofill = false) {
    const files = Array.from(event.target.files || []);
    const nextPhotos = files.map((file) => ({
      id: `${photoType}-${file.name}-${Date.now()}-${Math.random()}`,
      name: file.name,
      url: URL.createObjectURL(file),
      type: file.type || "image",
      file
    }));

    if (photoType === "item") setItemPhotos((photos) => [...photos, ...nextPhotos]);
    if (photoType === "receipt") setReceiptPhotos((photos) => [...photos, ...nextPhotos]);
    if (photoType === "quickItem") setQuickItemPhotos((photos) => [...photos, ...nextPhotos]);
    if (photoType === "quickReceipt") setQuickReceiptPhotos((photos) => [...photos, ...nextPhotos]);
    if (shouldAutofill && files[0]) applyAutofill(files[0].name, photoType);
    event.target.value = "";
  }

  function removePhoto(id, photoType) {
    const setterMap = { item: setItemPhotos, receipt: setReceiptPhotos, quickItem: setQuickItemPhotos, quickReceipt: setQuickReceiptPhotos };
    const setter = setterMap[photoType];
    setter((photos) => {
      const photo = photos.find((entry) => entry.id === id);
      if (photo) URL.revokeObjectURL(photo.url);
      return photos.filter((entry) => entry.id !== id);
    });
  }

  // Inserts the item row, uploads its photos to Supabase Storage, then stores
  // the photo paths back on the row. Returns the final row, or null on failure.
  async function insertItemWithPhotos(sourceItem, itemPhotoList, receiptPhotoList, entryType) {
    if (!currentUser) {
      pushToast("Please log in before saving inventory.", "error");
      return null;
    }

    setSaving(true);

    try {
      const { data, error } = await supabase
        .from("inventory_items")
        .insert(toDbItem(sourceItem, currentUser.id, itemPhotoList.length, receiptPhotoList.length))
        .select()
        .single();

      if (error) {
        console.error("Save item error:", error.message);
        pushToast(error.message, "error");
        return null;
      }

      let finalRow = data;
      const failures = [];

      if (itemPhotoList.length > 0 || receiptPhotoList.length > 0) {
        const itemResult = await uploadPhotoList(currentUser.id, data.id, itemPhotoList, "item");
        const receiptResult = await uploadPhotoList(currentUser.id, data.id, receiptPhotoList, "receipt");
        failures.push(...itemResult.failures, ...receiptResult.failures);

        const { data: updated, error: updateError } = await supabase
          .from("inventory_items")
          .update({
            item_photos: itemResult.uploaded,
            receipt_photos: receiptResult.uploaded,
            item_photo_count: itemResult.uploaded.length,
            receipt_photo_count: receiptResult.uploaded.length,
            updated_at: new Date().toISOString()
          })
          .eq("id", data.id)
          .select()
          .single();

        if (updateError) {
          console.error("Photo record update error:", updateError.message);
          failures.push("(photo records could not be saved)");
        } else {
          finalRow = updated;
        }
      }

      trackEvent("inventory_item_submitted", {
        entry_type: entryType,
        category: sourceItem.category || "Other",
        status: sourceItem.status || "Owned",
        has_item_photo: itemPhotoList.length > 0,
        has_receipt_photo: receiptPhotoList.length > 0
      });

      setInventory((items) => [fromDbItem(finalRow), ...items]);

      if (failures.length > 0) {
        pushToast(`Item saved, but some photos failed to upload: ${failures.join(", ")}. Make sure the item-photos storage bucket is set up, then re-add the photos.`, "warning");
      } else {
        pushToast("Saved to your inventory.", "success");
      }

      return finalRow;
    } finally {
      setSaving(false);
    }
  }

  async function saveItem() {
    const saved = await insertItemWithPhotos(item, itemPhotos, receiptPhotos, "tutorial");
    if (!saved) return;

    clearPhotoUrls(itemPhotos);
    clearPhotoUrls(receiptPhotos);
    setItem({ ...emptyItem });
    setItemPhotos([]);
    setReceiptPhotos([]);
    setActiveView("inventory");
  }

  async function saveQuickItem(event) {
    event.preventDefault();

    const saved = await insertItemWithPhotos(quickItem, quickItemPhotos, quickReceiptPhotos, "quick_add");
    if (!saved) return;

    clearPhotoUrls(quickItemPhotos);
    clearPhotoUrls(quickReceiptPhotos);
    setQuickItem({ ...emptyItem, purchaseDate: todayIso() });
    setQuickItemPhotos([]);
    setQuickReceiptPhotos([]);
    setAutofillMessage("");
    setActiveView("inventory");
  }

  async function deleteItem(id) {
    const entry = inventory.find((current) => current.id === id);

    const { error } = await supabase
      .from("inventory_items")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Delete item error:", error.message);
      pushToast(error.message, "error");
      return;
    }

    // Best-effort cleanup of the item's stored photos; the row is already gone.
    const photoPaths = [...(entry?.itemPhotos || []), ...(entry?.receiptPhotos || [])]
      .map((photo) => photo.path)
      .filter(Boolean);

    if (photoPaths.length > 0) {
      const { error: storageError } = await supabase.storage.from(PHOTO_BUCKET).remove(photoPaths);
      if (storageError) console.error("Photo cleanup error:", storageError.message);
    }

    trackEvent("item_deleted", { category: entry?.category || "Other", status: entry?.status || "Owned" });
    setInventory((items) => items.filter((entry) => entry.id !== id));
    pushToast(`Deleted "${entry?.name || "item"}".`, "success");
  }

  async function markSold(id, { soldPrice, soldDate, condition } = {}) {
    const previousItem = inventory.find((entry) => entry.id === id);
    // Remember what the item was before the sale (not "Sold" itself, in the
    // rare case this fires twice) so restoring later can put it back there
    // instead of always defaulting to "Owned".
    const statusToRestore = previousItem && previousItem.status !== "Sold" ? previousItem.status : previousItem?.previousStatus || "Owned";

    const { data, error } = await supabase
      .from("inventory_items")
      .update({
        status: "Sold",
        previous_status: statusToRestore,
        sold_price: hasValue(soldPrice) ? toNumber(soldPrice) : null,
        sold_date: soldDate || null,
        condition: condition || previousItem?.condition || "",
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Mark sold error:", error.message);
      pushToast(error.message, "error");
      return;
    }

    trackEvent("item_marked_sold", {
      category: previousItem?.category || "Other",
      status_before: previousItem?.status || "Owned",
      has_sold_price: hasValue(soldPrice)
    });

    setInventory((items) => items.map((entry) => (entry.id === id ? fromDbItem(data) : entry)));
    pushToast(hasValue(soldPrice) ? `Marked sold for ${formatCurrency(soldPrice)}.` : "Marked sold.", "success");
  }

  async function restoreSold(id) {
    const previousItem = inventory.find((entry) => entry.id === id);
    const restoredStatus = previousItem?.previousStatus || "Owned";

    const { data, error } = await supabase
      .from("inventory_items")
      .update({
        status: restoredStatus,
        previous_status: null,
        sold_price: null,
        sold_date: null,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Restore item error:", error.message);
      pushToast(error.message, "error");
      return;
    }

    trackEvent("item_restored", {
      category: previousItem?.category || "Other"
    });

    setInventory((items) => items.map((entry) => (entry.id === id ? fromDbItem(data) : entry)));
    setInventoryStatusView("active");
    pushToast(`Restored to ${restoredStatus}.`, "success");
  }

  async function updateInventoryItem({ draft, newItemPhotos, newReceiptPhotos, removedItemPhotoPaths, removedReceiptPhotoPaths }) {
    if (!currentUser) {
      pushToast("Please log in before saving inventory.", "error");
      return;
    }

    setSaving(true);

    try {
      const currentEntry = inventory.find((entry) => entry.id === draft.id);
      const keptItemPhotos = (currentEntry?.itemPhotos || []).filter((photo) => !removedItemPhotoPaths.includes(photo.path));
      const keptReceiptPhotos = (currentEntry?.receiptPhotos || []).filter((photo) => !removedReceiptPhotoPaths.includes(photo.path));
      const failures = [];

      // The edit form can flip status into or out of "Sold" directly, not
      // just via the Mark Sold / Restore actions, so keep the sold fields
      // consistent with whichever status comes out of this save.
      const isNowSold = draft.status === "Sold";
      const wasAlreadySold = currentEntry?.status === "Sold";
      const previousStatusToStore = !isNowSold
        ? null
        : wasAlreadySold
          ? currentEntry?.previousStatus || "Owned"
          : currentEntry?.status || "Owned";

      let uploadedItemPhotos = [];
      let uploadedReceiptPhotos = [];

      if (newItemPhotos.length > 0) {
        const result = await uploadPhotoList(currentUser.id, draft.id, newItemPhotos, "item");
        uploadedItemPhotos = result.uploaded;
        failures.push(...result.failures);
      }

      if (newReceiptPhotos.length > 0) {
        const result = await uploadPhotoList(currentUser.id, draft.id, newReceiptPhotos, "receipt");
        uploadedReceiptPhotos = result.uploaded;
        failures.push(...result.failures);
      }

      const finalItemPhotos = [...keptItemPhotos, ...uploadedItemPhotos];
      const finalReceiptPhotos = [...keptReceiptPhotos, ...uploadedReceiptPhotos];

      const removedPaths = [...removedItemPhotoPaths, ...removedReceiptPhotoPaths];
      if (removedPaths.length > 0) {
        const { error: removeError } = await supabase.storage.from(PHOTO_BUCKET).remove(removedPaths);
        if (removeError) console.error("Photo removal error:", removeError.message);
      }

      const { data, error } = await supabase
        .from("inventory_items")
        .update({
          name: draft.name || "",
          category: draft.category || "Other",
          maker: draft.maker || "",
          edition: draft.edition || "",
          book_genre: draft.bookGenre || "",
          book_edition: draft.bookEdition || "",
          book_printing: draft.bookPrinting || "",
          status: draft.status || "Owned",
          condition: draft.condition || "",
          previous_status: previousStatusToStore,
          sold_price: isNowSold && hasValue(draft.soldPrice) ? toNumber(draft.soldPrice) : null,
          sold_date: isNowSold ? draft.soldDate || null : null,
          purchase_date: draft.purchaseDate || null,
          source: draft.source || "",
          purchase_price: toNumber(draft.purchasePrice),
          estimated_value: hasValue(draft.estimatedValue) ? toNumber(draft.estimatedValue) : null,
          notes: draft.notes || "",
          item_photos: finalItemPhotos,
          receipt_photos: finalReceiptPhotos,
          item_photo_count: finalItemPhotos.length,
          receipt_photo_count: finalReceiptPhotos.length,
          updated_at: new Date().toISOString()
        })
        .eq("id", draft.id)
        .select()
        .single();

      if (error) {
        console.error("Update item error:", error.message);
        pushToast(error.message, "error");
        return;
      }

      trackEvent("item_updated", { category: draft.category || "Other", status: draft.status || "Owned" });
      setInventory((items) => items.map((entry) => (entry.id === draft.id ? fromDbItem(data) : entry)));
      setEditingItem(null);

      if (failures.length > 0) {
        pushToast(`Changes saved, but some new photos failed to upload: ${failures.join(", ")}. Re-add them from Edit.`, "warning");
      } else {
        pushToast("Changes saved.", "success");
      }
    } finally {
      setSaving(false);
    }
  }

  function downloadTemplate() {
    const csv = buildCsvTemplate();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "firstfinder-inventory-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleBulkUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = async () => {
      if (!currentUser) {
        pushToast("Please log in before importing inventory.", "error");
        return;
      }

      setBulkUploading(true);

      try {
        const { items: importedItems, error: parseError } = parseCsvInventory(String(reader.result || ""));

        if (parseError) {
          pushToast(parseError, "error");
          return;
        }

        const rows = importedItems.map((entry) => toDbItem(entry, currentUser.id, 0, 0));

        const { data, error } = await supabase
          .from("inventory_items")
          .insert(rows)
          .select();

        if (error) {
          console.error("Bulk import error:", error.message);
          pushToast(error.message, "error");
          return;
        }

        trackEvent("csv_uploaded", {
          source_page: "add_inventory",
          imported_count: (data || []).length
        });

        setInventory((items) => [...(data || []).map(fromDbItem), ...items]);
        setBulkMessage(`Imported ${(data || []).length} item${(data || []).length === 1 ? "" : "s"} from ${file.name}.`);
        setActiveView("inventory");
      } finally {
        setBulkUploading(false);
      }
    };

    reader.readAsText(file);
    event.target.value = "";
  }

  return (
    <main className="min-h-screen bg-[#f6efe3] text-[#201a14]">
      <div className="print:hidden">
        <ToastStack toasts={toasts} onDismiss={dismissToast} />
      </div>

      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 print:hidden">
        <button onClick={() => go(isLoggedIn ? "dashboard" : "home")} className="flex items-center gap-3 text-left">
          <img src="/firstfinder-mark-exact.png" alt="FirstFinder logo" className="h-10 w-10 rounded-xl object-cover" /><div><div className="text-xl font-semibold tracking-tight">FirstFinder</div><div className="text-xs uppercase tracking-[0.22em] text-[#746655]">Collectible inventory</div></div>
        </button>

        <div className="hidden max-w-full items-center gap-1 overflow-x-auto rounded-full border border-[#d8c7ad] bg-[#fff8ee] p-1 md:flex">
          {isLoggedIn ? (
            <>
              <TabButton active={activeView === "dashboard"} onClick={() => setActiveView("dashboard")}>Dashboard</TabButton>
              <TabButton active={activeView === "inventory"} onClick={() => setActiveView("inventory")}>Inventory ({activeInventory.length})</TabButton>
              <TabButton active={activeView === "add"} onClick={() => setActiveView("add")}>Add Item</TabButton>
              <TabButton active={activeView === "roadmap"} onClick={() => setActiveView("roadmap")}>Roadmap</TabButton>
              <TabButton active={activeView === "about"} onClick={() => setActiveView("about")}>About</TabButton>
              <TabButton active={activeView === "feedback"} onClick={() => setActiveView("feedback")}>Feedback</TabButton>
              <TabButton active={activeView === "account"} onClick={() => setActiveView("account")}>My Account</TabButton>
            </>
          ) : (
            <>
              <TabButton active={activeView === "home"} onClick={() => setActiveView("home")}>Get Started</TabButton>
              <TabButton active={activeView === "roadmap"} onClick={() => setActiveView("roadmap")}>Roadmap</TabButton>
              <TabButton active={activeView === "about"} onClick={() => setActiveView("about")}>About</TabButton>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isLoggedIn ? <Button variant="outline" onClick={logout} className="rounded-full border-[#cdbb9d] bg-[#fff8ee] px-5 hover:bg-white">Log out</Button> : <Button onClick={() => setActiveView("login")} className="rounded-full bg-[#123f38] px-5 text-[#fff7ea] hover:bg-[#0f332d]">Log in</Button>}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d8c7ad] bg-[#fff8ee] text-[#201a14] md:hidden"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
          >
            <Icon name={mobileMenuOpen ? "x" : "menu"} size={18} />
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="mx-auto max-w-6xl px-6 pb-4 md:hidden print:hidden">
          <div className="flex flex-col gap-1 rounded-2xl border border-[#d8c7ad] bg-[#fff8ee] p-2">
            {isLoggedIn ? (
              <>
                <MobileNavLink active={activeView === "dashboard"} onClick={() => go("dashboard")}>Dashboard</MobileNavLink>
                <MobileNavLink active={activeView === "inventory"} onClick={() => go("inventory")}>Inventory ({activeInventory.length})</MobileNavLink>
                <MobileNavLink active={activeView === "add"} onClick={() => go("add")}>Add Item</MobileNavLink>
                <MobileNavLink active={activeView === "roadmap"} onClick={() => go("roadmap")}>Roadmap</MobileNavLink>
                <MobileNavLink active={activeView === "about"} onClick={() => go("about")}>About</MobileNavLink>
                <MobileNavLink active={activeView === "feedback"} onClick={() => go("feedback")}>Feedback</MobileNavLink>
                <MobileNavLink active={activeView === "account"} onClick={() => go("account")}>My Account</MobileNavLink>
              </>
            ) : (
              <>
                <MobileNavLink active={activeView === "home"} onClick={() => go("home")}>Get Started</MobileNavLink>
                <MobileNavLink active={activeView === "roadmap"} onClick={() => go("roadmap")}>Roadmap</MobileNavLink>
                <MobileNavLink active={activeView === "about"} onClick={() => go("about")}>About</MobileNavLink>
              </>
            )}
          </div>
        </div>
      )}

      {activeView === "home" && <HomePage onGetStarted={() => setActiveView(isLoggedIn ? "dashboard" : "login")} />}
      {activeView === "roadmap" && <RoadmapPage />}
      {activeView === "about" && <AboutPage onGoToFeedback={() => setActiveView(isLoggedIn ? "feedback" : "login")} />}
      {activeView === "login" && <LoginPage />}
      {activeView === "resetPassword" && <ResetPasswordPage onDone={() => setActiveView("dashboard")} />}
      {activeView === "dashboard" && isLoggedIn && <DashboardPage quickItem={quickItem} setQuickItem={setQuickItem} quickItemPhotos={quickItemPhotos} quickReceiptPhotos={quickReceiptPhotos} onUpload={handlePhotoUpload} onRemove={removePhoto} onSave={saveQuickItem} saving={saving} onFullAdd={() => setActiveView("add")} onInventory={() => setActiveView("inventory")} inventory={activeInventory} totalCostBasis={totalCostBasis} totalEstimatedValue={totalEstimatedValue} totalGain={totalGain} autofillMessage={autofillMessage} onDownloadTemplate={downloadTemplate} onBulkUpload={handleBulkUpload} bulkUploading={bulkUploading} bulkMessage={bulkMessage} />}
      {activeView === "add" && isLoggedIn && <FullAddPage item={item} setItem={setItem} itemPhotos={itemPhotos} receiptPhotos={receiptPhotos} onUpload={handlePhotoUpload} onRemove={removePhoto} onSave={saveItem} saving={saving} onReset={resetFullForm} onLoadSample={loadSample} autofillMessage={autofillMessage} />}
      {activeView === "inventory" && isLoggedIn && <InventoryPage inventory={visibleInventory} filteredInventory={filteredInventory} searchTerm={searchTerm} setSearchTerm={setSearchTerm} viewMode={inventoryViewMode} setViewMode={setInventoryViewMode} statusView={inventoryStatusView} setStatusView={setInventoryStatusView} activeCount={activeInventory.length} soldCount={soldInventory.length} totalCostBasis={viewTotalCostBasis} totalEstimatedValue={viewTotalEstimatedValue} totalGain={viewTotalGain} onAdd={() => setActiveView("dashboard")} onExport={() => setActiveView("insuranceExport")} onDelete={deleteItem} onMarkSold={markSold} onRestoreSold={restoreSold} onEdit={setEditingItem} bulkMessage={bulkMessage} />}
      {activeView === "insuranceExport" && isLoggedIn && <InsuranceExportPage items={activeInventory} onBack={() => setActiveView("inventory")} />}
      {activeView === "feedback" && isLoggedIn && <FeedbackPage currentUser={currentUser} pushToast={pushToast} />}
      {activeView === "account" && isLoggedIn && <MyAccountPage currentUser={currentUser} inventory={inventory} pushToast={pushToast} />}

      {editingItem && (
        <EditItemModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={updateInventoryItem}
          saving={saving}
        />
      )}

    </main>
  );
}


const roadmapCategoryStyles = {
  Cataloging: { icon: "camera", tone: "bg-[#edf4f2] text-[#123f38]" },
  "Trust & Provenance": { icon: "receipt", tone: "bg-[#f0e2cf] text-[#665746]" },
  Valuation: { icon: "dollar", tone: "bg-[#fff3d8] text-[#6d5526]" },
  Discovery: { icon: "search", tone: "bg-[#e6ecf5] text-[#2c3f5c]" },
  Community: { icon: "user", tone: "bg-[#f3e6ef] text-[#5c2c4d]" }
};

const roadmapHorizons = [
  {
    id: "now",
    label: "Now",
    framing: "In progress or up next in the build queue.",
    items: [
      {
        category: "Cataloging",
        title: "ISBN barcode scan, auto-filled",
        text: "Scan a book's barcode and pull real title, author, publisher, and year from a public books API — replacing the mock-data autofill entirely."
      },
      {
        category: "Trust & Provenance",
        title: "Grading & cert fields",
        text: "Grading company, grade, and cert number fields for graded cards and comics, with a direct link out to the grader's public cert-verification page."
      }
    ]
  },
  {
    id: "next",
    label: "Next",
    framing: "Scoped, waiting on the Now list to clear.",
    items: [
      {
        category: "Valuation",
        title: "\"Check current price\" deep links",
        text: "One tap from any item to relevant eBay sold listings or an AbeBooks search for that exact title and edition — market context without a pricing API."
      },
      {
        category: "Trust & Provenance",
        title: "First-edition identification helper",
        text: "A per-book checklist for the points that actually prove a true first — number line, stated edition, issue points — the feature the FirstFinder name promises."
      },
      {
        category: "Discovery",
        title: "A real want list",
        text: "Give \"Wishlist\" its own view with a target price, instead of it being just another status buried in the inventory tabs."
      },
      {
        category: "Valuation",
        title: "Insurance / estate report export",
        text: "One-click PDF of the collection — photos, cost basis, current values — so \"receipts, values, photos, proof\" is something you can actually hand someone."
      }
    ]
  },
  {
    id: "later",
    label: "Later",
    framing: "Directionally right; sequencing depends on what Now/Next prove out.",
    items: [
      {
        category: "Community",
        title: "Shareable collection page",
        text: "A public, read-only link to show off a shelf or set — the same instinct that makes PSA's and PCGS's set registries so sticky."
      },
      {
        category: "Valuation",
        title: "Value-over-time charting",
        text: "Cost basis and realized sales are already tracked, so a value trend line is mostly a visualization problem once there's enough history per item."
      },
      {
        category: "Valuation",
        title: "Live pricing integration",
        text: "Wire in eBay's or PSA's pricing APIs for real-time value estimates, once the manual deep-links above prove people actually want this."
      }
    ]
  }
];

const roadmapNonGoals = [
  "Grading or authentication services",
  "Becoming a marketplace or facilitating sales",
  "Anything that competes with the graders and marketplaces this roadmap links out to"
];

function RoadmapPage() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 md:py-20">
      <div className="max-w-3xl">
        <div className="font-ledger inline-flex items-center gap-2 rounded-full border border-[#d9c9b0] bg-[#fff8ee] px-4 py-2 text-xs uppercase tracking-[0.2em] text-[#655644]">
          Roadmap
        </div>
        <h1 className="font-display mt-5 text-4xl font-semibold tracking-tight md:text-6xl">What's next for FirstFinder.</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-[#665746]">
          A working roadmap, not a promise list — sequencing shifts as we learn what collectors actually reach for. Shaped by what serious collectors already expect from graded-collectibles registries and rare-book marketplaces.
        </p>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {roadmapHorizons.map((horizon) => (
          <div key={horizon.id} className="rounded-[2rem] border border-[#d8c7ad] bg-[#fbf5e9] p-5">
            <div className="flex items-baseline justify-between px-2">
              <h2 className="font-display text-2xl font-semibold">{horizon.label}</h2>
              <span className="font-ledger text-xs text-[#8a7a64]">{horizon.items.length} item{horizon.items.length === 1 ? "" : "s"}</span>
            </div>
            <p className="mt-1 px-2 text-sm leading-6 text-[#7d6c5a]">{horizon.framing}</p>

            <div className="mt-4 flex flex-col gap-3">
              {horizon.items.map((item) => {
                const style = roadmapCategoryStyles[item.category] || roadmapCategoryStyles.Cataloging;
                return (
                  <div key={item.title} className="rounded-2xl border border-[#e0d2bc] bg-[#fffdf8] p-4 shadow-sm">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${style.tone}`}>
                      <Icon name={style.icon} size={11} />
                      {item.category}
                    </span>
                    <div className="mt-3 font-semibold leading-snug">{item.title}</div>
                    <p className="mt-1.5 text-sm leading-6 text-[#665746]">{item.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-dashed border-[#d3c1a4] bg-[#fffdf8] p-6">
        <div className="font-ledger text-xs uppercase tracking-[0.2em] text-[#8a7a64]">Deliberately not on this roadmap</div>
        <ul className="mt-3 grid gap-1.5 text-sm leading-6 text-[#665746] sm:grid-cols-3">
          {roadmapNonGoals.map((goal) => (
            <li key={goal} className="flex items-start gap-2">
              <Icon name="x" size={14} className="mt-1 shrink-0 text-[#b09a78]" />
              {goal}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const aboutParagraphs = [
  "There's something magical about discovering your first rare or collectible book. It's more than finding an old volume on a shelf—it's stepping into a world filled with history, craftsmanship, and stories that have survived generations. Every collector remembers that first find.",
  "As your collection grows, so does the challenge of keeping track of it. What starts as a simple spreadsheet slowly turns into a maze of formulas, colors, and tabs. Eventually, you look for a better solution, only to find software that's clunky, confusing, or built without collectors in mind.",
  "That's why we created First Finder.",
  "First Finder is designed to help you catalog and care for your collection—from your very first find to your next great discovery. Whether you're browsing your favorite used bookstore, exploring a rare book fair, or uncovering a hidden gem online, you can quickly record your purchase, photograph its condition, save receipts, and keep everything in one place. And while we started with rare books, First Finder is equally at home with comics, manuscripts, and other cherished collectibles.",
  "To us, collecting is about more than ownership. It's about preserving art, protecting knowledge, and ensuring that remarkable stories continue to be passed from one generation to the next. That happens because of collectors—people who care enough to seek, preserve, and share these pieces of history.",
  "First Finder was built for you.",
  "The Collector. The Seeker. The First Finder.",
  "We're constantly improving the app and would love to hear your ideas. Thank you for being part of the journey."
];

function AboutPage({ onGoToFeedback }) {
  return (
    <section className="mx-auto max-w-3xl px-6 py-16 md:py-20">
      <h1 className="font-display text-4xl font-semibold tracking-tight md:text-6xl">The story behind First Finder.</h1>

      <div className="mt-8 space-y-5 text-lg leading-8 text-[#665746]">
        {aboutParagraphs.map((paragraph, index) => (
          <p key={index} className={index === 2 || index === 5 || index === 6 ? "font-display text-2xl font-semibold text-[#201a14]" : ""}>
            {paragraph}
          </p>
        ))}
      </div>

      <div className="mt-12 flex justify-center">
        <Button onClick={onGoToFeedback} className="h-12 rounded-full bg-[#123f38] px-7 text-base text-[#fff7ea] hover:bg-[#0f332d]">
          Share your ideas <Icon name="arrow" size={18} className="ml-1" />
        </Button>
      </div>
    </section>
  );
}

// Drop a YouTube video id in here (e.g. "dQw4w9WgXcQ") and the demo video
// player appears on the homepage in place of the three-step strip's header.
const demoVideoId = "3RTVD9LqoEI";

// Plain <iframe src> embeds have no playback-rate control, so this loads
// the YouTube IFrame API and calls setPlaybackRate once the player is
// ready. Falls back to a normal embed if the API script fails to load.
function DemoVideoPlayer({ videoId }) {
  const iframeRef = useRef(null);

  useEffect(() => {
    if (!videoId || !iframeRef.current) return;

    let cancelled = false;

    function createPlayer() {
      if (cancelled || !iframeRef.current || !window.YT?.Player) return;
      new window.YT.Player(iframeRef.current, {
        events: {
          onReady: (event) => event.target.setPlaybackRate(1.5),
          // Belt-and-suspenders loop: the loop=1/playlist URL params usually
          // handle this alone, but restarting on ENDED covers players where
          // that trick doesn't take.
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.ENDED) {
              event.target.seekTo(0);
              event.target.playVideo();
            }
          }
        }
      });
    }

    if (window.YT?.Player) {
      createPlayer();
    } else {
      const previousCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (typeof previousCallback === "function") previousCallback();
        createPlayer();
      };

      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
    };
  }, [videoId]);

  return (
    <iframe
      ref={iframeRef}
      className="aspect-video w-full"
      src={`https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&autoplay=1&mute=1&loop=1&playlist=${videoId}`}
      title="FirstFinder demo"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
  );
}

function LedgerRow({ label, value, strong = false }) {
  return (
    <div className="flex items-baseline gap-2 text-sm">
      <span className="text-[#7d6c5a]">{label}</span>
      <span className="flex-1 border-b border-dotted border-[#c9b591]" />
      <span className={`font-ledger ${strong ? "font-medium text-[#123f38]" : "text-[#3d332a]"}`}>{value}</span>
    </div>
  );
}

function SpecimenCard({ index, kind, title, detail, paid, value, chips, className = "" }) {
  return (
    <div className={`w-full max-w-sm rounded-2xl border border-[#d3c1a4] bg-[#fffdf8] p-5 shadow-[0_18px_40px_-18px_rgba(48,36,20,0.35)] ${className}`}>
      <div className="flex items-center justify-between border-b border-[#e6d9c2] pb-3">
        <span className="font-ledger text-[11px] uppercase tracking-[0.18em] text-[#8a7a64]">{kind}</span>
        <span className="font-ledger text-[11px] text-[#8a7a64]">No. {index}</span>
      </div>
      <div className="font-display mt-4 text-2xl font-semibold leading-tight text-[#201a14]">{title}</div>
      <div className="mt-1 text-sm text-[#665746]">{detail}</div>
      <div className="mt-4 grid gap-2">
        <LedgerRow label="Paid" value={paid} />
        <LedgerRow label="Est. value" value={value} strong />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {chips.map((chip) => (
          <span key={chip.text} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ${chip.tone === "green" ? "bg-[#edf4f2] text-[#123f38]" : "bg-[#f0e2cf] text-[#665746]"}`}>
            {chip.icon && <Icon name={chip.icon} size={12} />}
            {chip.text}
          </span>
        ))}
      </div>
    </div>
  );
}

function HomePage({ onGetStarted }) {
  const steps = [
    { number: "01", icon: "camera", title: "Snap it", text: "Photograph the item and the receipt the day it comes home. Proof beats memory." },
    { number: "02", icon: "file", title: "Log it", text: "Edition points, condition, where you found it, what you paid. Thirty seconds per item." },
    { number: "03", icon: "dollar", title: "Track it", text: "Cost basis, estimated value, and what actually changed when you sold." }
  ];

  return (
    <>
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-14 md:pt-20">
        <div className="grid gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="font-display max-w-2xl text-5xl font-semibold leading-[1.02] tracking-tight text-[#201a14] md:text-[4.4rem]">
              Inventory collectibles like you may actually sell them one day.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#665746]">
              Item photos, receipt proof, purchase details, and value in one ledger — for the first editions, cards, and programs you swore you'd keep track of this time.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-5">
              <Button onClick={onGetStarted} className="h-12 rounded-full bg-[#123f38] px-7 text-base text-[#fff7ea] hover:bg-[#0f332d]">
                Get Started <Icon name="arrow" size={18} className="ml-1" />
              </Button>
              <a href="#how-it-works" className="text-sm font-medium text-[#123f38] underline underline-offset-4 hover:text-[#0f332d]">
                See how it works
              </a>
            </div>
            <p className="font-ledger mt-10 text-xs text-[#8a7a64]">Built by a collector who kept losing receipts.</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="relative mx-auto w-full max-w-lg lg:mx-0">
            <div className="pointer-events-none absolute -left-6 top-8 hidden h-full w-full rounded-2xl border border-dashed border-[#d3c1a4] sm:block" aria-hidden="true" />
            <SpecimenCard
              index="001"
              kind="Book · First edition"
              title="The Gunslinger"
              detail="Donald M. Grant, 1982 · dust jacket, first printing points"
              paid="$45"
              value="$850"
              chips={[{ icon: "receipt", text: "Receipt saved", tone: "green" }, { icon: "camera", text: "5 photos" }]}
              className="relative z-10 -rotate-2"
            />
            <SpecimenCard
              index="002"
              kind="Sports · Program"
              title="Phillies Program, 1970s"
              detail="Veterans Stadium era · minor corner wear"
              paid="$12"
              value="$40"
              chips={[{ icon: "receipt", text: "Flea market find", tone: "green" }, { icon: "camera", text: "2 photos" }]}
              className="relative z-20 ml-auto -mt-1 rotate-[2.5deg]"
            />
          </motion.div>
        </div>
      </section>

      <section id="how-it-works" className="border-t border-[#e2d4bc] bg-[#fbf5e9]">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-display text-center text-3xl font-semibold tracking-tight md:text-4xl">See it in ninety seconds.</h2>
            {demoVideoId ? (
              <div className="mt-8 overflow-hidden rounded-2xl border border-[#d3c1a4] bg-black shadow-xl">
                <DemoVideoPlayer videoId={demoVideoId} />
              </div>
            ) : (
              <div className="mt-8 flex aspect-video w-full flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl border border-[#d3c1a4] bg-[#123f38] shadow-xl">
                <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#fff7ea]/40 text-[#fff7ea]">
                  <Icon name="play" size={26} className="ml-1" />
                </span>
                <div className="font-ledger text-xs uppercase tracking-[0.24em] text-[#d8e6e2]">Demo film · Coming soon</div>
              </div>
            )}
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {steps.map((step) => (
              <div key={step.number} className="rounded-2xl border border-[#ddceb2] bg-[#fffdf8] p-6">
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#123f38] text-[#fff7ea]"><Icon name={step.icon} size={20} /></span>
                  <span className="font-ledger text-sm text-[#b09a78]">{step.number}</span>
                </div>
                <div className="font-display mt-5 text-xl font-semibold">{step.title}</div>
                <p className="mt-2 text-sm leading-6 text-[#665746]">{step.text}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Button onClick={onGetStarted} className="h-12 rounded-full bg-[#123f38] px-7 text-base text-[#fff7ea] hover:bg-[#0f332d]">
              Start your ledger <Icon name="arrow" size={18} className="ml-1" />
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

const authModeCopy = {
  signin: {
    heading: "Log in to your collection.",
    sub: "Sign in with Google or use your email and password to access your collectible inventory.",
    formTitle: "Email and password",
    formSub: "Log in with the email and password you signed up with.",
    submit: "Log in",
    submitting: "Logging in..."
  },
  signup: {
    heading: "Start your collection.",
    sub: "Create a free account to track item photos, receipts, cost basis, and estimated values.",
    formTitle: "Create your account",
    formSub: "Sign up with your email and a password of at least 8 characters.",
    submit: "Create account",
    submitting: "Creating account..."
  },
  forgot: {
    heading: "Reset your password.",
    sub: "Enter your account email and we'll send you a link to choose a new password.",
    formTitle: "Forgot your password?",
    formSub: "We'll email you a secure link to reset it.",
    submit: "Send reset link",
    submitting: "Sending..."
  }
};

function AuthMessage({ message }) {
  if (!message) return null;
  return (
    <div className={`mt-5 rounded-2xl p-4 text-sm leading-6 ${message.type === "error" ? "bg-[#fbe9e2] text-[#8a3b22]" : "bg-[#edf4f2] text-[#123f38]"}`}>
      {message.text}
    </div>
  );
}

function AuthLink({ children, onClick }) {
  return (
    <button type="button" onClick={onClick} className="font-medium text-[#123f38] underline underline-offset-4 hover:text-[#0f332d]">
      {children}
    </button>
  );
}

function LoginPage() {
  const [method, setMethod] = useState("password");
  const [mode, setMode] = useState("signin");
  const [form, setForm] = useState({ email: "", password: "", confirmPassword: "" });
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const copy = authModeCopy[mode];

  function switchMode(nextMode) {
    setMode(nextMode);
    setMessage(null);
  }

  async function handleGoogleLogin() {
    trackEvent("google_login_clicked", { source_page: "login" });
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin
      }
    });

    if (error) {
      console.error("Google login error:", error.message);
      setMessage({ type: "error", text: error.message });
    }
  }

  async function handleSignIn(event) {
    event.preventDefault();
    setMessage(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: form.email.trim(),
      password: form.password
    });

    setLoading(false);

    if (error) {
      const text = /invalid login credentials/i.test(error.message)
        ? "Incorrect email or password. If you just signed up, confirm your email first."
        : error.message;
      setMessage({ type: "error", text });
      return;
    }

    trackEvent("login_submitted", { method: "password" });
    // Success: the auth state listener loads inventory and navigates to the dashboard.
  }

  async function handleSignUp(event) {
    event.preventDefault();
    setMessage(null);

    if (form.password.length < 8) {
      setMessage({ type: "error", text: "Password must be at least 8 characters." });
      return;
    }
    if (form.password !== form.confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match." });
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        emailRedirectTo: window.location.origin
      }
    });

    setLoading(false);

    if (error) {
      setMessage({ type: "error", text: error.message });
      return;
    }

    trackEvent("signup_submitted", { method: "password" });

    // Supabase returns a user with no identities when the email is already registered.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setMessage({ type: "error", text: "An account with this email already exists. Try logging in instead." });
      return;
    }

    // With email confirmation disabled Supabase returns a live session and the
    // auth listener takes over; otherwise the user needs to confirm first.
    if (!data.session) {
      setMessage({ type: "success", text: `Almost there — we sent a confirmation link to ${form.email.trim()}. Open it to activate your account, then log in here.` });
      setMode("signin");
    }
  }

  async function handleForgotPassword(event) {
    event.preventDefault();
    setMessage(null);

    const email = form.email.trim();
    if (!email) {
      setMessage({ type: "error", text: "Enter your email address first." });
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });

    setLoading(false);

    if (error) {
      setMessage({ type: "error", text: error.message });
      return;
    }

    trackEvent("password_reset_requested", { source_page: "login" });
    setMessage({ type: "success", text: `If an account exists for ${email}, a reset link is on its way. Open it to choose a new password.` });
  }

  const submitHandler = mode === "signup" ? handleSignUp : mode === "forgot" ? handleForgotPassword : handleSignIn;

  return (
    <section className="mx-auto grid max-w-6xl gap-8 px-6 py-12 md:grid-cols-[0.9fr_1.1fr] md:items-start">
      <div>
        <h1 className="text-5xl font-semibold tracking-tight">{copy.heading}</h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-[#665746]">{copy.sub}</p>
      </div>

      <Card className="rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-xl">
        <CardContent className="p-7">
          <div className="mb-6 grid grid-cols-2 rounded-full border border-[#d8c7ad] bg-[#fff8ee] p-1">
            <TabButton active={method === "password"} onClick={() => setMethod("password")}>Email</TabButton>
            <TabButton active={method === "google"} onClick={() => setMethod("google")}>Google</TabButton>
          </div>

          {method === "google" ? (
            <div>
              <h2 className="text-2xl font-semibold">Continue with Google</h2>
              <p className="mt-3 leading-7 text-[#665746]">
                Continue with your Google account to access your collection. New here? This also creates your account.
              </p>
              <AuthMessage message={message} />
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="mt-6 flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-[#cdbb9c] bg-white px-6 text-base font-semibold text-[#123f38] shadow-sm transition hover:bg-[#f8f4ec] hover:shadow-md active:scale-[0.99]"
              >
                <Icon name="google" size={20} />
                <span>Continue with Google</span>
              </button>
            </div>
          ) : (
            <form onSubmit={submitHandler}>
              <h2 className="text-2xl font-semibold">{copy.formTitle}</h2>
              <p className="mt-3 leading-7 text-[#665746]">{copy.formSub}</p>
              <AuthMessage message={message} />
              <div className="mt-6 grid gap-4">
                <Field label="Email" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
                {mode !== "forgot" && (
                  <Field label="Password" type="password" value={form.password} onChange={(value) => setForm({ ...form, password: value })} />
                )}
                {mode === "signup" && (
                  <Field label="Confirm password" type="password" value={form.confirmPassword} onChange={(value) => setForm({ ...form, confirmPassword: value })} />
                )}
              </div>
              <Button type="submit" disabled={loading} className="mt-6 h-12 w-full rounded-full bg-[#123f38] px-6 text-[#fff7ea] hover:bg-[#0f332d]">
                {loading ? copy.submitting : copy.submit}
              </Button>

              <div className="mt-5 flex flex-col gap-2 text-sm text-[#665746]">
                {mode === "signin" && (
                  <>
                    <div>New to FirstFinder? <AuthLink onClick={() => switchMode("signup")}>Create an account</AuthLink></div>
                    <div><AuthLink onClick={() => switchMode("forgot")}>Forgot your password?</AuthLink></div>
                  </>
                )}
                {mode === "signup" && (
                  <div>Already have an account? <AuthLink onClick={() => switchMode("signin")}>Log in</AuthLink></div>
                )}
                {mode === "forgot" && (
                  <div>Remembered it? <AuthLink onClick={() => switchMode("signin")}>Back to log in</AuthLink></div>
                )}
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function ResetPasswordPage({ onDone }) {
  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage(null);

    if (form.password.length < 8) {
      setMessage({ type: "error", text: "Password must be at least 8 characters." });
      return;
    }
    if (form.password !== form.confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match." });
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password: form.password });

    setLoading(false);

    if (error) {
      setMessage({ type: "error", text: error.message });
      return;
    }

    setDone(true);
    setMessage({ type: "success", text: "Password updated. You're logged in and ready to go." });
  }

  return (
    <section className="mx-auto grid max-w-6xl gap-8 px-6 py-12 md:grid-cols-[0.9fr_1.1fr] md:items-start">
      <div>
        <h1 className="text-5xl font-semibold tracking-tight">Choose a new password.</h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-[#665746]">
          You followed a password reset link. Set a new password below to finish.
        </p>
      </div>

      <Card className="rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-xl">
        <CardContent className="p-7">
          <h2 className="text-2xl font-semibold">New password</h2>
          <p className="mt-3 leading-7 text-[#665746]">Use at least 8 characters.</p>
          <AuthMessage message={message} />
          {done ? (
            <Button onClick={onDone} className="mt-6 h-12 w-full rounded-full bg-[#123f38] px-6 text-[#fff7ea] hover:bg-[#0f332d]">
              Go to my collection
            </Button>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="mt-6 grid gap-4">
                <Field label="New password" type="password" value={form.password} onChange={(value) => setForm({ ...form, password: value })} />
                <Field label="Confirm new password" type="password" value={form.confirmPassword} onChange={(value) => setForm({ ...form, confirmPassword: value })} />
              </div>
              <Button type="submit" disabled={loading} className="mt-6 h-12 w-full rounded-full bg-[#123f38] px-6 text-[#fff7ea] hover:bg-[#0f332d]">
                {loading ? "Updating..." : "Update password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function FeedbackPage({ currentUser, pushToast }) {
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  function handleUpload(event) {
    const files = Array.from(event.target.files || []);
    const nextPhotos = files.map((file) => ({
      id: `feedback-${file.name}-${Date.now()}-${Math.random()}`,
      name: file.name,
      url: URL.createObjectURL(file),
      file
    }));
    setPhotos((current) => [...current, ...nextPhotos]);
    event.target.value = "";
  }

  function removePhoto(id) {
    setPhotos((current) => {
      const photo = current.find((entry) => entry.id === id);
      if (photo) URL.revokeObjectURL(photo.url);
      return current.filter((entry) => entry.id !== id);
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!description.trim()) {
      pushToast("Add a description before sending feedback.", "error");
      return;
    }

    if (!currentUser) {
      pushToast("Please log in before sending feedback.", "error");
      return;
    }

    setSubmitting(true);

    try {
      const { data, error } = await supabase
        .from("feedback")
        .insert({ user_id: currentUser.id, description: description.trim() })
        .select()
        .single();

      if (error) {
        console.error("Feedback submit error:", error.message);
        pushToast(error.message, "error");
        return;
      }

      if (photos.length > 0) {
        // Feedback photos reuse the inventory item-photos bucket, under
        // <user_id>/feedback/<feedback_id>/... -- the bucket's existing
        // owner-only policies only check the first path segment, so no
        // new bucket or storage policy is needed for this.
        const result = await uploadPhotoList(currentUser.id, `feedback/${data.id}`, photos, "feedback");

        const { error: updateError } = await supabase
          .from("feedback")
          .update({ photos: result.uploaded, updated_at: new Date().toISOString() })
          .eq("id", data.id);

        if (updateError) console.error("Feedback photo update error:", updateError.message);

        if (result.failures.length > 0) {
          pushToast(`Feedback sent, but some photos failed to upload: ${result.failures.join(", ")}.`, "warning");
        }
      }

      trackEvent("feedback_submitted", { has_photos: photos.length > 0 });

      clearPhotoUrls(photos);
      setDescription("");
      setPhotos([]);
      pushToast("Thanks — your feedback was sent.", "success");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-5xl font-semibold tracking-tight">Send feedback.</h1>
      <p className="mt-4 max-w-2xl text-lg leading-8 text-[#665746]">
        Found a bug or have an idea? Describe what happened and attach a screenshot or photo if it helps.
      </p>

      <Card className="mt-8 rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-xl">
        <CardContent className="p-6 md:p-8">
          <form onSubmit={handleSubmit}>
            <TextAreaField
              label="What's going on?"
              value={description}
              onChange={setDescription}
              placeholder="Tell us what happened, what you expected, and any steps to reproduce it."
            />

            <div className="mt-6">
              <CompactUploader title="Attach photos (optional)" icon="camera" photos={photos} onUpload={handleUpload} onRemove={removePhoto} />
            </div>

            <Button type="submit" disabled={submitting} className="mt-6 h-11 w-full rounded-full bg-[#123f38] px-5 font-medium text-[#fff7ea] hover:bg-[#0f332d]">
              {submitting ? "Sending..." : "Send feedback"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-sm text-[#665746]">
        Prefer email? Reach us directly at <a href="mailto:thebookbarterer@gmail.com" className="font-medium text-[#123f38] underline underline-offset-4 hover:text-[#0f332d]">thebookbarterer@gmail.com</a>.
      </p>
    </section>
  );
}

function formatAccountDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function MyAccountPage({ currentUser, inventory, pushToast }) {
  const [name, setName] = useState(currentUser?.user_metadata?.full_name || currentUser?.user_metadata?.name || "");
  const [savingName, setSavingName] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const firstItem =
    inventory.length > 0
      ? [...inventory].sort((a, b) => new Date(a.savedAt) - new Date(b.savedAt))[0]
      : null;

  async function handleSaveName(event) {
    event.preventDefault();
    setSavingName(true);

    const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim() } });

    setSavingName(false);

    if (error) {
      pushToast(error.message, "error");
      return;
    }

    trackEvent("account_name_updated");
    pushToast("Name updated.", "success");
  }

  async function handleDeleteAccount() {
    setDeletingAccount(true);
    trackEvent("delete_account_initiated");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        pushToast("Please log in again before deleting your account.", "error");
        return;
      }

      const response = await fetch("/api/delete-account", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        pushToast(result.error || "Could not delete your account. Please try again.", "error");
        return;
      }

      trackEvent("delete_account_completed");
      await supabase.auth.signOut();
      // Full reload so every bit of app state (inventory, session, etc.)
      // clears cleanly rather than trying to unwind it all in React state.
      window.location.href = "/";
    } catch (error) {
      console.error("Delete account request error:", error.message);
      pushToast("Could not reach the server to delete your account. Please try again.", "error");
    } finally {
      setDeletingAccount(false);
    }
  }

  return (
    <section className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-5xl font-semibold tracking-tight">My account.</h1>
      <p className="mt-4 max-w-2xl text-lg leading-8 text-[#665746]">Your profile and account settings.</p>

      <Card className="mt-8 rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-xl">
        <CardContent className="p-6 md:p-8">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-[#7d6c5a]">Member since</div>
              <div className="mt-1 text-lg font-semibold">{formatAccountDate(currentUser?.created_at)}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-[#7d6c5a]">Email</div>
              <div className="mt-1 text-lg font-semibold">{currentUser?.email}</div>
            </div>
            <div className="sm:col-span-2">
              <div className="text-xs uppercase tracking-[0.16em] text-[#7d6c5a]">First collectible loaded</div>
              {firstItem ? (
                <>
                  <div className="mt-1 text-lg font-semibold">{firstItem.name || "Untitled item"}</div>
                  <div className="text-sm text-[#665746]">{formatAccountDate(firstItem.savedAt)}</div>
                </>
              ) : (
                <div className="mt-1 text-lg font-semibold text-[#8a7a64]">None yet</div>
              )}
            </div>
          </div>

          <form onSubmit={handleSaveName} className="mt-6 flex flex-col gap-3 border-t border-[#e0d2bc] pt-6 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Field label="Name" value={name} onChange={setName} />
            </div>
            <Button type="submit" disabled={savingName} className="h-11 rounded-full bg-[#123f38] px-6 text-[#fff7ea] hover:bg-[#0f332d]">
              {savingName ? "Saving..." : "Save name"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6 rounded-[2rem] border-[#e2b6a1] bg-[#fbf1ec] shadow-sm">
        <CardContent className="p-6 md:p-8">
          <div className="text-sm uppercase tracking-[0.18em] text-[#8a3b22]">Danger zone</div>
          <h2 className="mt-1 text-2xl font-semibold">Delete your account</h2>
          <p className="mt-3 leading-7 text-[#665746]">
            Permanently deletes your login, your entire collection, all saved photos, and any feedback you've sent. This can't be undone.
          </p>
          <Button onClick={() => setShowDeleteDialog(true)} className="mt-5 h-11 rounded-full bg-[#8a3b22] px-6 text-[#fff7ea] hover:bg-[#7a331d]">
            Delete my account
          </Button>
        </CardContent>
      </Card>

      {showDeleteDialog && (
        <DeleteAccountDialog
          deleting={deletingAccount}
          onCancel={() => setShowDeleteDialog(false)}
          onConfirm={handleDeleteAccount}
        />
      )}
    </section>
  );
}

function DeleteAccountDialog({ deleting, onCancel, onConfirm }) {
  const [confirmText, setConfirmText] = useState("");
  const canConfirm = confirmText.trim().toUpperCase() === "DELETE";

  return (
    <ModalShell onClose={deleting ? () => {} : onCancel} contentClassName="max-w-md">
      <div className="text-sm uppercase tracking-[0.18em] text-[#8a3b22]">Delete account</div>
      <h2 className="mt-1 text-2xl font-semibold">Are you sure?</h2>
      <p className="mt-3 leading-7 text-[#665746]">
        This permanently deletes your login, your entire collection, all saved photos, and any feedback you've sent. There is no way to undo this.
      </p>
      <p className="mt-4 text-sm font-medium text-[#665746]">Type DELETE to confirm.</p>
      <input
        value={confirmText}
        onChange={(event) => setConfirmText(event.target.value)}
        className="mt-2 w-full rounded-2xl border border-[#e2b6a1] bg-white px-4 py-3 outline-none focus:border-[#8a3b22] focus:ring-2 focus:ring-[#8a3b22]/15"
        placeholder="DELETE"
        autoFocus
      />
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={deleting} className="h-11 rounded-full border-[#cdbb9d] bg-[#fff8ee] px-6 hover:bg-white">
          Cancel
        </Button>
        <Button type="button" onClick={onConfirm} disabled={!canConfirm || deleting} className="h-11 rounded-full bg-[#8a3b22] px-6 text-[#fff7ea] hover:bg-[#7a331d]">
          {deleting ? "Deleting..." : "Permanently delete my account"}
        </Button>
      </div>
    </ModalShell>
  );
}

function DashboardPage({ quickItem, setQuickItem, quickItemPhotos, quickReceiptPhotos, onUpload, onRemove, onSave, saving, onFullAdd, onInventory, inventory, totalCostBasis, totalGain, autofillMessage, onDownloadTemplate, onBulkUpload, bulkUploading, bulkMessage }) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-5xl font-semibold tracking-tight">Add something quickly.</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-[#665746]">Use quick add for most items. Upload a photo to mock-autofill fields, use CSV for bulk import, or open the tutorial for the guided flow.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            onClick={() => {
              trackEvent("quick_add_clicked", {
                location: "add_inventory_header"
              });

              const quickAddForm = document.getElementById("quick-add-form");
              if (quickAddForm) {
                quickAddForm.scrollIntoView({ behavior: "smooth", block: "start" });
              }
            }}
            className="rounded-full bg-[#123f38] px-6 text-[#fff7ea] hover:bg-[#0f332d]"
          >
            Quick Add
          </Button>
          <Button onClick={onInventory} className="rounded-full bg-[#123f38] px-6 text-[#fff7ea] hover:bg-[#0f332d]">Inventory</Button>
          <Button onClick={onFullAdd} variant="outline" className="rounded-full border-[#cdbb9d] bg-[#fff8ee] px-6 hover:bg-white">Add Item</Button>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <DashboardCard icon="box" label="Active inventory" value={inventory.length} />
        <DashboardCard icon="receipt" label="Cost basis" value={formatCurrency(totalCostBasis)} />
        <DashboardCard icon="dollar" label="Est. gain/loss" value={formatCurrency(totalGain)} />
      </div>

      <div id="quick-add-form" className="scroll-mt-24">
        <Card className="mt-8 rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-xl">
          <CardContent className="p-6 md:p-8">
            <form onSubmit={onSave}>
            <div>
              <div className="text-sm uppercase tracking-[0.18em] text-[#7d6c5a]">Quick add</div>
              <h2 className="mt-1 text-3xl font-semibold">New collectible</h2>
            </div>

            {autofillMessage && <div className="mt-5 rounded-2xl bg-[#edf4f2] p-4 text-sm leading-6 text-[#123f38]">{autofillMessage}</div>}

            <div className="mt-6 grid gap-3 md:grid-cols-4">
              <Field label="Item name" value={quickItem.name} onChange={(value) => setQuickItem({ ...quickItem, name: value })} />
              <SelectField label="Category" value={quickItem.category} options={quickCategories} onChange={(value) => setQuickItem({ ...quickItem, category: value })} />
              <Field label="Cost basis" type="number" value={quickItem.purchasePrice} onChange={(value) => setQuickItem({ ...quickItem, purchasePrice: value })} />
              <Field
                label={quickItem.status === "Sold" ? "Sold for" : "Estimated value"}
                type="number"
                value={quickItem.status === "Sold" ? quickItem.soldPrice : quickItem.estimatedValue}
                onChange={(value) => setQuickItem({ ...quickItem, [quickItem.status === "Sold" ? "soldPrice" : "estimatedValue"]: value })}
              />
              <Field label="Maker / Author / Brand" value={quickItem.maker} onChange={(value) => setQuickItem({ ...quickItem, maker: value })} />
              <Field label="Where purchased" value={quickItem.source} onChange={(value) => setQuickItem({ ...quickItem, source: value })} />
              <Field label="Purchase date" type="date" value={quickItem.purchaseDate} onChange={(value) => setQuickItem({ ...quickItem, purchaseDate: value })} />
              <SelectField label="Status" value={quickItem.status} options={statuses} onChange={(value) => setQuickItem((current) => ({ ...current, status: value, soldDate: value === "Sold" && !current.soldDate ? todayIso() : current.soldDate }))} />
              {quickItem.status === "Sold" && (
                <Field label="Sold on" type="date" value={quickItem.soldDate} onChange={(value) => setQuickItem({ ...quickItem, soldDate: value })} />
              )}
              <SelectField label="Condition" value={quickItem.condition} options={conditionOptions} placeholder="Not set" onChange={(value) => setQuickItem({ ...quickItem, condition: value })} />
            </div>

            {quickItem.category === "Book" && (
              <div className="mt-3 grid gap-3 md:grid-cols-4">
                <Field label="Genre" value={quickItem.bookGenre} onChange={(value) => setQuickItem({ ...quickItem, bookGenre: value })} />
                <SelectField label="Edition" value={quickItem.bookEdition} options={bookEditionOptions} placeholder="Select edition" onChange={(value) => setQuickItem({ ...quickItem, bookEdition: value })} />
                <SelectField label="Printing" value={quickItem.bookPrinting} options={bookPrintingOptions} placeholder="Select printing" onChange={(value) => setQuickItem({ ...quickItem, bookPrinting: value })} />
              </div>
            )}

            <div className="mt-5">
              <Field label="Notes" value={quickItem.notes} onChange={(value) => setQuickItem({ ...quickItem, notes: value })} />
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <CompactUploader title="Item photo + autofill" icon="camera" photos={quickItemPhotos} onUpload={(event) => onUpload(event, "quickItem", true)} onRemove={(id) => onRemove(id, "quickItem")} />
              <CompactUploader title="Receipt proof + autofill" icon="receipt" photos={quickReceiptPhotos} onUpload={(event) => onUpload(event, "quickReceipt", true)} onRemove={(id) => onRemove(id, "quickReceipt")} />
            </div>

            <Button type="submit" disabled={saving} className="mt-6 h-11 w-full rounded-full bg-[#123f38] px-5 font-medium text-[#fff7ea] hover:bg-[#0f332d]">
              {saving ? "Saving photos..." : "Submit"}
            </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <BulkUploadCard onDownloadTemplate={onDownloadTemplate} onBulkUpload={onBulkUpload} bulkUploading={bulkUploading} bulkMessage={bulkMessage} />
      </div>
    </section>
  );
}

function FullAddPage({ item, setItem, itemPhotos, receiptPhotos, onUpload, onRemove, onSave, saving, onReset, onLoadSample, autofillMessage }) {
  return (
    <section className="mx-auto grid max-w-6xl gap-8 px-6 py-10 lg:grid-cols-[0.82fr_1.18fr] lg:py-16">
      <div><motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}><h1 className="max-w-3xl text-5xl font-semibold leading-[0.98] tracking-tight md:text-6xl">Add the complete record.</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-[#665746]">Use this guided tutorial when you want to capture every field, item photo, and receipt/proof image before saving.</p></motion.div><Card className="mt-8 rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-sm"><CardContent className="p-6"><h2 className="text-xl font-semibold">Try a sample</h2><div className="mt-4 grid gap-3">{sampleItems.map((sample) => <button key={sample.name} onClick={() => onLoadSample(sample)} className={`rounded-2xl border p-4 text-left transition hover:bg-white ${item.name === sample.name ? "border-[#123f38] bg-white" : "border-[#e0d2bc] bg-[#f8f0e4]"}`}><div className="font-semibold">{sample.name}</div><div className="text-sm text-[#665746]">{sample.category} · {sample.source}</div></button>)}</div></CardContent></Card></div>
      <div className="space-y-5"><Card className="rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-xl"><CardContent className="p-6"><div className="flex items-start justify-between gap-4"><div><div className="text-sm uppercase tracking-[0.18em] text-[#7d6c5a]">Step 1</div><h2 className="mt-1 text-2xl font-semibold">Item record</h2></div><div className="rounded-full bg-[#edf4f2] px-3 py-1 text-sm font-medium text-[#123f38]">Detailed</div></div>{autofillMessage && <div className="mt-5 rounded-2xl bg-[#edf4f2] p-4 text-sm leading-6 text-[#123f38]">{autofillMessage}</div>}<div className="mt-5 grid gap-3 md:grid-cols-2"><Field label="Item name" value={item.name} onChange={(value) => setItem({ ...item, name: value })} /><Field label="Category" value={item.category} onChange={(value) => setItem({ ...item, category: value })} /><Field label="Maker / Author / Brand" value={item.maker} onChange={(value) => setItem({ ...item, maker: value })} />{item.category === "Book" ? (<><Field label="Genre" value={item.bookGenre} onChange={(value) => setItem({ ...item, bookGenre: value })} /><SelectField label="Edition" value={item.bookEdition} options={bookEditionOptions} placeholder="Select edition" onChange={(value) => setItem({ ...item, bookEdition: value })} /><SelectField label="Printing" value={item.bookPrinting} options={bookPrintingOptions} placeholder="Select printing" onChange={(value) => setItem({ ...item, bookPrinting: value })} /></>) : (<Field label="Edition / Variant / Details" value={item.edition} onChange={(value) => setItem({ ...item, edition: value })} />)}<SelectField label="Status" value={item.status} options={statuses} onChange={(value) => setItem((current) => ({ ...current, status: value, soldDate: value === "Sold" && !current.soldDate ? todayIso() : current.soldDate }))} />{item.status === "Sold" && (<Field label="Sold on" type="date" value={item.soldDate} onChange={(value) => setItem({ ...item, soldDate: value })} />)}<SelectField label="Condition" value={item.condition} options={conditionOptions} placeholder="Not set" onChange={(value) => setItem({ ...item, condition: value })} /><Field label="Purchase date" type="date" value={item.purchaseDate} onChange={(value) => setItem({ ...item, purchaseDate: value })} /><Field label="Where purchased" value={item.source} onChange={(value) => setItem({ ...item, source: value })} /><Field label="Cost basis / purchase price" type="number" value={item.purchasePrice} onChange={(value) => setItem({ ...item, purchasePrice: value })} /><Field label={item.status === "Sold" ? "Sold for" : "Estimated value"} type="number" value={item.status === "Sold" ? item.soldPrice : item.estimatedValue} onChange={(value) => setItem({ ...item, [item.status === "Sold" ? "soldPrice" : "estimatedValue"]: value })} /><Field label="Notes" value={item.notes} onChange={(value) => setItem({ ...item, notes: value })} /></div></CardContent></Card><div className="grid gap-5 md:grid-cols-2"><PhotoUploader title="Item photos + autofill" eyebrow="Step 2" description="Capture condition, edition points, signatures, defects, tags, labels, or packaging. The first uploaded image can mock-autofill fields." prompts={itemPhotoPrompts} photos={itemPhotos} onUpload={(event) => onUpload(event, "item", true)} onRemove={(id) => onRemove(id, "item")} /><PhotoUploader title="Receipt / proof photos + autofill" eyebrow="Step 3" description="Save receipts, invoices, order confirmations, auction records, or payment screenshots. Receipt uploads can mock-autofill cost basis." prompts={receiptPhotoPrompts} photos={receiptPhotos} onUpload={(event) => onUpload(event, "receipt", true)} onRemove={(id) => onRemove(id, "receipt")} /></div><Card className="rounded-[2rem] border-[#d8c7ad] bg-white shadow-xl"><CardContent className="p-6"><div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between"><div><div className="text-sm uppercase tracking-[0.18em] text-[#7d6c5a]">Step 4</div><h2 className="mt-1 text-3xl font-semibold">Review and save</h2><p className="mt-3 max-w-xl leading-7 text-[#665746]">{item.name || "This item"} has a cost basis of {formatCurrency(item.purchasePrice)} and {item.status === "Sold" ? <>sold for {formatEstimatedValue(item)}. Realized gain/loss is {formatGain(calculateGain(item))}.</> : <>an estimated value of {formatEstimatedValue(item)}. Current estimated gain/loss is {formatGain(calculateGain(item))}.</>}</p></div><div className="rounded-3xl bg-[#f7efe3] p-5 text-center"><div className="text-3xl font-semibold text-[#123f38]">{formatGain(calculateGain(item))}</div><div className="mt-1 text-sm text-[#665746]">{item.status === "Sold" ? "realized gain/loss" : "est. gain/loss"}</div></div></div><div className="mt-6 grid gap-3 md:grid-cols-3"><SummaryPill label="Item photos" value={itemPhotos.length} /><SummaryPill label="Receipt photos" value={receiptPhotos.length} /><SummaryPill label="Status" value={item.status} /></div>{receiptPhotos.length === 0 && <div className="mt-5 rounded-2xl bg-[#fff3d8] p-4 text-sm leading-6 text-[#6d5526]">Add a receipt or proof photo if you want documentation for cost basis later.</div>}<div className="mt-6 flex flex-col gap-3 sm:flex-row"><Button onClick={onSave} disabled={saving} className="h-11 rounded-full bg-[#123f38] px-6 text-[#fff7ea] hover:bg-[#0f332d]"><Icon name="save" size={17} className="mr-2" /> {saving ? "Saving photos..." : "Save to inventory"}</Button><Button variant="outline" onClick={onReset} className="h-11 rounded-full border-[#cdbb9d] bg-[#fff8ee] px-6 hover:bg-white">Reset form</Button></div></CardContent></Card></div>
    </section>
  );
}

function InventoryPage({ inventory, filteredInventory, searchTerm, setSearchTerm, viewMode, setViewMode, statusView, setStatusView, activeCount, soldCount, totalCostBasis, totalEstimatedValue, totalGain, onAdd, onExport, onDelete, onMarkSold, onRestoreSold, onEdit, bulkMessage }) {
  const [photoViewer, setPhotoViewer] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [pendingMarkSold, setPendingMarkSold] = useState(null);
  const [markingSold, setMarkingSold] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("All categories");
  const [genreFilter, setGenreFilter] = useState("All genres");
  const [editionFilter, setEditionFilter] = useState("All editions");
  const [printingFilter, setPrintingFilter] = useState("All printings");

  const genreOptions = useMemo(
    () => Array.from(new Set(inventory.map((entry) => entry.bookGenre).filter(Boolean))).sort(),
    [inventory]
  );
  const editionOptions = useMemo(
    () => Array.from(new Set(inventory.map((entry) => entry.bookEdition).filter(Boolean))).sort(),
    [inventory]
  );
  const printingOptions = useMemo(
    () => Array.from(new Set(inventory.map((entry) => entry.bookPrinting).filter(Boolean))).sort(),
    [inventory]
  );

  const displayedInventory = filteredInventory
    .filter((entry) => categoryFilter === "All categories" || entry.category === categoryFilter)
    .filter((entry) => genreFilter === "All genres" || entry.bookGenre === genreFilter)
    .filter((entry) => editionFilter === "All editions" || entry.bookEdition === editionFilter)
    .filter((entry) => printingFilter === "All printings" || entry.bookPrinting === printingFilter);

  const activeFilters = [
    categoryFilter !== "All categories" && { label: categoryFilter, clear: () => setCategoryFilter("All categories") },
    genreFilter !== "All genres" && { label: genreFilter, clear: () => setGenreFilter("All genres") },
    editionFilter !== "All editions" && { label: editionFilter, clear: () => setEditionFilter("All editions") },
    printingFilter !== "All printings" && { label: printingFilter, clear: () => setPrintingFilter("All printings") }
  ].filter(Boolean);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await onDelete(pendingDelete.id);
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  async function confirmMarkSold({ soldPrice, soldDate, condition }) {
    if (!pendingMarkSold) return;
    setMarkingSold(true);
    try {
      await onMarkSold(pendingMarkSold.id, { soldPrice, soldDate, condition });
      setPendingMarkSold(null);
    } finally {
      setMarkingSold(false);
    }
  }

  async function handleRestoreSold(id) {
    setBusyId(id);
    try {
      await onRestoreSold(id);
    } finally {
      setBusyId(null);
    }
  }

  const isSoldView = statusView === "sold";

  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-5xl font-semibold tracking-tight">{statusView === "sold" ? "Sold collectibles" : "Your active collectibles"}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-[#665746]">
            {statusView === "sold"
              ? "Sold items stay preserved here for reporting, resale history, and cost-basis records."
              : "Sold items are removed from active inventory counts and moved into the Sold tab."}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button variant="outline" onClick={() => { trackEvent("insurance_export_viewed"); onExport(); }} className="rounded-full border-[#cdbb9d] bg-[#fff8ee] px-6 hover:bg-white"><Icon name="file" size={16} className="mr-2" /> Export for insurance</Button>
          <Button onClick={onAdd} className="rounded-full bg-[#123f38] px-6 text-[#fff7ea] hover:bg-[#0f332d]">Add inventory</Button>
        </div>
      </div>

      {bulkMessage && <div className="mt-6 rounded-2xl bg-[#edf4f2] p-4 text-sm leading-6 text-[#123f38]">{bulkMessage}</div>}

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <DashboardCard icon="receipt" label={isSoldView ? "Sold cost basis" : "Active cost basis"} value={formatCurrency(totalCostBasis)} />
        <DashboardCard icon="dollar" label={isSoldView ? "Sold for (total)" : "Active estimated value"} value={formatCurrency(totalEstimatedValue)} />
        <DashboardCard icon="search" label={isSoldView ? "Realized gain/loss" : "Active est. gain/loss"} value={formatCurrency(totalGain)} />
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <div className="rounded-2xl border border-[#d8c7ad] bg-[#fff8ee] p-3">
          <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3">
            <Icon name="search" size={18} className="text-[#746655]" />
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search by item, category, maker, source, or status..." className="w-full bg-transparent outline-none" />
          </div>
        </div>

        <select
          value={categoryFilter}
          onChange={(event) => { trackEvent("inventory_filter_changed", { filter: "category", value: event.target.value }); setCategoryFilter(event.target.value); }}
          className="mt-[10px] h-[48px] rounded-full border border-[#d8c7ad] bg-[#fff8ee] px-4 text-sm font-medium text-[#201a14] outline-none"
        >
          <option>All categories</option>
          {quickCategories.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>

        <div className="mt-[10px] flex h-[48px] items-center gap-2 rounded-full border border-[#d8c7ad] bg-[#fff8ee] p-1">
          <TabButton active={viewMode === "cards"} onClick={() => { trackEvent("inventory_view_changed", { view_mode: "cards" }); setViewMode("cards"); }}>Cards</TabButton>
          <TabButton active={viewMode === "records"} onClick={() => { trackEvent("inventory_view_changed", { view_mode: "records" }); setViewMode("records"); }}>Records</TabButton>
        </div>
      </div>

      {(genreOptions.length > 0 || editionOptions.length > 0 || printingOptions.length > 0) && (
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {genreOptions.length > 0 && (
            <select
              value={genreFilter}
              onChange={(event) => { trackEvent("inventory_filter_changed", { filter: "genre", value: event.target.value }); setGenreFilter(event.target.value); }}
              className="h-[44px] rounded-full border border-[#d8c7ad] bg-[#fff8ee] px-4 text-sm font-medium text-[#201a14] outline-none"
            >
              <option>All genres</option>
              {genreOptions.map((genre) => <option key={genre} value={genre}>{genre}</option>)}
            </select>
          )}
          {editionOptions.length > 0 && (
            <select
              value={editionFilter}
              onChange={(event) => { trackEvent("inventory_filter_changed", { filter: "edition", value: event.target.value }); setEditionFilter(event.target.value); }}
              className="h-[44px] rounded-full border border-[#d8c7ad] bg-[#fff8ee] px-4 text-sm font-medium text-[#201a14] outline-none"
            >
              <option>All editions</option>
              {editionOptions.map((edition) => <option key={edition} value={edition}>{edition}</option>)}
            </select>
          )}
          {printingOptions.length > 0 && (
            <select
              value={printingFilter}
              onChange={(event) => { trackEvent("inventory_filter_changed", { filter: "printing", value: event.target.value }); setPrintingFilter(event.target.value); }}
              className="h-[44px] rounded-full border border-[#d8c7ad] bg-[#fff8ee] px-4 text-sm font-medium text-[#201a14] outline-none"
            >
              <option>All printings</option>
              {printingOptions.map((printing) => <option key={printing} value={printing}>{printing}</option>)}
            </select>
          )}
        </div>
      )}

      {activeFilters.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[#665746]">
          Filtering by
          {activeFilters.map((filter) => (
            <span key={filter.label} className="flex items-center gap-2 rounded-full bg-[#f0e2cf] px-3 py-1 font-medium text-[#665746]">
              {filter.label}
              <button type="button" onClick={filter.clear} className="text-[#123f38] underline underline-offset-4 hover:text-[#0f332d]">Clear</button>
            </span>
          ))}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between gap-3 rounded-[2rem] border border-[#d8c7ad] bg-[#fff8ee] p-2">
        <div className="text-sm text-[#665746]">
          Showing {statusView === "sold" ? "sold records" : "active inventory"}
        </div>
        <div className="flex items-center gap-2 rounded-full border border-[#d8c7ad] bg-[#fff8ee] p-1">
          <TabButton active={statusView === "active"} onClick={() => setStatusView("active")}>Active ({activeCount})</TabButton>
          <TabButton active={statusView === "sold"} onClick={() => setStatusView("sold")}>Sold ({soldCount})</TabButton>
        </div>
      </div>

      {inventory.length === 0 ? (
        <Card className="mt-8 rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-sm">
          <CardContent className="p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#123f38] text-[#fff7ea]"><Icon name="receipt" size={26} /></div>
            <h2 className="mt-5 text-2xl font-semibold">No active inventory</h2>
            <p className="mx-auto mt-3 max-w-md leading-7 text-[#665746]">Add an item or import a CSV to start building your cost-basis record.</p>
          </CardContent>
        </Card>
      ) : displayedInventory.length === 0 ? (
        <Card className="mt-8 rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-sm">
          <CardContent className="p-8 text-center"><h2 className="text-2xl font-semibold">No matches</h2><p className="mt-3 text-[#665746]">Try a different search term or filter.</p></CardContent>
        </Card>
      ) : viewMode === "records" ? (
        <div className="mt-8 overflow-hidden rounded-[2rem] border border-[#d8c7ad] bg-[#fff9f0] shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-[#f0e2cf] text-xs uppercase tracking-[0.14em] text-[#665746]">
                <tr>
                  <th className="px-5 py-4">Item</th>
                  <th className="px-5 py-4">Category</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Cost</th>
                  <th className="px-5 py-4">Value</th>
                  <th className="px-5 py-4">Photos</th>
                  <th className="px-5 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedInventory.map((entry) => (
                  <tr key={entry.id} className="border-t border-[#e0d2bc]">
                    <td className="px-5 py-4"><div className="font-semibold">{entry.name || "Untitled item"}</div><div className="text-[#665746]">{entry.maker || "Unknown maker"}</div></td>
                    <td className="px-5 py-4">{entry.category}</td>
                    <td className="px-5 py-4">{entry.status}</td>
                    <td className="px-5 py-4">{formatCurrency(entry.purchasePrice)}</td>
                    <td className="px-5 py-4">{formatEstimatedValue(entry)}</td>
                    <td className="px-5 py-4">
                      <button type="button" onClick={() => setPhotoViewer(entry)} className="rounded-full bg-[#edf4f2] px-3 py-1 text-xs font-medium text-[#123f38]">
                        View {(entry.itemPhotoCount || 0) + (entry.receiptPhotoCount || 0)}
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => onEdit(entry)} className="px-4 py-2">Edit</Button>
                        {entry.status === "Sold" ? (
                          <Button variant="outline" disabled={busyId === entry.id} onClick={() => handleRestoreSold(entry.id)} className="px-4 py-2">{busyId === entry.id ? "Restoring..." : "Restore"}</Button>
                        ) : (
                          <Button variant="outline" onClick={() => setPendingMarkSold(entry)} className="px-4 py-2">Sold</Button>
                        )}
                        <button onClick={() => setPendingDelete(entry)} className="rounded-full bg-[#f0e2cf] p-2 text-[#665746] hover:bg-[#ead8bf]" aria-label={`Delete ${entry.name || "inventory item"}`}><Icon name="trash" size={17} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {displayedInventory.map((entry) => (
            <Card key={entry.id} className="rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-[#edf4f2] px-3 py-1 text-xs font-medium text-[#123f38]">{entry.status}</span>
                      <span className="rounded-full bg-[#f0e2cf] px-3 py-1 text-xs font-medium text-[#665746]">{entry.category}</span>
                    </div>
                    <h2 className="mt-3 text-2xl font-semibold">{entry.name || "Untitled item"}</h2>
                    <p className="text-[#665746]">{entry.maker || "Unknown maker"}</p>
                  </div>
                  <button onClick={() => setPendingDelete(entry)} className="rounded-full bg-[#f0e2cf] p-2 text-[#665746] hover:bg-[#ead8bf]" aria-label={`Delete ${entry.name || "inventory item"}`}><Icon name="trash" size={17} /></button>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <SmallMetric label="Cost" value={formatCurrency(entry.purchasePrice)} />
                  <SmallMetric label="Value" value={formatEstimatedValue(entry)} />
                  <SmallMetric label="Gain" value={formatGain(calculateGain(entry))} />
                </div>

                {entry.status === "Sold" && hasValue(entry.soldPrice) && (
                  <div className="mt-3 rounded-2xl bg-[#edf4f2] px-4 py-3 text-sm text-[#123f38]">
                    Sold for {formatCurrency(entry.soldPrice)}{entry.soldDate ? ` on ${entry.soldDate}` : ""}
                  </div>
                )}

                <div className="mt-5 rounded-2xl bg-white p-4">
                  <div className="text-sm leading-6 text-[#665746]">{entry.edition || "No edition details"} · Purchased from {entry.source || "unknown source"} on {entry.purchaseDate || "unknown date"}</div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <button type="button" onClick={() => setPhotoViewer(entry)} className={`rounded-full px-3 py-1 ${entry.receiptPhotoCount > 0 ? "bg-[#edf4f2] text-[#123f38]" : "bg-[#fff3d8] text-[#6d5526]"}`}>
                      {entry.receiptPhotoCount > 0 ? `${entry.receiptPhotoCount} receipt proof` : "No receipt proof"}
                    </button>
                    <button type="button" onClick={() => setPhotoViewer(entry)} className="rounded-full bg-[#f0e2cf] px-3 py-1 text-[#665746]">
                      {entry.itemPhotoCount || 0} item photo{entry.itemPhotoCount === 1 ? "" : "s"}
                    </button>
                  </div>
                  {buildSimilarCopyLinks(entry) && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#f0e2cf] pt-3 text-xs">
                      <span className="text-[#7d6c5a]">Find similar copies:</span>
                      <a href={buildSimilarCopyLinks(entry).abebooks} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent("find_similar_copies_clicked", { site: "abebooks", category: entry.category || "Other" })} className="rounded-full bg-[#e6ecf5] px-3 py-1 font-medium text-[#2c3f5c] hover:bg-[#d8e0ee]">AbeBooks ↗</a>
                      <a href={buildSimilarCopyLinks(entry).ebay} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent("find_similar_copies_clicked", { site: "ebay", category: entry.category || "Other" })} className="rounded-full bg-[#fff3d8] px-3 py-1 font-medium text-[#6d5526] hover:bg-[#ffe9bd]">eBay ↗</a>
                    </div>
                  )}
                </div>

                <p className="mt-4 text-sm leading-6 text-[#665746]">{entry.notes}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => onEdit(entry)} className="h-10 rounded-full border-[#cdbb9d] bg-[#fff8ee] px-5 hover:bg-white">Edit</Button>
                  {entry.status === "Sold" ? (
                    <Button variant="outline" disabled={busyId === entry.id} onClick={() => handleRestoreSold(entry.id)} className="h-10 rounded-full border-[#cdbb9d] bg-[#fff8ee] px-5 hover:bg-white">{busyId === entry.id ? "Restoring..." : "Restore to active"}</Button>
                  ) : (
                    <Button variant="outline" onClick={() => setPendingMarkSold(entry)} className="h-10 rounded-full border-[#cdbb9d] bg-[#fff8ee] px-5 hover:bg-white">Mark sold</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {photoViewer && <PhotoViewerModal entry={photoViewer} onClose={() => setPhotoViewer(null)} />}

      {pendingDelete && (
        <DeleteConfirmDialog
          entry={pendingDelete}
          deleting={deleting}
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
        />
      )}

      {pendingMarkSold && (
        <MarkSoldDialog
          entry={pendingMarkSold}
          submitting={markingSold}
          onCancel={() => setPendingMarkSold(null)}
          onConfirm={confirmMarkSold}
        />
      )}
    </section>
  );
}

function InsuranceExportPage({ items, onBack }) {
  const generatedDate = todayIso();
  const totalCostBasis = items.reduce((sum, item) => sum + toNumber(item.purchasePrice), 0);
  const totalEstimatedValue = items.reduce((sum, item) => {
    const value = itemValueForTotals(item);
    return value === null ? sum : sum + value;
  }, 0);

  return (
    <section className="mx-auto max-w-5xl px-6 py-12 print:max-w-none print:px-0 print:py-0">
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">Collection report.</h1>
          <p className="mt-2 max-w-xl text-[#665746]">A printable summary of your active inventory — for insurance, estate planning, or your own records. Use your browser's print dialog to save it as a PDF.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button variant="outline" onClick={onBack} className="rounded-full border-[#cdbb9d] bg-[#fff8ee] px-5 hover:bg-white">Back to inventory</Button>
          <Button onClick={() => { trackEvent("insurance_export_printed", { item_count: items.length }); window.print(); }} className="rounded-full bg-[#123f38] px-5 text-[#fff7ea] hover:bg-[#0f332d]"><Icon name="file" size={16} className="mr-2" /> Print / Save as PDF</Button>
        </div>
      </div>

      <div className="mt-2 hidden print:block">
        <h1 className="text-2xl font-semibold">FirstFinder — Collection Report</h1>
        <p className="mt-1 text-sm text-[#665746]">Generated {generatedDate} · {items.length} item{items.length === 1 ? "" : "s"}</p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3 print:mt-4 print:grid-cols-3 print:gap-2">
        <DashboardCard icon="box" label="Active items" value={items.length} />
        <DashboardCard icon="receipt" label="Total cost basis" value={formatCurrency(totalCostBasis)} />
        <DashboardCard icon="dollar" label="Total estimated value" value={formatCurrency(totalEstimatedValue)} />
      </div>

      <div className="mt-8 overflow-hidden rounded-[2rem] border border-[#d8c7ad] bg-white print:mt-4 print:rounded-none print:border-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm print:min-w-0">
            <thead className="bg-[#f0e2cf] text-xs uppercase tracking-[0.14em] text-[#665746] print:bg-transparent print:text-black">
              <tr>
                <th className="px-4 py-3">Item</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Condition</th>
                <th className="px-4 py-3">Purchased</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Cost</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Photos</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-[#e0d2bc] align-top">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{item.name || "Untitled item"}</div>
                    <div className="text-[#665746]">{item.maker || "Unknown maker"}</div>
                    {item.notes && <div className="mt-1 max-w-xs text-xs text-[#8a7a64]">{item.notes}</div>}
                  </td>
                  <td className="px-4 py-3">{item.category}</td>
                  <td className="px-4 py-3">{item.condition || "—"}</td>
                  <td className="px-4 py-3">{item.purchaseDate || "—"}</td>
                  <td className="px-4 py-3">{item.source || "—"}</td>
                  <td className="px-4 py-3">{formatCurrency(item.purchasePrice)}</td>
                  <td className="px-4 py-3">{formatEstimatedValue(item)}</td>
                  <td className="px-4 py-3">{(item.itemPhotoCount || 0) + (item.receiptPhotoCount || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function DeleteConfirmDialog({ entry, deleting, onCancel, onConfirm }) {
  return (
    <ModalShell onClose={deleting ? () => {} : onCancel} contentClassName="max-w-md">
      <div className="text-sm uppercase tracking-[0.18em] text-[#7d6c5a]">Delete item</div>
      <h2 className="mt-1 text-2xl font-semibold">Delete "{entry.name || "Untitled item"}"?</h2>
      <p className="mt-3 leading-7 text-[#665746]">
        This removes the item and its saved photos permanently. This can't be undone.
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={deleting} className="h-11 rounded-full border-[#cdbb9d] bg-[#fff8ee] px-6 hover:bg-white">
          Cancel
        </Button>
        <Button type="button" onClick={onConfirm} disabled={deleting} className="h-11 rounded-full bg-[#8a3b22] px-6 text-[#fff7ea] hover:bg-[#7a331d]">
          {deleting ? "Deleting..." : "Delete item"}
        </Button>
      </div>
    </ModalShell>
  );
}

function MarkSoldDialog({ entry, submitting, onCancel, onConfirm }) {
  const [soldPrice, setSoldPrice] = useState(entry.estimatedValue || "");
  const [soldDate, setSoldDate] = useState(todayIso());
  const [condition, setCondition] = useState(entry.condition || "");

  function handleSubmit(event) {
    event.preventDefault();
    onConfirm({ soldPrice, soldDate, condition });
  }

  return (
    <ModalShell onClose={submitting ? () => {} : onCancel} contentClassName="max-w-md">
      <div className="text-sm uppercase tracking-[0.18em] text-[#7d6c5a]">Mark sold</div>
      <h2 className="mt-1 text-2xl font-semibold">"{entry.name || "Untitled item"}" sold</h2>
      <p className="mt-3 leading-7 text-[#665746]">
        Capture what it actually sold for so realized gain and the Sold tab totals reflect reality, not the estimate. Leave the price blank if you'd rather skip it for now.
      </p>
      <form onSubmit={handleSubmit}>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Sold for" type="number" value={soldPrice} onChange={setSoldPrice} />
          <Field label="Sold on" type="date" value={soldDate} onChange={setSoldDate} />
          <SelectField label="Condition" value={condition} options={conditionOptions} placeholder="Not set" onChange={setCondition} />
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting} className="h-11 rounded-full border-[#cdbb9d] bg-[#fff8ee] px-6 hover:bg-white">
            Cancel
          </Button>
          <Button type="submit" disabled={submitting} className="h-11 rounded-full bg-[#123f38] px-6 text-[#fff7ea] hover:bg-[#0f332d]">
            {submitting ? "Saving..." : "Mark sold"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

function BulkUploadCard({ onDownloadTemplate, onBulkUpload, bulkUploading, bulkMessage }) {
  return (
    <Card className="rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-sm"><CardContent className="p-6"><div className="inline-flex items-center gap-2 rounded-full bg-[#edf4f2] px-3 py-1 text-sm font-medium text-[#123f38]"><Icon name="file" size={15} /> Bulk upload</div><h2 className="mt-4 text-2xl font-semibold">Import inventory by CSV.</h2><p className="mt-3 leading-7 text-[#665746]">Download the template, fill it out, then upload it here. Photos can be added later item-by-item.</p><div className="mt-5 grid gap-3"><Button type="button" onClick={() => { trackEvent("csv_template_downloaded", { source_page: "add_inventory" }); onDownloadTemplate(); }} variant="outline" className="h-11 rounded-full border-[#cdbb9d] bg-[#fff8ee] px-5 hover:bg-white"><Icon name="file" size={17} className="mr-2" /> Download CSV template</Button><label className={`flex h-11 items-center justify-center rounded-full bg-[#123f38] px-5 font-medium text-[#fff7ea] ${bulkUploading ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-[#0f332d]"}`}><Icon name="upload" size={17} className="mr-2" /> {bulkUploading ? "Importing..." : "Upload CSV"}<input type="file" accept=".csv,text/csv" onChange={onBulkUpload} disabled={bulkUploading} className="hidden" /></label></div>{bulkMessage && <div className="mt-5 rounded-2xl bg-[#edf4f2] p-4 text-sm leading-6 text-[#123f38]">{bulkMessage}</div>}<div className="mt-5 rounded-2xl bg-[#f7efe3] p-4 text-xs leading-6 text-[#665746]"><div className="font-semibold">Template columns</div><div className="mt-1 break-words">{csvHeaders.join(", ")}</div></div></CardContent></Card>
  );
}

function EditItemModal({ item, onClose, onSave, saving }) {
  const [draft, setDraft] = useState({ ...item });
  const [existingItemPhotos, setExistingItemPhotos] = useState((item.itemPhotos || []).map((photo) => ({ ...photo })));
  const [existingReceiptPhotos, setExistingReceiptPhotos] = useState((item.receiptPhotos || []).map((photo) => ({ ...photo })));
  const [newItemPhotos, setNewItemPhotos] = useState([]);
  const [newReceiptPhotos, setNewReceiptPhotos] = useState([]);

  const originalItemPhotoPaths = (item.itemPhotos || []).map((photo) => photo.path).filter(Boolean);
  const originalReceiptPhotoPaths = (item.receiptPhotos || []).map((photo) => photo.path).filter(Boolean);

  useEffect(() => {
    let cancelled = false;

    Promise.all([fetchSignedPhotoUrls(existingItemPhotos), fetchSignedPhotoUrls(existingReceiptPhotos)]).then(
      ([itemResult, receiptResult]) => {
        if (cancelled) return;
        setExistingItemPhotos((current) =>
          current.map((photo) => ({ ...photo, url: itemResult.find((entry) => entry.path === photo.path)?.url || photo.url }))
        );
        setExistingReceiptPhotos((current) =>
          current.map((photo) => ({ ...photo, url: receiptResult.find((entry) => entry.path === photo.path)?.url || photo.url }))
        );
      }
    );

    return () => {
      cancelled = true;
    };
    // Only load signed URLs once, for the photos this modal opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleNewPhotoUpload(event, kind) {
    const files = Array.from(event.target.files || []);
    const nextPhotos = files.map((file) => ({
      id: `${kind}-${file.name}-${Date.now()}-${Math.random()}`,
      name: file.name,
      url: URL.createObjectURL(file),
      file
    }));

    if (kind === "item") setNewItemPhotos((photos) => [...photos, ...nextPhotos]);
    else setNewReceiptPhotos((photos) => [...photos, ...nextPhotos]);
    event.target.value = "";
  }

  function removeNewPhoto(id, kind) {
    const setter = kind === "item" ? setNewItemPhotos : setNewReceiptPhotos;
    setter((photos) => {
      const photo = photos.find((entry) => entry.id === id);
      if (photo) URL.revokeObjectURL(photo.url);
      return photos.filter((entry) => entry.id !== id);
    });
  }

  // Switching status to "Sold" here (rather than via the Mark Sold dialog)
  // should behave the same way: default the sold date to today so the
  // field isn't just sitting there blank.
  function handleStatusChange(value) {
    setDraft((current) => ({
      ...current,
      status: value,
      soldDate: value === "Sold" && !current.soldDate ? todayIso() : current.soldDate
    }));
  }

  function removeExistingPhoto(path, kind) {
    const setter = kind === "item" ? setExistingItemPhotos : setExistingReceiptPhotos;
    setter((photos) => photos.filter((photo) => photo.path !== path));
  }

  function handleClose() {
    clearPhotoUrls(newItemPhotos);
    clearPhotoUrls(newReceiptPhotos);
    onClose();
  }

  function handleSubmit(event) {
    event.preventDefault();

    const removedItemPhotoPaths = originalItemPhotoPaths.filter(
      (path) => !existingItemPhotos.some((photo) => photo.path === path)
    );
    const removedReceiptPhotoPaths = originalReceiptPhotoPaths.filter(
      (path) => !existingReceiptPhotos.some((photo) => photo.path === path)
    );

    onSave({ draft, newItemPhotos, newReceiptPhotos, removedItemPhotoPaths, removedReceiptPhotoPaths });
  }

  return (
    <ModalShell onClose={saving ? () => {} : handleClose} contentClassName="max-h-[88vh] max-w-3xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="text-sm uppercase tracking-[0.18em] text-[#7d6c5a]">Edit record</div>
          <h2 className="mt-1 text-3xl font-semibold">{item.name || "Untitled item"}</h2>
        </div>
        <button onClick={handleClose} disabled={saving} className="rounded-full bg-[#f0e2cf] p-2 text-[#665746] hover:bg-[#ead8bf] disabled:cursor-not-allowed disabled:opacity-40" aria-label="Close edit modal">
          <Icon name="x" size={18} />
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Item name" value={draft.name} onChange={(value) => setDraft({ ...draft, name: value })} />
          <SelectField label="Category" value={draft.category} options={quickCategories} onChange={(value) => setDraft({ ...draft, category: value })} />
          <Field label="Maker / Author / Brand" value={draft.maker} onChange={(value) => setDraft({ ...draft, maker: value })} />
          {draft.category === "Book" ? (
            <>
              <Field label="Genre" value={draft.bookGenre} onChange={(value) => setDraft({ ...draft, bookGenre: value })} />
              <SelectField label="Edition" value={draft.bookEdition} options={bookEditionOptions} placeholder="Select edition" onChange={(value) => setDraft({ ...draft, bookEdition: value })} />
              <SelectField label="Printing" value={draft.bookPrinting} options={bookPrintingOptions} placeholder="Select printing" onChange={(value) => setDraft({ ...draft, bookPrinting: value })} />
            </>
          ) : (
            <Field label="Edition / Variant / Details" value={draft.edition} onChange={(value) => setDraft({ ...draft, edition: value })} />
          )}
          <SelectField label="Status" value={draft.status} options={statuses} onChange={handleStatusChange} />
          <SelectField label="Condition" value={draft.condition} options={conditionOptions} placeholder="Not set" onChange={(value) => setDraft({ ...draft, condition: value })} />
          <Field label="Purchase date" type="date" value={draft.purchaseDate} onChange={(value) => setDraft({ ...draft, purchaseDate: value })} />
          <Field label="Where purchased" value={draft.source} onChange={(value) => setDraft({ ...draft, source: value })} />
          <Field label="Cost basis" type="number" value={draft.purchasePrice} onChange={(value) => setDraft({ ...draft, purchasePrice: value })} />
          <Field
            label={draft.status === "Sold" ? "Sold for" : "Estimated value"}
            type="number"
            value={draft.status === "Sold" ? draft.soldPrice : draft.estimatedValue}
            onChange={(value) => setDraft({ ...draft, [draft.status === "Sold" ? "soldPrice" : "estimatedValue"]: value })}
          />
          {draft.status === "Sold" && (
            <Field label="Sold on" type="date" value={draft.soldDate} onChange={(value) => setDraft({ ...draft, soldDate: value })} />
          )}
          <Field label="Notes" value={draft.notes} onChange={(value) => setDraft({ ...draft, notes: value })} />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <EditPhotoSection
            title="Item photos"
            icon="camera"
            existingPhotos={existingItemPhotos}
            newPhotos={newItemPhotos}
            onUpload={(event) => handleNewPhotoUpload(event, "item")}
            onRemoveExisting={(path) => removeExistingPhoto(path, "item")}
            onRemoveNew={(id) => removeNewPhoto(id, "item")}
          />
          <EditPhotoSection
            title="Receipt proof"
            icon="receipt"
            existingPhotos={existingReceiptPhotos}
            newPhotos={newReceiptPhotos}
            onUpload={(event) => handleNewPhotoUpload(event, "receipt")}
            onRemoveExisting={(path) => removeExistingPhoto(path, "receipt")}
            onRemoveNew={(id) => removeNewPhoto(id, "receipt")}
          />
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={handleClose} disabled={saving} className="h-11 rounded-full border-[#cdbb9d] bg-[#fff8ee] px-6 hover:bg-white">
            Cancel
          </Button>
          <Button type="submit" disabled={saving} className="h-11 rounded-full bg-[#123f38] px-6 text-[#fff7ea] hover:bg-[#0f332d]">
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}

function EditPhotoSection({ title, icon, existingPhotos, newPhotos, onUpload, onRemoveExisting, onRemoveNew }) {
  const total = existingPhotos.length + newPhotos.length;

  return (
    <div className="rounded-2xl border border-[#d8c7ad] bg-[#fffdf8] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold"><Icon name={icon} size={17} /> {title}</div>
        <span className="rounded-full bg-[#edf4f2] px-3 py-1 text-xs text-[#123f38]">{total}</span>
      </div>
      <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-[#cbb894] bg-[#f7ecdc] px-4 py-4 text-sm font-medium hover:bg-[#fff4e6]">
        Add photos
        <input type="file" accept="image/*" capture="environment" multiple onChange={onUpload} className="hidden" />
      </label>
      {total > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-3">
          {existingPhotos.map((photo) => (
            <div key={photo.path} className="group relative overflow-hidden rounded-2xl border border-[#e0d2bc] bg-white shadow-sm">
              {photo.url ? (
                <img src={photo.url} alt={photo.name} className="h-20 w-full object-cover" />
              ) : (
                <div className="flex h-20 w-full items-center justify-center text-xs text-[#7d6c5a]">Loading...</div>
              )}
              <button type="button" onClick={() => onRemoveExisting(photo.path)} className="absolute right-2 top-2 rounded-full bg-[#201a14]/75 p-2 text-white opacity-100 transition hover:bg-[#201a14] sm:opacity-0 sm:group-hover:opacity-100" aria-label={`Remove ${photo.name}`}>
                <Icon name="x" size={15} />
              </button>
            </div>
          ))}
          {newPhotos.map((photo) => (
            <div key={photo.id} className="group relative overflow-hidden rounded-2xl border border-[#e0d2bc] bg-white shadow-sm">
              <img src={photo.url} alt={photo.name} className="h-20 w-full object-cover" />
              <span className="absolute left-2 top-2 rounded-full bg-[#123f38] px-2 py-0.5 text-[10px] font-medium text-[#fff7ea]">New</span>
              <button type="button" onClick={() => onRemoveNew(photo.id)} className="absolute right-2 top-2 rounded-full bg-[#201a14]/75 p-2 text-white opacity-100 transition hover:bg-[#201a14] sm:opacity-0 sm:group-hover:opacity-100" aria-label={`Remove ${photo.name}`}>
                <Icon name="x" size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PhotoViewerModal({ entry, onClose }) {
  const [allPhotos, setAllPhotos] = useState(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const photos = [
      ...(entry.itemPhotos || []).map((photo) => ({ ...photo, label: "Item photo" })),
      ...(entry.receiptPhotos || []).map((photo) => ({ ...photo, label: "Receipt proof" }))
    ];

    const savedPaths = photos.filter((photo) => photo.path).map((photo) => photo.path);

    if (savedPaths.length === 0) {
      // Nothing stored remotely (or photos are still local blob previews).
      setAllPhotos(photos.filter((photo) => photo.url));
      return;
    }

    let cancelled = false;

    supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(savedPaths, 3600)
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error("Signed URL error:", error.message);
          setLoadError("Could not load photos. Check that the item-photos storage bucket is set up.");
          setAllPhotos([]);
          return;
        }

        const urlByPath = new Map((data || []).map((row) => [row.path, row.signedUrl]));
        setAllPhotos(photos.map((photo) => ({ ...photo, url: photo.path ? urlByPath.get(photo.path) : photo.url })).filter((photo) => photo.url));
      });

    return () => {
      cancelled = true;
    };
  }, [entry]);

  return (
    <ModalShell onClose={onClose} contentClassName="max-h-[85vh] max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm uppercase tracking-[0.18em] text-[#7d6c5a]">Photos</div>
          <h2 className="mt-1 text-3xl font-semibold">{entry.name || "Untitled item"}</h2>
        </div>
        <button onClick={onClose} className="rounded-full bg-[#f0e2cf] p-2 text-[#665746] hover:bg-[#ead8bf]" aria-label="Close photo viewer">
          <Icon name="x" size={18} />
        </button>
      </div>

      {allPhotos === null ? (
        <div className="mt-6 rounded-2xl bg-[#f7efe3] p-6 text-center text-[#665746]">
          Loading photos...
        </div>
      ) : allPhotos.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-[#f7efe3] p-6 text-center text-[#665746]">
          {loadError || "No saved photos for this item yet."}
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {allPhotos.map((photo) => (
            <div key={photo.id} className="overflow-hidden rounded-2xl border border-[#d8c7ad] bg-white">
              <div className="flex h-72 w-full items-center justify-center bg-[#f3ece0]">
                <img src={photo.url} alt={photo.name} className="h-full w-full object-contain" />
              </div>
              <div className="p-4">
                <div className="font-semibold">{photo.label}</div>
                <div className="truncate text-sm text-[#665746]">{photo.name}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </ModalShell>
  );
}

function clearPhotoUrls(photos) { photos.forEach((photo) => URL.revokeObjectURL(photo.url)); }
function TabButton({ active, children, onClick }) { return <button onClick={onClick} className={`shrink-0 rounded-full px-3 py-2 text-sm font-medium transition ${active ? "bg-[#123f38] text-[#fff7ea]" : "text-[#665746] hover:bg-white"}`}>{children}</button>; }
function MobileNavLink({ active, children, onClick }) { return <button onClick={onClick} className={`rounded-xl px-4 py-3 text-left text-sm font-medium transition ${active ? "bg-[#123f38] text-[#fff7ea]" : "text-[#665746] hover:bg-white"}`}>{children}</button>; }
function Field({ label, value, onChange, type = "text" }) { return <label className="block"><div className="mb-2 text-sm font-medium text-[#665746]">{label}</div><input type={type} value={value || ""} onChange={(event) => onChange(event.target.value)} className="w-full rounded-2xl border border-[#d8c7ad] bg-[#fffdf8] px-4 py-3 outline-none transition focus:border-[#123f38] focus:ring-2 focus:ring-[#123f38]/15" /></label>; }
function SelectField({ label, value, options, onChange, placeholder }) { return <label className="block"><div className="mb-2 text-sm font-medium text-[#665746]">{label}</div><select value={value || ""} onChange={(event) => onChange(event.target.value)} className="w-full rounded-2xl border border-[#d8c7ad] bg-[#fffdf8] px-4 py-3 outline-none transition focus:border-[#123f38] focus:ring-2 focus:ring-[#123f38]/15">{placeholder && <option value="">{placeholder}</option>}{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>; }
function TextAreaField({ label, value, onChange, placeholder, rows = 6 }) { return <label className="block"><div className="mb-2 text-sm font-medium text-[#665746]">{label}</div><textarea value={value || ""} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={rows} className="w-full rounded-2xl border border-[#d8c7ad] bg-[#fffdf8] px-4 py-3 outline-none transition focus:border-[#123f38] focus:ring-2 focus:ring-[#123f38]/15" /></label>; }
function PhotoUploader({ title, eyebrow, description, prompts, photos, onUpload, onRemove }) { return <Card className="rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-sm"><CardContent className="p-6"><div className="flex items-start justify-between gap-4"><div><div className="text-sm uppercase tracking-[0.18em] text-[#7d6c5a]">{eyebrow}</div><h2 className="mt-1 text-2xl font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-[#665746]">{description}</p></div><div className="rounded-full bg-[#edf4f2] px-3 py-1 text-sm font-medium text-[#123f38]">{photos.length}</div></div><label className="mt-5 flex min-h-[150px] cursor-pointer flex-col items-center justify-center rounded-[1.5rem] border-2 border-dashed border-[#cbb894] bg-[#f7ecdc] p-6 text-center transition hover:bg-[#fff4e6]"><Icon name={title.toLowerCase().includes("receipt") ? "receipt" : "camera"} size={36} className="text-[#123f38]" /><div className="mt-3 text-lg font-semibold">Take or upload</div><div className="mt-1 max-w-sm text-xs leading-5 text-[#6b5b4c]">Works with camera or photo library on mobile.</div><input type="file" accept="image/*" capture="environment" multiple onChange={onUpload} className="hidden" /></label><div className="mt-4 flex flex-wrap gap-2">{prompts.map((prompt) => <div key={prompt} className="rounded-full bg-[#f0e2cf] px-3 py-1 text-xs text-[#665746]">{prompt}</div>)}</div>{photos.length > 0 && <PhotoGrid photos={photos} onRemove={onRemove} />}</CardContent></Card>; }
function CompactUploader({ title, icon, photos, onUpload, onRemove }) { return <div className="rounded-2xl border border-[#d8c7ad] bg-[#fffdf8] p-4"><div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2 font-semibold"><Icon name={icon} size={17} /> {title}</div><span className="rounded-full bg-[#edf4f2] px-3 py-1 text-xs text-[#123f38]">{photos.length}</span></div><label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-[#cbb894] bg-[#f7ecdc] px-4 py-4 text-sm font-medium hover:bg-[#fff4e6]">Take or upload<input type="file" accept="image/*" capture="environment" multiple onChange={onUpload} className="hidden" /></label>{photos.length > 0 && <PhotoGrid photos={photos} onRemove={onRemove} compact />}</div>; }
function PhotoGrid({ photos, onRemove, compact = false }) { return <div className={`mt-4 grid gap-3 ${compact ? "grid-cols-3" : "sm:grid-cols-2"}`}>{photos.map((photo) => <div key={photo.id} className="group relative overflow-hidden rounded-2xl border border-[#e0d2bc] bg-white shadow-sm"><img src={photo.url} alt={photo.name} className={`${compact ? "h-20" : "h-32"} w-full object-cover`} /><button type="button" onClick={() => onRemove(photo.id)} className="absolute right-2 top-2 rounded-full bg-[#201a14]/75 p-2 text-white opacity-100 transition hover:bg-[#201a14] sm:opacity-0 sm:group-hover:opacity-100" aria-label={`Remove ${photo.name}`}><Icon name="x" size={15} /></button>{!compact && <div className="truncate px-3 py-2 text-xs text-[#665746]">{photo.name}</div>}</div>)}</div>; }
function SummaryPill({ label, value }) { return <div className="rounded-2xl bg-[#f7efe3] p-4"><div className="text-xs uppercase tracking-[0.16em] text-[#7d6c5a]">{label}</div><div className="mt-1 text-lg font-semibold">{value}</div></div>; }
function DashboardCard({ icon, label, value }) { return <Card className="rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-sm"><CardContent className="flex items-center gap-4 p-6"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#123f38] text-[#fff7ea]"><Icon name={icon} size={22} /></div><div><div className="text-sm text-[#665746]">{label}</div><div className="text-2xl font-semibold">{value}</div></div></CardContent></Card>; }
function SmallMetric({ label, value }) { return <div className="rounded-2xl bg-white p-4"><div className="text-xs uppercase tracking-[0.16em] text-[#7d6c5a]">{label}</div><div className="mt-1 font-semibold">{value}</div></div>; }

function Button({ children, variant = "primary", className = "", onClick, type = "button", disabled = false }) {
  const styles =
    variant === "outline"
      ? "border border-[#cdbb9d] bg-[#fff8ee] text-[#201a14] hover:bg-white"
      : "bg-[#123f38] text-[#fff7ea] hover:bg-[#0f332d]";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full px-5 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`rounded-[2rem] border border-[#d8c7ad] bg-[#fff9f0] shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function CardContent({ children, className = "" }) {
  return <div className={`p-6 ${className}`}>{children}</div>;
}
