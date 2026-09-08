"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  sortOptions,
  filterPublicItems,
  sortPublicItems,
  collectFilterOptions,
  statusLabel,
  resultSummary
} from "../../../src/utils/publicCollectionBrowse";
import { formatCurrency } from "../../../src/utils/format";
import { ItemCard } from "./ItemCard";

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

// Below this, the controls are noise. A shelf of six is faster to read than to
// filter, and a search box over it makes a small collection look like it is
// hiding something. The grid still renders; only the toolbar waits.
const MIN_ITEMS_FOR_CONTROLS = 8;

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
      return window.localStorage.getItem(VIEW_STORAGE_KEY) === "records" ? "records" : "cards";
    } catch {
      return "cards";
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

// Cards is what the server renders, so it is what hydration must agree on.
const serverView = () => "cards";

// A shared page is often opened on a phone from a link, so the compact view
// has to be genuinely compact: no photo column, no value rows, just enough to
// scan a shelf.
function RecordRow({ item }) {
  const editionLine =
    item.category === "Book"
      ? [item.bookEdition && `${item.bookEdition} edition`, item.bookPrinting && `${item.bookPrinting} printing`]
          .filter(Boolean)
          .join(" · ")
      : item.edition;

  const meta = [editionLine, item.condition, item.bookGenre].filter(Boolean);

  return (
    <li className="flex items-baseline justify-between gap-4 border-b border-[#eadfcd] px-4 py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="truncate font-medium text-[#201a14]">{item.name || "Untitled item"}</p>
        {item.maker && <p className="truncate text-sm text-[#665746]">{item.maker}</p>}
        {meta.length > 0 && <p className="mt-0.5 truncate text-xs text-[#8a7a64]">{meta.join(" · ")}</p>}
      </div>
      <div className="shrink-0 text-right">
        {/* Only ever the per-item value the owner already chose to publish --
            this view adds no field the cards do not also show. */}
        {item.estimatedValue && (
          <div className="text-sm font-medium tabular-nums text-[#3f352a]">{formatCurrency(item.estimatedValue)}</div>
        )}
        {item.status !== "Owned" && <div className="text-xs text-[#8a7a64]">{statusLabel(item.status)}</div>}
      </div>
    </li>
  );
}

function ToggleButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        active ? "bg-[#123f38] text-[#fff7ea]" : "text-[#665746] hover:bg-white"
      }`}
    >
      {children}
    </button>
  );
}

const selectClass =
  "rounded-full border border-[#d8c7ad] bg-[#fffdf8] px-4 py-2.5 text-sm text-[#3f352a] outline-none transition focus:border-[#123f38] focus:ring-2 focus:ring-[#123f38]/15";

export default function CollectionBrowser({ items }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("added");
  const view = useSyncExternalStore(viewStore.subscribe, viewStore.read, serverView);

  const options = useMemo(() => collectFilterOptions(items), [items]);

  const visible = useMemo(
    () => sortPublicItems(filterPublicItems(items, { query, category, status }), sort),
    [items, query, category, status, sort]
  );

  const filtering = Boolean(query || category || status);
  const showControls = items.length >= MIN_ITEMS_FOR_CONTROLS;

  return (
    <>
      {showControls && (
      <div className="mt-10 flex flex-col gap-3 rounded-[2rem] border border-[#d8c7ad] bg-[#fff9f0] p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Search this collection</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by title, maker, edition…"
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

          <div className="flex items-center gap-1 rounded-full border border-[#d8c7ad] bg-[#fffdf8] p-1">
            <ToggleButton active={view === "cards"} onClick={() => viewStore.write("cards")}>
              Cards
            </ToggleButton>
            <ToggleButton active={view === "records"} onClick={() => viewStore.write("records")}>
              Records
            </ToggleButton>
          </div>
        </div>
      </div>
      )}

      {visible.length === 0 ? (
        <div className="mt-8 rounded-[2rem] border border-[#d8c7ad] bg-[#fff9f0] p-8 text-center shadow-sm">
          <h2 className="text-xl font-semibold">Nothing matches</h2>
          <p className="mx-auto mt-2 max-w-md leading-7 text-[#665746]">
            There is nothing in this collection matching that. Try a different search, or clear the filters.
          </p>
        </div>
      ) : view === "cards" ? (
        <div className={`${showControls ? "mt-8" : "mt-10"} grid gap-6 sm:grid-cols-2 lg:grid-cols-3`}>
          {visible.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <ul className="mt-8 overflow-hidden rounded-[2rem] border border-[#d8c7ad] bg-[#fff9f0] shadow-sm">
          {visible.map((item) => (
            <RecordRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </>
  );
}
