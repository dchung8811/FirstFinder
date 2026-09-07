# Contributing to FirstFinder

FirstFinder is a free, open-source collectible inventory app, built and paid
for by one collector so other collectors can keep track of what they love.
Contributions of every size are welcome — a typo fix counts.

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to help that aren't code

Not every useful contribution is a pull request:

- **Report a bug.** [Open a bug report](https://github.com/dchung8811/FirstFinder/issues/new?template=bug_report.yml),
  or use **Feedback** inside the app if you'd rather not have a GitHub account.
- **Suggest a feature.** [Open a feature request](https://github.com/dchung8811/FirstFinder/issues/new?template=feature_request.yml).
  The [Roadmap page](https://first-finder.vercel.app) shows what's already planned.
- **Improve the docs.** If setup instructions didn't work for you, that's a bug
  in the docs and worth reporting.
- **Test with a real collection.** Rare books, trading cards, comics, sports
  memorabilia — edge cases in real inventories are the most valuable bug
  reports we get.
- **Help pay for it.** Hosting, storage, database, and the AI identification
  calls cost real money: [buy me a coffee](https://buymeacoffee.com/firstfinder).

## Finding something to work on

Issues labeled [`good first issue`](https://github.com/dchung8811/FirstFinder/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)
are scoped small and don't need much context. [`help wanted`](https://github.com/dchung8811/FirstFinder/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22)
is everything else that's ready for someone to pick up. The **Contribute** page
in the app shows the same lists live.

For anything larger than a bug fix, open an issue first and say what you're
planning. It's a small project with an opinionated design, and a short
conversation beforehand beats a big PR that has to be reworked.

## Local setup

### Prerequisites

- **Node.js 20.9 or newer** and npm (`node -v` to check)
- A **Supabase** account — the free tier is plenty

### 1. Clone and install

```bash
git clone https://github.com/dchung8811/FirstFinder.git
cd FirstFinder
npm install
```

### 2. Create a Supabase project

1. Create a new project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste the entire contents of
   [`supabase/schema.sql`](supabase/schema.sql), and run it. That creates the
   `inventory_items` and `feedback` tables, their Row Level Security policies,
   and the private `item-photos` storage bucket.
3. Under **Authentication → Providers**, leave Email enabled. Google sign-in is
   optional for local development.

The other files in `supabase/` are the incremental patches that produced this
schema, kept for the production database's history. You don't need to run them
on a fresh project.

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Then fill in, from **Project Settings → API** in the Supabase dashboard:

| Variable | Required? | What it's for |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | The app throws on startup without it |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | Same |
| `SUPABASE_SERVICE_ROLE_KEY` | Only for "Delete my account" | Bypasses RLS — server-only, never commit it |
| `OPENAI_API_KEY` | Only for photo identification | Every call is billed to whoever owns the key |
| `OPENAI_MODEL`, `IDENTIFY_DAILY_LIMIT`, `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_APPLE_AUTH_ENABLED` | No | Optional overrides, see `.env.example` |

Everything except photo identification and account deletion works with just the
two Supabase values. `.env.local` is gitignored — keep it that way.

### 4. Run it

```bash
npm run dev
```

Then open <http://localhost:3000>, create an account, and add an item.

## How the code is laid out

```
app/
  InventoryApp.jsx          Nearly the entire UI: nav, pages, modals, data access
  layout.js, page.js        Next.js App Router entry points
  globals.css               Tailwind entry point and font setup
  api/identify-book/        Server route for AI photo identification (OpenAI)
  api/delete-account/       Server route for account + data deletion
  api/contribute/           Server route that reads open issues from GitHub
src/lib/
  supabaseClient.js         Browser client (anon key)
  supabaseAdmin.js          Server-only client (service role key) — never import in a client file
supabase/                   schema.sql plus the incremental patches behind it
```

`app/InventoryApp.jsx` is one large client component with a `activeView` state
variable acting as the router. That's unusual, and it is a deliberate trade for
now — it keeps a solo-maintained project in one file you can read top to bottom.
**Please don't submit a PR that splits it up as its own change.** If a feature
you're building genuinely needs a piece extracted, extract just that piece and
say so in the PR.

## Code style

There's no formatter or linter configured, so the rule is: **match the code
around you.**

- Two-space indentation, double-quoted strings, semicolons.
- Comments explain *why*, not *what*. The existing comments are the model — if a
  decision would surprise the next reader, write down the reason it was made.
- Colors come from the existing palette as Tailwind arbitrary values
  (`bg-[#f6efe3]`, `text-[#123f38]`). Don't introduce a new accent color without
  a reason.
- Keep money nullable-aware: an empty estimate is `null`, not `0`.
- Anything touching the service role key stays server-side. Never import
  `supabaseAdmin.js` from a `"use client"` file, and never prefix a secret with
  `NEXT_PUBLIC_`.

## Before you open a pull request

There's no automated test suite yet, so verification is manual — and CI only
checks that the app builds.

1. `npm run build` passes.
2. The flows your change touches still work in `npm run dev`. At minimum, for
   anything touching inventory: add an item, edit it, mark it sold, restore it,
   delete it.
3. Check it at a phone width — the layout is responsive and the mobile nav is
   easy to break.
4. No secrets, no `.env.local`, no personal collection data in the diff.

Then:

- Branch off `main` (`git checkout -b short-descriptive-name`).
- Write commit messages in the imperative mood, describing the change from a
  user's point of view: "Warn on possible duplicate items when adding new
  inventory".
- Open the PR against `main` and fill in the template. Screenshots or a short
  clip for anything visual, please.
- Link the issue it closes.

Reviews come from one maintainer working on this in spare time. Expect a few
days, and a nudge is fine if it's been longer.

## Reporting a security problem

**Don't open a public issue.** See [SECURITY.md](SECURITY.md) — this app stores
people's home addresses in receipt photos and their collections' values, so
please report privately.

## Licensing of contributions

FirstFinder is licensed under the [GNU AGPL v3](LICENSE). By contributing, you
agree that your contributions are licensed under the same terms. In practice
that means anyone can run and modify FirstFinder, but anyone who runs a modified
version as a public service has to publish their changes too.
