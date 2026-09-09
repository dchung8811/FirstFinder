"use client";

import { formatCurrency } from "../../../src/utils/format";
import { itemCredit } from "../../../src/utils/items";

// The card, the chip, and the detail row a shared collection page is built
// from.
//
// These are client components because the page's item grid is now filtered and
// re-laid-out in the browser, and a server component cannot be handed to a
// client one as a render function. Nothing here is interactive and nothing
// fetches: they render props the server already vetted through
// buildPublicItem, which is what makes moving them across the boundary safe.
// Chip is imported back into the server page for its header.

export function Chip({ children, tone = "neutral" }) {
  const tones = {
    neutral: "bg-[#f0e2cf] text-[#665746]",
    green: "bg-[#edf4f2] text-[#123f38]",
    amber: "bg-[#fff3d8] text-[#6d5526]"
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

function DetailRow({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-[#eadfcd] pt-2">
      <span className="text-xs uppercase tracking-[0.14em] text-[#8a7a64]">{label}</span>
      <span className="text-right text-sm font-medium text-[#3f352a]">{children}</span>
    </div>
  );
}

export function ItemCard({ item, onViewPhotos }) {
  // "First / First" reads the way collectors say it; either half alone still
  // needs its noun, so a lone printing doesn't render as a bare "Second".
  const editionLine =
    item.category === "Book"
      ? [item.bookEdition && `${item.bookEdition} edition`, item.bookPrinting && `${item.bookPrinting} printing`].filter(Boolean).join(" · ")
      : item.edition;

  const hasDetails = item.estimatedValue || item.purchasePrice || item.soldPrice || item.purchaseDate || item.source || item.notes;

  return (
    <article className="overflow-hidden rounded-[2rem] border border-[#d8c7ad] bg-[#fff9f0] shadow-sm">
      {/* A plain <img>, not next/image: these are short-lived signed URLs
          into a private Supabase bucket, and routing them through the image
          optimizer would cache copies of private photos outside it.

          loading="lazy" matters more here than it looks. A large shelf is
          hundreds of cards, and every one of these is a separate request to
          Supabase storage -- eagerly, that is the whole page's load time. The
          fixed h-56 means the box is reserved before the image arrives, so
          deferring costs no layout shift. */}
      {item.photoUrl ? (
        /* A card photo is a thumbnail of a book, which is mostly a guess about
           its condition -- so it opens. A button rather than a wrapping div,
           because this is a real control and has to be reachable by keyboard. */
        <button
          type="button"
          onClick={() => onViewPhotos?.(item)}
          aria-label={`View photos of ${item.name || "this item"}`}
          className="group relative block w-full cursor-zoom-in"
        >
          <img
            src={item.photoUrl}
            alt={item.name || "Collection item"}
            loading="lazy"
            decoding="async"
            className="h-56 w-full bg-[#f0e2cf] object-cover"
          />
          {item.photoUrls?.length > 1 && (
            <span className="absolute bottom-3 right-3 rounded-full bg-[#201a14]/70 px-2.5 py-1 text-xs font-medium text-[#fff7ea]">
              {item.photoUrls.length} photos
            </span>
          )}
        </button>
      ) : (
        <div className="flex h-56 w-full items-center justify-center bg-[#f0e2cf] text-sm text-[#8a7a64]">No photo</div>
      )}

      <div className="p-5">
        <h2 className="text-xl font-semibold leading-tight">{item.name || "Untitled item"}</h2>
        {itemCredit(item) && <p className="mt-1 text-sm text-[#665746]">{itemCredit(item)}</p>}

        <div className="mt-3 flex flex-wrap gap-2">
          {editionLine && <Chip tone="green">{editionLine}</Chip>}
          {item.condition && <Chip>{item.condition}</Chip>}
          {item.bookGenre && <Chip>{item.bookGenre}</Chip>}
          {item.status === "For sale" && <Chip tone="amber">For sale</Chip>}
          {item.status === "Sold" && <Chip tone="amber">Sold</Chip>}
          {item.status === "Wishlist" && <Chip tone="amber">Wanted</Chip>}
          {/* That a receipt exists, never the receipt itself -- see the
              comment on buildPublicItem for why this is a badge and not an
              image. */}
          {item.hasReceipt && <Chip>Receipt on file</Chip>}
        </div>

        {hasDetails && (
          <div className="mt-4 flex flex-col gap-2">
            {item.estimatedValue && <DetailRow label="Est. value">{formatCurrency(item.estimatedValue)}</DetailRow>}
            {item.purchasePrice && <DetailRow label="Paid">{formatCurrency(item.purchasePrice)}</DetailRow>}
            {item.soldPrice && <DetailRow label="Sold for">{formatCurrency(item.soldPrice)}</DetailRow>}
            {item.purchaseDate && <DetailRow label="Acquired">{item.purchaseDate}</DetailRow>}
            {item.source && <DetailRow label="Source">{item.source}</DetailRow>}
            {item.notes && (
              <div className="border-t border-[#eadfcd] pt-2">
                <div className="text-xs uppercase tracking-[0.14em] text-[#8a7a64]">Notes</div>
                <p className="mt-1 whitespace-pre-line text-sm leading-6 text-[#3f352a]">{item.notes}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
