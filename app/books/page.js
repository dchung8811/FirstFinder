import { getVerifiedWorks, getVerifiedWorksByAuthor, workPath } from "../../src/content/books";

const SITE_URL = "https://firstfinder.app";

// Below this many guides, author headings are heavier than the list they
// organise. Above it, a flat list is a wall of titles with no way in.
const GROUP_FROM = 5;

// The hub the footer points at. Without it the guides are orphans: nothing on
// the site links to them, and search engines find pages mainly by following
// links, so a sitemap entry alone gets crawled slowly and ranked poorly.
export const metadata = {
  title: "First edition identification guides",
  description:
    "How to tell whether a book is a true first edition — publisher, edition statement, binding, jacket and issue points, compiled from published references.",
  alternates: { canonical: `${SITE_URL}/books` }
};


// One entry, shared by the flat and grouped layouts so they cannot drift.
function GuideCard({ work }) {
  return (
    <li>
      <a
        href={workPath(work)}
        className="block rounded-[1.5rem] border border-[#d8c7ad] bg-[#fff9f0] px-6 py-5 transition hover:bg-[#fffdf8]"
      >
        <h3 className="text-xl font-semibold">{work.title}</h3>
        <p className="mt-1 text-sm text-[#746655]">
          {work.author}
          {work.firstEdition?.publisher ? ` · ${work.firstEdition.publisher}` : ""}
          {work.firstEdition?.year ? `, ${work.firstEdition.year}` : ""}
        </p>
        <p className="mt-3 leading-7 text-[#3d332a]">{work.quickAnswer}</p>
      </a>
    </li>
  );
}

export default function BooksIndexPage() {
  // Only verified guides. Drafts carry noindex, and linking to them from an
  // indexable hub would undercut that.
  const works = getVerifiedWorks();
  // Grouped by author once there is enough here for a flat list to stop
  // helping. Below the threshold the headings are just noise over a short list.
  const groups = getVerifiedWorksByAuthor();
  const grouped = works.length >= GROUP_FROM;

  return (
    <section className="mx-auto max-w-3xl px-6 pb-4">
      <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
        First edition identification guides
      </h1>
      <p className="mt-6 text-lg leading-8 text-[#665746]">
        How to tell whether a copy is a true first edition — the edition statement, the binding, the jacket, and the
        issue points that separate a first printing from everything that followed. Each guide is compiled from published
        references and checked by hand before it goes up.
      </p>

      {works.length === 0 ? (
        <p className="mt-10 rounded-2xl bg-[#fff3d8] px-5 py-4 leading-7 text-[#6d5526]">
          No guides are published yet. They are being written and checked one at a time.
        </p>
      ) : (
        grouped ? (
          <div className="mt-10 space-y-10">
            {groups.map((group) => (
              <section key={group.author}>
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-[#746655]">{group.author}</h2>
                <ul className="mt-4 space-y-4">
                  {group.works.map((work) => (
                    <GuideCard key={work.slug} work={work} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <ul className="mt-10 space-y-4">
            {works.map((work) => (
              <GuideCard key={work.slug} work={work} />
            ))}
          </ul>
        )
      )}

      <section className="mt-12 rounded-[2rem] border border-[#d8c7ad] bg-[#fff9f0] px-6 py-8 shadow-sm sm:px-8">
        <h2 className="text-2xl font-semibold tracking-tight">Not the book you're holding?</h2>
        <p className="mt-3 leading-7 text-[#3d332a]">
          Photograph the cover and the copyright page and FirstFinder will work out the edition and printing for any
          title, then price it against copies that actually sold.
        </p>
        <a
          href="/"
          className="mt-6 inline-flex h-12 items-center rounded-full bg-[#123f38] px-7 font-medium text-[#fff7ea] transition hover:bg-[#0f332d]"
        >
          Check your copy
        </a>
      </section>
    </section>
  );
}
