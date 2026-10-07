import { notFound } from "next/navigation";
import { featureGuides, getGuide, guidePath } from "../../../src/content/featureGuides";
import { features } from "../../../src/content/features";
import { formatFeatureDate } from "../../../src/utils/features";

const SITE_URL = "https://firstfinder.app";

// Static at build time: the guides are content in the repo, not data.
export function generateStaticParams() {
  return featureGuides.map((guide) => ({ slug: guide.slug }));
}

// params is a Promise in Next 16 -- see app/books/[work]/first-edition/page.js
// for what reading it synchronously does.
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return {};

  const url = `${SITE_URL}${guidePath(guide)}`;
  return {
    title: guide.title,
    description: guide.summary,
    alternates: { canonical: url },
    openGraph: { title: guide.title, description: guide.summary, url, siteName: "FirstFinder", type: "article" },
    twitter: { card: "summary", title: guide.title, description: guide.summary }
  };
}

// Screens are framed by shape: a phone capture sits in a narrow column so it
// reads at the size it was taken, and a desktop one gets the full width.
function Shot({ image }) {
  const phone = image.kind === "phone";
  return (
    <figure className={phone ? "mx-auto max-w-[300px]" : ""}>
      <img
        src={image.src}
        alt={image.alt}
        width={image.width}
        height={image.height}
        loading="lazy"
        className={`h-auto w-full border border-[#d8c7ad] bg-white shadow-sm ${phone ? "rounded-[1.75rem]" : "rounded-2xl"}`}
      />
      {image.caption && <figcaption className="mt-2 text-center text-sm text-[#746655]">{image.caption}</figcaption>}
    </figure>
  );
}

export default async function FeatureGuidePage({ params }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const entry = features.find((feature) => feature.guide === guide.slug);
  const others = featureGuides.filter((other) => other.slug !== guide.slug);

  return (
    <article className="mx-auto max-w-4xl px-6 pb-4">
      <a href="/" className="text-sm font-medium text-[#123f38] underline underline-offset-4">
        ← FirstFinder
      </a>
      <div className="mt-6 font-mono text-xs uppercase tracking-[0.2em] text-[#8a7a64]">
        Feature guide{entry ? ` · Live since ${formatFeatureDate(entry.date)}` : ""}
      </div>
      <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">{guide.title}</h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-[#665746]">{guide.summary}</p>

      {guide.video && (
        <figure className="mt-10">
          <video
            src={guide.video.src}
            poster={guide.video.poster}
            controls
            playsInline
            preload="none"
            className="w-full rounded-2xl border border-[#d8c7ad] bg-black shadow-sm"
          />
          {guide.video.caption && <figcaption className="mt-2 text-center text-sm text-[#746655]">{guide.video.caption}</figcaption>}
        </figure>
      )}

      {guide.why && (
        <section className="mt-12">
          <h2 className="text-2xl font-semibold tracking-tight">Why it's useful</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {guide.why.map((point) => (
              <li key={point} className="rounded-2xl border border-[#e0d2bc] bg-[#fffdf8] px-5 py-4 leading-7 text-[#3d332a]">
                {point}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12">
        <h2 className="text-2xl font-semibold tracking-tight">How to use it</h2>
        <ol className="mt-6 grid gap-12">
          {guide.steps.map((step, index) => (
            <li key={step.title} className="grid gap-5 md:grid-cols-[1fr_1fr] md:items-start">
              <div>
                <div className="flex items-baseline gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#123f38] text-sm font-semibold text-[#fff7ea]">
                    {index + 1}
                  </span>
                  <h3 className="text-xl font-semibold">{step.title}</h3>
                </div>
                <p className="mt-3 leading-7 text-[#3d332a]">{step.body}</p>
              </div>
              {step.image ? <Shot image={step.image} /> : <div className="hidden md:block" />}
            </li>
          ))}
        </ol>
      </section>

      {guide.tips && (
        <section className="mt-14 rounded-[1.5rem] bg-[#fbf5e9] p-6">
          <h2 className="text-xl font-semibold tracking-tight">Good to know</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 leading-7 text-[#3d332a]">
            {guide.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-12 flex flex-wrap items-center gap-4">
        <a href="/" className="rounded-full bg-[#123f38] px-6 py-3 text-sm font-medium text-[#fff7ea] hover:bg-[#0f332d]">
          Try it in FirstFinder
        </a>
      </div>

      <nav className="mt-14 border-t border-[#e0d2bc] pt-8" aria-label="More feature guides">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[#746655]">More guides</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {others.map((other) => (
            <li key={other.slug}>
              <a href={guidePath(other)} className="block rounded-2xl border border-[#d8c7ad] bg-[#fff9f0] px-5 py-4 transition hover:bg-[#fffdf8]">
                <span className="block font-semibold">{other.title}</span>
                <span className="mt-1 block text-sm leading-6 text-[#665746]">{other.summary}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </article>
  );
}
