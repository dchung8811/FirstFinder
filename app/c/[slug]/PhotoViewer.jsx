"use client";

import { useCallback, useEffect } from "react";

// A full-size look at one item's photos on a shared collection page.
//
// Cards are thumbnails, and a thumbnail of a book is mostly a guess about its
// condition. This is where a visitor actually looks at the copy -- the whole
// reason someone opens a collection page they were sent.
//
// It renders the signed URLs the server already produced. There is no fetching
// here and no path handling: the page decided which photos a visitor may see
// long before this component existed, and it cannot widen that.

export default function PhotoViewer({ item, index, onIndex, onClose }) {
  const photos = item?.photoUrls || [];
  const count = photos.length;

  const step = useCallback(
    (delta) => {
      if (count < 2) return;
      // Wraps, so paging never dead-ends on the last photo -- with two or three
      // photos, running off the end and stopping feels like a broken control.
      onIndex((index + delta + count) % count);
    },
    [count, index, onIndex]
  );

  // Escape closes, arrows page. A lightbox that traps someone until they find
  // a small × is the classic version of this getting it wrong.
  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, step]);

  // The page behind must not scroll while this is open, or a phone drags the
  // collection around underneath the photo.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  if (!item || count === 0) return null;
  const current = photos[Math.min(index, count - 1)];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Photos of ${item.name || "this item"}`}
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#201a14]/90 p-4 sm:p-8"
    >
      <div className="flex w-full max-w-4xl items-start justify-between gap-4 pb-3">
        <div className="min-w-0 text-[#fff7ea]">
          <div className="truncate text-lg font-semibold">{item.name || "Untitled item"}</div>
          {item.maker && <div className="truncate text-sm text-[#fff7ea]/70">{item.maker}</div>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close photo viewer"
          className="shrink-0 rounded-full bg-[#fff7ea]/15 p-2.5 text-[#fff7ea] transition hover:bg-[#fff7ea]/25"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      {/* Stops a click on the photo itself from closing, while a click on the
          backdrop still does -- the behaviour everyone already expects. */}
      <div onClick={(event) => event.stopPropagation()} className="relative flex w-full max-w-4xl items-center justify-center">
        <img
          src={current}
          alt={item.name ? `${item.name} — photo ${index + 1} of ${count}` : `Photo ${index + 1} of ${count}`}
          className="max-h-[70vh] w-auto max-w-full rounded-2xl object-contain"
        />

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous photo"
              className="absolute left-2 rounded-full bg-[#201a14]/60 p-3 text-[#fff7ea] transition hover:bg-[#201a14]/80"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next photo"
              className="absolute right-2 rounded-full bg-[#201a14]/60 p-3 text-[#fff7ea] transition hover:bg-[#201a14]/80"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="pt-3 text-sm text-[#fff7ea]/70">
          {index + 1} of {count}
        </div>
      )}
    </div>
  );
}
