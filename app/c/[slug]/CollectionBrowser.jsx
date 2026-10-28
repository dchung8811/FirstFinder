"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  sortOptions,
  filterPublicItems,
  sortPublicItems,
  collectFilterOptions,
  statusLabel,
  resultSummary
} from "../../../src/utils/publicCollectionBrowse";
import { formatCurrency } from "../../../src/utils/format";
import { itemCredit } from "../../../src/utils/items";
import { publicItemAnchor } from "../../../src/utils/publicCollection";
import { ItemCard, ItemTile } from "./ItemCard";
import PhotoViewer from "./PhotoViewer";

// The interactive half of a shared collection page.
//
// It receives items the server has already vetted -- buildPublicItem decided
// what may be published, and nothing here can widen that. This component only
// hides, reorders, and re-lays-out what it was handed, which is why it is safe
// for it to be a client component on a public page: there is no privileged
// data in its props to leak, and no query it can make.
//
// Filtering client-side rather than through the URL is deliberate. The page is
// server-rendered per request (see the `dynamic` note in page.js), so a
// searchParams-driven filter would mean a full round trip -- a database read,
// a fresh batch of signed photo URLs -- on every keystroke. The whole
// collection is already in the payload; filtering it here is instant and costs
// the database nothing.

const VIEW_STORAGE_KEY = "ff-collection-view";
const VIEWS = ["tiles", "cards", "records"];

// The remembered view, read through useSyncExternalStore rather than restored
// in an effect.
//
// localStorage is a store outside React that does not exist on the server, and
// this is what that hook is for: getServerSnapshot supplies the value the HTML
// is rendered with, and the client reads the real one as it hydrates. Doing it
// in an effect instead would either render the wrong view for a frame or, if
// read during render, make the first client pass disagree with the server's
// markup.
//
// Every access is wrapped: a browser set to block site data throws on the
// property itself rather than returning null.
const viewStore = {
  listeners: new Set(),
  subscribe(listener) {
    viewStore.listeners.add(listener);
    return () => viewStore.listeners.delete(listener);
  },
  read() {
    try {
      const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
      return VIEWS.includes(stored) ? stored : "tiles";
    } catch {
      return "tiles";
    }
  },
  write(next) {
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // The preference will not persist. Notifying anyway keeps this render
      // in step with the click that caused it.
    }
    viewStore.listeners.forEach((listener) => listener());
  }
};

// Tiles is what the server renders, so it is what hydration must agree on.
// A visitor who picked Cards or Records before Tiles existed still has that
// choice stored, and keeps it.
const serverView = () => "tiles";

// The Records view, matching the table on the owner's own Collection tab.
//
// Deliberately the same shape as the app's inventory table -- the same wrapper,
// the same header treatment, the same Item / Category / Status / Cost / Value /
// Photos columns, and the same horizontal scroll on a narrow screen. Someone
// who catalogues in FirstFinder and then opens a shared page should recognise
// what they are looking at.
//
// What is dropped is what a visitor cannot do: the Actions column, the inline
// editing, and the hint line about clicking a cell to edit it. The value
// columns render only when the owner actually published those fields -- a
// permanently empty "Cost" column would look broken and would advertise that
// there is a price being withheld.
function valueForItem(item) {
  return item.status === "Sold" ? item.soldPrice : item.estimatedValue;
}

