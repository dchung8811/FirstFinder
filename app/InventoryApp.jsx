"use client";
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { sendGAEvent } from "@next/third-parties/google";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../src/lib/supabaseClient";
import {
  REPO_URL,
  CONTRIBUTING_URL,
  CODE_OF_CONDUCT_URL,
  LICENSE_URL,
  SECURITY_URL,
  BUG_REPORT_URL,
  FEATURE_REQUEST_URL,
  GOOD_FIRST_ISSUE_LABEL,
  HELP_WANTED_LABEL,
  labelSearchUrl,
  DONATE_URL
} from "../src/lib/project";
import {
  emptyItem,
  sampleItems,
  itemPhotoPrompts,
  receiptPhotoPrompts,
  statuses,
  quickCategories,
  conditionOptions,
  bookEditionOptions,
  bookPrintingOptions,
  csvHeaders
} from "../src/utils/constants";
import { formatReference, todayIso, toNumber, formatCurrency, hasValue } from "../src/utils/format";
import {
  shouldAttemptPlay,
  isPermanentPlayRefusal,
  hasStartedPlaying,
  shouldSkipAutoplay,
  nextWatchdogDelayMs,
  WATCHDOG_HARD_CAP_MS
} from "../src/utils/videoPlayback";
import {
  GUIDE_TIER,
  MAX_SUGGESTIONS,
  isSearchable,
  searchGuides,
  mergeSuggestions,
  suggestionSubtitle,
  applyBookSuggestion
} from "../src/utils/bookSearch";
import {
  findPossibleDuplicates,
  buildSimilarCopyLinks,
  itemCredit,
  usesAuthorField,
  itemValueForTotals,
  calculateGain,
  formatEstimatedValue,
  formatGain,
  getActiveInventory,
  toValueRange
} from "../src/utils/items";
import { csvUpdateRow, toDbItem, fromDbItem, fromDbShareSettings, toDbShareRow, fromDbWant, toDbWant } from "../src/utils/mapping";
import { syncAgeLabel } from "../src/utils/offlineCollection";
import {
  createOperation,
  updateOperation,
  deleteOperation,
  enqueue,
  applyQueueToCollection,
  markAttempt,
  isBlocked,
  isPendingId,
  newPendingId,
  summarizeQueue,
  queueLabel,
  describeOperation
} from "../src/utils/offlineQueue";
import { readOfflineCollection, writeOfflineCollection, clearOfflineCollection } from "../src/lib/offlineStore";
import { isQueueAvailable, loadQueue, saveOperation, loadOperationPhotos, removeOperations, clearQueue } from "../src/lib/offlineQueueStore";
import {
  emptyWant,
  priorityOptions,
  priorityLabel,
  jacketOptions,
  signatureOptions,
  isWantSaveable,
  describeCriteria,
  sortWants,
  openWants,
  summarizeWants,
  buildWantSearchLinks,
  wantToItem,
  compareToCeiling
} from "../src/utils/wishlist";
import {
  defaultShareSettings,
  shareFieldGroups,
  sharePresets,
  applyPreset,
  matchingPresetId,
  isItemShared,
  buildPublicItem,
  shareSettingsChanged,
  generateShareSlug,
  sharePath
} from "../src/utils/publicCollection";
import { buildCsvTemplate, buildCsvExport, parseCsvBatch } from "../src/utils/csv";
import { monthLabel, monthlyBuckets, dashboardRanges, applyDashboardFilters } from "../src/utils/dashboard";

