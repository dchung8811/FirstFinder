import Link from "next/link";
import AdminDashboard from "./AdminDashboard";

// noindex belongs here as well as in robots.txt, and the two do different jobs.
// robots.txt asks crawlers not to fetch the page; this tells the ones that
// reach it anyway (from a link, a referrer, a shared URL) not to index it.
// Blocking the crawl alone can leave a URL listed from inbound links, because
// the crawler is never allowed to read the noindex that would have kept it out
// -- the same reasoning app/robots.js sets out for /c/ pages.
export const metadata = {
  title: "Admin · FirstFinder",
  robots: { index: false, follow: false }
};

// The gate lives in the API route, not here. This page renders for anyone who
// visits; it just has nothing to show them, because every number it displays
// comes from a fetch that checks the caller's token against the admin
// allowlist. Guarding the page instead would be the weaker arrangement -- the
// data would still be one unguarded request away, and the real protection has
// to sit where the data is.
export default function AdminPage() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:px-6">
      <header>
        <Link href="/" className="text-sm font-medium text-[#123f38] underline underline-offset-4">
          ← Back to the app
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[#201a14] sm:text-3xl">Admin</h1>
        <p className="mt-2 text-sm leading-6 text-[#665746]">
          Platform totals and the limits worth watching. Aggregates only — this page never reads anyone&apos;s items,
          names, or email addresses.
        </p>
      </header>
      <AdminDashboard />
    </main>
  );
}
