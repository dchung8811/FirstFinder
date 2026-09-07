import { notFound } from "next/navigation";
import { getAllWorks, getVerifiedWorks, getWork, workPath } from "../../../../src/content/books";

const SITE_URL = "https://firstfinder.app";

// Every work gets a static page at build time -- these are search landing
// pages, so there is no reason to render them per request.
export function generateStaticParams() {
  return getAllWorks().map((work) => ({ work: work.slug }));
}

// params is a Promise in Next 16 -- reading it synchronously silently yields
// undefined, which turns every one of these pages into a 404 that still builds
// and still reports as prerendered.
export async function generateMetadata({ params }) {
  const { work: slug } = await params;
  const work = getWork(slug);
  if (!work) return {};

  const title = `How to Identify a First Edition of ${work.title}`;
  const description = work.quickAnswer.slice(0, 200);
  const url = `${SITE_URL}${workPath(work)}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    // The verification gate. A draft page renders so it can be reviewed, but
    // tells search engines to stay away until a person has signed it off.
    robots: work.status === "verified" ? undefined : { index: false, follow: false },
    openGraph: { title, description, url, siteName: "FirstFinder", type: "article" },
    twitter: { card: "summary", title, description }
  };
}

function Section({ title, children }) {
  return (
    <section className="mt-10">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

// Shown on a claim our sources left ambiguous. Saying so is more useful to
// someone holding a book than quietly presenting a guess as settled.
function VerificationNote({ children }) {
  return (
    <p className="mt-2 rounded-2xl bg-[#fff3d8] px-4 py-3 text-sm leading-6 text-[#6d5526]">
      <span className="font-semibold">Needs checking.</span> {children}
    </p>
  );
}

export default async function FirstEditionPage({ params }) {
  const { work: slug } = await params;
  const work = getWork(slug);
  if (!work) notFound();

  const { firstEdition: fe } = work;
  const facts = [
    ["Publisher", fe?.publisher],
    ["Published", fe?.year],
    ["Original price", fe?.originalPrice],
    ["Pages", fe?.pages],
    ["Edition statement", fe?.editionStatement]
  ].filter(([, value]) => value !== undefined && value !== null && value !== "");

  // Verified siblings only: a published page should not hand readers, or
  // crawlers, a link to something still marked draft.
  const others = getVerifiedWorks().filter((entry) => entry.slug !== work.slug);

  // Structured data only for pages a person has verified -- the same gate as
  // indexing. Marking up unchecked claims as authoritative facts would be worse
  // than not marking them up at all.
  const jsonLd =
    work.status === "verified"
      ? {
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: `How to Identify a First Edition of ${work.title}`,
          description: work.quickAnswer,
          url: `${SITE_URL}${workPath(work)}`,
          about: { "@type": "Book", name: work.title, author: { "@type": "Person", name: work.author } },
          step: (work.identificationPoints || []).map((point, index) => ({
            "@type": "HowToStep",
            position: index + 1,
            name: point.label,
            text: point.detail
          }))
        }
      : null;

  return (
    <article className="mx-auto max-w-3xl px-6 pb-4">
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}

      <nav aria-label="Breadcrumb" className="text-sm text-[#746655]">
        <a href="/" className="underline underline-offset-4 hover:text-[#123f38]">FirstFinder</a>
        <span aria-hidden="true"> / </span>
        <a href="/books" className="underline underline-offset-4 hover:text-[#123f38]">Identification guides</a>
        <span aria-hidden="true"> / </span>
        <span>{work.title}</span>
      </nav>

      <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
        How to Identify a First Edition of {work.title}
      </h1>
      <p className="mt-2 text-lg text-[#665746]">{work.author}</p>

      {work.status !== "verified" && (
        <p className="mt-6 rounded-2xl bg-[#fff3d8] px-5 py-4 text-sm leading-6 text-[#6d5526]">
          <span className="font-semibold">Draft.</span> This guide is compiled but not yet checked against a
          reference copy, and is not published to search engines.
        </p>
      )}

      <p className="mt-6 text-lg leading-8">{work.quickAnswer}</p>

      {facts.length > 0 && (
        <Section title="The first edition at a glance">
          <dl className="divide-y divide-[#e0d2bc] rounded-2xl border border-[#d8c7ad] bg-[#fffdf8] px-5">
            {facts.map(([label, value]) => (
              <div key={label} className="flex flex-col gap-1 py-3 sm:flex-row sm:gap-6">
                <dt className="w-44 shrink-0 text-sm font-medium text-[#746655]">{label}</dt>
                <dd className="leading-7">{value}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      {(work.identificationPoints || []).length > 0 && (
        <Section title="Identification checklist">
          <ul className="space-y-5">
            {work.identificationPoints.map((point) => (
              <li key={point.label}>
                <h3 className="font-semibold">{point.label}</h3>
                <p className="mt-1 leading-7 text-[#3d332a]">{point.detail}</p>
                {point.needsVerification && <VerificationNote>{point.needsVerification}</VerificationNote>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(work.notFirstEdition || []).length > 0 && (
        <Section title={`What does not make it a first edition`}>
          <ul className="space-y-5">
            {work.notFirstEdition.map((entry) => (
              <li key={entry.claim}>
                <h3 className="font-semibold">{entry.claim}</h3>
                <p className="mt-1 leading-7 text-[#3d332a]">{entry.why}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(work.variants || []).length > 0 && (
        <Section title="Variants and states">
          <ul className="space-y-5">
            {work.variants.map((variant) => (
              <li key={variant.name}>
                <h3 className="font-semibold">{variant.name}</h3>
                <p className="mt-1 leading-7 text-[#3d332a]">{variant.detail}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(work.value || []).length > 0 && (
        <Section title="What copies sell for">
          <ul className="space-y-4">
            {work.value.map((entry) => (
              <li key={entry.configuration}>
                <span className="font-semibold">{entry.configuration}:</span> {entry.range}
                {entry.note && <span className="text-[#665746]"> — {entry.note}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <section className="mt-12 rounded-[2rem] border border-[#d8c7ad] bg-[#fff9f0] px-6 py-8 shadow-sm sm:px-8">
        <h2 className="text-2xl font-semibold tracking-tight">Think you have one?</h2>
        <p className="mt-3 leading-7 text-[#3d332a]">
          Photograph the cover and the copyright page and FirstFinder will work out the edition and printing, then
          price it against copies that actually sold. What a specific copy is worth depends on its condition and its
          jacket, which is why there is no single number on this page.
        </p>
        <a
          href="/"
          className="mt-6 inline-flex h-12 items-center rounded-full bg-[#123f38] px-7 font-medium text-[#fff7ea] transition hover:bg-[#0f332d]"
        >
          Check your copy
        </a>
      </section>

      {others.length > 0 && (
        <Section title="Other identification guides">
          <ul className="space-y-3">
            {others.map((other) => (
              <li key={other.slug}>
                <a href={workPath(other)} className="font-medium text-[#123f38] underline underline-offset-4">
                  How to identify a first edition of {other.title}
                </a>
                <span className="text-[#665746]"> — {other.author}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(work.sources || []).length > 0 && (
        <Section title="Sources">
          <ul className="space-y-2 text-sm leading-6 text-[#665746]">
            {work.sources.map((source) => (
              <li key={source.id}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[#123f38] underline underline-offset-4"
                >
                  {source.title}
                </a>
                {source.accessedAt && <span> — accessed {source.accessedAt}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </article>
  );
}