function Icon({ name, size = 20, className = "" }) {
  const icons = {
    box: (
      <>
        <path d="M21 8 12 3 3 8l9 5 9-5Z" />
        <path d="M3 8v8l9 5 9-5V8" />
        <path d="M12 13v8" />
      </>
    ),
    link: (
      <>
        <path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07l-1.42 1.42" />
        <path d="M14 11a5 5 0 0 0-7.07 0l-2.83 2.83a5 5 0 0 0 7.07 7.07l1.42-1.42" />
      </>
    ),
    camera: (
      <>
        <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
        <circle cx="12" cy="13" r="3" />
      </>
    ),
    check: <path d="M20 6 9 17l-5-5" />,
    // Signal arcs with a stroke through them: the offline banner's mark.
    wifiOff: (
      <>
        <path d="M2 3l20 18" />
        <path d="M5 12.5a11 11 0 0 1 4-2.4" />
        <path d="M2 8.8a16 16 0 0 1 5.5-3.2" />
        <path d="M16.7 10.4a11 11 0 0 1 2.3 2.1" />
        <path d="M12.5 5.6a16 16 0 0 1 9 3.2" />
        <path d="M8.5 16a6 6 0 0 1 7 0" />
        <path d="M12 20h.01" />
      </>
    ),
    // A circular arrow, for "try that again".
    refresh: (
      <>
        <path d="M21 12a9 9 0 1 1-2.6-6.4" />
        <path d="M21 4v5h-5" />
      </>
    ),
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
    apple: (
      <path
        fill="currentColor"
        stroke="none"
        d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.08ZM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25Z"
      />
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
    ),
    heart: (
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z" />
    ),
    github: (
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
    ),
    code: (
      <>
        <path d="m16 18 6-6-6-6" />
        <path d="m8 6-6 6 6 6" />
      </>
    ),
    bug: (
      <>
        <path d="M9 7a3 3 0 0 1 6 0" />
        <path d="M7 10a5 5 0 0 1 10 0v3a5 5 0 0 1-10 0Z" />
        <path d="M2 12h5M17 12h5M4 7l3 2M20 7l-3 2M4 18l3-2M20 18l-3-2" />
      </>
    ),
    star: (
      <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.4l6.1-.9Z" />
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

// Item-name autocomplete, in two tiers.
//
// The eleven verified guides are a local array, so they are matched in memory
// and always rank first. The catalog is a table of books nobody has checked,
// queried through a Postgres function that does the trigram matching and the
// ranking -- see supabase/book-catalog.sql.
//
// A catalog failure is not an error the collector needs to hear about. If the
// migration has not been run, or the table is unreachable, the guides still
// match and the field still works; the long tail is simply missing. Falling
// back to an empty dropdown would be worse than falling back to eleven books.
async function searchBookCatalog(query) {
  const guides = searchGuides(query);
  if (!isSearchable(query)) return [];

  try {
    const { data, error } = await supabase.rpc("search_book_catalog", {
      p_query: query.trim(),
      p_limit: MAX_SUGGESTIONS
    });

    if (error) throw new Error(error.message);
    return mergeSuggestions(guides, data || []);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn("Book catalog search failed:", error.message);
    }
    return mergeSuggestions(guides, []);
  }
}

// Queues a book the catalog does not know about, so the catalog grows from what
// collectors actually own rather than from a bibliography anyone can download.
//
// Fire-and-forget, and deliberately so: this runs after an item has already
// been saved, the collector is not waiting on it, and a failure here must never
// turn a successful save into an error message. The membership check happens
// inside the function, in SQL, so this costs one round trip and never blocks.
function queueBookSuggestion(sourceItem) {
  if (!sourceItem || sourceItem.category !== "Book") return;

  const title = (sourceItem.name || "").trim();
  if (title.length < 3) return;

  supabase
    .rpc("queue_book_suggestion", { p_title: title, p_author: (sourceItem.maker || "").trim() })
    .then(({ error }) => {
      if (error && process.env.NODE_ENV === "development") {
        console.warn("Book suggestion queue failed:", error.message);
      }
    });
}

// Records a sign-in for the admin dashboard's login history.
//
// Supabase does keep a login log -- auth.audit_log_entries -- but those rows
// are pruned and on this project the table is empty, so the history has to be
// ours. auth.users.last_sign_in_at survives, but it is one overwritten
// timestamp: it can say who is active and never how often anyone comes back.
//
// Deliberately fire-and-forget. A collector signing in must not be made to
// wait on a metric, and must never see it fail: if this insert is blocked,
// offline, or rejected, the login itself is unaffected and the only casualty
// is one row of maintainer telemetry.
function recordLogin(userId) {
  if (!userId) return;
  supabase
    .from("login_events")
    .insert({ user_id: userId })
    .then(({ error }) => {
      if (error && process.env.NODE_ENV === "development") {
        console.warn("Login event not recorded:", error.message);
      }
    });
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
//
// The hour is the important number here: every URL this hands back stops
// working an hour after it was signed, whether or not the page is still open.
// SignedPhoto below is what notices, and asks for a new one.
export const SIGNED_URL_TTL_SECONDS = 3600;

async function fetchSignedPhotoUrls(photos) {
  const paths = photos.filter((photo) => photo.path).map((photo) => photo.path);
  if (paths.length === 0) return photos;

  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  if (error) {
    console.error("Signed URL error:", error.message);
    return photos;
  }

  // createSignedUrls reports per-path failures inside the rows rather than in
  // `error`, and a row that failed carries a null URL. Logged rather than
  // swallowed: without this a single unsigned photo is indistinguishable from
  // one that simply has not arrived yet.
  (data || []).forEach((row) => {
    if (row.error) console.error("Signed URL error:", row.path, row.error);
  });

  const urlByPath = new Map((data || []).map((row) => [row.path, row.signedUrl]));
  return photos.map((photo) => ({ ...photo, url: photo.path ? urlByPath.get(photo.path) : photo.url }));
}

// A single photo's URL, re-signed on demand. Used by SignedPhoto to recover a
// photo whose hour is up without the page it lives on having to reload.
async function signedUrlForPath(path) {
  if (!path) return "";
  const [photo] = await fetchSignedPhotoUrls([{ path }]);
  return photo?.url || "";
}

// Allocates the next N reference numbers for a user.
//
// Assigned here rather than by a Postgres trigger on purpose: a BEFORE INSERT
// trigger computing max()+1 can't see the other rows of the same multi-row
// insert, so a bulk CSV import would hand every row the same number. Computing
// the whole range up front avoids that. The unique (user_id, reference_number)
// index is the backstop if two sessions ever race.
async function nextReferenceNumbers(userId, count) {
  if (count <= 0) return { numbers: [], error: null };

  const { data, error } = await supabase
    .from("inventory_items")
    .select("reference_number")
    .eq("user_id", userId)
    .not("reference_number", "is", null)
    .order("reference_number", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Reference number lookup error:", error.message);
    return { numbers: [], error: error.message };
  }

  const start = (data?.[0]?.reference_number || 0) + 1;
  return { numbers: Array.from({ length: count }, (_, index) => start + index), error: null };
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
  // Distinguishes "we have not fetched yet" from "there is genuinely
  // nothing here". Both are inventory.length === 0, and telling a signed-in
  // collector their collection is empty while it is still loading is the
  // worst possible reading of that state.
  const [inventoryLoading, setInventoryLoading] = useState(false);
  // Offline state (issue #60). `online` starts true rather than reading
  // navigator.onLine during render: the server has no such property, and a
  // first paint that disagrees with the client's is a hydration error. The
  // effect below corrects it immediately, and being briefly wrong in the
  // optimistic direction costs nothing.
  const [online, setOnline] = useState(true);
  // When the visible collection was last known to match the database, and
  // whether what is on screen came from the snapshot rather than the network.
  const [syncedAt, setSyncedAt] = useState("");
  const [fromSnapshot, setFromSnapshot] = useState(false);
  // Writes made with no signal, waiting for one (issue #147). The queue is the
  // only copy of a find added offline, so `queueReady` gates whether an
  // offline write is accepted at all: a browser that cannot hold the queue
  // gets the old refusal rather than a promise this app cannot keep.
  const [queue, setQueue] = useState([]);
  const [queueReady, setQueueReady] = useState(false);
  const [flushing, setFlushing] = useState(false);
  // Kept in a ref as well as in state, so the mutation paths can collapse an
  // operation against the current queue without waiting for a re-render.
  const queueRef = useRef([]);
  // Declared here rather than beside the other memos below: the reconnect
  // effect lists sendableCount in its dependency array, and a dependency
  // array is evaluated during render, at the point the effect is declared.
  const queueSummary = useMemo(() => summarizeQueue(queue), [queue]);
  const sendableCount = queueSummary.waiting;
  const [itemPhotos, setItemPhotos] = useState([]);
  const [receiptPhotos, setReceiptPhotos] = useState([]);
  const [quickItemPhotos, setQuickItemPhotos] = useState([]);
  const [quickReceiptPhotos, setQuickReceiptPhotos] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [inventoryViewMode, setInventoryViewMode] = useState("cards");
  const [inventoryStatusView, setInventoryStatusView] = useState("active");
  const [editingItem, setEditingItem] = useState(null);
  // The record a visitor asked to be shown, on their way to the collection --
  // tapping a cover in Recent finds. Cleared as soon as the collection has
  // acted on it, so coming back later does not scroll them somewhere they did
  // not ask to go.
  const [focusItemId, setFocusItemId] = useState(null);
  const focusItemRef = useRef(null);
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkUploading, setBulkUploading] = useState(false);
  const [pendingImport, setPendingImport] = useState(null);
  const [pendingDuplicateReview, setPendingDuplicateReview] = useState(null);
  const [applyingImport, setApplyingImport] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [identifyingPhotos, setIdentifyingPhotos] = useState([]);
  const [identifyDraft, setIdentifyDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Which account the server confirmed as an admin, rather than a bare
  // boolean. Admin-ness belongs to a user, not to the app, so holding the id
  // and comparing lets signing out (or signing in as someone else) fall back
  // to "not an admin" on its own -- with no flash of an Admin tab for the
  // second person while a fresh check is in flight, and no reset to forget.
  //
  // Only the server can answer this: the allowlist is a server-only
  // environment variable and stays there. It decides whether a menu item is
  // drawn and nothing else; the admin routes check every request themselves.
  const [adminUserId, setAdminUserId] = useState(null);
  // The public collection page's settings. Null until loaded; there is no row
  // at all until the collector first opens the share dialog, and the defaults
  // stand in until then (visibility "off", so nothing is public either way).
  const [shareSettings, setShareSettings] = useState(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [savingShare, setSavingShare] = useState(false);

  // The wishlist. Kept in its own state rather than merged into `inventory`,
  // for the same reason it is its own table: a want is a specification, not a
  // holding, and nothing that totals the collection should be able to reach it
  // by accident.
  const [wishlist, setWishlist] = useState([]);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  // The want being added or edited; null when the dialog is closed.
  const [editingWant, setEditingWant] = useState(null);
  // The want being turned into an owned item.
  const [foundWant, setFoundWant] = useState(null);
  const [savingWant, setSavingWant] = useState(false);

  const loadedUserIdRef = useRef(null);
  const navSlotRef = useRef(null);
  const navMeasureRef = useRef(null);
  // Wraps the hamburger and its dropdown, so a click landing anywhere else can
  // be told apart from a click inside the open menu.
  const navMenuRef = useRef(null);

  const router = useRouter();

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

  // For menu entries that are real routes rather than views of this component.
  // /admin lives outside this single-page shell (its own route and layout), so
  // it cannot be reached by setting activeView.
  function goToHref(href) {
    setMobileMenuOpen(false);
    router.push(href);
  }

  // Tracks every view the nav (desktop, mobile, or a same-page button like
  // "Add to collection") switches to, so navigation doesn't need a manual
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

  // Every "page" here is really just a conditional render inside the same
  // scrollable document, so switching views doesn't get the scroll reset a
  // real page navigation would. Most obvious from the footer, since those
  // links are clicked from the bottom of the page and the next view then
  // opens still scrolled to the bottom. Keyed on activeView like the
  // tracking effect above, so it covers every way a view can change --
  // footer, top nav, mobile nav, and in-page buttons -- not just the footer.
  useEffect(() => {
    // Except when this view change exists to show one record: the collection
    // is about to scroll to it, and starting at the top first would either
    // fight that or undo it. Read from a ref so this stays keyed on the view.
    if (focusItemRef.current) return;
    window.scrollTo(0, 0);
  }, [activeView]);

  // Connectivity, from the browser's own view of it (issue #60).
  //
  // navigator.onLine is a weak signal -- it means "there is an interface up",
  // not "Supabase is reachable" -- so it is not the only thing that puts the
  // app in its offline state: a failed load does too, through fromSnapshot.
  // This is the fast half, the one that catches the moment someone walks into
  // a basement, and it is read here rather than during render because the
  // server has no navigator to agree with.
  useEffect(() => {
    function syncOnline() {
      setOnline(navigator.onLine);
    }

    syncOnline();
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);
    return () => {
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
    };
  }, []);

  // Hydrates the pending queue once there is a signed-in user to hydrate it
  // for, and works out whether this browser can hold one at all.
  //
  // This runs after the first load rather than before it, which is why it ends
  // by putting the queue back on screen: on a cold offline launch the snapshot
  // is restored before the queue is known, and a find added yesterday would be
  // missing from the shelf until something else re-rendered it.
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;

    (async () => {
      const [available, stored] = await Promise.all([isQueueAvailable(), loadQueue(currentUser.id)]);
      if (cancelled) return;

      setQueueReady(available);
      queueRef.current = stored;
      setQueue(stored);

      if (stored.length === 0) return;
      if (navigator.onLine) {
        await flushQueue(currentUser.id);
        if (!cancelled) loadInventory(currentUser.id);
      } else {
        restoreFromSnapshot(currentUser.id);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Runs once per signed-in user; the functions it calls are recreated every
    // render and are not dependencies worth chasing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // Coming back into signal refetches what the snapshot was standing in for.
  // Without this the collector keeps reading a stale shelf until they think
  // to reload, which is exactly the moment they are least likely to trust it.
  useEffect(() => {
    if (!online || !currentUser) return;
    // Blocked operations are deliberately not counted: they wait for the
    // collector, and re-running this on every render they are in the queue
    // would refetch the collection forever.
    if (!fromSnapshot && sendableCount === 0) return;
    // Order is load-bearing: send what is waiting before asking the server
    // what it holds, or the refetch would paint a shelf without this
    // morning's finds and then have them reappear.
    flushQueue(currentUser.id).then(() => loadInventory(currentUser.id));
    // loadInventory is recreated every render and is not a dependency worth
    // chasing; the guards above are what decide whether this runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, fromSnapshot, currentUser, sendableCount]);

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
        // Only a real sign-in counts. Reopening the app with a stored session
        // arrives as INITIAL_SESSION, and a token refresh as TOKEN_REFRESHED,
        // so neither inflates the login count -- which is the whole reason to
        // keep this history rather than counting page loads.
        if (event === "SIGNED_IN") recordLogin(session.user.id);
        loadInventory(session.user.id);
        setActiveView("dashboard");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Asks the server whether this account may open /admin, once per signed-in
  // user. Silent on failure: an Admin tab that fails to appear is a maintainer
  // typing a URL, which is what they did before this existed.
  useEffect(() => {
    if (!isLoggedIn || !currentUser) return;

    let cancelled = false;
    const userId = currentUser.id;

    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        if (!accessToken) return;

        const response = await fetch("/api/admin/access", {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (!response.ok) return;

        const body = await response.json();
        // Records the id the answer is about, not just that it was yes, so a
        // reply landing after a switch of account cannot mark the new person
        // an admin.
        if (!cancelled && body?.admin) setAdminUserId(userId);
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.warn("Admin access check failed:", error.message);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, currentUser]);

  const isAdmin = Boolean(currentUser && adminUserId === currentUser.id);

  // A dropdown has to be dismissible by the two gestures everyone already
  // expects of one -- click away, press Escape -- or it reads as a panel that
  // got stuck open. Only listening while it is actually open keeps this off
  // the event path for every other click in the app.
  useEffect(() => {
    if (!mobileMenuOpen) return;

    function onPointerDown(event) {
      if (navMenuRef.current && !navMenuRef.current.contains(event.target)) {
        setMobileMenuOpen(false);
      }
    }

    function onKeyDown(event) {
      if (event.key === "Escape") setMobileMenuOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileMenuOpen]);

  const activeInventory = useMemo(() => getActiveInventory(inventory), [inventory]);
  // The nav label says how many items are in the collection, which it cannot
  // truthfully do before the fetch lands. Rather than assert "(0)" to someone
  // who has forty, drop the count until it is actually known -- same guard the
  // Dashboard and Collection empty states use.
  const inventoryCountKnown = !(inventoryLoading && inventory.length === 0);
  const openWishlist = useMemo(() => sortWants(openWants(wishlist)), [wishlist]);
  const wishlistSummary = useMemo(() => summarizeWants(wishlist), [wishlist]);
  const wishlistCountKnown = !(wishlistLoading && wishlist.length === 0);
  const soldInventory = useMemo(() => inventory.filter((entry) => entry.status === "Sold"), [inventory]);

  const navItems = useMemo(() => (
    isLoggedIn
      ? [
          { view: "dashboard", label: "Dashboard" },
          { view: "inventory", label: `My Collection${inventoryCountKnown ? ` (${activeInventory.length})` : ""}` },
          // Its own tab, beside the collection rather than inside it: the
          // whole point of the rework is that what you are hunting is not a
          // subset of what you own. Same count guard as the collection --
          // no number until the fetch has actually landed.
          { view: "wishlist", label: `Wishlist${wishlistCountKnown ? ` (${openWishlist.length})` : ""}` },
          { view: "addItems", label: "Add Items" },
          // Feedback sits where Roadmap used to, because the nav row only has
          // space for the first few and this is the one worth spending it on:
          // a collector who wants to tell us something should not have to find
          // a menu first. Roadmap keeps its place in the list, just further
          // down, which on most widths means inside the menu.
          { view: "feedback", label: "Feedback" },
          { view: "about", label: "About" },
          { view: "roadmap", label: "Roadmap" },
          { view: "account", label: "My Account" }
        ]
      : [
          { view: "home", label: "Get Started" },
          { view: "roadmap", label: "Roadmap" },
          { view: "about", label: "About" }
        ]
  ), [isLoggedIn, inventoryCountKnown, activeInventory.length, wishlistCountKnown, openWishlist.length]);

  // The nav never scrolls sideways: whatever does not fit on one line drops out
  // of the pill and into the menu behind the hamburger.
  // Resizing reshuffles which tabs are behind the menu, so close it rather than
  // leave a panel open over a list that just changed under the reader.
  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);
  const visibleNavCount = useNavOverflow(navSlotRef, navMeasureRef, navItems, closeMobileMenu);

  // What the hamburger holds: whatever did not fit in the tab row, plus Admin
  // for the accounts that have it.
  //
  // Admin is appended here rather than added to navItems, so it never competes
  // for a slot in the visible row however wide the window is. It is a
  // maintainer's tool, not part of the app every collector uses, and it should
  // not sit in the tab strip next to My Collection. Keeping it out of navItems
  // also leaves the overflow measurement reading exactly the tabs it did
  // before, so nothing about the row's behaviour changes for anyone else.
  const menuItems = useMemo(() => {
    const items = navItems.slice(visibleNavCount);
    if (isAdmin) items.push({ view: "admin", label: "Admin", href: "/admin" });
    return items;
  }, [navItems, visibleNavCount, isAdmin]);
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
    return visibleInventory.filter((entry) => [entry.name, entry.category, entry.author, entry.maker, entry.source, entry.status, entry.notes, entry.edition].join(" ").toLowerCase().includes(query));
  }, [visibleInventory, searchTerm]);

  // Puts the last synced collection on screen, and says whether it managed
  // to. Read-only by construction: nothing in the app writes to `inventory`
  // expecting it to reach Postgres, and every mutation is refused while
  // offline (see requireOnline).
  function restoreFromSnapshot(userId) {
    const snapshot = readOfflineCollection(userId);
    if (!snapshot) return null;

    // The snapshot is the last thing the server said; the queue is what has
    // happened since. What the collector sees is the two together -- see
    // applyQueueToCollection, and the note on setInventory in loadInventory.
    setInventory(applyQueueToCollection(snapshot.items, queueRef.current));
    setSyncedAt(snapshot.syncedAt);
    setFromSnapshot(true);
    return snapshot;
  }

  // Persists one pending operation and puts its effect on screen.
  //
  // Returns false when the queue could not take it, and the caller must then
  // tell the collector the save did not happen. Nothing in this app may report
  // a save that only ever existed in React state.
  async function queueWrite(operation, photos, { onQueued, message }) {
    const { queue: nextQueue, stored, removedIds } = enqueue(queueRef.current, operation);

    if (stored && !(await saveOperation(stored, photos))) {
      pushToast("This device could not store that change, so it was not saved. Try again on a connection.", "error");
      return false;
    }

    if (removedIds.length > 0) await removeOperations(removedIds);

    queueRef.current = nextQueue;
    setQueue(nextQueue);
    onQueued();
    if (message) pushToast(message, "success");
    return true;
  }

  // The gate in front of every write. Saving offline would fail somewhere
  // inside Supabase and take the collector's typed record with it; refusing up
  // front keeps the form filled in and says what to do about it.
  function requireOnline(what) {
    if (online) return true;
    pushToast(`You're offline, so ${what} has to wait. Your collection is here to look through, and this will work again on a connection.`, "warning");
    return false;
  }

  // True when a write should be queued rather than sent. Deliberately not the
  // same question as "are we offline": a browser that cannot hold a queue --
  // private mode, storage blocked, no IndexedDB -- falls back to refusing the
  // write, because a queue that cannot be written to would lose the record
  // rather than delay it.
  // The offline half of every edit path. `fields` is only what changed -- see
  // the third rule at the top of offlineQueue.js.
  async function queueItemUpdate(itemId, fields, message) {
    const operation = updateOperation({ userId: currentUser.id, itemId, fields, id: `op-update-${itemId}` });

    return queueWrite(operation, null, {
      onQueued: () => setInventory((items) => applyQueueToCollection(items, [operation])),
      message
    });
  }

  // Sends one queued operation. Throws on failure, so the caller can count the
  // attempt and keep the operation -- the queue is the only copy of an offline
  // find, and a thrown error is what stops it being discarded.
  async function replayOperation(operation, userId) {
    if (operation.kind === "delete") {
      // A delete whose row is already gone is a delete that has happened. It
      // is not an error, and retrying it forever would be.
      const { error } = await supabase.from("inventory_items").delete().eq("id", operation.itemId).eq("user_id", userId);
      if (error) throw new Error(error.message);
      return;
    }

    if (operation.kind === "update") {
      const existing = inventory.find((entry) => entry.id === operation.itemId) || {};
      const row = csvUpdateRow({ ...existing, id: operation.itemId }, operation.fields, userId);
      delete row.id;
      delete row.user_id;

      const { data, error } = await supabase
        .from("inventory_items")
        .update(row)
        .eq("id", operation.itemId)
        .eq("user_id", userId)
        .select();

      if (error) throw new Error(error.message);
      // No row came back: it was deleted on another device while this edit sat
      // in a pocket. There is nothing left to apply it to, and inventing the
      // row again would resurrect something the collector deleted on purpose.
      if (!data || data.length === 0) throw new Error("That item no longer exists -- it was deleted somewhere else.");
      return;
    }

    // A create. The reference number is allocated now rather than when the
    // item was photographed: a number claimed hours ago in a basement may
    // belong to something else by the time there is a connection.
    const { numbers, error: referenceError } = await nextReferenceNumbers(userId, 1);
    if (referenceError) throw new Error(referenceError);

    const photos = await loadOperationPhotos(operation.id);
    const itemPhotoList = photos.itemPhotos || [];
    const receiptPhotoList = photos.receiptPhotos || [];

    const { data, error } = await supabase
      .from("inventory_items")
      .insert(toDbItem({ ...operation.fields, referenceNumber: numbers[0] }, userId, itemPhotoList.length, receiptPhotoList.length))
      .select()
      .single();

    if (error) throw new Error(error.message);

    if (itemPhotoList.length === 0 && receiptPhotoList.length === 0) return;

    const itemResult = await uploadPhotoList(userId, data.id, itemPhotoList, "item");
    const receiptResult = await uploadPhotoList(userId, data.id, receiptPhotoList, "receipt");

    // The row is saved by this point, so a photo problem must not send the
    // whole operation round again -- that would insert the item twice. The
    // failure is reported instead, in the same words the online path uses.
    const { error: photoError } = await supabase
      .from("inventory_items")
      .update({
        item_photos: itemResult.uploaded,
        receipt_photos: receiptResult.uploaded,
        item_photo_count: itemResult.uploaded.length,
        receipt_photo_count: receiptResult.uploaded.length,
        updated_at: new Date().toISOString()
      })
      .eq("id", data.id);

    const failures = [...itemResult.failures, ...receiptResult.failures];
    if (photoError) console.error("Queued photo record update error:", photoError.message);
    if (failures.length > 0 || photoError) {
      pushToast(`"${operation.fields.name || "Item"}" synced, but some photos did not upload.`, "warning");
    }
  }

  // Sends everything waiting, oldest first, then refetches so the screen shows
  // what the server actually holds rather than what we hoped it would.
  async function flushQueue(userId) {
    if (flushing) return;

    const pending = queueRef.current.filter((operation) => !isBlocked(operation));
    if (pending.length === 0) return;

    setFlushing(true);
    let sent = 0;
    let failed = 0;

    try {
      for (const operation of pending) {
        try {
          await replayOperation(operation, userId);
          await removeOperations([operation.id]);
          queueRef.current = queueRef.current.filter((entry) => entry.id !== operation.id);
          sent += 1;
        } catch (error) {
          console.error("Queued write failed:", error.message);
          const attempted = markAttempt(operation, error.message);
          await saveOperation(attempted);
          queueRef.current = queueRef.current.map((entry) => (entry.id === operation.id ? attempted : entry));
          failed += 1;
          // Keep going. One rejected row must not hold up the rest of a
          // morning's finds.
        }
      }

      setQueue(queueRef.current);

      if (sent > 0) trackEvent("offline_queue_synced", { operations: sent });
      if (sent > 0 && failed === 0) pushToast(sent === 1 ? "Your offline change synced." : `${sent} offline changes synced.`, "success");
      else if (failed > 0) pushToast(`${failed} offline ${failed === 1 ? "change" : "changes"} could not be saved. See "Waiting to sync".`, "warning");
    } finally {
      setFlushing(false);
    }
  }

  // Gives up on one operation at the collector's request. The only way a
  // pending write leaves the queue unsent.
  async function discardOperation(operationId) {
    await removeOperations([operationId]);
    queueRef.current = queueRef.current.filter((entry) => entry.id !== operationId);
    setQueue(queueRef.current);
    if (currentUser) loadInventory(currentUser.id);
  }

  // Clears the failure count so the next flush picks it up again.
  async function retryOperation(operationId) {
    const operation = queueRef.current.find((entry) => entry.id === operationId);
    if (!operation) return;

    const reset = { ...operation, attempts: 0, lastError: "" };
    await saveOperation(reset);
    queueRef.current = queueRef.current.map((entry) => (entry.id === operationId ? reset : entry));
    setQueue(queueRef.current);
    if (currentUser && online) flushQueue(currentUser.id).then(() => loadInventory(currentUser.id));
  }

  async function loadInventory(userId) {
    // Set synchronously, in the same batch as the setActiveView("dashboard")
    // that precedes every call, so the dashboard's first render already knows
    // a fetch is in flight rather than painting the empty state first.
    setInventoryLoading(true);

    try {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Load inventory error:", error.message);
        // A failed load is what a shop basement looks like from in here. If
        // there is a snapshot, showing it beats showing an error and an empty
        // shelf -- the collector came to look something up, and the answer is
        // sitting in this browser.
        const snapshot = restoreFromSnapshot(userId);
        if (snapshot) pushToast(`No connection. Showing your collection as it was ${syncAgeLabel(snapshot.syncedAt)}.`, "warning");
        else pushToast(error.message, "error");
        return;
      }

      const loaded = (data || []).map(fromDbItem);
      // The snapshot records what the server said; the screen shows that with
      // anything still queued applied on top. Keeping the two apart is what
      // lets a reload rebuild the same view without counting a pending find
      // twice.
      setInventory(applyQueueToCollection(loaded, queueRef.current));
      setFromSnapshot(false);
      // Written on every load, so the snapshot is never older than the last
      // time the app worked. A failed write leaves syncedAt blank, which the
      // banner reads as "at some point" rather than claiming a time.
      setSyncedAt(writeOfflineCollection(userId, loaded) || "");
      loadShareSettings(userId);
      loadWishlist(userId);
    } finally {
      // Cleared on the error path too. A failed load leaves the empty state
      // showing alongside the error toast, which is wrong but recoverable --
      // "Just a sec..." forever would not be.
      setInventoryLoading(false);
    }
  }


  async function logout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Logout error:", error.message);
      pushToast(error.message, "error");
      return;
    }

    trackEvent("logout");
    // The snapshot is one person's shelf sitting in a browser other people
    // use. Signing out has to take it with them.
    clearOfflineCollection(currentUser?.id);
    // The queue goes too. It holds photographs and unsaved finds, and this is
    // a device someone else may sign in on next.
    clearQueue(currentUser?.id);
    queueRef.current = [];
    setQueue([]);
    loadedUserIdRef.current = null;
    setCurrentUser(null);
    setInventory([]);
    setSyncedAt("");
    setFromSnapshot(false);
    setInventoryLoading(false);
    setIsLoggedIn(false);
    setActiveView("home");
  }

  // Takes a tapped cover to its record. A cover in Recent finds is a picture
  // of one book; tapping it and landing on an unscrolled list of a hundred
  // others is the app answering a different question than the one asked.
  //
  // It clears whatever would hide that record -- the search box, the sold/active
  // tab -- because "show me this" has to beat a filter set ten minutes ago.
  function showItemInCollection(item) {
    if (!item) return;
    focusItemRef.current = item.id;
    setSearchTerm("");
    setInventoryStatusView(item.status === "Sold" ? "sold" : "active");
    setFocusItemId(item.id);
    setActiveView("inventory");
  }

  function loadSample(sample) {
    clearPhotoUrls(itemPhotos);
    clearPhotoUrls(receiptPhotos);
    setItem({ ...emptyItem, ...sample });
    setItemPhotos([]);
    setReceiptPhotos([]);
    setActiveView("tutorial");
  }

  function resetFullForm() {
    clearPhotoUrls(itemPhotos);
    clearPhotoUrls(receiptPhotos);
    setItem({ ...emptyItem });
    setItemPhotos([]);
    setReceiptPhotos([]);
  }

  function handlePhotoUpload(event, photoType) {
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
      pushToast("Please log in before saving to your collection.", "error");
      return null;
    }

    // Offline: the find goes in the queue, photos and all, and on the shelf
    // immediately. This is the case the whole feature exists for -- a book in
    // your hands, in a basement, with no signal.
    if (!online) {
      if (!queueReady) {
        requireOnline("saving this item");
        return null;
      }

      const pendingItem = {
        ...emptyItem,
        ...sourceItem,
        id: newPendingId(`${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
      };

      const operation = createOperation({
        userId: currentUser.id,
        item: pendingItem,
        itemPhotoCount: itemPhotoList.length,
        receiptPhotoCount: receiptPhotoList.length,
        id: `op-${pendingItem.id}`
      });

      const queued = await queueWrite(
        operation,
        // The blobs themselves, not the object URLs the form renders: a blob
        // URL dies with the page, and this has to survive being closed in a
        // shop and reopened at home.
        {
          itemPhotos: itemPhotoList.map((photo) => ({ name: photo.name, file: photo.file })),
          receiptPhotos: receiptPhotoList.map((photo) => ({ name: photo.name, file: photo.file }))
        },
        {
          onQueued: () => setInventory((items) => applyQueueToCollection(items, [operation])),
          message: "Saved on this device. It'll sync when you're back online."
        }
      );

      if (!queued) return null;

      trackEvent("inventory_item_queued", { entry_type: entryType, category: sourceItem.category || "Other" });
      return { id: operation.itemId, queued: true };
    }

    setSaving(true);

    try {
      const { numbers, error: referenceError } = await nextReferenceNumbers(currentUser.id, 1);
      if (referenceError) {
        pushToast(referenceError, "error");
        return null;
      }

      const { data, error } = await supabase
        .from("inventory_items")
        .insert(toDbItem({ ...sourceItem, referenceNumber: numbers[0] }, currentUser.id, itemPhotoList.length, receiptPhotoList.length))
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

      queueBookSuggestion(sourceItem);

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
        pushToast("Saved to your collection.", "success");
      }

      return finalRow;
    } finally {
      setSaving(false);
    }
  }

  async function saveItem() {
    const matches = findPossibleDuplicates(item, inventory);
    if (matches.length > 0) {
      setPendingDuplicateReview({ entryType: "tutorial", matches });
      return;
    }
    await commitSaveItem();
  }

  async function saveQuickItem(event) {
    event.preventDefault();

    const matches = findPossibleDuplicates(quickItem, inventory);
    if (matches.length > 0) {
      setPendingDuplicateReview({ entryType: "quick_add", matches });
      return;
    }
    await commitSaveQuickItem();
  }

  // The actual writes, split out from saveItem/saveQuickItem so the duplicate
  // warning dialog's "Add anyway" button can trigger them directly once the
  // user has seen the possible matches and chosen to proceed.
  async function commitSaveItem() {
    const saved = await insertItemWithPhotos(item, itemPhotos, receiptPhotos, "tutorial");
    if (!saved) return;

    clearPhotoUrls(itemPhotos);
    clearPhotoUrls(receiptPhotos);
    setItem({ ...emptyItem });
    setItemPhotos([]);
    setReceiptPhotos([]);
    setActiveView("inventory");
  }

  async function commitSaveQuickItem() {
    const saved = await insertItemWithPhotos(quickItem, quickItemPhotos, quickReceiptPhotos, "quick_add");
    if (!saved) return;

    clearPhotoUrls(quickItemPhotos);
    clearPhotoUrls(quickReceiptPhotos);
    setQuickItem({ ...emptyItem, purchaseDate: todayIso() });
    setQuickItemPhotos([]);
    setQuickReceiptPhotos([]);
    setActiveView("inventory");
  }

  async function confirmPendingDuplicateAndSave() {
    const entryType = pendingDuplicateReview?.entryType;
    setPendingDuplicateReview(null);
    if (entryType === "tutorial") await commitSaveItem();
    else if (entryType === "quick_add") await commitSaveQuickItem();
  }

  async function deleteItem(id) {
    const entry = inventory.find((current) => current.id === id);

    // A row that only exists in the queue has no uuid to send anywhere, so it
    // is edited and deleted through the queue whatever the connection is
    // doing. This is reachable online too: an operation that has stopped
    // trying leaves its row on screen, still pending.
    if (!online || isPendingId(id)) {
      if (!queueReady) {
        requireOnline("deleting an item");
        return;
      }

      const operation = deleteOperation({
        userId: currentUser.id,
        itemId: id,
        name: entry?.name || "",
        id: `op-delete-${id}`
      });

      await queueWrite(operation, null, {
        onQueued: () => setInventory((items) => items.filter((current) => current.id !== id)),
        // A create that never left the device is dropped whole by enqueue, so
        // there is nothing to sync and nothing to promise.
        message: isPendingId(id)
          ? `Removed "${entry?.name || "item"}".`
          : `Deleted "${entry?.name || "item"}" on this device. It'll sync when you're back online.`
      });
      return;
    }

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

    if (!online || isPendingId(id)) {
      if (!queueReady) {
        requireOnline("marking this sold");
        return;
      }

      // Replayed through csvUpdateRow, which derives previous_status and the
      // sale columns from the status the item ends up with -- the same
      // arithmetic a CSV-driven sale goes through.
      await queueItemUpdate(
        id,
        { status: "Sold", soldPrice: hasValue(soldPrice) ? String(soldPrice) : "", soldDate: soldDate || todayIso(), condition: condition || previousItem?.condition || "" },
        "Marked sold on this device. It'll sync when you're back online."
      );
      return;
    }

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

    if (!online || isPendingId(id)) {
      if (!queueReady) {
        requireOnline("restoring this item");
        return;
      }

      await queueItemUpdate(id, { status: restoredStatus, soldPrice: "", soldDate: "" }, "Restored on this device. It'll sync when you're back online.");
      setInventoryStatusView("active");
      return;
    }

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
      pushToast("Please log in before saving to your collection.", "error");
      return;
    }

    if (!online || isPendingId(draft.id)) {
      if (!queueReady) {
        requireOnline("saving this edit");
        return;
      }

      // Photos are the one part of an edit that cannot wait here.
      //
      // Adding one means uploading a blob and writing the row's photo list;
      // removing one means deleting from storage. Both are storage
      // operations, not column changes, and queueing them would mean holding
      // a second kind of pending photo state -- one attached to a row that
      // already exists -- for the rarest thing anyone does in a shop. The
      // fields are queued; the photos are refused, in the same breath, rather
      // than silently dropped.
      const photoChange =
        (newItemPhotos || []).length > 0 ||
        (newReceiptPhotos || []).length > 0 ||
        (removedItemPhotoPaths || []).length > 0 ||
        (removedReceiptPhotoPaths || []).length > 0;

      if (photoChange) {
        pushToast("You're offline, so photo changes have to wait. Edit the details now and add or remove photos on a connection.", "warning");
        return;
      }

      const existing = inventory.find((entry) => entry.id === draft.id) || {};
      // Only what actually changed: a whole-row write would clobber fields
      // edited on another device with values this one merely displayed.
      const fields = {};
      Object.entries(draft).forEach(([key, value]) => {
        if (key === "id" || key === "itemPhotos" || key === "receiptPhotos") return;
        if (existing[key] !== value) fields[key] = value;
      });

      if (Object.keys(fields).length === 0) {
        setEditingItem(null);
        return;
      }

      const queued = await queueItemUpdate(draft.id, fields, "Edited on this device. It'll sync when you're back online.");
      if (queued) setEditingItem(null);
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
          author: draft.author || "",
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
          hidden_from_share: Boolean(draft.hiddenFromShare),
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

  // ---------------------------------------------------------------------
  // Wishlist
  // ---------------------------------------------------------------------

  async function loadWishlist(userId) {
    setWishlistLoading(true);
    try {
      const { data, error } = await supabase
        .from("wishlist_items")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        // Non-fatal, unlike the inventory load: a collector whose wishlist
        // fails to load still has a working collection, so this reports
        // quietly rather than taking the whole session down.
        console.error("Load wishlist error:", error.message);
        return;
      }

      setWishlist((data || []).map(fromDbWant));
    } finally {
      setWishlistLoading(false);
    }
  }

  async function saveWant(want) {
    if (!currentUser || !isWantSaveable(want)) return;
    if (!requireOnline("saving a want")) return;
    setSavingWant(true);

    try {
      const row = toDbWant(want, currentUser.id);

      // Insert or update on the same path, decided by whether the draft
      // carries an id -- the dialog is the same dialog either way.
      const query = want.id
        ? supabase.from("wishlist_items").update(row).eq("id", want.id).select().single()
        : supabase.from("wishlist_items").insert(row).select().single();

      const { data, error } = await query;

      if (error) {
        console.error("Save want error:", error.message);
        pushToast(error.message, "error");
        return;
      }

      const saved = fromDbWant(data);
      setWishlist((current) => {
        const without = current.filter((entry) => entry.id !== saved.id);
        return [saved, ...without];
      });

      trackEvent(want.id ? "want_updated" : "want_added", {
        priority: saved.priority,
        has_ceiling: Boolean(saved.maxPrice),
        is_upgrade: Boolean(saved.upgradeForItemId)
      });

      setEditingWant(null);
      pushToast(want.id ? "Want updated." : "Added to your wishlist.", "success");
    } finally {
      setSavingWant(false);
    }
  }

  async function deleteWant(id) {
    if (!requireOnline("deleting a want")) return;

    const { error } = await supabase.from("wishlist_items").delete().eq("id", id);

    if (error) {
      console.error("Delete want error:", error.message);
      pushToast(error.message, "error");
      return;
    }

    setWishlist((current) => current.filter((entry) => entry.id !== id));
    setEditingWant(null);
    pushToast("Removed from your wishlist.", "success");
  }

  // The acquisition: a want becomes an owned item.
  //
  // Two writes that are deliberately not a transaction. The item is created
  // first, and only a successful insert marks the want found -- so the failure
  // mode is a collector who owns the book and still has the want on their
  // list, which they can see and clear. The reverse order could mark a hunt
  // over while the book never reached the collection, which they could not.
  async function markWantFound(want, found, photos = { itemPhotos: [], receiptPhotos: [] }) {
    if (!currentUser) return;
    // Deliberately not queued: marking a want found writes the new item's id
    // onto the want, and a queued item has no id until it reaches Postgres.
    // The collector can add the copy offline and close the want later.
    if (!requireOnline("marking a want found")) return;
    setSavingWant(true);

    try {
      // The same path the Add Items flows use, rather than a second thinner
      // insert of its own: it allocates the reference number, uploads the
      // photos, writes their paths back onto the row, and reports partial
      // photo failures. A found copy deserves the same record as one added
      // any other way -- and this is one insert to keep correct, not two.
      const row = await insertItemWithPhotos(
        wantToItem(want, found),
        photos.itemPhotos || [],
        photos.receiptPhotos || [],
        "wishlist_found"
      );

      // Already reported by insertItemWithPhotos. Leaving the want open is the
      // right outcome: the collector can see the hunt is unfinished and retry.
      if (!row) return;

      const savedItem = fromDbItem(row);

      const { data: wantData, error: wantError } = await supabase
        .from("wishlist_items")
        .update({ found_at: new Date().toISOString(), found_item_id: savedItem.id, updated_at: new Date().toISOString() })
        .eq("id", want.id)
        .select()
        .single();

      if (wantError) {
        // The item is already saved, which is the half that matters. Say so
        // rather than implying nothing happened.
        console.error("Found-want update error:", wantError.message);
        pushToast("Added to your collection, but the want stayed on your list.", "warning");
        setFoundWant(null);
        return;
      }

      setWishlist((current) => current.map((entry) => (entry.id === want.id ? fromDbWant(wantData) : entry)));

      const ceiling = compareToCeiling(want, found.purchasePrice);
      trackEvent("want_found", {
        priority: want.priority,
        under_ceiling: ceiling ? ceiling.under : null,
        has_item_photo: (photos.itemPhotos || []).length > 0,
        has_receipt_photo: (photos.receiptPhotos || []).length > 0
      });

      setFoundWant(null);
    } finally {
      setSavingWant(false);
    }
  }

  // ---------------------------------------------------------------------
  // Public collection page (/c/<slug>)
  // ---------------------------------------------------------------------

  async function loadShareSettings(userId) {
    const { data, error } = await supabase
      .from("shared_collections")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      // Non-fatal: a collection that can't read its share settings is still a
      // working collection. The dialog falls back to the defaults, which
      // publish nothing.
      console.error("Load share settings error:", error.message);
      setShareSettings({ ...defaultShareSettings, slug: "" });
      return;
    }

    setShareSettings(data ? fromDbShareSettings(data) : { ...defaultShareSettings, slug: "" });
  }

  async function saveShareSettings(next) {
    if (!currentUser || !shareSettings) return;
    setSavingShare(true);

    try {
      // The slug is minted on first save rather than when the row is created,
      // so a collector who opens the dialog and closes it never has a URL
      // sitting in the database at all.
      const slug = shareSettings.slug || generateShareSlug();
      const { data, error } = await supabase
        .from("shared_collections")
        .upsert(toDbShareRow(next, currentUser.id, slug), { onConflict: "user_id" })
        .select()
        .single();

      if (error) {
        console.error("Save share settings error:", error.message);
        pushToast(error.message, "error");
        return;
      }

      const saved = fromDbShareSettings(data);
      setShareSettings(saved);
      trackEvent("share_settings_saved", {
        visibility: saved.visibility,
        preset: matchingPresetId(saved) || "custom",
        shows_prices: saved.showPrices,
        shows_notes: saved.showNotes
      });

      pushToast(
        saved.visibility === "off" ? "Your page is off. The link no longer opens." : "Your collection page is live.",
        "success"
      );
    } finally {
      setSavingShare(false);
    }
  }

  // Rotates the slug, which is what actually revokes a link already sent. The
  // confirm is deliberate: there is no undo, and anyone holding the old link
  // silently loses access -- which is the point, but not something to do by
  // mis-clicking.
  async function resetShareLink() {
    if (!currentUser || !shareSettings?.slug) return;
    if (!window.confirm("Reset your link? Every link you've already shared will stop working, and there's no way back to the old one.")) return;

    setSavingShare(true);

    try {
      const { data, error } = await supabase
        .from("shared_collections")
        .update({ slug: generateShareSlug(), updated_at: new Date().toISOString() })
        .eq("user_id", currentUser.id)
        .select()
        .single();

      if (error) {
        console.error("Reset share link error:", error.message);
        pushToast(error.message, "error");
        return;
      }

      setShareSettings(fromDbShareSettings(data));
      trackEvent("share_link_reset");
      pushToast("New link created. The old one no longer works.", "success");
    } finally {
      setSavingShare(false);
    }
  }

  function openShareDialog() {
    if (!shareSettings) {
      pushToast("Still loading your sharing settings — try again in a moment.", "warning");
      return;
    }
    trackEvent("share_dialog_opened", { visibility: shareSettings.visibility });
    setShareDialogOpen(true);
  }

  // Saves a single field edited inline from the Records table.
  //
  // Deliberately reuses csvUpdateRow so inline edits, CSV bulk edits, and the
  // edit modal all apply the same sold-status rules. Without that, changing
  // status inline would leave sold_price/sold_date/previous_status inconsistent.
  async function updateItemFields(itemId, fields) {
    const existing = inventory.find((entry) => entry.id === itemId);
    if (!existing || !currentUser) return;
    if (!online || isPendingId(itemId)) {
      if (!queueReady) {
        requireOnline("this edit");
        return;
      }

      const enriched = { ...fields };
      if (fields.status === "Sold" && !existing.soldDate) enriched.soldDate = todayIso();
      await queueItemUpdate(itemId, enriched, "Edited on this device. It'll sync when you're back online.");
      return;
    }

    // Match the edit modal: moving an item to Sold defaults the sale date to
    // today rather than leaving it blank.
    const enriched = { ...fields };
    if (fields.status === "Sold" && !existing.soldDate) enriched.soldDate = todayIso();

    // Optimistic, so the table responds immediately; rolled back on failure.
    setInventory((items) => items.map((entry) => (entry.id === itemId ? { ...entry, ...enriched } : entry)));

    const row = csvUpdateRow(existing, enriched, currentUser.id);
    delete row.id;
    delete row.user_id;

    const { data, error } = await supabase
      .from("inventory_items")
      .update(row)
      .eq("id", itemId)
      .eq("user_id", currentUser.id)
      .select()
      .single();

    if (error) {
      console.error("Inline edit error:", error.message);
      pushToast(error.message, "error");
      setInventory((items) => items.map((entry) => (entry.id === itemId ? existing : entry)));
      return;
    }

    trackEvent("item_inline_edited", { field: Object.keys(fields)[0] || "unknown" });
    setInventory((items) => items.map((entry) => (entry.id === itemId ? fromDbItem(data) : entry)));
  }

  async function fileToPhoto(file) {
    const compressed = await compressImage(file, 1400, 0.8);
    return { id: `identify-${Date.now()}-${Math.random()}`, name: file.name, url: URL.createObjectURL(compressed), file: compressed };
  }

  function photoToDataUrl(photo) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not read that photo."));
      reader.readAsDataURL(photo.file);
    });
  }

  // Runs the identification call for a set of photos. Used both for the first
  // photo and for re-running with extra evidence (copyright page, ISBN) added
  // on the review screen. Nothing is written to the collection here.
  async function runIdentification(photos) {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) {
      pushToast("Please log in again before identifying a photo.", "error");
      return null;
    }

    const images = await Promise.all(photos.map(photoToDataUrl));

    const response = await fetch("/api/identify-book", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ images })
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      pushToast(payload.error || "Couldn't identify those photos. Please try again.", "error");
      return null;
    }

    const result = payload.result || {};
    trackEvent("photo_identified", {
      confidence: result.confidence || "unknown",
      category: result.category || "Other",
      photo_count: photos.length,
      comparable_count: Array.isArray(result.comparables) ? result.comparables.length : 0,
      has_value_estimate: Number(result.estimatedValueLow) > 0 || Number(result.estimatedValueHigh) > 0
    });
    return result;
  }

  // Maps an identification result onto item fields. Only touches what the model
  // produces -- cost basis, purchase date, source, and notes belong to the user
  // and survive a re-identification. estimatedValue is deliberately left out:
  // the result now carries a range plus its supporting comparables, and the
  // user picks a number from that rather than the field being silently
  // pre-filled with a point estimate the schema can no longer even produce.
  function identifiedFields(result) {
    const category = result.category || "Book";
    // The model returns one credit line. It belongs in Author for the things
    // that have one, and in Make / Publisher / Brand for everything else --
    // the other field is cleared rather than left holding a stale name from a
    // previous identification of a different item.
    const credit = result.author || "";

    return {
      name: result.title || "",
      author: usesAuthorField(category) ? credit : "",
      maker: usesAuthorField(category) ? "" : credit,
      category,
      bookGenre: result.genre || "",
      bookEdition: result.edition || "",
      bookPrinting: result.printing || "",
      condition: result.condition || ""
    };
  }

  async function handleIdentifyPhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!currentUser) {
      pushToast("Please log in before identifying a photo.", "error");
      return;
    }

    if (!requireOnline("identifying a photo")) return;

    let photo;
    try {
      photo = await fileToPhoto(file);
    } catch (error) {
      pushToast("Could not read that photo.", "error");
      return;
    }

    // Held in state so the loading overlay can show the actual photo being read.
    setIdentifyingPhotos([photo]);
    setIdentifying(true);

    try {
      const result = await runIdentification([photo]);
      if (!result) {
        clearPhotoUrls([photo]);
        return;
      }

      setIdentifyDraft({
        // Cost basis is deliberately left blank: only the collector knows what
        // they actually paid, and guessing it would corrupt gain calculations.
        item: { ...emptyItem, ...identifiedFields(result), estimatedValue: "", purchasePrice: "", purchaseDate: todayIso() },
        photos: [photo],
        valueRange: toValueRange(result, "estimatedValueLow", "estimatedValueHigh"),
        firstEditionRange: toValueRange(result, "firstEditionFirstPrintingValueLow", "firstEditionFirstPrintingValueHigh"),
        editionRationale: result.editionRationale || "",
        summary: result.summary || "",
        conditionNotes: result.conditionNotes || "",
        comparables: Array.isArray(result.comparables) ? result.comparables : [],
        citations: Array.isArray(result.citations) ? result.citations : [],
        confidence: result.confidence || "low"
      });
      setActiveView("identify");
    } catch (error) {
      console.error("Identify photo error:", error.message);
      pushToast(error.message || "Couldn't identify that photo. Please try again.", "error");
      clearPhotoUrls([photo]);
    } finally {
      setIdentifying(false);
      setIdentifyingPhotos([]);
    }
  }

  async function addIdentifyPhotos(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0 || !identifyDraft) return;

    const room = 4 - identifyDraft.photos.length;
    if (room <= 0) {
      pushToast("You can use up to 4 photos at a time.", "warning");
      return;
    }

    try {
      const added = await Promise.all(files.slice(0, room).map(fileToPhoto));
      setIdentifyDraft((draft) => ({ ...draft, photos: [...draft.photos, ...added] }));
      if (files.length > room) pushToast(`Added ${room} photo${room === 1 ? "" : "s"} — the limit is 4.`, "warning");
    } catch (error) {
      pushToast("Could not read one of those photos.", "error");
    }
  }

  function removeIdentifyPhoto(photoId) {
    setIdentifyDraft((draft) => {
      const photo = draft.photos.find((entry) => entry.id === photoId);
      if (photo) URL.revokeObjectURL(photo.url);
      return { ...draft, photos: draft.photos.filter((entry) => entry.id !== photoId) };
    });
  }

  // Re-runs identification with every photo now attached. Replaces the
  // identified fields, since the whole point is that the new evidence should
  // win, and leaves the user's own entries alone.
  async function reIdentify() {
    if (!identifyDraft || identifyDraft.photos.length === 0) return;

    setIdentifyingPhotos(identifyDraft.photos);
    setIdentifying(true);

    try {
      const result = await runIdentification(identifyDraft.photos);
      if (!result) return;

      setIdentifyDraft((draft) => ({
        ...draft,
        item: { ...draft.item, ...identifiedFields(result) },
        valueRange: toValueRange(result, "estimatedValueLow", "estimatedValueHigh"),
        firstEditionRange: toValueRange(result, "firstEditionFirstPrintingValueLow", "firstEditionFirstPrintingValueHigh"),
        editionRationale: result.editionRationale || "",
        summary: result.summary || "",
        conditionNotes: result.conditionNotes || "",
        comparables: Array.isArray(result.comparables) ? result.comparables : [],
        citations: Array.isArray(result.citations) ? result.citations : [],
        confidence: result.confidence || "low"
      }));
      pushToast("Updated using all of your photos.", "success");
    } catch (error) {
      console.error("Re-identify error:", error.message);
      pushToast("Couldn't re-check those photos. Please try again.", "error");
    } finally {
      setIdentifying(false);
      setIdentifyingPhotos([]);
    }
  }

  async function saveIdentifiedItem() {
    if (!identifyDraft) return;
    const saved = await insertItemWithPhotos(identifyDraft.item, identifyDraft.photos, [], "photo_identify");
    if (!saved) return;

    // Separate from the generic inventory_item_submitted event (which every
    // entry path fires) so this specific feature's completion rate -- click
    // to submit -- can be read on its own rather than filtered out of a
    // shared event.
    trackEvent("identify_item_submitted", {
      confidence: identifyDraft.confidence || "unknown",
      category: identifyDraft.item.category || "Other",
      photo_count: identifyDraft.photos.length,
      has_estimated_value: hasValue(identifyDraft.item.estimatedValue)
    });

    clearPhotoUrls(identifyDraft.photos);
    setIdentifyDraft(null);
    setActiveView("inventory");
  }

  function discardIdentifyDraft() {
    if (identifyDraft) clearPhotoUrls(identifyDraft.photos);
    setIdentifyDraft(null);
    setActiveView("addItems");
  }

  function downloadTemplate() {
    const csv = buildCsvTemplate();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "firstfinder-collection-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleBulkUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = async () => {
      if (!currentUser) {
        pushToast("Please log in before importing a collection.", "error");
        return;
      }

      setBulkUploading(true);

      try {
        const batch = parseCsvBatch(String(reader.result || ""), inventory);

        if (batch.error) {
          pushToast(batch.error, "error");
          return;
        }

        // Nothing is written yet. The user confirms from the preview first,
        // since this is the only flow in the app that can delete in bulk.
        trackEvent("csv_uploaded", {
          source_page: "add_inventory",
          create_count: batch.creates.length,
          update_count: batch.updates.length,
          delete_count: batch.deletes.length
        });
        setPendingImport({ batch, fileName: file.name });
      } finally {
        setBulkUploading(false);
      }
    };

    reader.readAsText(file);
    event.target.value = "";
  }

  async function applyPendingImport() {
    if (!pendingImport || !currentUser) return;
    if (!requireOnline("applying an import")) return;

    const { creates, updates, deletes } = pendingImport.batch;
    setApplyingImport(true);

    try {
      let created = [];
      if (creates.length > 0) {
        const { numbers, error: referenceError } = await nextReferenceNumbers(currentUser.id, creates.length);
        if (referenceError) {
          pushToast(referenceError, "error");
          return;
        }

        const rows = creates.map((entry, index) => toDbItem({ ...entry, referenceNumber: numbers[index] }, currentUser.id, 0, 0));
        const { data, error } = await supabase.from("inventory_items").insert(rows).select();

        if (error) {
          console.error("Bulk create error:", error.message);
          pushToast(error.message, "error");
          return;
        }
        created = (data || []).map(fromDbItem);
      }

      let updated = [];
      if (updates.length > 0) {
        const rows = updates.map(({ existing, fields }) => csvUpdateRow(existing, fields, currentUser.id));
        const { data, error } = await supabase.from("inventory_items").upsert(rows).select();

        if (error) {
          console.error("Bulk update error:", error.message);
          pushToast(error.message, "error");
          return;
        }
        updated = (data || []).map(fromDbItem);
      }

      if (deletes.length > 0) {
        // Best-effort photo cleanup first, mirroring deleteItem: the rows are
        // what matter, and an orphaned file is better than a blocked delete.
        const photoPaths = deletes
          .flatMap((item) => [...(item.itemPhotos || []), ...(item.receiptPhotos || [])])
          .map((photo) => photo.path)
          .filter(Boolean);

        if (photoPaths.length > 0) {
          const { error: storageError } = await supabase.storage.from(PHOTO_BUCKET).remove(photoPaths);
          if (storageError) console.error("Photo cleanup error:", storageError.message);
        }

        const { error } = await supabase
          .from("inventory_items")
          .delete()
          .in("id", deletes.map((item) => item.id))
          .eq("user_id", currentUser.id);

        if (error) {
          console.error("Bulk delete error:", error.message);
          pushToast(error.message, "error");
          return;
        }
      }

      const deletedIds = new Set(deletes.map((item) => item.id));
      const updatedById = new Map(updated.map((item) => [item.id, item]));
      setInventory((items) => [
        ...created,
        ...items.filter((item) => !deletedIds.has(item.id)).map((item) => updatedById.get(item.id) || item)
      ]);

      trackEvent("csv_bulk_applied", {
        created_count: created.length,
        updated_count: updated.length,
        deleted_count: deletes.length
      });

      const summary = `${created.length} added, ${updated.length} updated, ${deletes.length} deleted.`;
      setBulkMessage(`Applied ${pendingImport.fileName}: ${summary}`);
      pushToast(summary, "success");
      setPendingImport(null);
      setActiveView("inventory");
    } finally {
      setApplyingImport(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6efe3] text-[#201a14] print:min-h-0 print:bg-white">
      <div className="print:hidden">
        <ToastStack toasts={toasts} onDismiss={dismissToast} />
      </div>

      <nav className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-5 md:gap-8 print:hidden">
        {/* min-w-0 rather than shrink-0, and the tagline is hidden on the
            narrowest screens. With shrink-0 here the wordmark held its full
            322px on a 375px phone, so nothing in the row could give way and
            the log out button was pushed ~130px past the right edge -- which
            mobile Safari answers by shrinking the whole page to fit, leaving
            a white gutter down the side of every view. */}
        <button onClick={() => go(isLoggedIn ? "dashboard" : "home")} className="flex min-w-0 items-center gap-3 text-left">
          <img src="/firstfinder-mark-exact.png" alt="FirstFinder logo" className="h-10 w-10 shrink-0 rounded-xl object-cover" /><div className="min-w-0"><div className="truncate text-xl font-semibold tracking-tight">FirstFinder</div><div className="hidden truncate text-xs uppercase tracking-[0.22em] text-[#746655] sm:block">Your collection, catalogued</div></div>
        </button>

        <NavTabs
          items={navItems}
          activeView={activeView}
          onSelect={go}
          containerRef={navSlotRef}
          measureRef={navMeasureRef}
          visibleCount={visibleNavCount}
        />

        <div className="flex shrink-0 items-center gap-2">
          {isLoggedIn ? <Button variant="outline" onClick={logout} className="rounded-full border-[#cdbb9d] bg-[#fff8ee] px-5 hover:bg-white">Log out</Button> : <Button onClick={() => setActiveView("login")} className="rounded-full bg-[#123f38] px-5 text-[#fff7ea] hover:bg-[#0f332d]">Log in</Button>}
          {menuItems.length > 0 && (
            /* The menu is positioned against this wrapper rather than laid out
               in the page. It used to render as a full-width block below the
               nav, which pushed the whole page down on every open and read as
               a section of the page rather than a menu belonging to the
               button. Anchoring it here keeps it the size of its contents and
               leaves the layout underneath alone. */
            <div className="relative" ref={navMenuRef}>
              <button
                type="button"
                onClick={() => setMobileMenuOpen((open) => !open)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#d8c7ad] bg-[#fff8ee] text-[#201a14] hover:bg-white"
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileMenuOpen}
                aria-haspopup="menu"
              >
                <Icon name={mobileMenuOpen ? "x" : "menu"} size={18} />
              </button>

              {mobileMenuOpen && (
                /* right-0 rather than left-0: the button sits at the end of the
                   nav, so a menu growing rightwards would run off the screen on
                   a phone. z-40 keeps it above page content without going over
                   the toasts and modals, which sit higher. */
                <div
                  role="menu"
                  /* The height cap is not hypothetical: on the narrowest
                     screens the whole nav collapses in here, and eight items
                     stand ~400px tall -- taller than a phone's viewport in
                     landscape. Without this the last entries (Admin among
                     them, since it is appended last) sit below the fold with
                     no way to reach them. */
                  className="absolute right-0 top-full z-40 mt-2 flex max-h-[calc(100vh-5rem)] w-56 max-w-[calc(100vw-2rem)] flex-col gap-1 overflow-y-auto rounded-2xl border border-[#d8c7ad] bg-[#fff8ee] p-2 shadow-[0_18px_40px_-18px_rgba(32,26,20,0.45)]"
                >
                  {menuItems.map((navItem) => (
                    <MobileNavLink
                      key={navItem.view}
                      active={activeView === navItem.view}
                      onClick={() => (navItem.href ? goToHref(navItem.href) : go(navItem.view))}
                    >
                      {navItem.label}
                    </MobileNavLink>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </nav>

      {isLoggedIn && (!online || fromSnapshot) && (
        <OfflineBanner
          online={online}
          syncedAt={syncedAt}
          refreshing={inventoryLoading}
          // Offered only when the connection is supposedly working: "try
          // again" in front of someone who knows they have no signal is a
          // button that can only disappoint.
          onRefresh={online && currentUser ? () => loadInventory(currentUser.id) : undefined}
          queueNote={queueLabel(queueSummary)}
        />
      )}

      {isLoggedIn && queue.length > 0 && (
        <PendingSyncPanel
          summary={queueSummary}
          operations={queue}
          items={inventory}
          online={online}
          flushing={flushing}
          onSyncNow={() => currentUser && flushQueue(currentUser.id).then(() => loadInventory(currentUser.id))}
          onRetry={retryOperation}
          onDiscard={discardOperation}
        />
      )}

      {activeView === "home" && <HomePage onGetStarted={() => setActiveView(isLoggedIn ? "addItems" : "login")} />}
      {activeView === "roadmap" && <RoadmapPage />}
      {activeView === "wishlist" && isLoggedIn && (
        <WishlistPage
          wishlist={wishlist}
          openList={openWishlist}
          summary={wishlistSummary}
          loading={wishlistLoading}
          inventory={inventory}
          onAdd={() => setEditingWant({ ...emptyWant })}
          onEdit={(want) => setEditingWant(want)}
          onFound={(want) => setFoundWant(want)}
        />
      )}

      {editingWant && (
        <WantDialog
          want={editingWant}
          inventory={inventory}
          saving={savingWant}
          onSave={saveWant}
          onDelete={deleteWant}
          onClose={() => setEditingWant(null)}
        />
      )}

      {foundWant && (
        <FoundItDialog
          want={foundWant}
          saving={savingWant}
          onConfirm={markWantFound}
          onClose={() => setFoundWant(null)}
        />
      )}

      {activeView === "about" && <AboutPage onGoToFeedback={() => setActiveView(isLoggedIn ? "feedback" : "login")} onGoToContribute={() => setActiveView("contribute")} />}
      {activeView === "contribute" && <ContributePage onGoToFeedback={() => setActiveView(isLoggedIn ? "feedback" : "login")} />}
      {activeView === "terms" && <TermsPage onViewPrivacy={() => setActiveView("privacy")} />}
      {activeView === "privacy" && <PrivacyPage onViewTerms={() => setActiveView("terms")} />}
      {activeView === "login" && <LoginPage onViewTerms={() => setActiveView("terms")} onViewPrivacy={() => setActiveView("privacy")} />}
      {activeView === "resetPassword" && <ResetPasswordPage onDone={() => setActiveView("dashboard")} />}
      {activeView === "dashboard" && isLoggedIn && <DashboardPage inventory={inventory} loading={inventoryLoading} onAddItems={() => setActiveView("addItems")} onCollection={() => setActiveView("inventory")} onOpenItem={showItemInCollection} />}
      {activeView === "addItems" && isLoggedIn && <AddItemsPage quickItem={quickItem} setQuickItem={setQuickItem} quickItemPhotos={quickItemPhotos} quickReceiptPhotos={quickReceiptPhotos} onUpload={handlePhotoUpload} onRemove={removePhoto} onSave={saveQuickItem} saving={saving} onIdentifyPhoto={handleIdentifyPhoto} identifying={identifying} onFullAdd={() => setActiveView("tutorial")} onInventory={() => setActiveView("inventory")} inventory={activeInventory} totalCostBasis={totalCostBasis} totalEstimatedValue={totalEstimatedValue} totalGain={totalGain} onDownloadTemplate={downloadTemplate} onBulkUpload={handleBulkUpload} bulkUploading={bulkUploading} bulkMessage={bulkMessage} />}
      {activeView === "identify" && isLoggedIn && identifyDraft && <IdentifyReviewPage draft={identifyDraft} setDraft={setIdentifyDraft} onSubmit={saveIdentifiedItem} onDiscard={discardIdentifyDraft} saving={saving} onAddPhotos={addIdentifyPhotos} onRemovePhoto={removeIdentifyPhoto} onReIdentify={reIdentify} identifying={identifying} />}
      {activeView === "tutorial" && isLoggedIn && <FullAddPage item={item} setItem={setItem} itemPhotos={itemPhotos} receiptPhotos={receiptPhotos} onUpload={handlePhotoUpload} onRemove={removePhoto} onSave={saveItem} saving={saving} onReset={resetFullForm} onLoadSample={loadSample} />}
      {activeView === "inventory" && isLoggedIn && <InventoryPage inventory={visibleInventory} loading={inventoryLoading} filteredInventory={filteredInventory} searchTerm={searchTerm} setSearchTerm={setSearchTerm} viewMode={inventoryViewMode} setViewMode={setInventoryViewMode} statusView={inventoryStatusView} setStatusView={setInventoryStatusView} activeCount={activeInventory.length} soldCount={soldInventory.length} totalCostBasis={viewTotalCostBasis} totalEstimatedValue={viewTotalEstimatedValue} totalGain={viewTotalGain} onAdd={() => setActiveView("addItems")} onExport={() => setActiveView("insuranceExport")} onShare={openShareDialog} shareVisibility={shareSettings?.visibility} onDelete={deleteItem} onMarkSold={markSold} onRestoreSold={restoreSold} onEdit={setEditingItem} onInlineSave={updateItemFields} bulkMessage={bulkMessage} focusItemId={focusItemId} onFocusHandled={() => { focusItemRef.current = null; setFocusItemId(null); }} />}
      {activeView === "insuranceExport" && isLoggedIn && <InsuranceExportPage items={activeInventory} onBack={() => setActiveView("inventory")} />}
      {activeView === "feedback" && isLoggedIn && <FeedbackPage currentUser={currentUser} pushToast={pushToast} />}
      {activeView === "account" && isLoggedIn && <MyAccountPage currentUser={currentUser} inventory={inventory} pushToast={pushToast} />}

      {identifying && <IdentifyLoadingOverlay photos={identifyingPhotos} />}

      <SiteFooter isLoggedIn={isLoggedIn} onNavigate={go} />

      {pendingImport && (
        <BulkImportPreviewDialog
          fileName={pendingImport.fileName}
          batch={pendingImport.batch}
          applying={applyingImport}
          onCancel={() => setPendingImport(null)}
          onConfirm={applyPendingImport}
        />
      )}

      {editingItem && (
        <EditItemModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={updateInventoryItem}
          saving={saving}
        />
      )}

      {shareDialogOpen && shareSettings && (
        <ShareCollectionDialog
          settings={shareSettings}
          inventory={inventory}
          saving={savingShare}
          onSave={saveShareSettings}
          onResetLink={resetShareLink}
          onClose={() => setShareDialogOpen(false)}
          pushToast={pushToast}
        />
      )}

      {pendingDuplicateReview && (
        <DuplicateWarningDialog
          matches={pendingDuplicateReview.matches}
          saving={saving}
          onCancel={() => setPendingDuplicateReview(null)}
          onConfirm={confirmPendingDuplicateAndSave}
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
        category: "Trust & Provenance",
        title: "Grading & cert fields",
        text: "Grading company, grade, and cert number fields for graded cards and comics, with a direct link out to the grader's public cert-verification page."
      },
      {
        category: "Trust & Provenance",
        title: "Separate book & dust-jacket grades",
        text: "Grade the book and its dust jacket separately (e.g. VG/VG, NF/VG+), matching how booksellers actually describe first editions — the jacket wears differently and often carries most of the value."
      },
      {
        category: "Community",
        title: "Shareable collection page",
        text: "A public, read-only link to show off a shelf or set — the same instinct that makes PSA's and PCGS's set registries so sticky. You pick what it shows: titles, editions and condition to start with, and money, provenance, or notes only if you switch them on."
      },
      {
        category: "Discovery",
        title: "A real want list",
        text: "Give \"Wishlist\" its own view with a target price, instead of it being just another status buried in the collection tabs. Collecting is as much about the chase as the shelf, and right now FirstFinder only tracks the half you already own."
      }
    ]
  },
  {
    id: "next",
    label: "Next",
    framing: "Scoped, waiting on the Now list to clear.",
    items: [
      {
        category: "Trust & Provenance",
        title: "First-edition identification helper",
        text: "A per-book checklist for the points that actually prove a true first — number line, stated edition, issue points — the feature the FirstFinder name promises."
      },
      {
        category: "Cataloging",
        title: "Physical location / storage",
        text: "Structured or freeform storage locations — Home → Office → Bookcase B → Shelf 3 — so a growing collection stays findable, not just catalogued."
      },
      {
        category: "Trust & Provenance",
        title: "Provenance timeline",
        text: "Turn source, receipts, and notes into a structured ownership history — signed by the author, acquired by a previous owner, listed by a dealer — instead of separate, unlinked fields."
      }
    ]
  },
  {
    id: "later",
    label: "Later",
    framing: "Directionally right; sequencing depends on what Now/Next prove out.",
    items: [
      {
        category: "Trust & Provenance",
        title: "Evidence completeness scoring",
        text: "Score how defensible each record is for an insurance or estate claim — photos, receipt, purchase price, condition — and flag what's still missing."
      },
      {
        category: "Cataloging",
        title: "Linked records & set completion",
        text: "Connect related records — a dust jacket to its book, a volume to its set, a bookplate to its copy — instead of treating every item independently."
      },
      {
        category: "Valuation",
        title: "Appraisal fields & re-appraisal reminders",
        text: "Track a professional appraisal separately from the self-entered estimate, with a reminder to refresh it every three to five years the way insurers expect."
      },
      {
        category: "Cataloging",
        title: "Offline support for fairs and shops",
        text: "Keep adding and browsing items with no signal — the moments FirstFinder is most useful (a book fair, a shop basement, an estate sale) are exactly where connectivity is worst."
      },
      {
        category: "Cataloging",
        title: "Tags & custom fields",
        text: "Free-form tags and custom fields so collectors can organize by press, binding, series, or \"needs upgrading\" — the flexibility spreadsheets have that a fixed schema doesn't."
      },
      {
        category: "Discovery",
        title: "Import from LibraryThing, Goodreads, and Libib",
        text: "Accept those services' own export formats directly, since the real barrier to switching is the hundreds of items already catalogued somewhere else."
      },
      {
        category: "Discovery",
        title: "Sell directly through eBay",
        text: "List an item for sale on eBay straight from its FirstFinder record — the next tier up from today's AbeBooks/eBay search links."
      },
      {
        category: "Valuation",
        title: "Value-over-time charting",
        text: "What you paid and what you sold for are already tracked, so a value trend line is mostly a visualization problem once there's enough history per item."
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

// The Contribute page.
//
// FirstFinder is AGPL-licensed, and section 13 of that license expects an app
// people reach over a network to offer those people its source. This page is
// that offer -- and it doubles as the front door for anyone who wants to help,
// which is why it sits in the main nav next to Roadmap rather than being a
// link buried in the footer.
//
// The issue lists are read live from GitHub through app/api/contribute, so the
// page can't quietly go stale the way a hand-written "here's what needs doing"
// list always does. Everything else on the page is static and renders fine
// when that fetch fails.
const contributeWays = [
  {
    icon: "code",
    title: "Write some code",
    text: "The whole app is a Next.js and Supabase project you can clone and run locally in about ten minutes. Issues labeled good first issue are scoped small on purpose.",
    href: CONTRIBUTING_URL,
    cta: "Read the contributing guide",
    target: "contributing_guide"
  },
  {
    icon: "bug",
    title: "Report a bug",
    text: "Something not adding up in your collection? A precise bug report is worth as much as a patch: what you did, what you expected, and what you got instead.",
    href: BUG_REPORT_URL,
    cta: "File a bug report",
    target: "bug_report"
  },
  {
    icon: "plus",
    title: "Ask for a feature",
    text: "Describe the collecting problem rather than the solution. The Roadmap page shows what's already planned, and what's deliberately ruled out.",
    href: FEATURE_REQUEST_URL,
    cta: "Suggest a feature",
    target: "feature_request"
  },
  {
    icon: "search",
    title: "Test it on a real collection",
    text: "Rare books, comics, cards, memorabilia — real inventories break software in ways sample data never does. The odd edge case in your shelf is genuinely useful.",
    // Handled in-app rather than on GitHub, so collectors without a GitHub
    // account have a way in too.
    href: null,
    cta: "Send feedback in the app",
    target: "feedback"
  },
  {
    icon: "file",
    title: "Improve the docs",
    text: "If the setup steps didn't work on your machine, that's a bug in the documentation. Fixing one confusing paragraph helps more people than it looks like.",
    href: CONTRIBUTING_URL,
    cta: "See what's documented",
    target: "docs"
  },
  {
    icon: "heart",
    title: "Help pay for it",
    text: "Hosting, storage, the database, and every AI identification come out of one person's pocket so the app can stay free. Any donation keeps it that way.",
    href: DONATE_URL,
    cta: "Buy me a coffee",
    target: "donate"
  }
];

const contributeSetupCommands = [
  "git clone https://github.com/dchung8811/FirstFinder.git",
  "cd FirstFinder",
  "npm install",
  "cp .env.example .env.local   # add your Supabase URL and anon key",
  "npm run dev"
];

// "3 days ago" reads as a liveness signal in a way a formatted date doesn't --
// the question someone weighing a contribution is really asking is whether
// anyone is still working on this.
function formatRelativeTime(value) {
  if (!value) return null;
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return null;

  const days = Math.floor((Date.now() - then) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.round(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

function ContributeIssueList({ heading, blurb, label, issues, loading, failed }) {
  return (
    <div className="rounded-[2rem] border border-[#d8c7ad] bg-[#fbf5e9] p-5">
      <div className="flex items-baseline justify-between px-2">
        <h3 className="font-display text-2xl font-semibold">{heading}</h3>
        {!loading && !failed && (
          <span className="font-ledger text-xs text-[#8a7a64]">
            {issues.length} open
          </span>
        )}
      </div>
      <p className="mt-1 px-2 text-sm leading-6 text-[#7d6c5a]">{blurb}</p>

      <div className="mt-4 flex flex-col gap-3">
        {loading && (
          <div className="rounded-2xl border border-dashed border-[#e0d2bc] bg-[#fffdf8] p-4 text-sm text-[#8a7a64]">
            Checking GitHub…
          </div>
        )}

        {!loading && failed && (
          <div className="rounded-2xl border border-dashed border-[#e0d2bc] bg-[#fffdf8] p-4 text-sm leading-6 text-[#665746]">
            Couldn't reach GitHub just now.{" "}
            <a
              href={labelSearchUrl(label)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackEvent("contribute_link_clicked", { target: "issue_label_fallback" })}
              className="underline decoration-[#cdbb9d] underline-offset-2 hover:text-[#123f38]"
            >
              See the list on GitHub
            </a>
            .
          </div>
        )}

        {!loading && !failed && issues.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[#e0d2bc] bg-[#fffdf8] p-4 text-sm leading-6 text-[#665746]">
            Nothing open under this label right now. That's a good sign, not a closed door — pick anything from the roadmap, or open an issue with what you'd like to build.
          </div>
        )}

        {!loading &&
          !failed &&
          issues.map((issue) => (
            <a
              key={issue.number}
              href={issue.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackEvent("contribute_issue_opened", { issue_number: issue.number, label })}
              className="block rounded-2xl border border-[#e0d2bc] bg-[#fffdf8] p-4 shadow-sm transition hover:border-[#123f38]/30 hover:bg-white"
            >
              <div className="flex items-baseline gap-2">
                <span className="font-ledger text-xs text-[#8a7a64]">#{issue.number}</span>
                {issue.assigned && (
                  <span className="rounded-full bg-[#f0e2cf] px-2 py-0.5 text-[11px] text-[#665746]">Taken</span>
                )}
              </div>
              <div className="mt-1.5 font-semibold leading-snug">{issue.title}</div>
              {issue.labels.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {issue.labels.map((name) => (
                    <span key={name} className="rounded-full bg-[#edf4f2] px-2.5 py-1 text-[11px] font-medium text-[#123f38]">
                      {name}
                    </span>
                  ))}
                </div>
              )}
            </a>
          ))}
      </div>

      {!loading && !failed && issues.length > 0 && (
        <a
          href={labelSearchUrl(label)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent("contribute_link_clicked", { target: "issue_label_all" })}
          className="font-ledger mt-4 inline-flex items-center gap-1 px-2 text-xs uppercase tracking-[0.15em] text-[#655644] hover:text-[#123f38]"
        >
          All on GitHub <Icon name="arrow" size={12} />
        </a>
      )}
    </div>
  );
}

function ContributePage({ onGoToFeedback }) {
  // null until the fetch settles. A failed fetch stores an ok:false payload so
  // the lists can say so instead of spinning forever.
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/contribute")
      .then((response) => response.json())
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch(() => {
        if (!cancelled) setData({ ok: false, repo: null, goodFirstIssues: [], helpWanted: [] });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const loading = data === null;
  const failed = Boolean(data) && !data.ok;
  const repo = data?.repo || null;
  const lastPush = formatRelativeTime(repo?.lastPushedAt);

  function trackOutbound(target) {
    trackEvent("contribute_link_clicked", { target });
  }

  return (
    <section className="mx-auto max-w-6xl px-6 py-16 md:py-20">
      <div className="max-w-3xl">
        <div className="font-ledger inline-flex items-center gap-2 rounded-full border border-[#d9c9b0] bg-[#fff8ee] px-4 py-2 text-xs uppercase tracking-[0.2em] text-[#655644]">
          <Icon name="github" size={13} /> Open source
        </div>
        <h1 className="font-display mt-5 text-4xl font-semibold tracking-tight md:text-6xl">
          FirstFinder is yours to build on.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-[#665746]">
          Every line of this app is public, and free to read, run, fork, and improve. It's built and paid for by one collector, which means the fastest way to get the feature you want is often to help build it — and the second fastest is to say clearly what's missing.
        </p>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackOutbound("repository")}
          className="inline-flex h-12 items-center gap-2 rounded-full bg-[#123f38] px-7 text-base font-medium text-[#fff7ea] transition hover:bg-[#0f332d]"
        >
          <Icon name="github" size={18} /> View the source
        </a>
        <a
          href={CONTRIBUTING_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackOutbound("contributing_guide_hero")}
          className="inline-flex h-12 items-center gap-2 rounded-full border border-[#cdbb9d] bg-[#fff8ee] px-6 text-base font-medium text-[#665746] transition hover:bg-white"
        >
          Contributing guide <Icon name="arrow" size={16} />
        </a>

        {repo && (
          <div className="font-ledger flex flex-wrap items-center gap-4 text-xs text-[#8a7a64] sm:ml-2">
            <span className="inline-flex items-center gap-1.5">
              <Icon name="star" size={13} /> {repo.stars} star{repo.stars === 1 ? "" : "s"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="code" size={13} /> {repo.forks} fork{repo.forks === 1 ? "" : "s"}
            </span>
            {lastPush && <span>Last commit {lastPush}</span>}
          </div>
        )}
      </div>

      <div className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {contributeWays.map((way) => (
          <div key={way.title} className="flex flex-col rounded-[1.75rem] border border-[#d8c7ad] bg-[#fffdf8] p-6 shadow-sm">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[#edf4f2] text-[#123f38]">
              <Icon name={way.icon} size={18} />
            </span>
            <h2 className="font-display mt-4 text-xl font-semibold">{way.title}</h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-[#665746]">{way.text}</p>

            {way.href ? (
              <a
                href={way.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackOutbound(way.target)}
                className="font-ledger mt-4 inline-flex items-center gap-1 text-xs uppercase tracking-[0.15em] text-[#655644] hover:text-[#123f38]"
              >
                {way.cta} <Icon name="arrow" size={12} />
              </a>
            ) : (
              <button
                type="button"
                onClick={() => {
                  trackOutbound(way.target);
                  onGoToFeedback();
                }}
                className="font-ledger mt-4 inline-flex items-center gap-1 text-left text-xs uppercase tracking-[0.15em] text-[#655644] hover:text-[#123f38]"
              >
                {way.cta} <Icon name="arrow" size={12} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-14">
        <h2 className="font-display text-3xl font-semibold tracking-tight">Ready for someone to pick up</h2>
        <p className="mt-2 max-w-2xl leading-7 text-[#665746]">
          Read straight from GitHub, so this is what's genuinely open right now.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <ContributeIssueList
            heading="Good first issues"
            blurb="Small, self-contained, and safe to get wrong the first time."
            label={GOOD_FIRST_ISSUE_LABEL}
            issues={data?.goodFirstIssues || []}
            loading={loading}
            failed={failed}
          />
          <ContributeIssueList
            heading="Help wanted"
            blurb="Bigger pieces that are scoped and waiting on someone with time."
            label={HELP_WANTED_LABEL}
            issues={data?.helpWanted || []}
            loading={loading}
            failed={failed}
          />
        </div>
      </div>

      <div className="mt-14 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* min-w-0: without it this grid item refuses to shrink below the
            width of the longest setup command, and the whole page scrolls
            sideways on a phone instead of the code block scrolling on its own. */}
        <div className="min-w-0 rounded-[2rem] border border-[#d8c7ad] bg-[#fbf5e9] p-6 md:p-8">
          <h2 className="font-display text-2xl font-semibold">Run it on your own machine</h2>
          <p className="mt-2 leading-7 text-[#665746]">
            You'll need Node 20.9 or newer and a free Supabase project. Paste <span className="font-ledger text-[#4a3f33]">supabase/schema.sql</span> into Supabase's SQL editor to create the database, then:
          </p>
          <pre className="font-ledger mt-4 overflow-x-auto rounded-2xl bg-[#123f38] p-5 text-xs leading-6 text-[#fff7ea]">
{contributeSetupCommands.join("\n")}
          </pre>
          <a
            href={`${CONTRIBUTING_URL}#local-setup`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackOutbound("local_setup")}
            className="font-ledger mt-4 inline-flex items-center gap-1 text-xs uppercase tracking-[0.15em] text-[#655644] hover:text-[#123f38]"
          >
            Full setup walkthrough <Icon name="arrow" size={12} />
          </a>
        </div>

        <div className="rounded-[2rem] border border-dashed border-[#d3c1a4] bg-[#fffdf8] p-6 md:p-8">
          <div className="font-ledger text-xs uppercase tracking-[0.2em] text-[#8a7a64]">The license, in plain words</div>
          <p className="mt-3 leading-7 text-[#665746]">
            FirstFinder is released under the GNU AGPL v3. Use it, study it, change it, run your own copy for your own shelf — all fine. The one condition: if you run a modified version as a service other people can reach, you have to publish your changes too. That's what keeps this app, and anything built from it, open for collectors.
          </p>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
            {[
              { label: "Read the license", href: LICENSE_URL, target: "license" },
              { label: "Code of Conduct", href: CODE_OF_CONDUCT_URL, target: "code_of_conduct" },
              { label: "Report a vulnerability", href: SECURITY_URL, target: "security_policy" }
            ].map((link) => (
              <a
                key={link.target}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackOutbound(link.target)}
                className="font-ledger text-xs uppercase tracking-[0.15em] text-[#655644] underline decoration-[#cdbb9d] underline-offset-4 hover:text-[#123f38]"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
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

const aboutAudience = [
  "The hobbyist whose collection outgrew a spreadsheet",
  "Anyone who wants receipts, condition, and provenance kept together",
  "Collectors who need a record their insurer or family could actually use",
  "People who collect across categories — books, cards, comics, memorabilia"
];

const aboutNonAudience = [
  "Booksellers and dealers running stock",
  "Anyone who needs invoicing, consignment, or point of sale",
  "Multi-user teams with shared accounts and permissions",
  "Marketplace sellers looking for listing automation"
];

function AboutPage({ onGoToFeedback, onGoToContribute }) {
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

      {/* Naming who FirstFinder isn't for is what makes the rest of this page
          credible. Every feature decision gets weighed against the collector
          described here, so it's worth stating plainly rather than leaving
          people to infer it from the roadmap. */}
      <div className="mt-14 rounded-[2rem] border border-[#d8c7ad] bg-[#fff9f0] p-7 md:p-9">
        <div className="font-ledger text-xs uppercase tracking-[0.2em] text-[#8a7a64]">Who FirstFinder is for</div>
        <p className="mt-4 text-lg leading-8 text-[#665746]">
          <span className="font-medium text-[#201a14]">The collector with forty books, not the shop with four thousand.</span>{" "}
          FirstFinder is built for people who collect because they love it — who know the story of how each piece was
          found, and who want that story kept somewhere better than a spreadsheet.
        </p>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <div className="font-display text-lg font-semibold text-[#201a14]">Built for</div>
            <ul className="mt-3 space-y-2 text-[#665746]">
              {aboutAudience.map((line) => (
                <li key={line} className="flex items-start gap-2 leading-7">
                  <Icon name="check" size={15} className="mt-1.5 shrink-0 text-[#2f7d6b]" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="font-display text-lg font-semibold text-[#201a14]">Not built for</div>
            <ul className="mt-3 space-y-2 text-[#665746]">
              {aboutNonAudience.map((line) => (
                <li key={line} className="flex items-start gap-2 leading-7">
                  <Icon name="x" size={15} className="mt-1.5 shrink-0 text-[#b09a78]" />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-12 flex justify-center">
        <Button onClick={onGoToFeedback} className="h-12 rounded-full bg-[#123f38] px-7 text-base text-[#fff7ea] hover:bg-[#0f332d]">
          Share your ideas <Icon name="arrow" size={18} className="ml-1" />
        </Button>
      </div>

      {/* The Contribute page used to have its own nav tab. It doesn't anymore --
          it was competing with the pages people actually open, and contributing
          is something you go looking for after you care about the project, not
          before. This is that entry point: the story ends by saying the source
          is public, and the reader is already here for the story. */}
      <div className="mt-16 rounded-[2rem] border border-[#d8c7ad] bg-[#fff9f0] p-7 text-center md:p-9">
        <div className="font-ledger inline-flex items-center gap-2 rounded-full border border-[#d9c9b0] bg-[#fff8ee] px-4 py-2 text-xs uppercase tracking-[0.2em] text-[#655644]">
          <Icon name="github" size={13} /> Open source
        </div>
        <p className="mx-auto mt-5 max-w-xl leading-7 text-[#665746]">
          Every line of FirstFinder is public — free to read, run, fork, and improve. If something here is missing or
          broken, you don't have to wait for me to get to it. The Contribute page lists what's open right now, including
          the issues tagged for a first-time contributor.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            // The nav tab is gone, so this button and the footer link are the
            // only ways in. Tracked so it's answerable whether About actually
            // carries that traffic, rather than assumed.
            trackEvent("contribute_page_opened", { source_page: "about" });
            onGoToContribute();
          }}
          className="mt-6 h-11 rounded-full border-[#cdbb9d] bg-[#fff8ee] px-6 text-sm hover:bg-white"
        >
          See how to contribute <Icon name="arrow" size={16} className="ml-1" />
        </Button>
      </div>

      <div className="mt-16 border-t border-[#e0d2bc] pt-10 text-center">
        <p className="mx-auto max-w-xl leading-7 text-[#665746]">
          FirstFinder is free, and always will be. It's a passion project I built and pay for out of my own pocket to help fellow collectors keep track of what they love. Running it — hosting, storage, the database, all of it — costs real time and money as more people use it. If you've gotten value out of FirstFinder and want to help keep it free for everyone, any donation is genuinely appreciated.
        </p>
        <a
          href="https://buymeacoffee.com/firstfinder"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent("donation_link_clicked", { source_page: "about" })}
          className="mt-5 inline-flex h-11 items-center gap-2 rounded-full border border-[#cdbb9d] bg-[#fff8ee] px-6 text-sm font-medium text-[#665746] hover:bg-white"
        >
          <Icon name="heart" size={16} /> Buy me a coffee
        </a>
      </div>
    </section>
  );
}


// Terms of Service. Kept as data rather than a wall of JSX so sections can be
// edited, reordered, or added without touching layout, and so the jump links
// at the top of the page generate from the same source they link into.
//
// Update termsLastUpdated whenever the substance below changes -- section 12
// tells people that date is how they know the terms moved.
const termsLastUpdated = "September 9, 2026";

// A plain-English gloss shown above the binding text. It is explicitly not a
// substitute for the sections themselves, and it stays short enough that
// people actually read it before scrolling past.
const termsSummary = [
  "FirstFinder is a free cataloging tool. Your collection, photos, and records stay yours.",
  "Don't upload anything illegal, and don't use FirstFinder to catalog stolen or trafficked property.",
  "We can suspend or close an account that breaks these rules.",
  "Illegal content gets preserved and reported to law enforcement.",
  "Estimated values are estimates, not appraisals. Don't file an insurance claim on one.",
  "This is a hobby project. It can break or disappear, so keep your own copies — see section 9."
];

const termsSections = [
  {
    id: "agreement",
    heading: "1. The agreement",
    paragraphs: [
      "These Terms of Service (the \"Terms\") are a binding agreement between you and FirstFinder (\"FirstFinder,\" \"we,\" \"us\"). They cover the FirstFinder website and app, and everything you do with them.",
      "By creating an account, logging in, or otherwise using FirstFinder, you accept these Terms. If you don't agree with them, don't use FirstFinder.",
      "Our Privacy Policy explains what information FirstFinder collects, why, who else receives it, and how to have it deleted. It forms part of these Terms, and accepting these Terms means accepting it too."
    ]
  },
  {
    id: "account",
    heading: "2. Your account",
    paragraphs: [
      "You must be at least 13 years old to hold a FirstFinder account. If you are under the age of majority where you live, you may use FirstFinder only with a parent or guardian who agrees to these Terms on your behalf.",
      "Accounts belong to one person. Keep your password to yourself, don't reuse a password from somewhere else, and tell us promptly if you think someone has gotten into your account. You are responsible for what happens under it.",
      "Give us accurate account information and keep it current. You can permanently delete your account, your collection, and your stored photos at any time from My Account — you don't need to ask us first."
    ]
  },
  {
    id: "acceptable-use",
    heading: "3. Acceptable use",
    paragraphs: [
      "FirstFinder is a cataloging tool for collectors. Use it for that. You agree not to use FirstFinder to do, upload, store, or share any of the following:"
    ],
    list: [
      "Sexual content involving minors, in any form. This is the one rule with no discretion attached: we report it and we close the account.",
      "Anything illegal to create, possess, or distribute where you are or where we operate.",
      "Intimate images of another person shared without their consent.",
      "Threats, harassment, stalking, incitement to violence, or content promoting terrorism or violent extremism.",
      "Cataloging or documenting property you know or reasonably suspect to be stolen, looted, illegally trafficked, or unlawfully removed from a library, archive, museum, or protected site.",
      "Forged, altered, or fabricated provenance, receipts, certificates, or condition records — including using FirstFinder records to support a fraudulent sale, insurance claim, or appraisal.",
      "Impersonating another person, or presenting a collection that isn't yours as your own.",
      "Content that infringes someone else's copyright, trademark, or other rights.",
      "Malware, phishing, spam, or anything built to damage or disrupt FirstFinder or the people using it.",
      "Attempting to reach another person's account, collection, or photos; probing or bypassing our authentication, access controls, or security; or scraping, crawling, or automating access without our written permission.",
      "Reverse engineering the service, or reselling, sublicensing, or commercially exploiting any part of it.",
      "Deliberately overloading our storage, database, or the photo identification feature — for example, bulk uploads unrelated to a real collection."
    ],
    closing: "That list isn't exhaustive. If you are using FirstFinder in a way a reasonable person would call abusive, assume it's covered."
  },
  {
    id: "your-content",
    heading: "4. Your content",
    paragraphs: [
      "Your collection is yours. Photos, records, notes, receipts — you keep every right you already had in them, and we don't claim ownership of any of it.",
      "To run the service, you give us a limited, non-exclusive, worldwide, royalty-free license to store, back up, transmit, resize, and display your content, solely to operate and support FirstFinder for you. That license ends when you delete the content or your account, apart from copies in routine backups that age out on their own and anything we are required to keep under section 6.",
      "When you use photo identification, the photo you submit is sent to a third-party AI provider (currently OpenAI) to be analyzed and returned as suggested details. Don't submit photos you aren't comfortable having processed that way.",
      "Your collection is private unless you publish it. If you turn on a shareable collection page, the items and fields you choose become readable by anyone holding the link, whether or not they have a FirstFinder account, and by search engines if you also choose to have the page listed. Purchase prices, sources, notes, and sold records are only included if you switch them on; receipt photos are never published. You can switch the page off or reset its link at any time, which stops it being served immediately — but we can't recall anything already copied, screenshotted, cached, or indexed while it was public.",
      "You are responsible for having the right to upload whatever you upload, and for what you choose to publish on a shareable collection page."
    ]
  },
  {
    id: "termination",
    heading: "5. Review, suspension, and termination",
    paragraphs: [
      "We do not routinely browse private collections. Items and photos are stored privately and access is restricted, apart from whatever you have deliberately published on a shareable collection page.",
      "We reserve the right to access, review, or remove content, and to suspend or permanently terminate any account and delete everything in it, at our sole discretion and with or without prior notice, when we believe in good faith that:"
    ],
    list: [
      "these Terms, including the acceptable use rules in section 3, have been broken;",
      "the account is being used for fraud, abuse, or activity that harms FirstFinder, the people using it, or a third party;",
      "we are required to act by law, legal process, or a government request;",
      "access is necessary to investigate a report, a security incident, or a technical problem; or",
      "continuing to host the account would expose us or anyone else to legal liability or risk of harm."
    ],
    closing: "Where it is safe, lawful, and practical, we will tell you what happened and why, and give you a chance to respond. We won't do that when it would interfere with an investigation, risk the destruction of evidence, or put someone in danger. If you think we got it wrong, write to us at the address in section 14 and we'll take another look. FirstFinder is free, so there is nothing to refund on termination.",
    trailing: [
      "We may also change, limit, or stop offering FirstFinder, or any part of it, at any time. If we deliberately shut the service down, we'll make a reasonable effort to give notice and a window to export your collection first."
    ]
  },
  {
    id: "law-enforcement",
    heading: "6. Illegal content and law enforcement",
    paragraphs: [
      "If we find, or are told about, content on FirstFinder that we believe is illegal, we may preserve it — including account records, photos, and access logs — and report and disclose it to law enforcement or the appropriate authorities. We may do this without notifying you, and we will not notify you where the law forbids it or where doing so could interfere with an investigation or endanger someone.",
      "Apparent child sexual abuse material is reported to the National Center for Missing & Exploited Children as required by 18 U.S.C. § 2258A, and the account is terminated immediately and permanently.",
      "We will respond to valid subpoenas, court orders, warrants, and other lawful requests for account information.",
      "Deleting your account does not delete content we are legally required to preserve or have already reported."
    ]
  },
  {
    id: "reporting",
    heading: "7. Reporting abuse",
    paragraphs: [
      "If you come across something on FirstFinder that breaks these rules, tell us at thebookbarterer@gmail.com and include enough detail for us to find it. Logged-in users can also use Send feedback.",
      "If someone is in immediate danger, contact local emergency services first."
    ]
  },
  {
    id: "valuations",
    heading: "8. Estimated values are estimates",
    paragraphs: [
      "FirstFinder shows estimated values, comparable sales, and identification suggestions produced by automated tools and third-party sources. They are informational only.",
      "They are not appraisals, and they are not financial, investment, insurance, tax, or legal advice. They may be wrong, out of date, or built on a misread of your item. Don't rely on them for a sale, a purchase, an insurance claim, an estate valuation, or a tax filing — get a qualified professional appraisal instead.",
      "Reports you generate from FirstFinder, including the insurance report, carry the same caveat. Your insurer decides what it will accept."
    ]
  },
  {
    id: "as-is",
    heading: "9. A hobby project, provided as is",
    paragraphs: [
      "FirstFinder is free. It is run as a passion project by one person, not a company with a support desk, an uptime commitment, or anyone on call at three in the morning.",
      "The service is provided \"as is\" and \"as available,\" without warranties of any kind, express or implied, including any implied warranty of merchantability, fitness for a particular purpose, title, or non-infringement. We don't promise that the service will be uninterrupted, secure, error-free, or that any data will be preserved.",
      "So that this is impossible to miss, by using FirstFinder you specifically acknowledge and agree that:"
    ],
    list: [
      "FirstFinder is a hobby platform, and you will use it accordingly.",
      "It may be slow, may break, may lose features, and may go down — briefly, for a long time, or permanently — with or without warning.",
      "Your collection records and photos may be lost, corrupted, or made unreachable, including by a failure at one of the services FirstFinder is built on, and no backup of your data is guaranteed to exist or to be recoverable.",
      "FirstFinder may be discontinued at any time, at which point your data may be deleted.",
      "FirstFinder is not your system of record. It is a convenience layered on top of the copies you keep yourself.",
      "You will not hold FirstFinder, or the people who work on it, responsible for any of that — including the value of a collection you can no longer document."
    ],
    closing: "Keep your own copies. Export your collection to CSV from time to time, and make sure your photos exist somewhere other than FirstFinder. This is the single most important sentence on this page.",
    trailing: [
      "None of this asks you to give up a right you cannot lawfully give up, and section 10 says the same thing in the language courts expect."
    ]
  },
  {
    id: "liability",
    heading: "10. Limitation of liability",
    paragraphs: [
      "To the fullest extent the law allows, FirstFinder and anyone working on it will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, lost data, lost collections, or the cost of substitute services, arising out of or relating to your use of FirstFinder — even if we were told such damages were possible.",
      "To the fullest extent the law allows, our total liability for any claim relating to FirstFinder is limited to one hundred U.S. dollars ($100).",
      "Some places don't allow some of these exclusions. Where that's true, they apply only as far as the law permits, and nothing here limits liability that cannot lawfully be limited."
    ]
  },
  {
    id: "indemnity",
    heading: "11. Your responsibility for claims",
    paragraphs: [
      "You agree to indemnify and hold harmless FirstFinder and the people who run it from any claim, demand, loss, or expense — including reasonable legal fees — arising from your content, your use of FirstFinder, or your breach of these Terms or of anyone else's rights."
    ]
  },
  {
    id: "changes",
    heading: "12. Changes to these Terms",
    paragraphs: [
      "We may revise these Terms as FirstFinder changes or as the law requires. The \"Last updated\" date at the top of this page always reflects the current version.",
      "For material changes we'll make a reasonable effort to give notice in the app or by email before they take effect. Continuing to use FirstFinder after a change means you accept the revised Terms. If you don't accept them, delete your account."
    ]
  },
  {
    id: "governing-law",
    heading: "13. Governing law and disputes",
    paragraphs: [
      "These Terms are governed by the laws of the Commonwealth of Pennsylvania, United States, without regard to its conflict-of-laws rules.",
      "Any dispute arising out of or relating to these Terms or the service will be brought exclusively in the state or federal courts located in the Commonwealth of Pennsylvania, and we each consent to personal jurisdiction there. Nothing here stops either of us from seeking an injunction to protect intellectual property or account security in any court with jurisdiction.",
      "If any part of these Terms is found unenforceable, the rest stays in force. Not enforcing a provision isn't a waiver of it. These Terms are the entire agreement between us about FirstFinder."
    ]
  },
  {
    id: "contact",
    heading: "14. Contact",
    paragraphs: [
      "Questions about these Terms, abuse reports, and account appeals all go to thebookbarterer@gmail.com."
    ]
  }
];

// Terms and Privacy are the same page with different words in it: an eyebrow, a
// plain-English summary, jump links, numbered sections, and a closing note. One
// component renders both, so a layout fix lands on both and the two documents
// cannot drift into looking like they came from different sites.
//
// Sections are the shape used by termsSections and privacySections above:
// { id, heading, paragraphs, list?, closing?, trailing? }.
function LegalDocument({ eyebrow, title, lastUpdated, summary, sections, note }) {
  return (
    <section className="mx-auto max-w-3xl px-6 py-16 md:py-20">
      <div className="font-ledger inline-flex items-center gap-2 rounded-full border border-[#d9c9b0] bg-[#fff8ee] px-4 py-2 text-xs uppercase tracking-[0.2em] text-[#655644]">
        {eyebrow}
      </div>
      <h1 className="font-display mt-5 text-4xl font-semibold tracking-tight md:text-5xl">{title}</h1>
      <p className="font-ledger mt-4 text-sm text-[#8a7a64]">Last updated {lastUpdated}</p>

      <div className="mt-10 rounded-[2rem] border border-[#d8c7ad] bg-[#fbf5e9] p-6 md:p-7">
        <div className="font-ledger text-xs uppercase tracking-[0.2em] text-[#8a7a64]">The short version</div>
        <ul className="mt-4 grid gap-2.5 text-[#4c4034]">
          {summary.map((point) => (
            <li key={point} className="flex items-start gap-2.5 leading-7">
              <Icon name="check" size={15} className="mt-1.5 shrink-0 text-[#123f38]" />
              {point}
            </li>
          ))}
        </ul>
        <p className="mt-5 text-sm leading-6 text-[#7d6c5a]">
          That summary is here to be read, not to be relied on. The sections below are the real thing.
        </p>
      </div>

      <nav aria-label={`${eyebrow} sections`} className="mt-10 rounded-2xl border border-dashed border-[#d3c1a4] bg-[#fffdf8] p-6">
        <div className="font-ledger text-xs uppercase tracking-[0.2em] text-[#8a7a64]">Jump to</div>
        <div className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
          {sections.map((section) => (
            <a key={section.id} href={`#${section.id}`} className="text-[#665746] underline decoration-[#cdbb9d] underline-offset-4 transition hover:text-[#123f38]">
              {section.heading}
            </a>
          ))}
        </div>
      </nav>

      <div className="mt-12 space-y-12">
        {sections.map((section) => (
          <div key={section.id} id={section.id} className="scroll-mt-8">
            <h2 className="font-display text-2xl font-semibold tracking-tight">{section.heading}</h2>

            <div className="mt-4 space-y-4 leading-8 text-[#665746]">
              {section.paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>

            {section.list && (
              <ul className="mt-4 grid gap-2.5 border-l-2 border-[#e0d2bc] pl-5 text-[#665746]">
                {section.list.map((entry) => (
                  <li key={entry} className="leading-7">{entry}</li>
                ))}
              </ul>
            )}

            {section.closing && <p className="mt-4 leading-8 text-[#665746]">{section.closing}</p>}

            {section.trailing && section.trailing.map((paragraph, index) => (
              <p key={index} className="mt-4 leading-8 text-[#665746]">{paragraph}</p>
            ))}
          </div>
        ))}
      </div>

      <p className="mt-16 border-t border-[#e0d2bc] pt-8 text-sm leading-7 text-[#8a7a64]">{note}</p>
    </section>
  );
}

function TermsPage({ onViewPrivacy }) {
  return (
    <LegalDocument
      eyebrow="Terms of Service"
      title="The rules of the shelf."
      lastUpdated={termsLastUpdated}
      summary={termsSummary}
      sections={termsSections}
      note={
        <>
          FirstFinder is a personal project, and these Terms are written to be read by collectors rather than by
          lawyers. They are not legal advice, and they don&rsquo;t create any relationship beyond the one described
          here. Our{" "}
          <button type="button" onClick={onViewPrivacy} className="underline decoration-[#cdbb9d] underline-offset-2 hover:text-[#123f38]">
            Privacy Policy
          </button>{" "}
          covers what we do with your information.
        </>
      }
    />
  );
}

// The Privacy Policy. Same data-then-layout shape as the Terms above, and it
// renders through the same LegalDocument component, so the two pages cannot
// drift apart visually and a new section is a new object rather than new JSX.
//
// Everything below has to describe what the code actually does. When a service
// provider changes, a column is added that holds something personal, or a
// retention rule moves, this file is part of that change -- not a follow-up.
const privacyLastUpdated = "September 9, 2026";

const privacySummary = [
  "We collect what running a catalog needs: your email, what you record about your items, and your photos.",
  "We don't sell your data, and we don't run ads against it.",
  "Your collection is private until you publish a shareable page yourself.",
  "Photos you send to photo identification go to OpenAI to be analyzed.",
  "Deleting your account from My Account erases your records and your photos for good."
];

const privacySections = [
  {
    id: "scope",
    heading: "1. What this covers",
    paragraphs: [
      "This Privacy Policy explains what FirstFinder (\"FirstFinder,\" \"we,\" \"us\") collects, why we collect it, who else sees it, and what you can do about it. It covers the FirstFinder website and app.",
      "It sits alongside our Terms of Service, which govern your use of FirstFinder generally. Where the Terms describe how your content is handled, this policy is the longer version of the same story.",
      "FirstFinder is a free, open-source hobby project run by one person in the United States. It is not a company with a data protection department, and this policy is written to be read rather than to be impressive."
    ]
  },
  {
    id: "what-we-collect",
    heading: "2. What we collect",
    paragraphs: [
      "Almost everything here is something you typed or uploaded on purpose. The exceptions are the last two groups, which are collected automatically."
    ],
    list: [
      "Account information — your email address, and a password you set (stored only as a hash by our authentication provider, never as text we can read). If you sign in with Google or Apple instead, we receive the email address and account identifier that sign-in hands us, and no password at all.",
      "Collection records — everything you enter about an item: name, maker, edition, printing, category, condition, status, notes, and its reference number.",
      "Purchase and sale information — purchase date, source, price paid, your estimated value, and, if you mark an item sold, the sale price and date. We never see or handle a payment: FirstFinder charges nothing, and these are numbers you type about deals you made elsewhere.",
      "Photos — item photos and receipt photos you upload. Receipts often carry a name, an address, or the last digits of a card, which is why the photo store is private and served only through short-lived signed links.",
      "Wishlist entries — the copies you're hunting and the specification you'd accept.",
      "Feedback — what you write in Send feedback, and any screenshots you attach. Read section 4 before you send one: feedback becomes a public GitHub issue.",
      "Sign-in activity — a timestamped record of each sign-in, kept so the maintainer can see how many people use FirstFinder and how often they come back.",
      "Photo identification usage — a per-day count of how many identifications your account has run, which is how the daily cap is enforced.",
      "Analytics — page views and in-app events (for example, opening the identification flow or exporting a report), collected through Google Analytics along with the technical data it gathers: a device or browser identifier, approximate location derived from IP address, referring page, and general device and browser details."
    ],
    closing: "We do not ask for and do not want your street address, your phone number, your date of birth, a government identifier, or a payment card number. If one of those turns up inside a note or on a receipt photo, it is there because you put it there."
  },
  {
    id: "why",
    heading: "3. Why we use it",
    paragraphs: [
      "Each of these is a purpose, not a category we might expand into later."
    ],
    list: [
      "To run your account: signing you in, keeping your session, resetting a password, and letting you delete everything.",
      "To store and show your collection, your photos, your wishlist, and the totals and reports built from them.",
      "To produce the things you ask for: an identification suggestion, an estimated value, a CSV export, an insurance report, a shareable collection page.",
      "To answer feedback and support requests, and to fix what you tell us is broken.",
      "To enforce the daily cap on photo identification and to protect FirstFinder from abuse, fraud, and attempts to reach other people's accounts.",
      "To understand, in aggregate, which parts of FirstFinder people actually use, so the effort goes where it helps.",
      "To meet a legal obligation, including the reporting duties described in section 6 of the Terms."
    ],
    closing: "We do not sell your personal information, we do not share it with data brokers, and we do not use it to target advertising. There is no advertising on FirstFinder."
  },
  {
    id: "service-providers",
    heading: "4. Who else sees it",
    paragraphs: [
      "FirstFinder is a small app standing on other people's infrastructure. These are all of them, and what each one gets:"
    ],
    list: [
      "Supabase — our database, authentication, and photo storage. It holds essentially everything described in section 2 apart from analytics. Access is restricted per-account at the database level, so one user's rows and photos are not readable by another.",
      "Vercel — hosting for the website and its server routes. It processes requests as they pass through, and keeps standard server logs including IP addresses.",
      "OpenAI — receives the photos you submit to photo identification, along with the prompt describing what to look for, and returns the suggested details. This happens only when you press identify, and only for the photos in that request. Don't submit a photo you aren't comfortable having processed this way.",
      "Google Analytics — receives the page views and events in section 2. It does not receive your email address, your collection, or your photos.",
      "Google and Apple — only if you choose to sign in with them, and only to the extent that sign-in requires.",
      "GitHub — receives your feedback. Every submission is filed as an issue in the public FirstFinder repository. The description is scanned first and obvious personal details (email addresses, phone numbers, street addresses, long card- or account-shaped numbers) are masked, but that is a pattern matcher, not a promise: don't write anything into feedback you would not want published. Your email address and account identifier are not included in the issue."
    ],
    closing: "Beyond those, we disclose personal information only when the law requires it, when we respond to a valid legal request, or when it is necessary to investigate abuse or protect someone from harm — the circumstances set out in sections 5 and 6 of the Terms. If FirstFinder were ever transferred to someone else, your information would move with it and you'd be told before it did."
  },
  {
    id: "public-pages",
    heading: "5. What you choose to publish",
    paragraphs: [
      "Your collection is private by default. Nothing in it is visible to another visitor unless you turn on a shareable collection page yourself.",
      "When you do, you pick what appears. Purchase prices, sources, notes, and sold records are only included if you switch them on, and receipt photos are never published at all. You can also hide individual items. An unlisted page is readable by anyone holding the link; a listed page is additionally offered to search engines.",
      "Switching the page off, or resetting its link, stops it being served immediately. It cannot recall anything already copied, screenshotted, cached, or indexed while the page was public."
    ]
  },
  {
    id: "cookies",
    heading: "6. Cookies and analytics",
    paragraphs: [
      "FirstFinder uses browser storage for two things.",
      "The first is your session. Signing in stores a token in your browser so you stay signed in; without it there is no way to keep you logged in, and clearing it signs you out.",
      "The second is Google Analytics, which sets its own cookies to count visits and recognize a returning browser. You can block it with a browser setting, an extension, or Google's own opt-out — FirstFinder works exactly the same either way. We don't run advertising cookies, and nothing here follows you around other sites."
    ]
  },
  {
    id: "retention",
    heading: "7. How long we keep it",
    paragraphs: [
      "Your collection records, photos, and wishlist stay until you delete them or delete your account. There is no automatic expiry — a catalog that quietly forgot things would be worse than useless.",
      "Deleting an item deletes its photos with it. Deleting your account from My Account removes your account, every record under it, and every photo in your storage folder, and it is permanent — we cannot restore it afterwards, so export your CSV first if you want one.",
      "Some things survive that deletion, and you should know which. Copies inside routine encrypted backups age out on their own schedule. Sign-in counts and analytics are aggregate figures that no longer identify you. Feedback already filed as a public GitHub issue stays on GitHub, because the issue is public and other people may have replied to it. And anything we are legally required to preserve or have already reported to authorities is kept, as section 6 of the Terms says."
    ]
  },
  {
    id: "your-rights",
    heading: "8. Your choices and rights",
    paragraphs: [
      "Most of what a privacy law would have you request, you can simply do:"
    ],
    list: [
      "See what we hold — it's your collection; it's on the screen.",
      "Correct it — edit any item, at any time.",
      "Export it — download your whole collection as a CSV from My Collection.",
      "Delete part of it — delete an item, and its photos go with it.",
      "Delete all of it — delete your account from My Account. You don't need to ask us first, and nobody will try to talk you out of it.",
      "Opt out of analytics — block Google Analytics in your browser."
    ],
    closing: "Depending on where you live, you may also have the right to object to or restrict certain processing, to receive your data in a portable form, or to complain to a data protection authority. Write to thebookbarterer@gmail.com and we'll do our best to help — and if we ever have to refuse a request, we'll tell you why. We will not treat you differently for exercising any of this. FirstFinder is free; there is nothing to withhold."
  },
  {
    id: "security",
    heading: "9. How it's protected",
    paragraphs: [
      "Traffic is encrypted in transit. Passwords are stored hashed by our authentication provider and are not readable by us. Collection rows and photos are protected per-account at the database and storage layer, so the check that keeps one account out of another's data does not depend on the app remembering to ask. Photos are private and served through short-lived signed links rather than public URLs. Maintainer access to the underlying data is limited to what is needed to run the service and investigate problems.",
      "No system is perfectly secure, and this one is maintained by one person in their spare time. If you find a vulnerability, please report it — SECURITY.md in the repository explains how, and we'd much rather hear it from you."
    ]
  },
  {
    id: "children",
    heading: "10. Children",
    paragraphs: [
      "FirstFinder is not for children under 13, and we don't knowingly collect anything from them. If you believe a child under 13 has an account, write to thebookbarterer@gmail.com and we'll delete it."
    ]
  },
  {
    id: "international",
    heading: "11. Where your data lives",
    paragraphs: [
      "FirstFinder is operated from the United States, and the services in section 4 store and process data there. If you use FirstFinder from somewhere else, you are sending your information to the United States, where privacy law differs from your own — including from the protections you have in the UK, the EU, and the EEA."
    ]
  },
  {
    id: "privacy-changes",
    heading: "12. Changes to this policy",
    paragraphs: [
      "We'll update this policy as FirstFinder changes. The \"Last updated\" date at the top of this page always reflects the current version, and for a material change — a new service provider receiving your data, a new purpose for something we already hold — we'll make a reasonable effort to give notice in the app or by email before it takes effect."
    ]
  },
  {
    id: "privacy-contact",
    heading: "13. Contact",
    paragraphs: [
      "Questions about privacy, requests about your data, and anything you think this policy gets wrong go to thebookbarterer@gmail.com."
    ]
  }
];

function PrivacyPage({ onViewTerms }) {
  return (
    <LegalDocument
      eyebrow="Privacy Policy"
      title="What we know about you."
      lastUpdated={privacyLastUpdated}
      summary={privacySummary}
      sections={privacySections}
      note={
        <>
          This policy describes what FirstFinder actually does with your information, not what a template says a
          company might. It works alongside the{" "}
          <button type="button" onClick={onViewTerms} className="underline decoration-[#cdbb9d] underline-offset-2 hover:text-[#123f38]">
            Terms of Service
          </button>
          , which cover everything else about using FirstFinder.
        </>
      }
    />
  );
}

// Both home page films are served from /public rather than embedded from
// YouTube. They are silent screen recordings -- every second of both audio
// tracks measures as silence -- so muting them costs nothing, and self-hosting
// is what makes a clean autoplaying loop possible at all: YouTube serves a
// vertical clip through its Shorts player, which rests as a black rectangle
// wearing the Shorts logo, a mute button and Like/Share until someone presses
// play, with no frame of the video showing.
//
// preload="none" plus the observer below means neither file is fetched until
// it is actually scrolled to, so a visitor who reads the hero and leaves pays
// nothing for either one.
const demoVideoSrc = "/firstfinder-demo.mp4";
const demoVideoPoster = "/firstfinder-demo-poster.jpg";
const aiFeatureVideoSrc = "/firstfinder-ai-feature.mp4";
const aiFeatureVideoPoster = "/firstfinder-ai-feature-poster.jpg";

// Plays while it is on screen and pauses when it is not, so a loop that has
// scrolled away is not still decoding frames on someone's phone.
function LoopingVideo({ src, poster, label, className = "" }) {
  const videoRef = useRef(null);

  // idle    -- nothing has played; the poster IMAGE is what is on screen.
  // playing -- the film is running and covers the poster.
  // manual  -- autoplay was refused or the media failed; controls are offered.
  const [mode, setMode] = useState("idle");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // A film that cannot play itself has to become a film the visitor can
    // play. Without this, a refused autoplay leaves a video element with
    // preload="none" behind it and no controls -- nothing to click, and
    // nothing loaded to show.
    const offerControls = () => setMode("manual");

    // Anyone who has asked their system to reduce motion gets the poster frame
    // and real controls instead of a loop that starts on its own. The video is
    // still here to watch -- it just waits to be asked. Same for a browser with
    // no IntersectionObserver, where there is nothing to drive playback.
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (shouldSkipAutoplay({ reducedMotion, hasIntersectionObserver: typeof IntersectionObserver !== "undefined" })) {
      offerControls();
      return;
    }

    let onScreen = false;
    let watchdog = null;
    // Set right before pausing, read inside the catch below. What actually
    // rejects play() when we call pause() on it mid-flight is an AbortError
    // indistinguishable, by name alone, from one the browser generates on its
    // own -- this is the flag that tells the two apart. See the comment on
    // isPermanentPlayRefusal's selfInterrupted parameter for why the
    // difference matters.
    let pausedSinceLastPlay = false;
    // The moment the watchdog stops being patient, however much the film keeps
    // downloading in the meantime. Reset whenever playback is attempted from
    // scratch (freshly on screen, or resuming after the tab was hidden), so a
    // visitor who scrolls away and back gets a fresh window rather than the
    // remainder of one spent while nothing was even trying to play.
    let hardDeadline = 0;

    // Arms (or re-arms) the check for whether the film has actually started.
    // Called once when play() is first requested, and again on every
    // `progress` event -- the signal that bytes are still arriving. That is
    // what tells a slow download apart from a stalled one: a video that keeps
    // receiving data keeps earning more time to start, one that goes quiet
    // does not. See the comment on WATCHDOG_HARD_CAP_MS in videoPlayback.js
    // for why this cannot extend forever.
    const armWatchdog = () => {
      clearTimeout(watchdog);
      const delay = nextWatchdogDelayMs({ now: Date.now(), deadline: hardDeadline });
      watchdog = setTimeout(() => {
        if (document.hidden) return;
        if (!hasStartedPlaying(video)) offerControls();
      }, delay);
    };

    const tryPlay = () => {
      if (!shouldAttemptPlay({ onScreen, pageHidden: document.hidden })) return;

      // preload="none" means the element holds nothing at all, and not every
      // engine treats play() as permission to go and fetch. Asking explicitly
      // costs nothing here -- this only runs once the film is on screen, which
      // is the moment the bandwidth was always going to be spent.
      if (video.preload === "none") {
        video.preload = "auto";
        video.load();
      }

      // A fresh attempt, so a pause from a previous cycle cannot excuse a
      // rejection that belongs to this one.
      pausedSinceLastPlay = false;

      video.play().catch((error) => {
        if (isPermanentPlayRefusal(error, { pageHidden: document.hidden, selfInterrupted: pausedSinceLastPlay })) offerControls();
      });

      // The guarantee that this cannot sit there stuck. A play() that resolves,
      // or never settles, can still leave a motionless poster -- so rather than
      // trying to name every way WebKit can accept a play request and then not
      // play, check whether a frame actually moved and hand over controls if
      // not. Whatever the cause, the visitor ends up with something to tap.
      hardDeadline = Date.now() + WATCHDOG_HARD_CAP_MS;
      armWatchdog();
    };

    // The bug this exists for: the ratio this measures can wobble across the
    // threshold right after load -- fonts swapping in above the fold, an
    // image finishing and shifting the film down a few pixels -- which the
    // observer reports as a real, if brief, exit and re-entry. Calling
    // pause() on the tail of that reports back here as a rejected play(), and
    // without pausedSinceLastPlay that reads exactly like a real refusal.
    // Reported reproducing in a plain mobile browser tab and, separately, an
    // installed PWA is what pointed at this rather than at autoplay policy:
    // the two share nothing except that both can experience this kind of
    // post-load settling.
    const observer = new IntersectionObserver(
      ([entry]) => {
        onScreen = entry.isIntersecting;
        if (onScreen) {
          tryPlay();
        } else {
          pausedSinceLastPlay = true;
          video.pause();
        }
      },
      // Low enough that a tall portrait clip on a short phone screen still
      // counts as "on screen" -- a 0.5 threshold can never be met when the
      // video is taller than the viewport.
      { threshold: 0.25 }
    );

    // Only once a frame is actually on screen does the video stop being
    // transparent. Until then the poster image below is what the visitor sees.
    //
    // Listening for timeupdate as well as playing, because "playing" is an
    // announcement and timeupdate is evidence: it cannot fire without the film
    // having actually advanced.
    const reveal = () => {
      clearTimeout(watchdog);
      // Once actually playing there is nothing left for the watchdog to guard
      // against, so further `progress` events (a loop restarting, a later
      // chunk of an unusually long file) should not re-arm it.
      hardDeadline = 0;
      // timeupdate fires several times a second for the rest of the film, and
      // there is nothing left to learn after the first one.
      video.removeEventListener("timeupdate", reveal);
      setMode((current) => (current === "manual" ? current : "playing"));
    };

    // A slow connection keeps arriving in chunks; each one is worth pushing
    // the watchdog back for, which is the fix armWatchdog exists for above.
    // Guarded on hardDeadline so a `progress` event firing before anything has
    // tried to play, or after reveal() has already declared victory, does
    // nothing.
    const onProgress = () => {
      if (hardDeadline > 0) armWatchdog();
    };

    observer.observe(video);

    // The reason the visibilitychange listener exists: intersection does not
    // change when a tab is switched away and back, so the observer never
    // fires a second time. A video Chrome paused for being in a background
    // tab would otherwise stay paused for the rest of the visit, sitting
    // there looking broken.
    document.addEventListener("visibilitychange", tryPlay);
    video.addEventListener("playing", reveal);
    video.addEventListener("timeupdate", reveal);
    video.addEventListener("progress", onProgress);
    video.addEventListener("error", offerControls);

    return () => {
      clearTimeout(watchdog);
      observer.disconnect();
      document.removeEventListener("visibilitychange", tryPlay);
      video.removeEventListener("playing", reveal);
      video.removeEventListener("timeupdate", reveal);
      video.removeEventListener("progress", onProgress);
      video.removeEventListener("error", offerControls);
    };
  }, []);

  return (
    <>
      {/* The resting state is a real <img>, not the video's poster attribute.
          A <video> with preload="none" holds no frame, so what it paints when
          it cannot play is up to the platform -- and on an iOS home-screen web
          app it paints solid black, ignoring the poster. The same page in
          Chrome shows the poster, which is what makes this so easy to miss.
          An <img> is not open to interpretation: it is on screen before the
          video has done anything, and it stays there if the video never
          manages to play at all. */}
      <img
        src={poster}
        alt=""
        aria-hidden="true"
        className={`absolute inset-0 h-full w-full object-cover ${className}`}
      />

      <video
        ref={videoRef}
        // The fade belongs to the happy path only. When controls are being
        // offered, something has already gone wrong, and the play button must
        // not depend on an animation finishing in order to be visible.
        className={`absolute inset-0 h-full w-full object-cover ${mode === "playing" ? "transition-opacity duration-500" : ""} ${mode === "idle" ? "opacity-0" : "opacity-100"} ${className}`}
        src={src}
        poster={poster}
        preload="none"
        muted
        loop
        playsInline
        controls={mode === "manual"}
        aria-label={label}
      />
    </>
  );
}

function DemoVideoPlayer() {
  return (
    <LoopingVideo
      src={demoVideoSrc}
      poster={demoVideoPoster}
      label="A walkthrough of cataloguing a collection in FirstFinder"
    />
  );
}

function AiFeatureVideo() {
  return (
    <LoopingVideo
      src={aiFeatureVideoSrc}
      poster={aiFeatureVideoPoster}
      label="Identifying a book from a photo in FirstFinder"
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

// Quoted in two places -- the home page section and the card inside the app --
// and it must match IDENTIFY_DAILY_LIMIT in app/api/identify-book/route.js,
// which is the only place it is actually enforced. This constant is copy, not
// a limit.
const identifyDailyLimitCopy = 2;

// Deliberately narrow claims: the identification is grounded in a real search
// for comparable sales and every field lands in an editable draft, so the copy
// promises a head start rather than an answer.
const aiFeaturePoints = [
  { icon: "search", title: "Grounded in real sales", text: "It searches for comparable copies and weighs sold prices over asking prices." },
  { icon: "file", title: "Edition points read for you", text: "Publisher, printing, and the number line — the details that decide the value." },
  { icon: "check", title: "You approve every field", text: "The draft opens for review. Correct anything, then save it to your ledger." },
  { icon: "camera", title: "The photo comes along", text: "The picture you took is attached to the record as proof, not thrown away." }
];

function HomePage({ onGetStarted }) {
  const steps = [
    { number: "01", icon: "camera", title: "Snap it", text: "Photograph the item and the receipt the day it comes home. Proof beats memory." },
    { number: "02", icon: "file", title: "Log it", text: "Edition points, condition, where you found it, what you paid. Thirty seconds per item." },
    { number: "03", icon: "dollar", title: "Track it", text: "What you paid, what it's worth now, and how that changed if you ever let it go." }
  ];

  return (
    <>
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-14 md:pt-20">
        <div className="grid gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="font-display max-w-2xl text-5xl font-semibold leading-[1.02] tracking-tight text-[#201a14] md:text-[4.4rem]">
              All your favorite finds catalogued.
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

      {/* Sits between the hero and the walkthrough on purpose: the hero says
          what the ledger is, this says the part that is actually novel, and
          "See it in 60 seconds" then covers the whole flow end to end. The
          deep green band also keeps the page alternating rather than running
          two cream sections together. */}
      <section id="ai" className="border-y border-[#0d2f2a] bg-[#123f38] text-[#fff7ea]">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
          {/* Three cells placed explicitly rather than two columns with the
              button nested inside the copy: nesting it made a phone read
              heading -> copy -> call to action -> video, which strands the
              video after the section has already closed. Placed on the grid,
              the same three blocks fall as copy -> video -> button on a phone
              and still resolve to phone-left, copy-above-button on desktop. */}
          <div className="grid items-center gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-x-16 lg:gap-y-8">
            <div className="lg:col-start-2 lg:row-start-1">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#fff7ea]/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-[#d8e6e2]">
                <Icon name="camera" size={14} /> Fastest way in
              </div>
              <h2 className="font-display mt-5 text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
                Take a picture, we'll fill in the rest.
              </h2>
              <p className="mt-5 max-w-xl text-lg leading-8 text-[#d8e6e2]">
                Photograph the cover and FirstFinder reads the title, author, and edition points, then searches for
                what copies like yours actually sold for. You get an editable draft in a few seconds &mdash; nothing is
                saved until you say so.
              </p>

              <ul className="mt-8 grid gap-4 sm:grid-cols-2">
                {aiFeaturePoints.map((point) => (
                  <li key={point.title} className="flex gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#fff7ea]/10 text-[#fff7ea]">
                      <Icon name={point.icon} size={16} />
                    </span>
                    <div>
                      <div className="font-medium">{point.title}</div>
                      <p className="mt-1 text-sm leading-6 text-[#a9c4bd]">{point.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* lg:row-span-2 so the phone stands beside the copy and the button
                together instead of forcing a third row of its own. */}
            <div className="relative mx-auto w-full max-w-[248px] sm:max-w-[268px] lg:col-start-1 lg:row-start-1 lg:row-span-2 lg:mx-0">
              <div className="pointer-events-none absolute -inset-x-6 -inset-y-6 rounded-[3rem] border border-dashed border-[#fff7ea]/20" aria-hidden="true" />
              {/* aspect-[588/1280] is the clip's own ratio, so the player is
                  exactly as tall as the footage and YouTube adds no bar at
                  either end. The border is the bezel. */}
              <div className="relative overflow-hidden rounded-[2.25rem] border-[6px] border-[#201a14] bg-[#201a14] shadow-[0_30px_60px_-25px_rgba(0,0,0,0.7)]">
                <div className="relative aspect-[588/1280] overflow-hidden rounded-[1.75rem] bg-black">
                  <AiFeatureVideo />
                </div>
              </div>
            </div>

            <div className="lg:col-start-2 lg:row-start-2">
              {/* The outline variant rather than the primary one with an
                  inverted palette passed through className: the primary's own
                  text-[#fff7ea] and a text color from className are the same
                  utility at the same specificity, so which one wins comes down
                  to their order in the generated stylesheet, not the order
                  they are written here -- and the label rendered cream on
                  cream. Outline is already a cream button with dark text, so
                  nothing needs overriding. */}
              <Button variant="outline" onClick={onGetStarted} className="h-12 border-transparent px-7 text-base">
                Try it on your next find <Icon name="arrow" size={18} className="ml-1" />
              </Button>
              {/* Said plainly and up front rather than discovered on the third
                  attempt. Every identification is a search-grounded model call
                  with a real per-call cost on a self-funded app, and a cap
                  someone runs into unwarned reads as the feature being broken. */}
              <p className="mt-5 max-w-md text-sm leading-6 text-[#a9c4bd]">
                {identifyDailyLimitCopy} identifications per account per day. Each one is a paid, search-grounded
                API call, so it's capped — and it can pause altogether if the budget runs out.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-t border-[#e2d4bc] bg-[#fbf5e9]">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
          <div className="mx-auto max-w-3xl">
            <h2 className="font-display text-center text-3xl font-semibold tracking-tight md:text-4xl">See it in 60 seconds.</h2>
            {/* aspect-[1152/720], not aspect-video: the recording is 16:10, and
                cropping it to 16:9 would shave the top and bottom off a screen
                capture whose edges are the app's own chrome. */}
            <div className="relative mt-8 aspect-[1152/720] w-full overflow-hidden rounded-2xl border border-[#d3c1a4] bg-black shadow-xl">
              <DemoVideoPlayer />
            </div>
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

// Apple sign-in is built and tested but stays dark until the Apple provider is
// switched on in Supabase, which needs a paid Apple Developer account. Shipping
// the button before then would just hand collectors a control that bounces them
// back with an error. Set NEXT_PUBLIC_APPLE_AUTH_ENABLED=true to light it up --
// no code change. Read as a full static expression so Next can inline it.
const appleAuthEnabled = process.env.NEXT_PUBLIC_APPLE_AUTH_ENABLED === "true";

// Named in one place so the button list and the two sentences that promise it
// can't disagree about whether Apple exists.
const socialProviders = appleAuthEnabled ? "Google or Apple" : "Google";

const authModeCopy = {
  signin: {
    heading: "Log in to your collection.",
    sub: `Use your email and password, or continue with ${socialProviders}, to get back to your collection.`,
    formTitle: "Log in",
    formSub: "Enter the email and password you signed up with.",
    submit: "Log in",
    submitting: "Logging in..."
  },
  signup: {
    heading: "Start your collection.",
    sub: "Create a free account to track item photos, receipts, what you paid, and what it's worth now.",
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

function SocialAuthButton({ icon, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-[#cdbb9c] bg-white px-6 text-base font-semibold text-[#123f38] shadow-sm transition hover:bg-[#f8f4ec] hover:shadow-md active:scale-[0.99]"
    >
      <Icon name={icon} size={20} />
      <span>{children}</span>
    </button>
  );
}

function AuthLink({ children, onClick }) {
  return (
    <button type="button" onClick={onClick} className="font-medium text-[#123f38] underline underline-offset-4 hover:text-[#0f332d]">
      {children}
    </button>
  );
}

// Consent notice covering the account-creating controls in view: the email
// sign-up submit and the Google button, which signs up and signs in through the
// same click. One notice sits at the foot of the card rather than one per
// button, so sign-up doesn't stack the same sentence twice. Deliberately absent
// from the forgot-password form, where no account is being created and no
// Google button is shown.
function AuthTermsNotice({ onViewTerms, onViewPrivacy, action }) {
  return (
    <p className="mt-4 text-xs leading-5 text-[#7d6c5a]">
      {action} means you agree to FirstFinder's{" "}
      <button type="button" onClick={onViewTerms} className="underline decoration-[#cdbb9d] underline-offset-2 hover:text-[#123f38]">
        Terms of Service
      </button>{" "}
      and{" "}
      <button type="button" onClick={onViewPrivacy} className="underline decoration-[#cdbb9d] underline-offset-2 hover:text-[#123f38]">
        Privacy Policy
      </button>
      , including the acceptable use rules and the acknowledgment that FirstFinder is a hobby project that may lose
      data or go away.
    </p>
  );
}

function LoginPage({ onViewTerms, onViewPrivacy }) {
  const [mode, setMode] = useState("signin");
  const [form, setForm] = useState({ email: "", password: "", confirmPassword: "" });
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const copy = authModeCopy[mode];

  // A failed OAuth round trip comes back as a redirect to the app with the
  // reason in the URL, not as a rejected promise -- signInWithOAuth only builds
  // a URL and hands the browser over, so nothing below throws. Without this the
  // collector lands back on a blank login form with no idea why. Supabase uses
  // the hash for the implicit flow and the query string for PKCE, so read both.
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    const code = hash.get("error") || query.get("error");
    if (!code) return;

    const detail = hash.get("error_description") || query.get("error_description") || "";
    const text = /unsupported provider|provider is not enabled/i.test(detail)
      ? "That sign-in option isn't available yet. Use your email and password for now."
      : detail.replace(/\+/g, " ") || "Sign-in was cancelled or failed. Try again.";
    setMessage({ type: "error", text });

    // Strip the error off the URL so a refresh doesn't replay a stale failure.
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  function switchMode(nextMode) {
    setMode(nextMode);
    setMessage(null);
  }

  // One handler for both social buttons -- Google and Apple differ only in the
  // provider string, and keeping them on one path means the error handling and
  // the redirect target can't drift apart between the two.
  async function handleOAuthLogin(provider, label) {
    trackEvent(`${provider}_login_clicked`, { source_page: "login" });
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin
      }
    });

    if (error) {
      console.error(`${label} login error:`, error.message);
      // Supabase answers a provider that isn't switched on in the dashboard with
      // "Unsupported provider", which tells a collector nothing about what to do
      // next. Anything else is already written for a human.
      const text = /unsupported provider|provider is not enabled/i.test(error.message)
        ? `${label} sign-in isn't available yet. Use your email and password for now.`
        : error.message;
      setMessage({ type: "error", text });
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
          </form>

          {/* The social routes sit under the email module as always-visible
              alternatives rather than behind a tab -- one click, no choice to
              make first. Hidden only while resetting a password, where OAuth
              does nothing for someone who came here for a reset link. */}
          {mode !== "forgot" && (
            <div className="mt-6">
              <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-[#a4917a]">
                <span className="h-px flex-1 bg-[#e6d8bf]" />
                <span>or</span>
                <span className="h-px flex-1 bg-[#e6d8bf]" />
              </div>
              <div className="mt-6 grid gap-3">
                <SocialAuthButton icon="google" onClick={() => handleOAuthLogin("google", "Google")}>
                  Continue with Google
                </SocialAuthButton>
                {appleAuthEnabled && (
                  <SocialAuthButton icon="apple" onClick={() => handleOAuthLogin("apple", "Apple")}>
                    Continue with Apple
                  </SocialAuthButton>
                )}
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-2 text-sm text-[#665746]">
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

          {mode !== "forgot" && (
            <AuthTermsNotice
              onViewTerms={onViewTerms}
              onViewPrivacy={onViewPrivacy}
              action={mode === "signup" ? `Creating an account, or continuing with ${socialProviders}` : `Continuing with ${socialProviders}`}
            />
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

// Fires the automatic "feedback -> GitHub issue" path for a freshly saved row.
// Swallows everything: the user has already been told their feedback was sent,
// which is true, and whether it became an issue is not something they should
// see an error about. Failures are logged server-side and the feedback is still
// saved either way.
async function fileFeedbackAsIssue(feedbackId) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) return;

    await fetch("/api/feedback-intake", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ id: feedbackId }),
      // Triage plus filing takes a few seconds, and people close the tab the
      // moment they see "Thanks — your feedback was sent." keepalive lets the
      // request outlive the page so their report still becomes an issue.
      keepalive: true
    });
  } catch (error) {
    console.error("Feedback intake error:", error.message);
  }
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

      // Hand the saved row to the server, which triages it and files it as a
      // GitHub issue. Deliberately not awaited into the user's success path:
      // filing is our problem, not theirs, and the feedback is already safely
      // stored either way. If this call never lands, the row simply stays in the
      // feedback table unfiled.
      fileFeedbackAsIssue(data.id);

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

// The mark on a row that exists on this device and nowhere else yet. Small on
// purpose -- it is a fact about the record, not a warning about the book --
// except when the change has stopped trying, which the collector does need to
// notice.
function PendingChip({ error, className = "" }) {
  if (error) {
    return (
      <span title={error} className={`inline-flex items-center gap-1 rounded-full bg-[#fbe4e0] px-3 py-1 text-xs font-medium text-[#8a3527] ${className}`}>
        <Icon name="wifiOff" size={12} /> Not saved
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-[#fff3d8] px-3 py-1 text-xs font-medium text-[#6d5526] ${className}`}>
      <Icon name="wifiOff" size={12} /> Waiting to sync
    </span>
  );
}

// What is waiting to reach the server, and what has stopped trying.
//
// A queue that silently drops a record is worse than one that refuses the
// write, so nothing here is hidden: every pending change is named, every
// failure carries its reason, and the only way one leaves without being sent
// is the collector saying so.
function PendingSyncPanel({ summary, operations, items, online, flushing, onSyncNow, onRetry, onDiscard }) {
  const [open, setOpen] = useState(false);
  const blocked = operations.filter((operation) => isBlocked(operation));

  return (
    <div className="mx-auto max-w-6xl px-6 pt-3 print:hidden">
      <div className="rounded-2xl border border-[#d8c7ad] bg-[#fff9f0] px-5 py-4 text-sm text-[#3f352a]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="font-medium">
            {queueLabel(summary)}
            {flushing && <span className="ml-2 font-normal text-[#665746]">syncing now...</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {online && summary.waiting > 0 && (
              <button
                type="button"
                onClick={onSyncNow}
                disabled={flushing}
                className="rounded-full bg-[#123f38] px-4 py-1.5 text-xs font-medium text-[#fff7ea] transition hover:bg-[#0f332d] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Sync now
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen((current) => !current)}
              aria-expanded={open}
              className="rounded-full border border-[#cdbb9d] bg-[#fff8ee] px-4 py-1.5 text-xs font-medium transition hover:bg-white"
            >
              {open ? "Hide" : "Show"} {summary.total === 1 ? "it" : "them"}
            </button>
          </div>
        </div>

        {open && (
          <ul className="mt-4 space-y-2">
            {operations.map((operation) => (
              <li key={operation.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl bg-[#f8f0e4] px-4 py-3">
                <div className="min-w-0">
                  <div className="font-medium">{describeOperation(operation, items)}</div>
                  <div className="text-xs leading-5 text-[#665746]">
                    {isBlocked(operation)
                      ? operation.lastError || "This could not be saved."
                      : online
                        ? "Sending..."
                        : "Waiting for a connection."}
                  </div>
                </div>
                {isBlocked(operation) && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => onRetry(operation.id)}
                      className="rounded-full border border-[#cdbb9d] bg-[#fff8ee] px-3 py-1 text-xs font-medium transition hover:bg-white"
                    >
                      Try again
                    </button>
                    <button
                      type="button"
                      onClick={() => onDiscard(operation.id)}
                      className="rounded-full border border-[#e0b4aa] bg-[#fff5f3] px-3 py-1 text-xs font-medium text-[#8a3527] transition hover:bg-white"
                    >
                      Discard
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {blocked.length > 0 && !open && (
          <p className="mt-2 text-xs leading-5 text-[#8a3527]">
            {blocked.length === 1 ? "One change" : `${blocked.length} changes`} stopped trying. Open the list to see why, and to retry or discard.
          </p>
        )}
      </div>
    </div>
  );
}

// The line that stops a stale shelf from reading as the live one.
//
// Two states, because they are two different claims. Offline is a fact about
// the device and says plainly that the collection is read-only. Online but
// still on the snapshot means the load failed for some other reason -- an
// expired token, Supabase down, a captive portal that answers every request
// with a login page -- and there the honest offer is a retry.
function OfflineBanner({ online, syncedAt, refreshing, onRefresh, queueNote }) {
  const age = syncAgeLabel(syncedAt);

  return (
    <div className="mx-auto max-w-6xl px-6 print:hidden">
      <div
        role="status"
        className="flex flex-col gap-2 rounded-2xl border border-[#e2c78a] bg-[#fff3d8] px-5 py-4 text-sm leading-6 text-[#6d5526] sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-start gap-3">
          <Icon name={online ? "refresh" : "wifiOff"} size={17} className="mt-0.5 shrink-0" />
          <span>
            {online ? (
              <>Couldn&apos;t reach your collection just now. Showing your last synced copy, from {age}.</>
            ) : (
              <>
                You&apos;re offline. This is your collection as it was {age} — add and edit freely; it syncs when you reconnect.
                {queueNote ? ` ${queueNote}.` : ""}
              </>
            )}
          </span>
        </div>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="shrink-0 self-start rounded-full border border-[#d8b96a] bg-[#fff9ec] px-4 py-1.5 font-medium text-[#6d5526] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
          >
            {refreshing ? "Checking..." : "Try again"}
          </button>
        )}
      </div>
    </div>
  );
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
      // "Delete my account" has to mean the copy cached on this device too,
      // not just the rows in Postgres.
      clearOfflineCollection(currentUser?.id);
      await clearQueue(currentUser?.id);
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

      <Card className="mt-6 rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-sm">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between md:p-8">
          <div>
            <h2 className="text-lg font-semibold">Enjoying FirstFinder?</h2>
            <p className="mt-1 text-sm leading-6 text-[#665746]">It's free and always will be — a passion project I pay for out of pocket. Any donation helps keep it that way.</p>
          </div>
          <a
            href="https://buymeacoffee.com/firstfinder"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackEvent("donation_link_clicked", { source_page: "my_account" })}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-[#cdbb9d] bg-white px-6 text-sm font-medium text-[#665746] hover:bg-[#fff8ee]"
          >
            <Icon name="heart" size={16} /> Buy me a coffee
          </a>
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

function AddItemsPage({ quickItem, setQuickItem, quickItemPhotos, quickReceiptPhotos, onUpload, onRemove, onSave, saving, onIdentifyPhoto, identifying, onFullAdd, onInventory, inventory, totalCostBasis, totalGain, onDownloadTemplate, onBulkUpload, bulkUploading, bulkMessage }) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-5xl font-semibold tracking-tight">Add something quickly.</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-[#665746]">Use quick add for most items. Identify a photo to fill the fields for you, use CSV for bulk import, or open the tutorial for the guided flow.</p>
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
          <Button onClick={onInventory} className="rounded-full bg-[#123f38] px-6 text-[#fff7ea] hover:bg-[#0f332d]">My Collection</Button>
          <Button onClick={onFullAdd} variant="outline" className="rounded-full border-[#cdbb9d] bg-[#fff8ee] px-6 hover:bg-white">Tutorial</Button>
        </div>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <DashboardCard icon="box" label="In your collection" value={inventory.length} />
        <DashboardCard icon="receipt" label="What you paid" value={formatCurrency(totalCostBasis)} />
        <DashboardCard icon="dollar" label="Change in value" value={formatCurrency(totalGain)} />
      </div>

      <IdentifyPhotoCard onPhoto={onIdentifyPhoto} identifying={identifying} />

      <div id="quick-add-form" className="scroll-mt-24">
        <Card className="mt-8 rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-xl">
          <CardContent className="p-6 md:p-8">
            <form onSubmit={onSave}>
            <div>
              <div className="text-sm uppercase tracking-[0.18em] text-[#7d6c5a]">Quick add</div>
              <h2 className="mt-1 text-3xl font-semibold">New collectible</h2>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-4">
              <BookNameField
                label="Item name"
                value={quickItem.name}
                enabled={quickItem.category === "Book"}
                onChange={(value) => setQuickItem({ ...quickItem, name: value })}
                onSelectSuggestion={(suggestion) => setQuickItem((current) => applyBookSuggestion(current, suggestion))}
              />
              <SelectField label="Category" value={quickItem.category} options={quickCategories} onChange={(value) => setQuickItem({ ...quickItem, category: value })} />
              <Field label="What you paid" type="number" value={quickItem.purchasePrice} onChange={(value) => setQuickItem({ ...quickItem, purchasePrice: value })} />
              <Field
                label={quickItem.status === "Sold" ? "Sold for" : "Estimated value"}
                type="number"
                value={quickItem.status === "Sold" ? quickItem.soldPrice : quickItem.estimatedValue}
                onChange={(value) => setQuickItem({ ...quickItem, [quickItem.status === "Sold" ? "soldPrice" : "estimatedValue"]: value })}
              />
              {usesAuthorField(quickItem.category) && (
                <Field label="Author" value={quickItem.author} onChange={(value) => setQuickItem({ ...quickItem, author: value })} />
              )}
              <Field label="Make / Publisher / Brand" value={quickItem.maker} onChange={(value) => setQuickItem({ ...quickItem, maker: value })} />
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
              <CompactUploader title="Item photo" icon="camera" photos={quickItemPhotos} onUpload={(event) => onUpload(event, "quickItem")} onRemove={(id) => onRemove(id, "quickItem")} />
              <CompactUploader title="Receipt proof" icon="receipt" photos={quickReceiptPhotos} onUpload={(event) => onUpload(event, "quickReceipt")} onRemove={(id) => onRemove(id, "quickReceipt")} />
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

function FullAddPage({ item, setItem, itemPhotos, receiptPhotos, onUpload, onRemove, onSave, saving, onReset, onLoadSample }) {
  return (
    <section className="mx-auto grid max-w-6xl gap-8 px-6 py-10 lg:grid-cols-[0.82fr_1.18fr] lg:py-16">
      <div><motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}><h1 className="max-w-3xl text-5xl font-semibold leading-[0.98] tracking-tight md:text-6xl">Add the complete record.</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-[#665746]">Use this guided tutorial when you want to capture every field, item photo, and receipt/proof image before saving.</p></motion.div><Card className="mt-8 rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-sm"><CardContent className="p-6"><h2 className="text-xl font-semibold">Try a sample</h2><div className="mt-4 grid gap-3">{sampleItems.map((sample) => <button key={sample.name} onClick={() => onLoadSample(sample)} className={`rounded-2xl border p-4 text-left transition hover:bg-white ${item.name === sample.name ? "border-[#123f38] bg-white" : "border-[#e0d2bc] bg-[#f8f0e4]"}`}><div className="font-semibold">{sample.name}</div><div className="text-sm text-[#665746]">{sample.category} · {sample.source}</div></button>)}</div></CardContent></Card></div>
      <div className="space-y-5"><Card className="rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-xl"><CardContent className="p-6"><div className="flex items-start justify-between gap-4"><div><div className="text-sm uppercase tracking-[0.18em] text-[#7d6c5a]">Step 1</div><h2 className="mt-1 text-2xl font-semibold">Item record</h2></div><div className="rounded-full bg-[#edf4f2] px-3 py-1 text-sm font-medium text-[#123f38]">Detailed</div></div><div className="mt-5 grid gap-3 md:grid-cols-2"><BookNameField label="Item name" value={item.name} enabled={item.category === "Book"} onChange={(value) => setItem({ ...item, name: value })} onSelectSuggestion={(suggestion) => setItem((current) => applyBookSuggestion(current, suggestion))} /><Field label="Category" value={item.category} onChange={(value) => setItem({ ...item, category: value })} />{usesAuthorField(item.category) && (<Field label="Author" value={item.author} onChange={(value) => setItem({ ...item, author: value })} />)}<Field label="Make / Publisher / Brand" value={item.maker} onChange={(value) => setItem({ ...item, maker: value })} />{item.category === "Book" ? (<><Field label="Genre" value={item.bookGenre} onChange={(value) => setItem({ ...item, bookGenre: value })} /><SelectField label="Edition" value={item.bookEdition} options={bookEditionOptions} placeholder="Select edition" onChange={(value) => setItem({ ...item, bookEdition: value })} /><SelectField label="Printing" value={item.bookPrinting} options={bookPrintingOptions} placeholder="Select printing" onChange={(value) => setItem({ ...item, bookPrinting: value })} /></>) : (<Field label="Edition / Variant / Details" value={item.edition} onChange={(value) => setItem({ ...item, edition: value })} />)}<SelectField label="Status" value={item.status} options={statuses} onChange={(value) => setItem((current) => ({ ...current, status: value, soldDate: value === "Sold" && !current.soldDate ? todayIso() : current.soldDate }))} />{item.status === "Sold" && (<Field label="Sold on" type="date" value={item.soldDate} onChange={(value) => setItem({ ...item, soldDate: value })} />)}<SelectField label="Condition" value={item.condition} options={conditionOptions} placeholder="Not set" onChange={(value) => setItem({ ...item, condition: value })} /><Field label="Purchase date" type="date" value={item.purchaseDate} onChange={(value) => setItem({ ...item, purchaseDate: value })} /><Field label="Where purchased" value={item.source} onChange={(value) => setItem({ ...item, source: value })} /><Field label="What you paid" type="number" value={item.purchasePrice} onChange={(value) => setItem({ ...item, purchasePrice: value })} /><Field label={item.status === "Sold" ? "Sold for" : "Estimated value"} type="number" value={item.status === "Sold" ? item.soldPrice : item.estimatedValue} onChange={(value) => setItem({ ...item, [item.status === "Sold" ? "soldPrice" : "estimatedValue"]: value })} /><Field label="Notes" value={item.notes} onChange={(value) => setItem({ ...item, notes: value })} /></div></CardContent></Card><div className="grid gap-5 md:grid-cols-2"><PhotoUploader title="Item photos" eyebrow="Step 2" description="Capture condition, edition points, signatures, defects, tags, labels, or packaging." prompts={itemPhotoPrompts} photos={itemPhotos} onUpload={(event) => onUpload(event, "item")} onRemove={(id) => onRemove(id, "item")} /><PhotoUploader title="Receipt / proof photos" eyebrow="Step 3" description="Save receipts, invoices, order confirmations, auction records, or payment screenshots." prompts={receiptPhotoPrompts} photos={receiptPhotos} onUpload={(event) => onUpload(event, "receipt")} onRemove={(id) => onRemove(id, "receipt")} /></div><Card className="rounded-[2rem] border-[#d8c7ad] bg-white shadow-xl"><CardContent className="p-6"><div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between"><div><div className="text-sm uppercase tracking-[0.18em] text-[#7d6c5a]">Step 4</div><h2 className="mt-1 text-3xl font-semibold">Review and save</h2><p className="mt-3 max-w-xl leading-7 text-[#665746]">{item.name || "This item"} cost you {formatCurrency(item.purchasePrice)} and {item.status === "Sold" ? <>sold for {formatEstimatedValue(item)}. Realized gain/loss is {formatGain(calculateGain(item))}.</> : <>is worth an estimated {formatEstimatedValue(item)}. That's a change of {formatGain(calculateGain(item))}.</>}</p></div><div className="rounded-3xl bg-[#f7efe3] p-5 text-center"><div className="text-3xl font-semibold text-[#123f38]">{formatGain(calculateGain(item))}</div><div className="mt-1 text-sm text-[#665746]">{item.status === "Sold" ? "realized gain/loss" : "est. gain/loss"}</div></div></div><div className="mt-6 grid gap-3 md:grid-cols-3"><SummaryPill label="Item photos" value={itemPhotos.length} /><SummaryPill label="Receipt photos" value={receiptPhotos.length} /><SummaryPill label="Status" value={item.status} /></div>{receiptPhotos.length === 0 && <div className="mt-5 rounded-2xl bg-[#fff3d8] p-4 text-sm leading-6 text-[#6d5526]">Add a receipt or proof photo if you want to be able to prove what you paid later.</div>}<div className="mt-6 flex flex-col gap-3 sm:flex-row"><Button onClick={onSave} disabled={saving} className="h-11 rounded-full bg-[#123f38] px-6 text-[#fff7ea] hover:bg-[#0f332d]"><Icon name="save" size={17} className="mr-2" /> {saving ? "Saving photos..." : "Save to collection"}</Button><Button variant="outline" onClick={onReset} className="h-11 rounded-full border-[#cdbb9d] bg-[#fff8ee] px-6 hover:bg-white">Reset form</Button></div></CardContent></Card></div>
    </section>
  );
}

function InventoryPage({ inventory, loading, filteredInventory, searchTerm, setSearchTerm, viewMode, setViewMode, statusView, setStatusView, activeCount, soldCount, totalCostBasis, totalEstimatedValue, totalGain, onAdd, onExport, onShare, shareVisibility, onDelete, onMarkSold, onRestoreSold, onEdit, onInlineSave, bulkMessage, focusItemId, onFocusHandled }) {
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

  // Someone arriving from a tapped cover is asking for one specific record, so
  // this scrolls to it and marks it.
  //
  // The filters above need no clearing: leaving the collection unmounts this
  // page, so arriving from the dashboard always arrives with them at their
  // defaults. The search box is the app's, and showItemInCollection clears it.
  //
  // The mark is the focusItemId prop itself rather than a copy in state, and
  // the timer below clears it at the source. That keeps this effect free of
  // the synchronous setState that turns a prop change into a second render.
  useEffect(() => {
    if (!focusItemId) return;

    const element = document.getElementById(`item-${focusItemId}`);
    if (element) {
      // Smooth, unless the reader has asked their system for less motion --
      // a long animated jump down a hundred-item list is exactly what they
      // asked not to have.
      const lessMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      element.scrollIntoView({ behavior: lessMotion ? "auto" : "smooth", block: "center" });
    }

    // Long enough to catch the eye once the scroll lands, short enough that it
    // never becomes a state the collector has to dismiss. Leaving the
    // collection before it fires leaves the request standing, so the next
    // visit scrolls there once more -- the same answer to the same question.
    const fade = setTimeout(onFocusHandled, 2600);
    return () => clearTimeout(fade);
    // onFocusHandled is a fresh closure every render; the id is what decides
    // whether this runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusItemId]);

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
              ? "Sold items stay preserved here, with what you paid and what you got for them."
              : "Sold items move out of these counts and into the Sold tab."}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          {/* Always the verb, never the status. This button used to read
              "Sharing on" once a page was live, which describes a state
              rather than offering a way in -- so the one thing people came
              for, the link, looked like a label they could not press. The dot
              carries the status instead. */}
          <Button variant="outline" onClick={onShare} className="rounded-full border-[#cdbb9d] bg-[#fff8ee] px-6 hover:bg-white">
            <Icon name="link" size={16} className="mr-2" /> Share
            {shareVisibility && shareVisibility !== "off" && (
              <>
                <span aria-hidden="true" className="ml-2 h-2 w-2 rounded-full bg-[#123f38]" />
                <span className="sr-only">(your page is live)</span>
              </>
            )}
          </Button>
          <Button variant="outline" onClick={() => { trackEvent("insurance_export_viewed"); onExport(); }} className="rounded-full border-[#cdbb9d] bg-[#fff8ee] px-6 hover:bg-white"><Icon name="file" size={16} className="mr-2" /> Export for insurance</Button>
          <Button onClick={onAdd} className="rounded-full bg-[#123f38] px-6 text-[#fff7ea] hover:bg-[#0f332d]">Add to collection</Button>
        </div>
      </div>

      {bulkMessage && <div className="mt-6 rounded-2xl bg-[#edf4f2] p-4 text-sm leading-6 text-[#123f38]">{bulkMessage}</div>}

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <DashboardCard icon="receipt" label="What you paid" value={formatCurrency(totalCostBasis)} />
        <DashboardCard icon="dollar" label={isSoldView ? "Sold for (total)" : "Estimated value"} value={formatCurrency(totalEstimatedValue)} />
        <DashboardCard icon="search" label={isSoldView ? "Realized gain/loss" : "Change in value"} value={formatCurrency(totalGain)} />
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <div className="rounded-2xl border border-[#d8c7ad] bg-[#fff8ee] p-3">
          <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3">
            <Icon name="search" size={18} className="text-[#746655]" />
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search by item, category, author, maker, source, or status..." className="w-full bg-transparent outline-none" />
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

      {/* flex-wrap + shrink-0 on the toggle: TabButton is shrink-0, so when
          this row ran out of width the toggle's own box was squeezed narrower
          than the buttons inside it and they spilled past its rounded border.
          Now the toggle keeps its natural width and drops to its own line
          instead, and min-w-0 lets the label wrap rather than forcing the
          overflow in the first place. */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[2rem] border border-[#d8c7ad] bg-[#fff8ee] px-4 py-3">
        <div className="min-w-0 text-sm text-[#665746]">
          Showing {statusView === "sold" ? "sold records" : "your active collection"}
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-full border border-[#d8c7ad] bg-[#fff8ee] p-1">
          <TabButton active={statusView === "active"} onClick={() => setStatusView("active")}>Active ({activeCount})</TabButton>
          <TabButton active={statusView === "sold"} onClick={() => setStatusView("sold")}>Sold ({soldCount})</TabButton>
        </div>
      </div>

      {inventory.length === 0 && loading ? (
        /* Same flash as the dashboard: an unfetched collection and an empty
           one are both length 0, and only one of them should say so. */
        <Card className="mt-8 rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-sm">
          <CardContent className="p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf4f2] text-[#123f38]"><Icon name="receipt" size={26} /></div>
            <h2 className="mt-5 text-2xl font-semibold">Just a sec…</h2>
            <p className="mx-auto mt-3 max-w-md leading-7 text-[#665746]">Pulling your collection together.</p>
          </CardContent>
        </Card>
      ) : inventory.length === 0 ? (
        <Card className="mt-8 rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-sm">
          <CardContent className="p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#123f38] text-[#fff7ea]"><Icon name="receipt" size={26} /></div>
            <h2 className="mt-5 text-2xl font-semibold">Nothing in your collection yet</h2>
            <p className="mx-auto mt-3 max-w-md leading-7 text-[#665746]">Add an item or import a CSV to start building your cost-basis record.</p>
          </CardContent>
        </Card>
      ) : displayedInventory.length === 0 ? (
        <Card className="mt-8 rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-sm">
          <CardContent className="p-8 text-center"><h2 className="text-2xl font-semibold">No matches</h2><p className="mt-3 text-[#665746]">Try a different search term or filter.</p></CardContent>
        </Card>
      ) : viewMode === "records" ? (
        <div className="mt-8 overflow-hidden rounded-[2rem] border border-[#d8c7ad] bg-[#fff9f0] shadow-sm">
          <div className="border-b border-[#e0d2bc] px-5 py-3 text-xs text-[#8a7a64]">
            Click any name, category, status, or amount to edit it here. Enter saves, Escape cancels.
          </div>
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
                  <tr
                    key={entry.id}
                    id={`item-${entry.id}`}
                    className={`border-t border-[#e0d2bc] transition ${focusItemId === entry.id ? "bg-[#edf4f2]" : ""}`}
                  >
                    <td className="px-5 py-4">
                      <InlineCell
                        label="item name"
                        value={entry.name}
                        display={
                          <span className="font-semibold">
                            {entry.name || "Untitled item"}
                            {entry.pendingSync && <PendingChip error={entry.pendingError} className="ml-2 align-middle" />}
                          </span>
                        }
                        onSave={(value) => onInlineSave(entry.id, { name: value })}
                      />
                      <InlineCell
                        label={usesAuthorField(entry.category) ? "author" : "maker"}
                        value={usesAuthorField(entry.category) ? entry.author : entry.maker}
                        display={<span className="text-[#665746]">{itemCredit(entry) || "Unknown maker"}</span>}
                        onSave={(value) => onInlineSave(entry.id, usesAuthorField(entry.category) ? { author: value } : { maker: value })}
                      />
                    </td>
                    <td className="px-5 py-4">
                      <InlineCell label="category" value={entry.category} options={quickCategories} onSave={(value) => onInlineSave(entry.id, { category: value })} />
                    </td>
                    <td className="px-5 py-4">
                      <InlineCell label="status" value={entry.status} options={statuses} onSave={(value) => onInlineSave(entry.id, { status: value })} />
                    </td>
                    <td className="px-5 py-4">
                      <InlineCell
                        label="what you paid"
                        type="number"
                        value={entry.purchasePrice}
                        display={formatCurrency(entry.purchasePrice)}
                        onSave={(value) => onInlineSave(entry.id, { purchasePrice: value })}
                      />
                    </td>
                    <td className="px-5 py-4">
                      <InlineCell
                        label={entry.status === "Sold" ? "sold price" : "estimated value"}
                        type="number"
                        value={entry.status === "Sold" ? entry.soldPrice : entry.estimatedValue}
                        display={formatEstimatedValue(entry)}
                        onSave={(value) => onInlineSave(entry.id, entry.status === "Sold" ? { soldPrice: value } : { estimatedValue: value })}
                      />
                    </td>
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
                        <button onClick={() => setPendingDelete(entry)} className="rounded-full bg-[#f0e2cf] p-2 text-[#665746] hover:bg-[#ead8bf]" aria-label={`Delete ${entry.name || "this item"}`}><Icon name="trash" size={17} /></button>
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
            <Card
              key={entry.id}
              id={`item-${entry.id}`}
              className={`scroll-mt-24 rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-sm transition ${
                focusItemId === entry.id ? "ring-2 ring-[#123f38] ring-offset-2 ring-offset-[#f6efe3]" : ""
              }`}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-[#edf4f2] px-3 py-1 text-xs font-medium text-[#123f38]">{entry.status}</span>
                      <span className="rounded-full bg-[#f0e2cf] px-3 py-1 text-xs font-medium text-[#665746]">{entry.category}</span>
                      {entry.pendingSync && <PendingChip error={entry.pendingError} />}
                    </div>
                    <h2 className="mt-3 text-2xl font-semibold">{entry.name || "Untitled item"}</h2>
                    <p className="text-[#665746]">{itemCredit(entry) || "Unknown maker"}</p>
                  </div>
                  <button onClick={() => setPendingDelete(entry)} className="rounded-full bg-[#f0e2cf] p-2 text-[#665746] hover:bg-[#ead8bf]" aria-label={`Delete ${entry.name || "this item"}`}><Icon name="trash" size={17} /></button>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <SmallMetric label="Paid" value={formatCurrency(entry.purchasePrice)} />
                  <SmallMetric label="Value" value={formatEstimatedValue(entry)} />
                  <SmallMetric label="Change" value={formatGain(calculateGain(entry))} />
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

  const [itemPhotosById, setItemPhotosById] = useState({});

  useEffect(() => {
    let cancelled = false;
    const allPhotos = items.flatMap((item) => (item.itemPhotos || []).map((photo) => ({ ...photo, itemId: item.id })));
    if (allPhotos.length === 0) return;

    fetchSignedPhotoUrls(allPhotos).then((resolved) => {
      if (cancelled) return;
      const byItem = {};
      resolved.forEach((photo) => {
        if (!byItem[photo.itemId]) byItem[photo.itemId] = [];
        byItem[photo.itemId].push(photo);
      });
      setItemPhotosById(byItem);
    });

    return () => {
      cancelled = true;
    };
  }, [items]);

  function handleExportCsv() {
    trackEvent("insurance_export_csv_downloaded", { item_count: items.length });
    const csv = buildCsvExport(items);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "firstfinder-collection-export.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="mx-auto max-w-5xl px-6 py-12 print:max-w-none print:px-0 print:py-0">
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">Collection report.</h1>
          <p className="mt-2 max-w-xl text-[#665746]">A printable summary of your active collection — for insurance, estate planning, or your own records. Use your browser's print dialog to save it as a PDF, or export the raw data as a CSV (photos aren't included in the CSV).</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button variant="outline" onClick={onBack} className="rounded-full border-[#cdbb9d] bg-[#fff8ee] px-5 hover:bg-white">Back to collection</Button>
          <Button variant="outline" onClick={handleExportCsv} className="rounded-full border-[#cdbb9d] bg-[#fff8ee] px-5 hover:bg-white"><Icon name="file" size={16} className="mr-2" /> Export as CSV</Button>
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

      {/* Screen view: a compact table. Hidden for print -- a wide table
          doesn't reflow to a printed page's width, which is what made the
          old PDF output overflow and truncate columns. */}
      <div className="mt-8 overflow-hidden rounded-[2rem] border border-[#d8c7ad] bg-white print:hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-[#f0e2cf] text-xs uppercase tracking-[0.14em] text-[#665746]">
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
                    <div className="text-[#665746]">{itemCredit(item) || "Unknown maker"}</div>
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

      {/* Print-only view: an itemized list rather than a table, so every
          item's photos and details flow within the printed page width
          instead of needing horizontal space a page doesn't have. */}
      <div className="hidden print:mt-4 print:block">
        {items.map((item) => (
          <div key={item.id} className="break-inside-avoid border-t border-[#e0d2bc] py-4 first:border-t-0">
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <div className="font-semibold">{item.name || "Untitled item"}</div>
                <div className="text-sm text-[#665746]">
                  {itemCredit(item) || "Unknown maker"} · {item.category}
                  {item.condition ? ` · ${item.condition}` : ""}
                </div>
              </div>
              <div className="whitespace-nowrap text-right text-sm">
                <div>Cost {formatCurrency(item.purchasePrice)}</div>
                <div>Value {formatEstimatedValue(item)}</div>
              </div>
            </div>
            <div className="mt-1 text-xs text-[#8a7a64]">
              Purchased {item.purchaseDate || "unknown date"} · {item.source || "unknown source"}
            </div>
            {item.notes && <div className="mt-1 text-xs text-[#8a7a64]">{item.notes}</div>}
            {(itemPhotosById[item.id]?.length > 0) && (
              <div className="mt-2 flex flex-wrap gap-2">
                {itemPhotosById[item.id].map((photo) => (
                  <SignedPhoto
                    key={photo.path}
                    path={photo.path}
                    src={photo.url}
                    frameClassName="h-24 w-24 rounded-lg border border-[#e0d2bc]"
                    className="h-24 w-24 object-cover"
                    quiet
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// Rounds the axis top up to a value whose halfway point is also a round number,
// so the mid gridline's label is exact rather than a rounded approximation of
// wherever the line happens to fall.
function niceScaleMax(value, integerOnly) {
  if (value <= 0) return integerOnly ? 2 : 1;
  if (integerOnly) return Math.max(2, Math.ceil(value / 2) * 2);

  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  const step = steps.find((candidate) => candidate * magnitude >= value);
  return (step ?? 10) * magnitude;
}

// Rounded only at the data end, anchored to the baseline.
function barPath(x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width / 2, height));
  return `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`;
}

// One measure over time. Deliberately one series per chart: volume and dollars
// live on different scales, and putting them on one plot would need a second
// y-axis, which invents a correlation that isn't in the data.
function TimeSeriesChart({ title, buckets, metric, color, formatValue }) {
  const values = buckets.map((bucket) => bucket[metric]);
  const max = Math.max(...values, 0);

  if (buckets.length === 0 || max <= 0) {
    return (
      <Card className="rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-sm">
        <CardContent className="p-6">
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-6 text-sm text-[#8a7a64]">Nothing to chart yet.</p>
        </CardContent>
      </Card>
    );
  }

  const width = 640;
  // Headroom above the plot so the peak's direct label can't clip the top.
  const plotTop = 24;
  const plotBottom = 150;
  const plotLeft = 52;
  const plotRight = 632;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;

  const scaleMax = niceScaleMax(max, metric === "count");
  const slot = plotWidth / buckets.length;
  // Capped so a collection with only a few months doesn't render as a row of
  // heavy blocks. Thin marks read better and stay on-brand.
  const barWidth = Math.max(2, Math.min(48, slot - 2));
  const peakIndex = values.indexOf(max);

  // Label the ends and the peak only. A number on every bar is unreadable.
  const labelledTicks = new Set([0, buckets.length - 1, peakIndex]);

  return (
    <Card className="rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-sm">
      <CardContent className="p-6">
        <h3 className="font-semibold">{title}</h3>

        <svg viewBox={`0 0 ${width} 186`} className="mt-4 w-full" role="img" aria-label={title}>
          {[0, 0.5, 1].map((fraction) => {
            const y = plotBottom - fraction * plotHeight;
            return (
              <g key={fraction}>
                <line x1={plotLeft} y1={y} x2={plotRight} y2={y} stroke="#e0d2bc" strokeWidth="1" />
                <text x={plotLeft - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#8a7a64" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {formatValue(scaleMax * fraction)}
                </text>
              </g>
            );
          })}

          {buckets.map((bucket, index) => {
            const value = bucket[metric];
            const height = scaleMax > 0 ? (value / scaleMax) * plotHeight : 0;
            const x = plotLeft + index * slot + (slot - barWidth) / 2;
            const y = plotBottom - height;
            return (
              <g key={bucket.key}>
                {height > 0 && <path d={barPath(x, y, barWidth, height, 4)} fill={color} />}
                <title>{`${monthLabel(bucket.key)}: ${formatValue(value)}`}</title>
                {index === peakIndex && height > 0 && (
                  <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill="#201a14">
                    {formatValue(value)}
                  </text>
                )}
                {labelledTicks.has(index) && (
                  <text x={x + barWidth / 2} y={plotBottom + 18} textAnchor="middle" fontSize="11" fill="#8a7a64">
                    {monthLabel(bucket.key)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-[#8a7a64] hover:text-[#665746]">Table view</summary>
          <div className="mt-2 max-h-48 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[#8a7a64]">
                <tr><th className="py-1">Month</th><th className="py-1 text-right">{metric === "count" ? "Items" : "Amount"}</th></tr>
              </thead>
              <tbody>
                {buckets.map((bucket) => (
                  <tr key={bucket.key} className="border-t border-[#e0d2bc]">
                    <td className="py-1">{monthLabel(bucket.key)}</td>
                    <td className="py-1 text-right" style={{ fontVariantNumeric: "tabular-nums" }}>{formatValue(bucket[metric])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

function StatTile({ label, value, sublabel }) {
  return (
    <Card className="rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-sm">
      <CardContent className="p-6">
        <div className="text-xs uppercase tracking-[0.16em] text-[#7d6c5a]">{label}</div>
        <div className="mt-2 text-3xl font-semibold text-[#201a14]">{value}</div>
        {sublabel && <div className="mt-1 truncate text-sm text-[#665746]" title={sublabel}>{sublabel}</div>}
      </CardContent>
    </Card>
  );
}

// The dashboard opens on the collection itself, not on its balance sheet.
// Six most recent finds, newest first, using each item's first photo. Items
// without a photo are skipped rather than shown as empty frames -- a gap in
// the strip reads as a bug, a shorter strip doesn't.
function RecentFinds({ inventory, onCollection, onOpenItem }) {
  const recent = useMemo(
    () =>
      [...inventory]
        .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt))
        .filter((item) => (item.itemPhotos || []).some((photo) => photo.path || photo.url))
        .slice(0, 6),
    [inventory]
  );

  const [covers, setCovers] = useState([]);

  useEffect(() => {
    if (recent.length === 0) {
      setCovers([]);
      return;
    }

    let cancelled = false;

    // One signed-URL round trip for the whole strip rather than one per
    // thumbnail: these expire in an hour, so they can't be cached with the row.
    fetchSignedPhotoUrls(recent.map((item) => (item.itemPhotos || []).find((photo) => photo.path || photo.url))).then(
      (photos) => {
        if (cancelled) return;
        // The path travels with the URL: it is what a cover needs to ask for
        // a new URL of its own when the one it was handed stops working.
        setCovers(
          recent
            .map((item, index) => ({ item, url: photos[index]?.url, path: photos[index]?.path }))
            // A cover whose URL did not come back is still a book the
            // collector owns: it keeps its place, says the photo did not
            // load, and re-signs itself. Dropping it made the strip quietly
            // shorter, which reads as items going missing.
            .filter((cover) => cover.url || cover.path)
        );
      }
    );

    return () => {
      cancelled = true;
    };
  }, [recent]);

  if (covers.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="flex items-baseline justify-between">
        <h2 className="text-2xl font-semibold">Recent finds</h2>
        <button type="button" onClick={onCollection} className="text-sm font-medium text-[#123f38] underline underline-offset-4 hover:text-[#0f332d]">
          See everything
        </button>
      </div>
      <div className="mt-4 flex gap-4 overflow-x-auto pb-2">
        {covers.map(({ item, url, path }) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpenItem(item)}
            /* A cover is a picture of one book, so tapping it goes to that
               book's record rather than to the collection in general. */
            aria-label={`Show "${item.name || "this item"}" in your collection`}
            className="group w-32 shrink-0 rounded-2xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#123f38]/40"
          >
            <div className="overflow-hidden rounded-2xl border border-[#d8c7ad] bg-[#f7efe3]">
              <SignedPhoto
                path={path}
                src={url}
                frameClassName="aspect-[3/4] w-full"
                className="h-full w-full object-cover transition group-hover:opacity-90"
                allowRetry={false}
              />
            </div>
            <div className="mt-2 truncate text-sm font-medium" title={item.name || "Untitled item"}>{item.name || "Untitled item"}</div>
            <div className="truncate text-xs text-[#7d6c5a]" title={itemCredit(item)}>{itemCredit(item) || "Unknown maker"}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function DashboardPage({ inventory, loading, onAddItems, onCollection, onOpenItem }) {
  // Deliberately not persisted. The dashboard is a page you glance at, and it
  // should open showing everything rather than a filter you set weeks ago.
  const [category, setCategory] = useState("");
  const [rangeKey, setRangeKey] = useState("all");

  const categoryOptions = useMemo(
    () => Array.from(new Set(inventory.map((item) => item.category).filter(Boolean))).sort(),
    [inventory]
  );

  const { visible, undatedExcluded } = useMemo(
    () => applyDashboardFilters(inventory, category, rangeKey),
    [inventory, category, rangeKey]
  );

  const filtered = category !== "" || rangeKey !== "all";
  const rangeLabel = dashboardRanges.find((entry) => entry.key === rangeKey)?.label;

  function clearFilters() {
    setCategory("");
    setRangeKey("all");
  }

  const sold = useMemo(() => visible.filter((item) => item.status === "Sold"), [visible]);
  const held = useMemo(() => visible.filter((item) => item.status !== "Sold"), [visible]);

  const topHeld = useMemo(
    () => held.reduce((best, item) => (toNumber(item.estimatedValue) > toNumber(best?.estimatedValue ?? 0) ? item : best), null),
    [held]
  );
  const topSold = useMemo(
    () => sold.reduce((best, item) => (toNumber(item.soldPrice) > toNumber(best?.soldPrice ?? 0) ? item : best), null),
    [sold]
  );

  const totalHeldValue = held.reduce((sum, item) => {
    const value = itemValueForTotals(item);
    return value === null ? sum : sum + value;
  }, 0);
  const totalSoldValue = sold.reduce((sum, item) => sum + toNumber(item.soldPrice), 0);

  const categoryCount = useMemo(
    () => new Set(held.map((item) => item.category).filter(Boolean)).size,
    [held]
  );

  const acquisitions = useMemo(() => monthlyBuckets(visible, "purchaseDate", "purchasePrice"), [visible]);
  const sales = useMemo(() => monthlyBuckets(sold, "soldDate", "soldPrice"), [sold]);

  const wholeNumber = (value) => String(Math.round(value));

  if (inventory.length === 0) {
    return (
      <section className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="text-5xl font-semibold tracking-tight">Your collection.</h1>
        {/* Both states reuse the same card shell -- same border, radius, ground
            and padding -- so the swap reads as one surface settling rather than
            two different screens. What changes is what it says: telling someone
            with forty books that they have nothing catalogued, under a button
            inviting them to add their "first" find, reads as data loss rather
            than as a spinner. */}
        <Card className="mt-8 rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-sm">
          {loading ? (
            <CardContent className="p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf4f2] text-[#123f38]"><Icon name="receipt" size={26} /></div>
              <h2 className="mt-5 text-2xl font-semibold">Just a sec…</h2>
              <p className="mx-auto mt-3 max-w-md leading-7 text-[#665746]">Pulling your collection together.</p>
            </CardContent>
          ) : (
            <CardContent className="p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#123f38] text-[#fff7ea]"><Icon name="camera" size={26} /></div>
              <h2 className="mt-5 text-2xl font-semibold">Nothing catalogued yet</h2>
              <p className="mx-auto mt-3 max-w-md leading-7 text-[#665746]">This page fills in as you add finds — what you have, what it's worth, and how the collection has grown.</p>
              <Button onClick={onAddItems} className="mt-6 h-11 rounded-full bg-[#123f38] px-6 text-[#fff7ea] hover:bg-[#0f332d]">Add your first find</Button>
            </CardContent>
          )}
        </Card>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-5xl font-semibold tracking-tight">Your collection.</h1>
          {/* Leads with the shelf, not the ledger: how much is here and how
              varied it is, before any figure with a dollar sign on it. */}
          <p className="mt-4 max-w-2xl text-lg leading-8 text-[#665746]">
            {held.length} item{held.length === 1 ? "" : "s"}
            {categoryCount > 1 ? ` across ${categoryCount} categories` : ""}
            {sold.length > 0 ? `, plus ${sold.length} you've since let go` : ""}.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button variant="outline" onClick={onCollection} className="rounded-full border-[#cdbb9d] bg-[#fff8ee] px-6 hover:bg-white">Browse all</Button>
          <Button onClick={onAddItems} className="rounded-full bg-[#123f38] px-6 text-[#fff7ea] hover:bg-[#0f332d]">Add a find</Button>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3 rounded-[1.5rem] border border-[#d8c7ad] bg-[#fff9f0] p-4 sm:flex-row sm:items-center">
        <label className="flex items-center gap-2 text-sm font-medium text-[#665746]">
          <span className="shrink-0">Category</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="rounded-full border border-[#d8c7ad] bg-[#fffdf8] px-4 py-2 text-sm outline-none transition focus:border-[#123f38] focus:ring-2 focus:ring-[#123f38]/15"
          >
            <option value="">All categories</option>
            {categoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm font-medium text-[#665746]">
          <span className="shrink-0">Period</span>
          <select
            value={rangeKey}
            onChange={(event) => setRangeKey(event.target.value)}
            className="rounded-full border border-[#d8c7ad] bg-[#fffdf8] px-4 py-2 text-sm outline-none transition focus:border-[#123f38] focus:ring-2 focus:ring-[#123f38]/15"
          >
            {dashboardRanges.map((range) => <option key={range.key} value={range.key}>{range.label}</option>)}
          </select>
        </label>

        {filtered && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm font-medium text-[#123f38] underline underline-offset-4 sm:ml-auto"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Everything below is scoped, so say so plainly. A filtered figure read
          as a whole-collection total is the way this feature misleads. */}
      {filtered && (
        <p className="mt-3 text-sm leading-6 text-[#665746]">
          Showing {category === "" ? "all categories" : category}
          {rangeKey === "all" ? "" : `, ${rangeLabel.toLowerCase()}`}. Every figure and chart below covers{" "}
          {visible.length} item{visible.length === 1 ? "" : "s"}.
          {undatedExcluded > 0 && ` ${undatedExcluded} item${undatedExcluded === 1 ? " has" : "s have"} no date and cannot be placed in a period.`}
        </p>
      )}

      {visible.length === 0 ? (
        <Card className="mt-6 rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-sm">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-semibold">Nothing matches those filters</h2>
            <p className="mx-auto mt-3 max-w-md leading-7 text-[#665746]">
              There is nothing in your collection for this combination. Widen the period or pick a different category.
            </p>
            <Button onClick={clearFilters} className="mt-6 h-11 rounded-full bg-[#123f38] px-6 text-[#fff7ea] hover:bg-[#0f332d]">Clear filters</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <RecentFinds inventory={visible} onCollection={onCollection} onOpenItem={onOpenItem} />

          <h2 className="mt-12 text-2xl font-semibold">What it's worth</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Total value held" value={formatCurrency(totalHeldValue)} sublabel={`${held.length} item${held.length === 1 ? "" : "s"}`} />
            <StatTile label="Most expensive held" value={topHeld ? formatCurrency(topHeld.estimatedValue) : "—"} sublabel={topHeld?.name || (held.length > 0 ? "No estimates yet" : "Nothing held")} />
            <StatTile label="Total value sold" value={formatCurrency(totalSoldValue)} sublabel={`${sold.length} item${sold.length === 1 ? "" : "s"}`} />
            <StatTile label="Most expensive sold" value={topSold ? formatCurrency(topSold.soldPrice) : "—"} sublabel={topSold?.name || "Nothing sold yet"} />
          </div>

          <h2 className="mt-12 text-2xl font-semibold">How it's grown</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <TimeSeriesChart title="Items acquired" buckets={acquisitions} metric="count" color="#2f7d6b" formatValue={wholeNumber} />
            <TimeSeriesChart title="Amount spent" buckets={acquisitions} metric="amount" color="#2f7d6b" formatValue={formatCurrency} />
          </div>

          <h2 className="mt-12 text-2xl font-semibold">Sales over time</h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <TimeSeriesChart title="Items sold" buckets={sales} metric="count" color="#b07d2a" formatValue={wholeNumber} />
            <TimeSeriesChart title="Amount realized" buckets={sales} metric="amount" color="#b07d2a" formatValue={formatCurrency} />
          </div>
        </>
      )}
    </section>
  );
}

const identifyingSteps = [
  "Reading the cover…",
  "Matching the title and author…",
  "Looking for edition points…",
  "Checking the number line…",
  "Searching for comparable sales…",
  "Weighing sold prices over asking prices…",
  "Weighing the condition…"
];

// Shown while the identification call is in flight. The photo the user just
// took is the subject, with a scan sweeping over it, so the wait reads as work
// happening on their book rather than a spinner on a blank page.
function IdentifyLoadingOverlay({ photos }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setStep((current) => (current + 1) % identifyingSteps.length), 1700);
    return () => window.clearInterval(timer);
  }, []);

  const cover = photos?.[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#201a14]/75 p-6 backdrop-blur-sm print:hidden">
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-sm rounded-[2rem] border border-[#d8c7ad] bg-[#fff9f0] p-6 shadow-2xl"
      >
        {cover && (
          // Fixed aspect + object-cover rather than a max-height with
          // object-contain: a portrait phone photo inside a variable-height
          // box got scaled down to fit the height, leaving it much narrower
          // than the card and boxed in by black bars on both sides. A fixed
          // box that always fills works the same for portrait and landscape.
          <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-black">
            <img src={cover.url} alt="" className="h-full w-full object-cover opacity-85" />
            <motion.div
              className="pointer-events-none absolute inset-x-0 h-24"
              style={{ background: "linear-gradient(to bottom, rgba(47,125,107,0), rgba(47,125,107,0.5), rgba(47,125,107,0))" }}
              animate={{ y: ["-30%", "130%"] }}
              transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
        )}

        {photos?.length > 1 && (
          <div className="mt-3 text-center text-xs uppercase tracking-[0.16em] text-[#8a7a64]">
            Reading {photos.length} photos together
          </div>
        )}

        {/* Keyed so each message remounts and fades in. Deliberately not wrapped
            in AnimatePresence: with mode="wait" the enter animation could be
            left un-run, leaving the message stuck at opacity 0.
            min-h-7, not a fixed h-7: h-7 is exactly one line at this text
            size, so a longer message (e.g. "Weighing sold prices over
            asking prices…") wrapping to two lines on a narrow phone
            overflowed the fixed box and visually collided with the
            progress bar directly below it. min-h-7 keeps short messages
            compact but lets the box grow for a wrapped one, pushing the
            progress bar down instead of overlapping it. */}
        <div className="mt-5 min-h-7 text-center">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="font-display text-lg font-semibold text-[#201a14]"
          >
            {identifyingSteps[step]}
          </motion.div>
        </div>

        {/* Indeterminate on purpose -- there's no real progress to report, and a
            fake percentage would be a lie about how far along it is. */}
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#e0d2bc]">
          <motion.div
            className="h-full w-1/3 rounded-full bg-[#2f7d6b]"
            animate={{ x: ["-110%", "320%"] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        <p className="mt-4 text-center text-sm leading-6 text-[#8a7a64]">
          This usually takes a few seconds. You'll get to review and edit everything before anything is saved.
        </p>
      </motion.div>
    </div>
  );
}

// The entry point for photo identification. Sits between the summary cards and
// the manual form, so the fast path is the first thing you see.
function IdentifyPhotoCard({ onPhoto, identifying }) {
  return (
    <Card className="mt-8 rounded-[2rem] border-[#123f38]/25 bg-[#edf4f2] shadow-sm">
      <CardContent className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between md:p-8">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-[#123f38]">
            <Icon name="camera" size={14} /> Fastest way in
          </div>
          <h2 className="mt-3 text-2xl font-semibold">Take a picture, we'll fill in the rest.</h2>
          <p className="mt-2 max-w-xl leading-7 text-[#365c53]">
            Photograph the cover and we'll identify the title, edition, and a rough value, then hand you an editable draft. The photo is attached to the record. You'll still enter what you paid.
          </p>
          {/* Stated before the button, not after the refusal. */}
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#5c7a72]">
            Limited to {identifyDailyLimitCopy} identifications a day per account, and they can pause if the budget
            runs out — each one is a live, search-grounded API call, and this is a self-funded app.
          </p>
        </div>
        <label
          onClick={() => trackEvent("identify_button_clicked", { source_page: "add_items" })}
          className={`flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-[#123f38] px-7 font-medium text-[#fff7ea] ${identifying ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-[#0f332d]"}`}
        >
          <Icon name="camera" size={18} />
          {identifying ? "Identifying..." : "Take or upload a photo"}
          <input type="file" accept="image/*" capture="environment" onChange={onPhoto} disabled={identifying} className="hidden" />
        </label>
      </CardContent>
    </Card>
  );
}

// Review screen for an identified photo: the picture beside the fields it
// produced. Everything stays editable, and nothing reaches the collection until
// the user submits.
const saleTypeLabel = {
  sold: "Sold",
  auction_result: "Auction result",
  active_listing: "Asking price",
  unknown: "Unclear"
};

// Asking prices get visually deprioritized -- they're the thing the model was
// told not to lean on, so the UI shouldn't present them with equal weight to
// an actual sale.
const saleTypeTone = {
  sold: "bg-[#edf4f2] text-[#123f38]",
  auction_result: "bg-[#edf4f2] text-[#123f38]",
  active_listing: "bg-[#f0e2cf] text-[#665746]",
  unknown: "bg-[#f0e2cf] text-[#665746]"
};

function ValueRangeBlock({ label, range, onUseLow, onUseHigh, caveat }) {
  if (!range) {
    return (
      <div className="rounded-2xl bg-[#f7efe3] p-4">
        <div className="text-xs uppercase tracking-[0.16em] text-[#7d6c5a]">{label}</div>
        <p className="mt-1 text-sm leading-6 text-[#8a7a64]">No supported estimate — search didn't turn up usable comparables.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-[#f7efe3] p-4">
      <div className="text-xs uppercase tracking-[0.16em] text-[#7d6c5a]">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-[#123f38]">
        {range.low === range.high ? formatCurrency(range.low) : `${formatCurrency(range.low)}–${formatCurrency(range.high)}`}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <button type="button" onClick={onUseLow} className="text-sm font-medium text-[#123f38] underline underline-offset-4 hover:text-[#0f332d]">
          Use {formatCurrency(range.low)}
        </button>
        {range.high !== range.low && (
          <button type="button" onClick={onUseHigh} className="text-sm font-medium text-[#123f38] underline underline-offset-4 hover:text-[#0f332d]">
            Use {formatCurrency(range.high)}
          </button>
        )}
      </div>
      {caveat && <p className="mt-2 text-sm leading-6 text-[#665746]">{caveat}</p>}
    </div>
  );
}

function IdentifyReviewPage({ draft, setDraft, onSubmit, onDiscard, saving, onAddPhotos, onRemovePhoto, onReIdentify, identifying }) {
  const { item, photos, summary, conditionNotes, valueRange, firstEditionRange, editionRationale, comparables, citations } = draft;
  const setItem = (changes) => setDraft({ ...draft, item: { ...item, ...changes } });
  const atPhotoLimit = photos.length >= 4;

  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <div>
        <div className="text-sm uppercase tracking-[0.18em] text-[#7d6c5a]">Review before saving</div>
        <h1 className="mt-1 text-5xl font-semibold tracking-tight">Is this right?</h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-[#665746]">
          Everything below was read from your photo and can be changed. Nothing is saved until you submit.
        </p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          <Card className="overflow-hidden rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-sm">
            <img src={photos[0]?.url} alt="The item you photographed" className="w-full object-cover" />
          </Card>

          <Card className="rounded-[2rem] border-[#123f38]/25 bg-[#edf4f2] shadow-sm">
            <CardContent className="p-6">
              <h2 className="font-semibold">Add more photos for a better read</h2>
              <p className="mt-2 text-sm leading-6 text-[#365c53]">
                A cover alone can't prove an edition. Add the <span className="font-medium">copyright page</span>, the <span className="font-medium">number line</span>, or the <span className="font-medium">ISBN barcode</span> and re-check — that's what moves an edition from a guess to something you can stand behind.
              </p>

              {photos.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-3">
                  {photos.map((photo, index) => (
                    <div key={photo.id} className="relative">
                      <img src={photo.url} alt="" className="h-20 w-20 rounded-xl border border-[#cdbb9d] object-cover" />
                      {index === 0 && (
                        <span className="absolute -top-2 left-1 rounded-full bg-[#123f38] px-2 py-0.5 text-[10px] font-medium text-[#fff7ea]">Cover</span>
                      )}
                      {photos.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onRemovePhoto(photo.id)}
                          disabled={identifying || saving}
                          aria-label="Remove this photo"
                          className="absolute -right-2 -top-2 rounded-full bg-[#f0e2cf] p-1 text-[#665746] hover:bg-[#ead8bf] disabled:opacity-40"
                        >
                          <Icon name="x" size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <label className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-[#cdbb9d] bg-white px-5 text-sm font-medium text-[#665746] ${identifying || saving || atPhotoLimit ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-[#fff8ee]"}`}>
                  <Icon name="camera" size={16} />
                  {atPhotoLimit ? "4 photo limit reached" : "Add photos"}
                  <input type="file" accept="image/*" capture="environment" multiple onChange={onAddPhotos} disabled={identifying || saving || atPhotoLimit} className="hidden" />
                </label>
                <Button
                  type="button"
                  onClick={onReIdentify}
                  disabled={identifying || saving}
                  className="h-11 flex-1 rounded-full bg-[#123f38] px-5 text-[#fff7ea] hover:bg-[#0f332d]"
                >
                  {identifying ? "Re-checking..." : `Re-check with ${photos.length} photo${photos.length === 1 ? "" : "s"}`}
                </Button>
              </div>

              <p className="mt-3 text-xs leading-5 text-[#5c7d74]">
                Re-checking replaces the identified fields above. Anything you typed yourself — what you paid, purchase date, source, notes — is kept.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-sm">
            <CardContent className="p-6">
              <h2 className="font-semibold">What this is</h2>
              <p className="mt-3 leading-7 text-[#665746]">{summary || "No summary was returned for this photo."}</p>
              {editionRationale && (
                <>
                  <h3 className="mt-5 font-semibold">Why this edition and printing</h3>
                  <p className="mt-2 leading-7 text-[#665746]">{editionRationale}</p>
                </>
              )}
              {conditionNotes && (
                <>
                  <h3 className="mt-5 font-semibold">What condition does to the value</h3>
                  <p className="mt-2 leading-7 text-[#665746]">{conditionNotes}</p>
                </>
              )}
              <p className="mt-5 rounded-2xl bg-[#fff3d8] p-4 text-sm leading-6 text-[#6d5526]">
                These figures come from live web research, not a formal appraisal. Review the comparables below before relying on them for insurance or a sale.
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-sm">
            <CardContent className="p-6">
              <h2 className="font-semibold">Comparable sales</h2>
              {comparables.length === 0 ? (
                <p className="mt-3 text-sm leading-6 text-[#8a7a64]">No comparables were found for this specific edition and printing.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {comparables.map((comp, index) => (
                    <div key={`${comp.url}-${index}`} className="rounded-xl border border-[#e0d2bc] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <a href={comp.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[#123f38] underline underline-offset-4 hover:text-[#0f332d]">
                          {comp.source || "Source"}
                        </a>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${saleTypeTone[comp.saleType] || saleTypeTone.unknown}`}>
                          {saleTypeLabel[comp.saleType] || "Unclear"}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-baseline gap-2 text-sm text-[#665746]">
                        <span className="font-semibold text-[#201a14]">{formatCurrency(comp.price)}</span>
                        {comp.date && <span>· {comp.date}</span>}
                      </div>
                      {comp.editionMatch && <p className="mt-1 text-xs leading-5 text-[#8a7a64]">{comp.editionMatch}</p>}
                    </div>
                  ))}
                </div>
              )}

              {citations.length > 0 && (
                <>
                  <h3 className="mt-5 text-xs uppercase tracking-[0.16em] text-[#7d6c5a]">Sources checked</h3>
                  <ul className="mt-2 space-y-1">
                    {citations.map((citation) => (
                      <li key={citation.url}>
                        <a href={citation.url} target="_blank" rel="noopener noreferrer" className="text-sm text-[#123f38] underline underline-offset-4 hover:text-[#0f332d]">
                          {citation.title || citation.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-xl">
          <CardContent className="p-6 md:p-8">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Item name" value={item.name} onChange={(value) => setItem({ name: value })} />
              {usesAuthorField(item.category) && (
                <Field label="Author" value={item.author} onChange={(value) => setItem({ author: value })} />
              )}
              <Field label="Make / Publisher / Brand" value={item.maker} onChange={(value) => setItem({ maker: value })} />
              <SelectField label="Category" value={item.category} options={quickCategories} onChange={(value) => setItem({ category: value })} />
              <SelectField label="Condition" value={item.condition} options={conditionOptions} placeholder="Not set" onChange={(value) => setItem({ condition: value })} />
              {item.category === "Book" && (
                <>
                  <Field label="Genre" value={item.bookGenre} onChange={(value) => setItem({ bookGenre: value })} />
                  <SelectField label="Edition" value={item.bookEdition} options={bookEditionOptions} placeholder="Select edition" onChange={(value) => setItem({ bookEdition: value })} />
                  <SelectField label="Printing" value={item.bookPrinting} options={bookPrintingOptions} placeholder="Select printing" onChange={(value) => setItem({ bookPrinting: value })} />
                </>
              )}
              <SelectField label="Status" value={item.status} options={statuses} onChange={(value) => setItem({ status: value })} />
              <Field label="Purchase date" type="date" value={item.purchaseDate} onChange={(value) => setItem({ purchaseDate: value })} />
              <Field label="Where purchased" value={item.source} onChange={(value) => setItem({ source: value })} />
              <Field label="What you paid" type="number" value={item.purchasePrice} onChange={(value) => setItem({ purchasePrice: value })} />
              <Field label="Estimated value" type="number" value={item.estimatedValue} onChange={(value) => setItem({ estimatedValue: value })} />
            </div>

            <div className="mt-4">
              <Field label="Notes" value={item.notes} onChange={(value) => setItem({ notes: value })} />
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <ValueRangeBlock
                label="Estimated value, as pictured"
                range={valueRange}
                onUseLow={() => setItem({ estimatedValue: String(valueRange.low) })}
                onUseHigh={() => setItem({ estimatedValue: String(valueRange.high) })}
              />
              <ValueRangeBlock
                label="If it were a first edition, first printing"
                range={firstEditionRange}
                onUseLow={() => setItem({ estimatedValue: String(firstEditionRange.low) })}
                onUseHigh={() => setItem({ estimatedValue: String(firstEditionRange.high) })}
                caveat="Only apply this if you've confirmed the edition and printing yourself — a cover photo alone can't prove either."
              />
            </div>
            <p className="mt-3 text-xs leading-5 text-[#8a7a64]">
              Neither figure fills in the Estimated value field automatically — pick a number from the range, or from the comparables below, and enter it yourself.
            </p>

            <div className="mt-6 rounded-2xl bg-[#edf4f2] p-4 text-sm leading-6 text-[#123f38]">
              We left "what you paid" blank on purpose — only you know that, and it's what turns an estimate into a real number.
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={onDiscard} disabled={saving} className="h-11 rounded-full border-[#cdbb9d] bg-[#fff8ee] px-6 hover:bg-white">
                Discard
              </Button>
              <Button type="button" onClick={onSubmit} disabled={saving} className="h-11 rounded-full bg-[#123f38] px-6 text-[#fff7ea] hover:bg-[#0f332d]">
                <Icon name="save" size={17} className="mr-2" /> {saving ? "Saving..." : "Add to my collection"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function FooterLink({ children, onClick, href }) {
  const className = "text-sm text-[#fff7ea]/70 transition hover:text-[#fff7ea]";
  if (href) {
    // Links to our own pages navigate in place. Only outbound ones open a tab,
    // and only those need the noopener guard.
    const internal = href.startsWith("/");
    const newTab = !internal && !href.startsWith("mailto:");
    return <a href={href} className={className} target={newTab ? "_blank" : undefined} rel={newTab ? "noopener noreferrer" : undefined}>{children}</a>;
  }
  return <button type="button" onClick={onClick} className={`${className} text-left`}>{children}</button>;
}

function SiteFooter({ isLoggedIn, onNavigate }) {
  // Footer links to logged-in areas send signed-out visitors to log in rather
  // than to a page that would render nothing.
  const go = (view) => () => onNavigate(isLoggedIn ? view : "login");

  return (
    <footer className="mt-20 bg-[#123f38] text-[#fff7ea] print:hidden">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <img src="/firstfinder-mark-exact.png" alt="" className="h-9 w-9 rounded-lg object-cover" />
            <div className="font-display text-xl font-semibold tracking-tight">FirstFinder</div>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-6 text-[#fff7ea]/70">
            Item photos, receipt proof, purchase details, and value — one ledger for the collection you swore you'd keep track of this time.
          </p>
          <p className="mt-6 text-xs text-[#fff7ea]/50" suppressHydrationWarning>
            © {new Date().getFullYear()} FirstFinder. Free and open source under the{" "}
            <a
              href={LICENSE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-[#fff7ea]/30 underline-offset-2 hover:text-[#fff7ea]"
            >
              AGPL-3.0
            </a>
            .
          </p>
        </div>

        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-[#fff7ea]/50">Features</div>
          <div className="mt-4 flex flex-col gap-3">
            <FooterLink onClick={go("tutorial")}>How to / Tutorial</FooterLink>
            <FooterLink onClick={go("inventory")}>My Collection</FooterLink>
            <FooterLink onClick={go("wishlist")}>Wishlist</FooterLink>
            <FooterLink onClick={go("account")}>My Account</FooterLink>
            <FooterLink href="/books">Identification guides</FooterLink>
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-[#fff7ea]/50">Support</div>
          <div className="mt-4 flex flex-col gap-3">
            <FooterLink onClick={() => onNavigate("roadmap")}>Roadmap</FooterLink>
            {isLoggedIn
              ? <FooterLink onClick={() => onNavigate("feedback")}>Contact Support</FooterLink>
              : <FooterLink href="mailto:thebookbarterer@gmail.com">Contact Support</FooterLink>}
            <FooterLink href="mailto:thebookbarterer@gmail.com?subject=Business%20inquiry">Business Inquiries</FooterLink>
            <FooterLink onClick={() => onNavigate("terms")}>Terms of Service</FooterLink>
            <FooterLink onClick={() => onNavigate("privacy")}>Privacy Policy</FooterLink>
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-[#fff7ea]/50">Open source</div>
          <div className="mt-4 flex flex-col gap-3">
            {/* Public pages, so these don't route signed-out visitors to log in. */}
            <FooterLink onClick={() => onNavigate("contribute")}>Contribute</FooterLink>
            <FooterLink href={REPO_URL}>Source on GitHub</FooterLink>
            <FooterLink href={labelSearchUrl(GOOD_FIRST_ISSUE_LABEL)}>Good first issues</FooterLink>
            <FooterLink href={DONATE_URL}>Buy me a coffee</FooterLink>
          </div>
        </div>
      </div>
    </footer>
  );
}

// A single click-to-edit table cell for the Records view. Renders as plain
// text until clicked, so the table still reads as a table rather than a grid
// of form controls.
function InlineCell({ value, display, options, type = "text", label, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  // Keep the draft in step when the row changes underneath us (another edit,
  // a bulk import, a refetch).
  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  function commit(next) {
    setEditing(false);
    if (String(next ?? "") === String(value ?? "")) return;
    onSave(String(next ?? ""));
  }

  function cancel() {
    setDraft(value ?? "");
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={`Edit ${label}`}
        className="-mx-2 w-full rounded-lg px-2 py-1 text-left transition hover:bg-[#f0e2cf] focus:outline-none focus:ring-2 focus:ring-[#123f38]/20"
      >
        {display ?? (value || <span className="text-[#a2947f]">—</span>)}
      </button>
    );
  }

  if (options) {
    return (
      <select
        autoFocus
        value={draft}
        aria-label={label}
        onChange={(event) => commit(event.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(event) => { if (event.key === "Escape") cancel(); }}
        className="w-full rounded-lg border border-[#d8c7ad] bg-white px-2 py-1 outline-none focus:border-[#123f38]"
      >
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    );
  }

  return (
    <input
      autoFocus
      type={type}
      value={draft}
      aria-label={label}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => commit(draft)}
      onKeyDown={(event) => {
        if (event.key === "Enter") { event.preventDefault(); commit(draft); }
        if (event.key === "Escape") cancel();
      }}
      className="w-full rounded-lg border border-[#d8c7ad] bg-white px-2 py-1 outline-none focus:border-[#123f38]"
    />
  );
}

function ImportCount({ label, value, tone }) {
  return (
    <div className={`rounded-2xl px-4 py-3 ${tone}`}>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs uppercase tracking-[0.14em]">{label}</div>
    </div>
  );
}

// Stands between an uploaded CSV and any write. Bulk delete is the most
// destructive thing the app can do, so the counts, the exact items being
// removed, and the skipped rows are all shown before anything happens.
function BulkImportPreviewDialog({ fileName, batch, applying, onCancel, onConfirm }) {
  const { creates, updates, deletes, rejected } = batch;
  const [confirmText, setConfirmText] = useState("");
  // A handful of deletions is easy to sanity-check from the list above. Past
  // that, make the user type it out rather than click through.
  const needsTypedConfirm = deletes.length > 5;
  const canApply = !needsTypedConfirm || confirmText.trim().toUpperCase() === "DELETE";

  return (
    <ModalShell onClose={applying ? () => {} : onCancel} contentClassName="max-h-[88vh] max-w-2xl">
      <div className="text-sm uppercase tracking-[0.18em] text-[#7d6c5a]">Review import</div>
      <h2 className="mt-1 text-2xl font-semibold">{fileName}</h2>
      <p className="mt-3 leading-7 text-[#665746]">Nothing has been changed yet. Here's what this file will do.</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <ImportCount label="To add" value={creates.length} tone="bg-[#edf4f2] text-[#123f38]" />
        <ImportCount label="To update" value={updates.length} tone="bg-[#f0e2cf] text-[#665746]" />
        <ImportCount label="To delete" value={deletes.length} tone={deletes.length > 0 ? "bg-[#fbf1ec] text-[#8a3b22]" : "bg-[#f7efe3] text-[#8a7a64]"} />
      </div>

      {deletes.length > 0 && (
        <div className="mt-5 rounded-2xl bg-[#fbf1ec] p-4">
          <div className="text-sm font-semibold text-[#8a3b22]">
            {deletes.length === 1 ? "This item will be permanently deleted" : `These ${deletes.length} items will be permanently deleted`}, along with their saved photos:
          </div>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm text-[#665746]">
            {deletes.map((item) => (
              <li key={item.id}>{formatReference(item.referenceNumber)} — {item.name || "Untitled item"}</li>
            ))}
          </ul>
        </div>
      )}

      {rejected.length > 0 && (
        <div className="mt-5 rounded-2xl bg-[#fff3d8] p-4">
          <div className="text-sm font-semibold text-[#6d5526]">
            {rejected.length === 1 ? "1 row will be skipped:" : `${rejected.length} rows will be skipped:`}
          </div>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm text-[#6d5526]">
            {rejected.map((row) => (
              <li key={`${row.line}-${row.reference}`}>Line {row.line}{row.reference ? ` (${row.reference})` : ""} — {row.reason}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-5 text-sm leading-6 text-[#8a7a64]">Anything in your collection that isn't listed in this file is left untouched.</p>

      {needsTypedConfirm && (
        <div className="mt-5">
          <Field label={`Type DELETE to confirm removing ${deletes.length} items`} value={confirmText} onChange={setConfirmText} />
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={applying} className="h-11 rounded-full border-[#cdbb9d] bg-[#fff8ee] px-6 hover:bg-white">
          Cancel
        </Button>
        <Button
          type="button"
          onClick={onConfirm}
          disabled={applying || !canApply}
          className={`h-11 rounded-full px-6 text-[#fff7ea] ${deletes.length > 0 ? "bg-[#8a3b22] hover:bg-[#7a331d]" : "bg-[#123f38] hover:bg-[#0f332d]"}`}
        >
          {applying ? "Applying..." : "Apply changes"}
        </Button>
      </div>
    </ModalShell>
  );
}

const duplicateMatchCopy = {
  possible_duplicate: { label: "Possible duplicate", tone: "bg-[#fbf1ec] text-[#8a3b22]" },
  different_copy: { label: "Different collectible copy", tone: "bg-[#f0e2cf] text-[#665746]" },
  potential_upgrade: { label: "Potential upgrade", tone: "bg-[#edf4f2] text-[#123f38]" }
};

// Non-blocking by design (see findPossibleDuplicates) -- this informs, it
// never stops the save. "Add anyway" is always available.
function DuplicateWarningDialog({ matches, saving, onCancel, onConfirm }) {
  return (
    <ModalShell onClose={saving ? () => {} : onCancel} contentClassName="max-w-lg">
      <div className="text-sm uppercase tracking-[0.18em] text-[#7d6c5a]">Before you add this</div>
      <h2 className="mt-1 text-2xl font-semibold">Already something like this in your collection</h2>
      <p className="mt-3 leading-7 text-[#665746]">
        This won't stop you from saving it -- collectors deliberately keep multiple copies and upgrades. Just flagging what looks related.
      </p>
      <div className="mt-5 max-h-64 space-y-3 overflow-y-auto">
        {matches.map(({ entry, matchType }) => {
          const copy = duplicateMatchCopy[matchType];
          const details = [
            itemCredit(entry),
            entry.category === "Book" ? [entry.bookEdition, entry.bookPrinting].filter(Boolean).join(" / ") : entry.edition,
            entry.condition
          ].filter(Boolean).join(" • ");

          return (
            <div key={entry.id} className="rounded-2xl border border-[#e7dcc7] bg-[#fffaf1] p-4">
              <div className={`inline-flex rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.08em] ${copy.tone}`}>{copy.label}</div>
              <div className="mt-2 font-medium">
                {entry.name || "Untitled item"}{entry.referenceNumber ? ` (${formatReference(entry.referenceNumber)})` : ""}
              </div>
              <div className="mt-1 text-sm text-[#7d6c5a]">{details || "No extra details on file"}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving} className="h-11 rounded-full border-[#cdbb9d] bg-[#fff8ee] px-6 hover:bg-white">
          Go back and edit
        </Button>
        <Button type="button" onClick={onConfirm} disabled={saving} className="h-11 rounded-full bg-[#123f38] px-6 text-[#fff7ea] hover:bg-[#0f332d]">
          {saving ? "Saving..." : "Add anyway"}
        </Button>
      </div>
    </ModalShell>
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
    <Card className="rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-sm"><CardContent className="p-6"><div className="inline-flex items-center gap-2 rounded-full bg-[#edf4f2] px-3 py-1 text-sm font-medium text-[#123f38]"><Icon name="file" size={15} /> Bulk upload</div><h2 className="mt-4 text-2xl font-semibold">Import your collection by CSV.</h2><p className="mt-3 leading-7 text-[#665746]">Download the template, fill it out, then upload it here. Leave the <span className="font-medium">ref</span> column empty for new items — FirstFinder assigns those. Photos can be added later item-by-item.</p><p className="mt-3 leading-7 text-[#665746]">You can also edit in bulk: export your collection from the My Collection page, change what you need in a spreadsheet, and upload it back. Rows keep their <span className="font-medium">ref</span> so they update instead of duplicating, and putting <span className="font-medium">yes</span> in the <span className="font-medium">delete</span> column removes them. You'll see exactly what will change before anything is saved.</p><div className="mt-5 grid gap-3"><Button type="button" onClick={() => { trackEvent("csv_template_downloaded", { source_page: "add_inventory" }); onDownloadTemplate(); }} variant="outline" className="h-11 rounded-full border-[#cdbb9d] bg-[#fff8ee] px-5 hover:bg-white"><Icon name="file" size={17} className="mr-2" /> Download CSV template</Button><label className={`flex h-11 items-center justify-center rounded-full bg-[#123f38] px-5 font-medium text-[#fff7ea] ${bulkUploading ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-[#0f332d]"}`}><Icon name="upload" size={17} className="mr-2" /> {bulkUploading ? "Importing..." : "Upload CSV"}<input type="file" accept=".csv,text/csv" onChange={onBulkUpload} disabled={bulkUploading} className="hidden" /></label></div>{bulkMessage && <div className="mt-5 rounded-2xl bg-[#edf4f2] p-4 text-sm leading-6 text-[#123f38]">{bulkMessage}</div>}<div className="mt-5 rounded-2xl bg-[#f7efe3] p-4 text-xs leading-6 text-[#665746]"><div className="font-semibold">Template columns</div><div className="mt-1 break-words">{csvHeaders.join(", ")}</div></div></CardContent></Card>
  );
}

function ShareToggle({ group, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#e0d2bc] bg-[#fffdf8] p-3 transition hover:bg-white">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-[#123f38]"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{group.label}</span>
        <span className="block text-xs leading-5 text-[#7d6c5a]">{group.detail}</span>
        {/* Notes are the one group that can publish something the owner
            forgot they wrote. Warn at the moment of the decision, where it
            can still change it -- not in a help page nobody opens. */}
        {group.warning && checked && (
          <span className="mt-1 block rounded-xl bg-[#fff3d8] px-3 py-2 text-xs leading-5 text-[#6d5526]">{group.warning}</span>
        )}
      </span>
    </label>
  );
}

// A single card rendered exactly as a visitor would see it.
//
// The markup here is a compact copy of the card in app/c/[slug]/page.js -- that
// one is a server component and can't be imported into this "use client" file.
// What matters is that the *data* is not a copy: both call buildPublicItem
// with the same settings, so this preview cannot show something the public
// page would withhold, or withhold something it would show.
function SharePreviewCard({ item, photoUrl, photoPath }) {
  const editionLine =
    item.category === "Book"
      ? [item.bookEdition && `${item.bookEdition} edition`, item.bookPrinting && `${item.bookPrinting} printing`].filter(Boolean).join(" · ")
      : item.edition;

  const details = [
    item.estimatedValue && ["Est. value", formatCurrency(item.estimatedValue)],
    item.purchasePrice && ["Paid", formatCurrency(item.purchasePrice)],
    item.soldPrice && ["Sold for", formatCurrency(item.soldPrice)],
    item.purchaseDate && ["Acquired", item.purchaseDate],
    item.source && ["Source", item.source]
  ].filter(Boolean);

  return (
    <div className="overflow-hidden rounded-2xl border border-[#d8c7ad] bg-[#fff9f0]">
      {photoUrl || photoPath ? (
        <SignedPhoto path={photoPath} src={photoUrl} frameClassName="h-32 w-full" className="h-32 w-full object-cover" quiet />
      ) : (
        <div className="flex h-32 w-full items-center justify-center bg-[#f0e2cf] text-xs text-[#8a7a64]">No photo</div>
      )}
      <div className="p-4">
        <div className="font-semibold leading-tight">{item.name || "Untitled item"}</div>
        {itemCredit(item) && <div className="mt-0.5 text-sm text-[#665746]">{itemCredit(item)}</div>}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {editionLine && <span className="rounded-full bg-[#edf4f2] px-2.5 py-1 text-[11px] font-medium text-[#123f38]">{editionLine}</span>}
          {item.condition && <span className="rounded-full bg-[#f0e2cf] px-2.5 py-1 text-[11px] font-medium text-[#665746]">{item.condition}</span>}
          {item.hasReceipt && <span className="rounded-full bg-[#f0e2cf] px-2.5 py-1 text-[11px] font-medium text-[#665746]">Receipt on file</span>}
        </div>
        {details.length > 0 && (
          <div className="mt-3 flex flex-col gap-1.5">
            {details.map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-3 border-t border-[#eadfcd] pt-1.5">
                <span className="text-[10px] uppercase tracking-[0.14em] text-[#8a7a64]">{label}</span>
                <span className="text-right text-xs font-medium text-[#3f352a]">{value}</span>
              </div>
            ))}
          </div>
        )}
        {item.notes && (
          <div className="mt-2 border-t border-[#eadfcd] pt-1.5">
            <div className="text-[10px] uppercase tracking-[0.14em] text-[#8a7a64]">Notes</div>
            <p className="mt-1 line-clamp-3 text-xs leading-5 text-[#3f352a]">{item.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

const visibilityChoices = [
  {
    value: "off",
    label: "Off",
    detail: "There is no page. The link returns Not Found for everyone, including anyone you sent it to earlier."
  },
  {
    value: "unlisted",
    label: "Anyone with the link",
    detail: "Signed in or not, anyone holding the link can open it. The link can't be guessed — but it isn't secret, and whoever it's forwarded to can read it."
  },
  {
    value: "listed",
    label: "Listed on search engines",
    detail: "Everything above, plus Google is invited to index it. Worth knowing: turning this back off takes days to clear from search results."
  }
];

function ShareCollectionDialog({ settings, inventory, saving, onSave, onResetLink, onClose, pushToast }) {
  const [draft, setDraft] = useState(settings);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState("");
  // Read during render rather than in an effect. Safe here specifically
  // because this dialog only ever mounts after a click, so it is never part
  // of the server-rendered markup and there is no hydration pass to mismatch.
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  // "Saved" is what the public page serves, "draft" is what the switches say.
  // Keeping them apart is the whole reason this dialog has a Save button:
  // publishing a purchase price should be something you press, not something
  // that happens as your cursor passes over a checkbox.
  const dirty = shareSettingsChanged(settings, draft);

  const sharedItems = useMemo(() => inventory.filter((entry) => isItemShared(entry, draft)), [inventory, draft]);
  const previewSource = sharedItems[0] || null;
  const previewItem = useMemo(() => (previewSource ? buildPublicItem(previewSource, draft) : null), [previewSource, draft]);
  const hiddenCount = inventory.filter((entry) => entry.hiddenFromShare).length;
  const presetId = matchingPresetId(draft);
  // Guarded rather than reading window.location directly: this dialog only
  // mounts on a click today, so a server pass never reaches it, but a bare
  // window reference during render is one refactor away from a 500.
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const shareUrl = settings.slug ? `${origin}${sharePath(settings.slug)}` : "";
  const isLive = settings.visibility !== "off";

  useEffect(() => {
    let cancelled = false;
    const path = previewSource?.itemPhotos?.[0]?.path;

    // Resolved rather than set straight away in the no-photo case, so this
    // effect never sets state synchronously, which would risk a cascading render.
    const pending = path ? fetchSignedPhotoUrls([{ path }]).then(([photo]) => photo?.url || "") : Promise.resolve("");
    pending.then((url) => {
      if (!cancelled) setPreviewPhotoUrl(url);
    });

    return () => {
      cancelled = true;
    };
  }, [previewSource]);

  function set(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      trackEvent("share_link_copied", { visibility: settings.visibility });
      pushToast("Link copied.", "success");
    } catch {
      pushToast("Couldn't copy automatically — select the link and copy it.", "warning");
    }
  }

  // On a phone, "share this link" means the OS share sheet -- Messages, Mail,
  // AirDrop -- not the clipboard. Cancelling the sheet throws AbortError, and
  // that is a completed interaction, not a failure to fall back from.
  async function shareLink() {
    try {
      await navigator.share({ title: draft.title.trim() || "My collection on FirstFinder", url: shareUrl });
      trackEvent("share_link_shared", { visibility: settings.visibility });
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.error("Native share error:", error.message);
        copyLink();
      }
    }
  }

  return (
    <ModalShell onClose={saving ? () => {} : onClose} contentClassName="max-h-[88vh] max-w-4xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="text-sm uppercase tracking-[0.18em] text-[#7d6c5a]">Share</div>
          <h2 className="mt-1 text-3xl font-semibold">Your public collection page</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#665746]">
            A read-only page you can send to anyone. You choose what it shows — it starts with titles, editions,
            condition and photos, and nothing about money.
          </p>
        </div>
        <button onClick={onClose} disabled={saving} className="rounded-full bg-[#f0e2cf] p-2 text-[#665746] hover:bg-[#ead8bf] disabled:cursor-not-allowed disabled:opacity-40" aria-label="Close share settings">
          <Icon name="x" size={18} />
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_16rem]">
        <div>
          {/* Green means live, and only live.

              This panel used to be green in both states, changing nothing but
              the words -- so "currently off" was rendered in the exact styling
              that everywhere else in the app means "on", and the colour
              quietly contradicted the sentence. Colour is what gets read
              first, so it has to carry the same answer the text does.

              isLive is the saved setting, not the draft: this panel is about
              whether the URL above it works right now, and a radio button
              switched to Off but not yet saved has not taken the page down.
              The Save button is what changes reality -- the preview link below
              follows the draft precisely because it is about what you would be
              looking at, which is a different question. */}
          {shareUrl && (
            <div
              className={`mb-5 rounded-2xl border p-4 ${
                isLive ? "border-[#123f38]/25 bg-[#edf4f2]" : "border-[#d8c7ad] bg-[#f3ece1]"
              }`}
            >
              <div
                className={`flex items-center gap-2 text-xs uppercase tracking-[0.16em] ${
                  isLive ? "text-[#123f38]" : "text-[#7d6c5a]"
                }`}
              >
                {/* The same dot the Share button uses, so the two places that
                    report this state report it the same way. */}
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 shrink-0 rounded-full ${isLive ? "bg-[#123f38]" : "bg-[#a2957f]"}`}
                />
                {isLive ? "Your link — live now" : "Your link — currently off"}
              </div>
              <div className="mt-2 break-all font-mono text-sm text-[#3f352a]">{shareUrl}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {/* Copy is the primary action and sits first: it is the one
                    thing every visit to this dialog is ultimately for.

                    Not while the page is off, though. The link is a 404 until
                    it is switched on, so shouting it in the app's primary
                    green inside an otherwise grey panel would undo the signal
                    the panel is there to give. Still offered, and still works
                    -- copying the address before publishing is a fair thing to
                    want -- just not dressed as the live action. */}
                <Button
                  type="button"
                  variant={isLive ? "primary" : "outline"}
                  onClick={copyLink}
                  className={`h-10 rounded-full px-5 text-sm ${
                    isLive
                      ? "bg-[#123f38] text-[#fff7ea] hover:bg-[#0f332d]"
                      : "border-[#cdbb9d] bg-[#fff8ee] hover:bg-white"
                  }`}
                >
                  <Icon name="file" size={15} className="mr-2" /> Copy link
                </Button>
                {canNativeShare && (
                  <Button type="button" variant="outline" onClick={shareLink} className="h-10 rounded-full border-[#cdbb9d] bg-[#fff8ee] px-5 text-sm hover:bg-white">
                    <Icon name="link" size={15} className="mr-2" /> Share…
                  </Button>
                )}
                {/* Deliberately not enabled while there are unsaved switches:
                    the preview opens the real page, so it would show the last
                    saved settings and quietly contradict the checkboxes. */}
                <a
                  href={dirty ? undefined : shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-disabled={dirty || draft.visibility === "off"}
                  className={`inline-flex h-10 items-center rounded-full border border-[#cdbb9d] px-5 text-sm font-medium ${
                    dirty || draft.visibility === "off" ? "cursor-not-allowed bg-[#f3ece1] text-[#a2957f]" : "bg-[#fff8ee] text-[#665746] hover:bg-white"
                  }`}
                  onClick={(event) => {
                    if (dirty || draft.visibility === "off") event.preventDefault();
                  }}
                >
                  Open preview
                </a>
                <Button type="button" variant="outline" onClick={onResetLink} disabled={saving} className="h-10 rounded-full border-[#cdbb9d] bg-[#fff8ee] px-5 text-sm hover:bg-white">
                  Reset link
                </Button>
              </div>
              <p className="mt-3 text-xs leading-5 text-[#7d6c5a]">
                Resetting gives you a new address and breaks every link you&apos;ve already sent — the way to take back a
                page you shared with the wrong person.
              </p>
            </div>
          )}

          <fieldset>
            <legend className="text-xs uppercase tracking-[0.16em] text-[#7d6c5a]">Who can see it</legend>
            <div className="mt-3 flex flex-col gap-2">
              {visibilityChoices.map((choice) => (
                <label
                  key={choice.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition ${
                    draft.visibility === choice.value ? "border-[#123f38] bg-[#edf4f2]" : "border-[#e0d2bc] bg-[#fffdf8] hover:bg-white"
                  }`}
                >
                  <input
                    type="radio"
                    name="share-visibility"
                    value={choice.value}
                    checked={draft.visibility === choice.value}
                    onChange={() => set("visibility", choice.value)}
                    className="mt-1 h-4 w-4 shrink-0 accent-[#123f38]"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{choice.label}</span>
                    <span className="block text-xs leading-5 text-[#7d6c5a]">{choice.detail}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Page title" value={draft.title} onChange={(value) => set("title", value)} />
            <Field label="One line about it" value={draft.blurb} onChange={(value) => set("blurb", value)} />
          </div>

          <div className="mt-5">
            <div className="text-xs uppercase tracking-[0.16em] text-[#7d6c5a]">Start from</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {sharePresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  title={preset.detail}
                  onClick={() => setDraft((current) => applyPreset(current, preset.id))}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                    presetId === preset.id ? "bg-[#123f38] text-[#fff7ea]" : "border border-[#cdbb9d] bg-[#fff8ee] text-[#665746] hover:bg-white"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
              {/* Not a button: "Custom" is a description of where the switches
                  currently sit, not a fourth thing to choose. */}
              {presetId === null && (
                <span className="rounded-full border border-dashed border-[#cdbb9d] px-4 py-2 text-sm font-medium text-[#7d6c5a]">Custom</span>
              )}
            </div>
            <p className="mt-2 text-xs leading-5 text-[#7d6c5a]">
              {sharePresets.find((preset) => preset.id === presetId)?.detail || "Your own combination of the switches below."}
            </p>
          </div>

          <div className="mt-5">
            <div className="text-xs uppercase tracking-[0.16em] text-[#7d6c5a]">Also show</div>
            <div className="mt-2 grid gap-2">
              {shareFieldGroups.map((group) => (
                <ShareToggle key={group.key} group={group} checked={Boolean(draft[group.key])} onChange={(value) => set(group.key, value)} />
              ))}
            </div>
          </div>
        </div>

        <aside className="md:sticky md:top-0 md:self-start">
          <div className="text-xs uppercase tracking-[0.16em] text-[#7d6c5a]">What visitors see</div>
          <p className="mt-2 text-xs leading-5 text-[#7d6c5a]">
            {sharedItems.length} of {inventory.length} {inventory.length === 1 ? "item" : "items"}
            {hiddenCount > 0 && `, ${hiddenCount} hidden individually`}.
          </p>

          <div className="mt-3">
            {previewItem ? (
              <SharePreviewCard item={previewItem} photoUrl={previewPhotoUrl} photoPath={previewSource?.itemPhotos?.[0]?.path} />
            ) : (
              <div className="rounded-2xl border border-dashed border-[#cdbb9d] bg-[#fffdf8] p-4 text-xs leading-5 text-[#7d6c5a]">
                Nothing would appear on your page with these settings.
              </div>
            )}
          </div>

          <p className="mt-3 rounded-2xl bg-[#f7efe3] p-3 text-xs leading-5 text-[#665746]">
            Receipt photos are never published, whatever you switch on — they carry addresses and card details. Items
            with one get a “Receipt on file” badge instead.
          </p>
          <p className="mt-2 text-xs leading-5 text-[#7d6c5a]">
            To keep one item off the page, open it from your collection and tick “Hide from my public page”.
          </p>
        </aside>
      </div>

      <div className="mt-6 flex flex-col gap-3 border-t border-[#e0d2bc] pt-5 sm:flex-row sm:items-center sm:justify-end">
        {dirty && <span className="text-sm text-[#7d6c5a] sm:mr-auto">Unsaved changes</span>}
        <Button type="button" variant="outline" onClick={onClose} disabled={saving} className="h-11 rounded-full border-[#cdbb9d] bg-[#fff8ee] px-6 hover:bg-white">
          Cancel
        </Button>
        <Button type="button" onClick={() => onSave(draft)} disabled={saving || !dirty} className="h-11 rounded-full bg-[#123f38] px-6 text-[#fff7ea] hover:bg-[#0f332d]">
          {saving ? "Saving..." : draft.visibility === "off" ? "Save" : "Save and publish"}
        </Button>
      </div>
    </ModalShell>
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
          {usesAuthorField(draft.category) && (
            <Field label="Author" value={draft.author} onChange={(value) => setDraft({ ...draft, author: value })} />
          )}
          <Field label="Make / Publisher / Brand" value={draft.maker} onChange={(value) => setDraft({ ...draft, maker: value })} />
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
          <Field label="What you paid" type="number" value={draft.purchasePrice} onChange={(value) => setDraft({ ...draft, purchasePrice: value })} />
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

        {/* The per-item escape hatch from the public collection page. All or
            nothing for the item: field-level rules are set once for the whole
            collection in the share dialog, and only membership is decided per
            item. Shown whether or not sharing is currently on, so it can be
            set ahead of publishing rather than only after. */}
        <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-[#e0d2bc] bg-[#fffdf8] p-4">
          <input
            type="checkbox"
            checked={Boolean(draft.hiddenFromShare)}
            onChange={(event) => setDraft({ ...draft, hiddenFromShare: event.target.checked })}
            className="mt-1 h-4 w-4 shrink-0 accent-[#123f38]"
          />
          <span>
            <span className="block text-sm font-medium">Hide from my public page</span>
            <span className="block text-xs leading-5 text-[#7d6c5a]">
              Keeps this item off your shared collection page, whatever that page is set to show.
            </span>
          </span>
        </label>

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
              <SignedPhoto
                path={photo.path}
                src={photo.url}
                alt={photo.name}
                frameClassName="h-20 w-full"
                className="h-20 w-full object-cover"
                quiet
              />
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
          // The photo records are still real, so they are still listed: each
          // one re-signs itself and says so if it cannot. Emptying the list
          // here is what produced "No saved photos for this item yet" in front
          // of someone whose photos were sitting in storage untouched.
          setAllPhotos(photos.filter((photo) => photo.path || photo.url));
          return;
        }

        const urlByPath = new Map((data || []).map((row) => [row.path, row.signedUrl]));
        // Kept whether or not a URL came back, for the same reason: a photo
        // that failed to sign is a photo that failed to load, not one that
        // does not exist.
        setAllPhotos(
          photos
            .map((photo) => ({ ...photo, url: photo.path ? urlByPath.get(photo.path) : photo.url }))
            .filter((photo) => photo.url || photo.path)
        );
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
              <SignedPhoto
                path={photo.path}
                src={photo.url}
                alt={photo.name}
                frameClassName="h-72 w-full bg-[#f3ece0]"
                className="h-full w-full object-contain"
              />
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
// Measures the tabs at their natural width against the space the nav actually
// has and reports how many fit. Everything past that goes into the menu, so the
// pill never scrolls and never spills over the buttons beside it.
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : React.useLayoutEffect;

function useNavOverflow(containerRef, measureRef, items, onCountChange) {
  const [visibleCount, setVisibleCount] = useState(items.length);
  const lastCountRef = useRef(items.length);
  const signature = items.map((navItem) => navItem.label).join("|");

  useIsomorphicLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return undefined;

    function recompute() {
      const widths = Array.from(measure.children).map((child) => child.getBoundingClientRect().width);
      // The pill's own border and p-1 padding, which the tabs have to share the
      // slot with.
      const available = container.clientWidth - 10;
      const gap = 4;
      let used = 0;
      let count = 0;
      for (let index = 0; index < widths.length; index += 1) {
        const next = used + widths[index] + (index === 0 ? 0 : gap);
        if (next > available) break;
        used = next;
        count += 1;
      }
      setVisibleCount(count);
      if (count !== lastCountRef.current) {
        lastCountRef.current = count;
        onCountChange();
      }
    }

    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(container);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [signature, onCountChange]);

  return Math.min(visibleCount, items.length);
}

function NavTabs({ items, activeView, onSelect, containerRef, measureRef, visibleCount }) {
  return (
    <div ref={containerRef} className="relative flex min-w-0 flex-1 justify-center">
      {/* A copy of every tab at its natural width, sealed inside a zero-sized
          box so it can be measured without adding a pixel of scrollable area. */}
      <div aria-hidden="true" className="pointer-events-none invisible absolute left-0 top-0 h-0 w-0 overflow-hidden">
        <div ref={measureRef} className="flex flex-nowrap items-center gap-1">
          {items.map((navItem) => (
            <TabButton key={navItem.view} active={false} onClick={() => {}}>{navItem.label}</TabButton>
          ))}
        </div>
      </div>
      {visibleCount > 0 && (
        <div className="flex max-w-full flex-nowrap items-center gap-1 overflow-hidden rounded-full border border-[#d8c7ad] bg-[#fff8ee] p-1">
          {items.slice(0, visibleCount).map((navItem) => (
            <TabButton key={navItem.view} active={activeView === navItem.view} onClick={() => onSelect(navItem.view)}>{navItem.label}</TabButton>
          ))}
        </div>
      )}
    </div>
  );
}

function TabButton({ active, children, onClick }) { return <button onClick={onClick} className={`shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium transition ${active ? "bg-[#123f38] text-[#fff7ea]" : "text-[#665746] hover:bg-white"}`}>{children}</button>; }
// ---------------------------------------------------------------------------
// Wishlist
// ---------------------------------------------------------------------------

function PriorityChip({ priority }) {
  const tones = {
    grail: "bg-[#f7e0dc] text-[#8f3524]",
    hunting: "bg-[#edf4f2] text-[#123f38]",
    someday: "bg-[#f0e2cf] text-[#665746]"
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] ${tones[priority] || tones.hunting}`}>
      {priorityLabel(priority)}
    </span>
  );
}

function CriteriaChips({ want }) {
  const chips = describeCriteria(want);
  if (chips.length === 0) {
    // A want with no criteria is legitimate -- "a first of Suttree, eventually"
    // -- so this says so plainly rather than rendering an empty row that looks
    // like something failed to load.
    return <p className="mt-3 text-sm text-[#8a7a64]">Any copy. No conditions set.</p>;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {chips.map((chip) => (
        <span
          key={chip.text}
          className={`rounded-full px-3 py-1.5 text-[13px] font-medium ${
            chip.tone === "green" ? "bg-[#edf4f2] text-[#123f38]" : "bg-[#f0e2cf] text-[#665746]"
          }`}
        >
          {chip.text}
        </span>
      ))}
    </div>
  );
}

function WantCard({ want, upgradeFor, onEdit, onFound }) {
  const links = buildWantSearchLinks(want);

  return (
    <Card className="rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-sm">
      <CardContent className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <PriorityChip priority={want.priority} />
              {want.createdAt && (
                <span className="text-xs text-[#8a7a64]">Watching since {formatAccountDate(want.createdAt)}</span>
              )}
            </div>
            <h2 className="mt-2 text-xl font-semibold leading-tight">{want.name || "Untitled want"}</h2>
            {want.maker && <p className="mt-0.5 text-[15px] text-[#665746]">{want.maker}</p>}
          </div>

          {/* The ceiling, labelled as a limit rather than a value. It is what
              the collector will not exceed, never what the copy is worth. */}
          {hasValue(want.maxPrice) && (
            <div className="shrink-0 text-right">
              <div className="text-[11px] uppercase tracking-[0.14em] text-[#8a7a64]">Won&apos;t pay over</div>
              <div className="font-ledger mt-1 text-2xl font-medium">{formatCurrency(want.maxPrice)}</div>
            </div>
          )}
        </div>

        {upgradeFor && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[#eadfcd] bg-[#f6efe3] px-4 py-2.5">
            <Icon name="search" size={15} className="shrink-0 text-[#7d6c5a]" />
            <span className="text-[13px] text-[#665746]">
              Would replace <strong className="font-semibold text-[#201a14]">{formatReference(upgradeFor.referenceNumber)}</strong>
              {upgradeFor.condition ? ` — your ${upgradeFor.condition} copy` : ""}
            </span>
          </div>
        )}

        <CriteriaChips want={want} />

        {want.notes && <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#665746]">{want.notes}</p>}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#eadfcd] pt-4">
          <div className="flex flex-wrap gap-2">
            {links && (
              <>
                <a
                  href={links.abebooks}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackEvent("want_search_opened", { marketplace: "abebooks" })}
                  className="inline-flex items-center gap-2 rounded-full border border-[#cdbb9d] bg-[#fff8ee] px-4 py-2 text-[13px] font-medium hover:bg-white"
                >
                  Search AbeBooks
                </a>
                <a
                  href={links.ebay}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackEvent("want_search_opened", { marketplace: "ebay" })}
                  className="inline-flex items-center gap-2 rounded-full border border-[#cdbb9d] bg-[#fff8ee] px-4 py-2 text-[13px] font-medium hover:bg-white"
                >
                  eBay
                </a>
              </>
            )}
            <Button variant="outline" onClick={() => onEdit(want)} className="rounded-full border-[#cdbb9d] bg-[#fff8ee] px-4 py-2 text-[13px] hover:bg-white">
              Edit
            </Button>
          </div>
          <Button onClick={() => onFound(want)} className="rounded-full bg-[#123f38] px-5 py-2 text-[13px] text-[#fff7ea] hover:bg-[#0f332d]">
            I found it
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function WishlistPage({ wishlist, openList, summary, loading, inventory, onAdd, onEdit, onFound }) {
  const itemsById = useMemo(() => new Map(inventory.map((entry) => [entry.id, entry])), [inventory]);
  const found = wishlist.filter((want) => want.foundAt);

  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-5xl font-semibold tracking-tight">The hunt.</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-[#665746]">
            What you&apos;re looking for, and the copy that would actually be a yes. None of it counts toward what your
            collection is worth.
          </p>
        </div>
        <Button onClick={onAdd} className="rounded-full bg-[#123f38] px-6 text-[#fff7ea] hover:bg-[#0f332d]">
          Add a want
        </Button>
      </div>

      {openList.length > 0 && (
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <DashboardCard icon="search" label="Still looking for" value={`${summary.openCount} ${summary.openCount === 1 ? "copy" : "copies"}`} />
          {/* Named for what it is. Summing ceilings is a budget, not a holding,
              and the caption says how much of the list it actually covers. */}
          <DashboardCard
            icon="dollar"
            label={summary.withCeiling === summary.openCount ? "If you paid every ceiling" : `Ceilings on ${summary.withCeiling} of ${summary.openCount}`}
            value={formatCurrency(summary.ceilingTotal)}
          />
          <DashboardCard icon="check" label="Found so far" value={`${summary.foundCount} ${summary.foundCount === 1 ? "copy" : "copies"}`} />
        </div>
      )}

      {loading && wishlist.length === 0 ? (
        <Card className="mt-8 rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-sm">
          <CardContent className="p-8 text-center text-[#665746]">Loading your wishlist…</CardContent>
        </Card>
      ) : openList.length === 0 ? (
        <Card className="mt-8 rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-sm">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-semibold">{found.length > 0 ? "Nothing on the list right now" : "Nothing on the hunt yet"}</h2>
            <p className="mx-auto mt-3 max-w-md leading-7 text-[#665746]">
              {found.length > 0
                ? "You've found everything you were looking for. Add the next one whenever it occurs to you."
                : "Describe the copy you're after — the edition, the condition, what you won't go over — and the search links write themselves."}
            </p>
            <Button onClick={onAdd} className="mt-6 rounded-full bg-[#123f38] px-6 text-[#fff7ea] hover:bg-[#0f332d]">
              Add a want
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-8 flex flex-col gap-4">
          {openList.map((want) => (
            <WantCard
              key={want.id}
              want={want}
              upgradeFor={want.upgradeForItemId ? itemsById.get(want.upgradeForItemId) : null}
              onEdit={onEdit}
              onFound={onFound}
            />
          ))}
        </div>
      )}

      {/* The history. Kept because how long something was hunted, and what was
          set out for, is the interesting half of collecting. */}
      {found.length > 0 && (
        <div className="mt-12">
          <h2 className="text-2xl font-semibold">Found</h2>
          <div className="mt-4 overflow-hidden rounded-[2rem] border border-[#d8c7ad] bg-[#fff9f0] shadow-sm">
            {found.map((want) => (
              <div key={want.id} className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[#eadfcd] px-5 py-4 last:border-b-0">
                <div className="min-w-0">
                  <div className="font-medium">{want.name}</div>
                  {want.maker && <div className="text-sm text-[#665746]">{want.maker}</div>}
                </div>
                <div className="text-sm text-[#8a7a64]">
                  Hunted {formatAccountDate(want.createdAt)} — found {formatAccountDate(want.foundAt)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// A small labelled group of pill choices. Used for the three criteria that are
// genuinely a small closed set, where a select would hide the options behind a
// click and make the form feel longer than it is.
function ChoiceRow({ label, options, value, onChange, hint }) {
  return (
    <div>
      <div className="mb-2 text-sm font-medium text-[#665746]">
        {label}
        {hint && <span className="ml-2 font-normal text-[#a2957f]">{hint}</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={`rounded-full px-4 py-2 text-[13px] font-medium transition ${
              value === option.value
                ? "bg-[#123f38] text-[#fff7ea]"
                : "border border-[#cdbb9d] bg-[#fff8ee] text-[#665746] hover:bg-white"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function WantDialog({ want, inventory, saving, onSave, onDelete, onClose }) {
  const [draft, setDraft] = useState(want);
  const isNew = !want.id;

  function set(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  // Only real, owned copies can be upgraded from -- offering a sold one would
  // mean wanting a better version of something already gone.
  //
  // Labelled the way the collector would recognise the copy: its reference
  // number, its title, and the condition that is presumably why they want a
  // better one. The value stays the row id, because that is what the foreign
  // key stores -- but an id is not something a person should ever be asked to
  // pick from a list.
  const upgradeCandidates = useMemo(
    () =>
      inventory
        .filter((entry) => entry.status !== "Sold")
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
        .map((entry) => ({
          value: entry.id,
          label: [formatReference(entry.referenceNumber), entry.name || "Untitled item", entry.condition]
            .filter(Boolean)
            .join(" — ")
        })),
    [inventory]
  );

  return (
    <ModalShell onClose={saving ? () => {} : onClose} contentClassName="max-h-[88vh] max-w-3xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="text-sm uppercase tracking-[0.18em] text-[#7d6c5a]">Wishlist</div>
          <h2 className="mt-1 text-3xl font-semibold">{isNew ? "What would you actually buy?" : "Edit this want"}</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#665746]">
            Not the book — the copy. The more precisely you describe it, the better the search links work.
          </p>
        </div>
        <button
          onClick={onClose}
          disabled={saving}
          className="rounded-full bg-[#f0e2cf] p-2 text-[#665746] hover:bg-[#ead8bf] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Close"
        >
          <Icon name="x" size={18} />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" value={draft.name} onChange={(value) => set("name", value)} />
        <Field label="Maker / Author / Brand" value={draft.maker} onChange={(value) => set("maker", value)} />
      </div>

      {/* The criteria, boxed off from the plain fields above. These are
          conditions on a copy nobody has found yet, not facts about one. */}
      <div className="mt-5 rounded-[1.5rem] border border-[#123f38]/25 bg-[#edf4f2] p-5">
        <div className="text-xs uppercase tracking-[0.16em] text-[#123f38]">The copy that counts</div>
        <p className="mt-2 text-[13px] leading-6 text-[#3f352a]">
          Conditions, not facts — they describe a copy you have not found yet.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <SelectField label="Edition wanted" value={draft.wantedEdition} options={bookEditionOptions} onChange={(value) => set("wantedEdition", value)} placeholder="Any edition" />
          <SelectField label="Printing wanted" value={draft.wantedPrinting} options={bookPrintingOptions} onChange={(value) => set("wantedPrinting", value)} placeholder="Any printing" />
          <Field label="Publisher & year" value={draft.publisher} onChange={(value) => set("publisher", value)} />
          <SelectField label="Condition, at worst" value={draft.minCondition} options={conditionOptions} onChange={(value) => set("minCondition", value)} placeholder="Any condition" />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <ChoiceRow label="Dust jacket" options={jacketOptions} value={draft.jacketRequirement} onChange={(value) => set("jacketRequirement", value)} />
          <ChoiceRow label="Signature" options={signatureOptions} value={draft.signatureRequirement} onChange={(value) => set("signatureRequirement", value)} />
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Won't pay over" type="number" value={draft.maxPrice} onChange={(value) => set("maxPrice", value)} />
        <Field label="Preferred seller or country" value={draft.preferredSource} onChange={(value) => set("preferredSource", value)} />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <ChoiceRow label="How badly" options={priorityOptions} value={draft.priority} onChange={(value) => set("priority", value)} />
        <SelectField
          label="Upgrade for"
          value={draft.upgradeForItemId}
          options={upgradeCandidates}
          onChange={(value) => set("upgradeForItemId", value)}
          placeholder="Not an upgrade"
        />
      </div>

      <div className="mt-5">
        <TextAreaField label="Notes" value={draft.notes} onChange={(value) => set("notes", value)} rows={3} placeholder="What would make you pass?" />
      </div>

      {/* The same per-row escape hatch owned items get. Shown whether or not
          the wishlist is currently published, so a want can be marked private
          when it is written rather than only after someone shares the page. */}
      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-[#e0d2bc] bg-[#fffdf8] p-4">
        <input
          type="checkbox"
          checked={Boolean(draft.hiddenFromShare)}
          onChange={(event) => set("hiddenFromShare", event.target.checked)}
          className="mt-1 h-4 w-4 shrink-0 accent-[#123f38]"
        />
        <span>
          <span className="block text-sm font-medium">Keep this one to myself</span>
          <span className="block text-xs leading-5 text-[#7d6c5a]">
            Stays off your public wishlist even when the rest of it is published.
          </span>
        </span>
      </label>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#eadfcd] pt-5">
        <p className="max-w-sm text-xs leading-5 text-[#7d6c5a]">
          Your ceiling stays private — it is never published, whatever your sharing settings say.
        </p>
        <div className="flex gap-2">
          {!isNew && (
            <Button variant="outline" onClick={() => onDelete(draft.id)} disabled={saving} className="rounded-full border-[#cdbb9d] bg-[#fff8ee] px-5 hover:bg-white">
              Remove
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={saving} className="rounded-full border-[#cdbb9d] bg-[#fff8ee] px-5 hover:bg-white">
            Cancel
          </Button>
          <Button onClick={() => onSave(draft)} disabled={saving || !isWantSaveable(draft)} className="rounded-full bg-[#123f38] px-6 text-[#fff7ea] hover:bg-[#0f332d]">
            {saving ? "Saving..." : isNew ? "Add to wishlist" : "Save"}
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}

// One row of the wanted-vs-got table.
// One row of the found-it form: a label on the left, the field on the right.
//
// `hint` is the qualifier that used to be folded into the label itself, where
// it produced a long sentence breaking mid-clause above an empty box, reading
// as though the field were asking about the limit rather than the price.
//
// Deliberately two lines rather than one joined by a separator. This label sits
// in a half-width column of a 672px modal -- about 300px -- and "What you paid
// . You said you wouldn't pay over $1,750" does not fit on one line at any
// viewport, so a separator would only ever end up stranded at the start of the
// wrapped line. Label above, qualifier below, smaller and muted: it reads as
// deliberate at every width instead of as an accident at most of them.
function FoundRow({ wanted, hint, children }) {
  return (
    <div className="grid grid-cols-1 gap-1 border-t border-[#e0d2bc] bg-[#fffdf8] px-5 py-3 sm:grid-cols-2 sm:gap-4">
      <div className="flex flex-wrap items-baseline gap-x-1.5">
        <span className="text-sm text-[#665746]">{wanted}</span>
        {hint && <span className="text-xs leading-5 text-[#8a7a64]">{hint}</span>}
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function FoundItDialog({ want, saving, onConfirm, onClose }) {
  const [found, setFound] = useState({ condition: "", purchasePrice: "", source: want.preferredSource || "", purchaseDate: todayIso() });
  // Staged locally and handed over on confirm, the same {id, name, url, file}
  // shape the Add Items flows use, so CompactUploader and uploadPhotoList both
  // take them unchanged. Nothing uploads until the item row exists to attach
  // them to -- abandoning this dialog leaves no orphaned files in storage.
  const [itemPhotos, setItemPhotos] = useState([]);
  const [receiptPhotos, setReceiptPhotos] = useState([]);
  const criteria = describeCriteria(want);
  const ceiling = compareToCeiling(want, found.purchasePrice);

  // Every staged photo holds an object URL. Without this they leak for as long
  // as the tab lives, which on a phone in a bookshop is exactly the session
  // where it matters.
  useEffect(
    () => () => {
      [...itemPhotos, ...receiptPhotos].forEach((photo) => photo.url && URL.revokeObjectURL(photo.url));
    },
    [itemPhotos, receiptPhotos]
  );

  function set(field, value) {
    setFound((current) => ({ ...current, [field]: value }));
  }

  function addPhotos(event, kind) {
    const files = Array.from(event.target.files || []);
    const staged = files.map((file) => ({
      id: `${kind}-${file.name}-${Date.now()}-${Math.random()}`,
      name: file.name,
      url: URL.createObjectURL(file),
      type: file.type || "image",
      file
    }));
    const setter = kind === "item" ? setItemPhotos : setReceiptPhotos;
    setter((current) => [...current, ...staged]);
    event.target.value = "";
  }

  function dropPhoto(id, kind) {
    const setter = kind === "item" ? setItemPhotos : setReceiptPhotos;
    setter((current) => current.filter((photo) => photo.id !== id));
  }

  return (
    <ModalShell onClose={saving ? () => {} : onClose} contentClassName="max-h-[88vh] max-w-2xl">
      <div className="text-sm uppercase tracking-[0.18em] text-[#7d6c5a]">Found it</div>
      <h2 className="mt-1 text-3xl font-semibold">{want.name}</h2>
      <p className="mt-2 text-[15px] text-[#665746]">
        {[want.maker, want.createdAt && `wanted since ${formatAccountDate(want.createdAt)}`].filter(Boolean).join(" · ")}
      </p>

      {/* What you asked for, beside what you got. This is the payoff of a want
          being a specification rather than a status: there is something to
          check the copy against. */}
      {criteria.length > 0 && (
        <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-[#d8c7ad]">
          <div className="bg-[#f0e2cf] px-5 py-2.5 text-[11px] uppercase tracking-[0.14em] text-[#665746]">You wanted</div>
          <div className="bg-[#fffdf8] px-5 py-3">
            <div className="flex flex-wrap gap-2">
              {criteria.map((chip) => (
                <span key={chip.text} className="rounded-full bg-[#f0e2cf] px-3 py-1 text-[13px] text-[#665746]">{chip.text}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-[#d8c7ad]">
        <div className="bg-[#f0e2cf] px-5 py-2.5 text-[11px] uppercase tracking-[0.14em] text-[#665746]">What you got</div>

        <FoundRow wanted="Condition of this copy">
          <SelectField label="" value={found.condition} options={conditionOptions} onChange={(value) => set("condition", value)} placeholder="Not graded" />
        </FoundRow>

        {/* The label says what the field is for; the ceiling is context, not a
            question. Folding both into one sentence made the field read as if
            it were asking about the limit rather than the price. */}
        <FoundRow
          wanted="What you paid"
          hint={hasValue(want.maxPrice) ? `You said you wouldn't pay over ${formatCurrency(want.maxPrice)}` : ""}
        >
          <Field label="" type="number" value={found.purchasePrice} onChange={(value) => set("purchasePrice", value)} />
          {ceiling && (
            <div className={`mt-1 text-xs ${ceiling.under ? "text-[#1c5c4a]" : "text-[#8f3524]"}`}>
              {ceiling.difference === 0
                ? "Exactly your ceiling."
                : ceiling.under
                  ? `${formatCurrency(ceiling.difference)} under your ceiling.`
                  : `${formatCurrency(ceiling.difference)} over your ceiling.`}
            </div>
          )}
        </FoundRow>

        <FoundRow wanted="Where it came from">
          <Field label="" value={found.source} onChange={(value) => set("source", value)} />
        </FoundRow>

        <FoundRow wanted="Date acquired">
          <Field label="" type="date" value={found.purchaseDate} onChange={(value) => set("purchaseDate", value)} />
        </FoundRow>
      </div>

      {/* The same two uploaders the Add Items flows offer, because this is the
          moment a copy arrives -- photographing it now is the whole point, and
          sending someone to a separate edit screen afterwards is how a record
          ends up without a receipt. */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <CompactUploader
          title="Photos of this copy"
          icon="camera"
          photos={itemPhotos}
          onUpload={(event) => addPhotos(event, "item")}
          onRemove={(id) => dropPhoto(id, "item")}
        />
        <CompactUploader
          title="Receipt / proof"
          icon="receipt"
          photos={receiptPhotos}
          onUpload={(event) => addPhotos(event, "receipt")}
          onRemove={(id) => dropPhoto(id, "receipt")}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#eadfcd] pt-5">
        <p className="max-w-xs text-xs leading-5 text-[#7d6c5a]">
          It joins your collection. The hunt stays on record rather than being deleted.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving} className="rounded-full border-[#cdbb9d] bg-[#fff8ee] px-5 hover:bg-white">
            Not yet
          </Button>
          <Button onClick={() => onConfirm(want, found, { itemPhotos, receiptPhotos })} disabled={saving} className="rounded-full bg-[#123f38] px-6 text-[#fff7ea] hover:bg-[#0f332d]">
            {saving ? "Adding..." : "Add to collection"}
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}

function MobileNavLink({ active, children, onClick }) { return <button onClick={onClick} className={`rounded-xl px-4 py-3 text-left text-sm font-medium transition ${active ? "bg-[#123f38] text-[#fff7ea]" : "text-[#665746] hover:bg-white"}`}>{children}</button>; }
function Field({ label, value, onChange, type = "text" }) { return <label className="block"><div className="mb-2 text-sm font-medium text-[#665746]">{label}</div><input type={type} value={value || ""} onChange={(event) => onChange(event.target.value)} className="w-full rounded-2xl border border-[#d8c7ad] bg-[#fffdf8] px-4 py-3 outline-none transition focus:border-[#123f38] focus:ring-2 focus:ring-[#123f38]/15" /></label>; }
// options may be plain strings, where the value and the label are the same
// thing (every status, condition and category list in the app), or
// {value, label} pairs where they differ. The second shape exists because a
// select whose value is a database id must not show that id to a person --
// which is exactly what the wishlist's "Upgrade for" field did before it took
// pairs.
// The item-name field, with book autocomplete attached.
//
// It renders as the same input as every other Field -- that is the requirement,
// not an accident. Someone cataloguing a Phillies program should not be able to
// tell this field apart from the others; the suggestions only exist when the
// category is Book and three characters have been typed.
//
// Two tiers show up in one list. A guide row carries a badge and, once picked,
// a link to the identification page, because we have checked that book against
// sources. A catalog row is a bulk import nobody has read, so it says only that
// the book exists -- and the footer of the list says exactly that, so the
// dropdown cannot be mistaken for a verdict on anyone's copy.
function BookNameField({ label, value, onChange, onSelectSuggestion, enabled }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [picked, setPicked] = useState(null);
  const listId = useId();

  // Debounced, and every setState happens inside the timer rather than in the
  // effect body -- a keystroke should not schedule a render, and a fast typist
  // should not fire a query per character.
  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(async () => {
      if (!enabled || !isSearchable(query)) {
        if (!cancelled) setSuggestions([]);
        return;
      }

      const results = await searchBookCatalog(query);

      // The collector kept typing while this was in flight; their newer query
      // owns the dropdown now.
      if (cancelled) return;

      setSuggestions(results);
      setHighlighted(-1);
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, enabled]);

  function handleChange(next) {
    onChange(next);
    setQuery(next);
    setPicked(null);
    setOpen(true);
  }

  function choose(suggestion) {
    if (!suggestion) return;

    onSelectSuggestion(suggestion);
    trackEvent("book_autocomplete_selected", { tier: suggestion.tier });

    // Clearing the query is what stops the effect refiring on the title we just
    // wrote into the field and reopening the list under the collector.
    setQuery("");
    setSuggestions([]);
    setOpen(false);
    setPicked(suggestion);
  }

  const showList = open && enabled && suggestions.length > 0;

  function handleKeyDown(event) {
    if (!showList) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((current) => (current + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
    } else if (event.key === "Enter") {
      // Only swallow the Enter key when the collector is actually pointing at a
      // suggestion. Otherwise this is a form, and Enter should submit it.
      if (highlighted >= 0) {
        event.preventDefault();
        choose(suggestions[highlighted]);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative block">
      <label className="block">
        <div className="mb-2 text-sm font-medium text-[#665746]">{label}</div>
        <input
          type="text"
          value={value || ""}
          onChange={(event) => handleChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(true)}
          // A blur closes the list, but not before a click on an option has
          // registered -- mousedown on the option is prevented below, so focus
          // never actually leaves for a click inside the dropdown.
          onBlur={() => setOpen(false)}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={highlighted >= 0 ? `${listId}-${highlighted}` : undefined}
          autoComplete="off"
          className="w-full rounded-2xl border border-[#d8c7ad] bg-[#fffdf8] px-4 py-3 outline-none transition focus:border-[#123f38] focus:ring-2 focus:ring-[#123f38]/15"
        />
      </label>

      {showList && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-[#d8c7ad] bg-[#fffdf8] shadow-xl">
          <ul id={listId} role="listbox" aria-label="Matching books" className="max-h-72 overflow-y-auto py-1">
            {suggestions.map((suggestion, index) => (
              <li
                key={suggestion.key}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === highlighted}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setHighlighted(index)}
                onClick={() => choose(suggestion)}
                className={`cursor-pointer px-4 py-2.5 ${index === highlighted ? "bg-[#edf4f2]" : ""}`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium text-[#3f362b]">{suggestion.title}</span>
                  {suggestion.tier === GUIDE_TIER && (
                    <span className="shrink-0 rounded-full bg-[#123f38] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-[#fff7ea]">
                      Guide
                    </span>
                  )}
                </div>
                {suggestionSubtitle(suggestion) && (
                  <div className="mt-0.5 text-sm leading-5 text-[#7d6c5a]">{suggestionSubtitle(suggestion)}</div>
                )}
              </li>
            ))}
          </ul>
          <div className="border-t border-[#e8dcc7] bg-[#fbf5e9] px-4 py-2 text-xs leading-5 text-[#7d6c5a]">
            These say a book exists, not what your copy is. Check it against the guide.
          </div>
        </div>
      )}

      {picked && (
        <p className="mt-2 text-xs leading-5 text-[#7d6c5a]">
          Filled in from {picked.tier === GUIDE_TIER ? "our verified guide" : "the book catalog"}. Publisher, edition
          and printing are a starting point — check them against your copy
          {picked.guidePath ? (
            <>
              , using the{" "}
              <a
                href={picked.guidePath}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-[#cdbb9d] underline-offset-2 hover:text-[#123f38]"
              >
                identification guide
              </a>
              .
            </>
          ) : (
            "."
          )}
        </p>
      )}
    </div>
  );
}

function SelectField({ label, value, options, onChange, placeholder }) {
  const choices = (options || []).map((option) => (typeof option === "string" ? { value: option, label: option } : option));

  return (
    <label className="block">
      {label && <div className="mb-2 text-sm font-medium text-[#665746]">{label}</div>}
      <select
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-[#d8c7ad] bg-[#fffdf8] px-4 py-3 outline-none transition focus:border-[#123f38] focus:ring-2 focus:ring-[#123f38]/15"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
    </label>
  );
}
function TextAreaField({ label, value, onChange, placeholder, rows = 6 }) { return <label className="block"><div className="mb-2 text-sm font-medium text-[#665746]">{label}</div><textarea value={value || ""} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={rows} className="w-full rounded-2xl border border-[#d8c7ad] bg-[#fffdf8] px-4 py-3 outline-none transition focus:border-[#123f38] focus:ring-2 focus:ring-[#123f38]/15" /></label>; }
function PhotoUploader({ title, eyebrow, description, prompts, photos, onUpload, onRemove }) { return <Card className="rounded-[2rem] border-[#d8c7ad] bg-[#fff9f0] shadow-sm"><CardContent className="p-6"><div className="flex items-start justify-between gap-4"><div><div className="text-sm uppercase tracking-[0.18em] text-[#7d6c5a]">{eyebrow}</div><h2 className="mt-1 text-2xl font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-[#665746]">{description}</p></div><div className="rounded-full bg-[#edf4f2] px-3 py-1 text-sm font-medium text-[#123f38]">{photos.length}</div></div><label className="mt-5 flex min-h-[150px] cursor-pointer flex-col items-center justify-center rounded-[1.5rem] border-2 border-dashed border-[#cbb894] bg-[#f7ecdc] p-6 text-center transition hover:bg-[#fff4e6]"><Icon name={title.toLowerCase().includes("receipt") ? "receipt" : "camera"} size={36} className="text-[#123f38]" /><div className="mt-3 text-lg font-semibold">Take or upload</div><div className="mt-1 max-w-sm text-xs leading-5 text-[#6b5b4c]">Works with camera or photo library on mobile.</div><input type="file" accept="image/*" capture="environment" multiple onChange={onUpload} className="hidden" /></label><div className="mt-4 flex flex-wrap gap-2">{prompts.map((prompt) => <div key={prompt} className="rounded-full bg-[#f0e2cf] px-3 py-1 text-xs text-[#665746]">{prompt}</div>)}</div>{photos.length > 0 && <PhotoGrid photos={photos} onRemove={onRemove} />}</CardContent></Card>; }
function CompactUploader({ title, icon, photos, onUpload, onRemove }) { return <div className="rounded-2xl border border-[#d8c7ad] bg-[#fffdf8] p-4"><div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2 font-semibold"><Icon name={icon} size={17} /> {title}</div><span className="rounded-full bg-[#edf4f2] px-3 py-1 text-xs text-[#123f38]">{photos.length}</span></div><label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-[#cbb894] bg-[#f7ecdc] px-4 py-4 text-sm font-medium hover:bg-[#fff4e6]">Take or upload<input type="file" accept="image/*" capture="environment" multiple onChange={onUpload} className="hidden" /></label>{photos.length > 0 && <PhotoGrid photos={photos} onRemove={onRemove} compact />}</div>; }
// One stored photo, and every way it can fail to arrive.
//
// A photo is served through a signed URL that stops working an hour after it
// was signed, over whatever connection a collector has in a shop basement.
// Both of those failures look identical to an <img>: the fetch fails, the
// element renders an empty frame, and it stays that way until something
// remounts it. That is the blank card people were seeing on their phones --
// nothing was broken in the data, and nothing on screen said so.
//
// So this holds the three states a remote photo really has: arriving, arrived,
// and did not arrive. The first retry is automatic and asks for a *new* signed
// URL rather than re-requesting the dead one, because an expired hour is the
// likeliest reason a photo that worked earlier stopped. After that it stops
// and offers the reader the retry, rather than hammering a connection that is
// already struggling.
function SignedPhoto({ path, src, alt = "", className = "", frameClassName = "", quiet = false, allowRetry = true }) {
  const [current, setCurrent] = useState(src || "");
  const [status, setStatus] = useState(src ? "loading" : "failed");
  const [prevSrc, setPrevSrc] = useState(src);
  const autoRetriedRef = useRef(false);
  // When the URL now on screen was signed. Used to decide whether a resumed
  // app is holding one that has since died of old age.
  const signedAtRef = useRef(Date.now());

  // Adjusting state during render rather than in an effect: this is the
  // documented way to react to a changed prop without the extra render (and
  // the visible flash of a stale photo) that an effect would add. It happens
  // when the parent re-signs a batch of URLs.
  if (src !== prevSrc) {
    setPrevSrc(src);
    setCurrent(src || "");
    setStatus(src ? "loading" : "failed");
    autoRetriedRef.current = false;
  }

  async function resign() {
    setStatus("loading");
    const fresh = await signedUrlForPath(path);
    if (!fresh) {
      setStatus("failed");
      return;
    }
    signedAtRef.current = Date.now();
    setCurrent(fresh);
  }

  function handleError() {
    // One automatic attempt, and only when there is a path to re-sign from.
    // A local blob preview that fails has nowhere better to go.
    if (!autoRetriedRef.current && path) {
      autoRetriedRef.current = true;
      resign();
      return;
    }
    setStatus("failed");
  }

  function retry() {
    autoRetriedRef.current = true;
    resign();
  }

  // The installed-app case, and the one collectors actually hit.
  //
  // A PWA is not reloaded when you come back to it days later -- iOS freezes
  // the page and thaws it with its React state intact, including URLs signed
  // an hour ago that are now refused. Photos already painted survive; anything
  // the browser has to fetch again comes back blank. Waiting for that failure
  // works (handleError re-signs), but it means a frame of nothing first, so
  // this gets ahead of it: on the way back to a visible page, a URL old enough
  // to be in doubt is replaced before it is asked for.
  //
  // The margin is generous on purpose. Re-signing early costs one request that
  // was going to happen anyway; re-signing late costs the reader a broken
  // photo, which is the whole bug.
  useEffect(() => {
    if (!path) return;

    function refreshIfStale() {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - signedAtRef.current < SIGNED_URL_TTL_SECONDS * 1000 * 0.8) return;
      autoRetriedRef.current = false;
      resign();
    }

    document.addEventListener("visibilitychange", refreshIfStale);
    // Safari restoring a frozen page fires pageshow, not always
    // visibilitychange -- and the installed app is Safari.
    window.addEventListener("pageshow", refreshIfStale);
    return () => {
      document.removeEventListener("visibilitychange", refreshIfStale);
      window.removeEventListener("pageshow", refreshIfStale);
    };
    // resign closes over `path` only, which is what this is keyed on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  return (
    <div className={`relative overflow-hidden bg-[#f0e2cf] ${frameClassName}`}>
      {status !== "ok" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-2 text-center">
          {status === "loading" ? (
            <div className="h-full w-full animate-pulse bg-[#e7d7bd]" />
          ) : (
            <>
              <Icon name="camera" size={16} className="text-[#a2947f]" />
              {!quiet && <span className="text-[11px] leading-4 text-[#8a7a64]">Photo didn&apos;t load</span>}
              {/* Suppressed where this sits inside something already
                  clickable: a button inside a button is invalid, and the
                  outer control would fire along with it. Those places get
                  the automatic re-sign and nothing to press. */}
              {path && allowRetry && (
                <button
                  type="button"
                  onClick={retry}
                  className="rounded-full border border-[#cdbb9d] bg-[#fff8ee] px-2.5 py-1 text-[11px] font-medium text-[#665746] transition hover:bg-white"
                >
                  Try again
                </button>
              )}
            </>
          )}
        </div>
      )}
      {current && (
        <img
          src={current}
          alt={alt}
          onLoad={() => setStatus("ok")}
          onError={handleError}
          /* Async decoding keeps a large photo off the main thread while the
             rest of the page paints -- these are camera photos, not icons. */
          decoding="async"
          className={`${className} ${status === "ok" ? "" : "opacity-0"}`}
        />
      )}
    </div>
  );
}

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

function Card({ children, className = "", id }) {
  return (
    <div id={id} className={`rounded-[2rem] border border-[#d8c7ad] bg-[#fff9f0] shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function CardContent({ children, className = "" }) {
  return <div className={`p-6 ${className}`}>{children}</div>;
}
