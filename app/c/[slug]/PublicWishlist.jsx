import { jacketOptions, signatureOptions } from "../../../src/utils/wishlist";

// The wishlist section of a shared collection page.
//
// A server component: it renders text the server already vetted through
// buildPublicWant, has no state and no interactivity, so there is no reason
// for it to reach the browser as JavaScript.
//
// What is NOT here is the point of the whole feature. No maximum price, no
// priority. Both were withheld two layers below this -- never selected in SQL,
// never emitted by buildPublicWant -- so there is no prop to render even by
// mistake. See the comment on buildPublicWant for why "grail" is as much a
// negotiating signal as a dollar figure.

function wantedSinceLabel(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

// The spec, in the order a collector would judge a copy: edition first, since
// it rules more copies out than anything else, then the physical requirements.
function criteriaFor(want) {
  const chips = [];

  const edition = [
    want.wantedEdition && `${want.wantedEdition} edition`,
    want.wantedPrinting && `${want.wantedPrinting} printing`
  ]
    .filter(Boolean)
    .join(" · ");
  if (edition) chips.push({ text: edition, green: true });

  if (want.publisher) chips.push({ text: want.publisher, green: true });

  const jacket = jacketOptions.find((option) => option.value === want.jacketRequirement)?.short;
  if (jacket) chips.push({ text: jacket, green: false });

  if (want.minCondition) chips.push({ text: `${want.minCondition} or better`, green: false });

  const signature = signatureOptions.find((option) => option.value === want.signatureRequirement)?.short;
  if (signature) chips.push({ text: signature, green: true });

  return chips;
}

export default function PublicWishlist({ wants }) {
  if (!wants || wants.length === 0) return null;

  return (
    <section className="mt-16 border-t border-[#e0d2bc] pt-12">
      <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">Still looking for</h2>
      <p className="mt-4 max-w-2xl text-lg leading-8 text-[#665746]">
        {wants.length === 1 ? "One copy" : `${wants.length} copies`}, described exactly. If you have one, or see one, you
        know what would make it a yes.
      </p>

      <div className="mt-8 flex flex-col gap-4">
        {wants.map((want) => {
          const chips = criteriaFor(want);
          const since = wantedSinceLabel(want.wantedSince);

          return (
            <article key={want.id} className="rounded-[2rem] border border-[#d8c7ad] bg-[#fff9f0] p-6 shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-xl font-semibold leading-tight">{want.name || "Untitled"}</h3>
                  {want.maker && <p className="mt-1 text-[15px] text-[#665746]">{want.maker}</p>}
                </div>
                {since && (
                  <span className="shrink-0 rounded-full bg-[#f0e2cf] px-3 py-1 text-xs font-medium text-[#665746]">
                    Wanted since {since}
                  </span>
                )}
              </div>

              {chips.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {chips.map((chip) => (
                    <span
                      key={chip.text}
                      className={`rounded-full px-3 py-1.5 text-[13px] font-medium ${
                        chip.green ? "bg-[#edf4f2] text-[#123f38]" : "bg-[#f0e2cf] text-[#665746]"
                      }`}
                    >
                      {chip.text}
                    </span>
                  ))}
                </div>
              )}

              {want.notes && (
                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#665746]">{want.notes}</p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