function RecordTable({ items, onViewPhotos, markedId }) {
  // Derived from the items rather than passed down: a withheld field is absent
  // from the object, so "does anything here have a price" is the same question
  // as "did the owner publish prices".
  const showCost = items.some((item) => item.purchasePrice);
  const showValue = items.some((item) => valueForItem(item));
  const showPhotos = items.some((item) => item.photoUrl);

  return (
    <div className="mt-8 overflow-hidden rounded-[2rem] border border-[#d8c7ad] bg-[#fff9f0] shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-[#f0e2cf] text-xs uppercase tracking-[0.14em] text-[#665746]">
            <tr>
              <th className="px-5 py-4">Item</th>
              <th className="px-5 py-4">Category</th>
              <th className="px-5 py-4">Status</th>
              {showCost && <th className="px-5 py-4">Cost</th>}
              {showValue && <th className="px-5 py-4">Value</th>}
              {showPhotos && <th className="px-5 py-4">Photo</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                id={publicItemAnchor(item.id)}
                className={`scroll-mt-6 border-t border-[#e0d2bc] ${item.id === markedId ? "bg-[#edf4f2]" : ""}`}
              >
                <td className="px-5 py-4">
                  <div className="font-semibold">{item.name || "Untitled item"}</div>
                  <div className="text-[#665746]">{itemCredit(item) || "Unknown maker"}</div>
                </td>
                <td className="px-5 py-4">{item.category}</td>
                <td className="px-5 py-4">{statusLabel(item.status)}</td>
                {showCost && <td className="px-5 py-4 tabular-nums">{item.purchasePrice ? formatCurrency(item.purchasePrice) : "--"}</td>}
                {showValue && <td className="px-5 py-4 tabular-nums">{valueForItem(item) ? formatCurrency(valueForItem(item)) : "--"}</td>}
                {showPhotos && (
                  <td className="px-5 py-4">
                    {item.photoUrl ? (
                      <button
                        type="button"
                        onClick={() => onViewPhotos?.(item)}
                        aria-label={`View photos of ${item.name || "this item"}`}
                        className="cursor-zoom-in"
                      >
                        {/* Lazy for the same reason the cards are: one request
                            to Supabase storage per row. */}
                        <img
                          src={item.photoUrl}
                          alt={item.name || "Collection item"}
                          loading="lazy"
                          decoding="async"
                          className="h-12 w-12 rounded-lg bg-[#f0e2cf] object-cover"
                        />
                      </button>
                    ) : (
                      <span className="text-[#8a7a64]">--</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ToggleButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
        active ? "bg-[#123f38] text-[#fff7ea]" : "text-[#665746] hover:bg-white"
      }`}
    >
      {children}
    </button>
  );
}

// One item's card, laid over the Tiles view on a dark backdrop.
//
// Tapping a cover asks about that one book, so the answer comes to the
// visitor rather than sending them to the Cards view and losing their place
// in the wall. Closing it -- the button, the backdrop, or Escape -- leaves
// them exactly where they were.
//
// The photo viewer opens on top of it (z-50 over z-40), and while it does,
// Escape belongs to the viewer: `paused` stops this one closing underneath.
function CardOverlay({ item, onClose, onViewPhotos, paused }) {
  const panelRef = useRef(null);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape" && !paused) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, paused]);

  // Same reason as the photo viewer: a phone must not drag the shelf around
  // underneath the card.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#201a14]/75 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={item.name || "Untitled item"}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto outline-none"
      >
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full bg-[#fff9f0] p-2 text-[#201a14] shadow-sm transition hover:bg-white"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <ItemCard item={item} onViewPhotos={onViewPhotos} anchor={false} />
      </div>
    </div>
  );
}

const selectClass =
  "rounded-full border border-[#d8c7ad] bg-[#fffdf8] px-4 py-2.5 text-sm text-[#3f352a] outline-none transition focus:border-[#123f38] focus:ring-2 focus:ring-[#123f38]/15";

export default function CollectionBrowser({ items }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("added");
  // Every shelf gets the toolbar and the same views, however small. A page of
  // five that looked nothing like a page of two hundred read as a different
  // product, and a visitor coming from one to the other lost their bearings.
  const view = useSyncExternalStore(viewStore.subscribe, viewStore.read, serverView);
  // One viewer for the whole page, opened from either layout, rather than a
  // lightbox per card.
  const [viewing, setViewing] = useState(null);
  const [photoIndex, setPhotoIndex] = useState(0);

  function openPhotos(item) {
    if (!item?.photoUrls?.length) return;
    setViewing(item);
    setPhotoIndex(0);
  }

  // The item whose card is open over the Tiles view.
  const [openItem, setOpenItem] = useState(null);

  // Arriving from a cover on Explore or the home page, at /c/<slug>#item-<id>.
  //
  // The browser's own jump to the fragment can't be relied on here: the page
  // streams in behind loading.js, so the card may not exist yet when the
  // browser looks for it, and a visitor who last chose Records gets the tiles
  // the server rendered swapped for a table after hydration, which leaves them
  // scrolled to where a tile used to be. So once the view this visitor will
  // actually see has rendered, scroll to the book once. Only once: toggling
  // the view later shouldn't yank them back to it.
  //
  // In the Tiles view the book's card also opens over the wall, the same as
  // tapping its cover -- a ring around one tile in a grid of two hundred is
  // easy to miss. Its tile is scrolled to underneath, so closing the card
  // leaves the visitor beside it.
  //
  // The book is marked from state rather than with :target, which only
  // tracks full page loads -- Explore's links are client-side navigations,
  // and those never update it.
  const arrived = useRef(false);
  const [markedId, setMarkedId] = useState(null);
  useEffect(() => {
    if (arrived.current || view !== viewStore.read()) return;
    arrived.current = true;
    // Compared raw, not decoded: the anchors are plain ids that never need
    // escaping, and decodeURIComponent throws on a hand-mangled fragment like
    // "#%" -- which would take the whole shelf down over a typo in a link.
    const anchor = window.location.hash.slice(1);
    const item = anchor && items.find((candidate) => publicItemAnchor(candidate.id) === anchor);
    if (!item) return;
    setMarkedId(item.id);
    if (view === "tiles") setOpenItem(item);
    document.getElementById(anchor)?.scrollIntoView({ block: "start" });
  }, [view, items]);

  const options = useMemo(() => collectFilterOptions(items), [items]);

  const visible = useMemo(
    () => sortPublicItems(filterPublicItems(items, { query, category, status }), sort),
    [items, query, category, status, sort]
  );

  const filtering = Boolean(query || category || status);

  return (
    <>
      <div className="mt-10 flex flex-col gap-3 rounded-[2rem] border border-[#d8c7ad] bg-[#fff9f0] p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Search this collection</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by title, author, maker, edition…"
              className="w-full rounded-full border border-[#d8c7ad] bg-[#fffdf8] px-5 py-3 text-sm outline-none transition focus:border-[#123f38] focus:ring-2 focus:ring-[#123f38]/15"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            {/* Only rendered when the collection actually holds more than one
                value -- a dropdown with a single choice is a control that can
                only disappoint. */}
            {options.categories.length > 1 && (
              <label>
                <span className="sr-only">Filter by category</span>
                <select value={category} onChange={(event) => setCategory(event.target.value)} className={selectClass}>
                  <option value="">All categories</option>
                  {options.categories.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {options.statuses.length > 1 && (
              <label>
                <span className="sr-only">Filter by status</span>
                <select value={status} onChange={(event) => setStatus(event.target.value)} className={selectClass}>
                  <option value="">Any status</option>
                  {options.statuses.map((value) => (
                    <option key={value} value={value}>
                      {statusLabel(value)}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label>
              <span className="sr-only">Sort</span>
              <select value={sort} onChange={(event) => setSort(event.target.value)} className={selectClass}>
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[#665746]" aria-live="polite">
            {resultSummary(visible.length, items.length)}
            {filtering && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setCategory("");
                  setStatus("");
                }}
                className="ml-3 font-medium text-[#123f38] underline underline-offset-4"
              >
                Clear
              </button>
            )}
          </p>

          {/* Full width on a phone, each option an equal share of it, so the
              three read as one switch rather than a cluster at one end. */}
          <div className="flex w-full items-center gap-1 rounded-full border border-[#d8c7ad] bg-[#fffdf8] p-1 sm:w-auto">
            <ToggleButton active={view === "tiles"} onClick={() => viewStore.write("tiles")}>
              Tiles
            </ToggleButton>
            <ToggleButton active={view === "cards"} onClick={() => viewStore.write("cards")}>
              Cards
            </ToggleButton>
            <ToggleButton active={view === "records"} onClick={() => viewStore.write("records")}>
              Records
            </ToggleButton>
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="mt-8 rounded-[2rem] border border-[#d8c7ad] bg-[#fff9f0] p-8 text-center shadow-sm">
          <h2 className="text-xl font-semibold">Nothing matches</h2>
          <p className="mx-auto mt-2 max-w-md leading-7 text-[#665746]">
            There is nothing in this collection matching that. Try a different search, or clear the filters.
          </p>
        </div>
      ) : view === "tiles" ? (
        <div className="mt-8 grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 sm:gap-x-4 md:grid-cols-6">
          {visible.map((item) => (
            <ItemTile key={item.id} item={item} onOpen={setOpenItem} marked={item.id === markedId} />
          ))}
        </div>
      ) : view === "cards" ? (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item) => (
            <ItemCard key={item.id} item={item} onViewPhotos={openPhotos} marked={item.id === markedId} />
          ))}
        </div>
      ) : (
        <RecordTable items={visible} onViewPhotos={openPhotos} markedId={markedId} />
      )}

      {openItem && (
        <CardOverlay item={openItem} onClose={() => setOpenItem(null)} onViewPhotos={openPhotos} paused={Boolean(viewing)} />
      )}

      {viewing && (
        <PhotoViewer item={viewing} index={photoIndex} onIndex={setPhotoIndex} onClose={() => setViewing(null)} />
      )}
    </>
  );
}
