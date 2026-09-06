# FirstFinder

**A free, open-source catalog for people who collect things.** Photograph a
book, and its title, edition, printing, condition, and a search-grounded value
range come back filled in. Keep receipts, purchase prices, and current values in
one place instead of the spreadsheet that got away from you.

Built for the collector with forty books, not the shop with four thousand.
FirstFinder is for hobbyists and avid collectors — the people who remember how
they found each piece. It is deliberately **not** a dealer tool: no invoicing,
no consignment, no point of sale, no shared team accounts. If you run a
bookshop, you want something else.

[![License: AGPL v3](https://img.shields.io/badge/license-AGPL--3.0-123f38.svg)](LICENSE)
[![CI](https://github.com/dchung8811/FirstFinder/actions/workflows/ci.yml/badge.svg)](https://github.com/dchung8811/FirstFinder/actions/workflows/ci.yml)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-123f38.svg)](CONTRIBUTING.md)

**[Use it free at first-finder.vercel.app →](https://first-finder.vercel.app)**

Built for rare books first, and equally at home with comics, manuscripts,
trading cards, and sports memorabilia.

## Open source, and free to stay that way

FirstFinder is a passion project, self-funded and released under the
[AGPL-3.0](LICENSE). You can read every line, run your own copy, and send
changes back. The **Contribute** page in the app is the front door: it links the
source, the setup guide, and the issues that are ready for someone to pick up.

- **Want to help?** Start with [CONTRIBUTING.md](CONTRIBUTING.md), or browse
  [good first issues](https://github.com/dchung8811/FirstFinder/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22).
- **Found a bug?** [Open an issue](https://github.com/dchung8811/FirstFinder/issues/new/choose).
- **Found a security problem?** Report it privately — see [SECURITY.md](SECURITY.md).
- **Want to help pay the hosting bill?** [Buy me a coffee](https://buymeacoffee.com/firstfinder).

## Quick start

Requires Node.js 20.9+ and a free Supabase project.

```bash
git clone https://github.com/dchung8811/FirstFinder.git
cd FirstFinder
npm install
cp .env.example .env.local   # then fill in your Supabase URL and anon key
npm run dev
```

Create the database by pasting [`supabase/schema.sql`](supabase/schema.sql) into
the Supabase dashboard's **SQL Editor → New query → Run**. That one file creates
both tables, their Row Level Security policies, and the private photo bucket.

The full walkthrough — including what each environment variable is for and which
ones you can skip — is in [CONTRIBUTING.md](CONTRIBUTING.md#local-setup).

## Current features

### Accounts and navigation

- Sign in with Google or with an email and password through Supabase Auth.
- Create an account, reset a forgotten password, and stay signed in across sessions.
- Use the responsive desktop or mobile navigation, with clear in-app success, warning, and error notifications.
- Manage a profile from **My Account**, including the display name, member-since date, and first-collectible date.
- Permanently delete an account and its associated inventory, feedback, and stored photos without contacting support.

### Cataloging and photos

- Identify a collectible from a photo: take a picture, and the title, maker, edition, printing, and condition are filled in for review, alongside a web-search-grounded value range backed by comparable sales and their sources. Add a copyright page or number line photo and re-check for a more confident edition read. Cost basis is deliberately left blank, and the photo is attached to the saved record.
- Add a collectible through either a fast **Quick Add** form or a guided, tutorial-style flow.
- Track books, trading cards, sports memorabilia, and other collectible categories.
- Record an item's title, creator or maker, edition, status, condition (Near Fine/Fine, Very Good/Good, Fair, Poor), purchase date, source, purchase price, estimated value, and notes.
- Capture book-specific genre, edition, and printing details.
- Upload item and receipt photos, view uncropped full images, and add or remove photos while editing an existing item.
- Store photos privately in Supabase Storage, with browser-side compression to keep uploads manageable.
- Protect destructive and duplicate actions with delete confirmation and in-progress submission states.

### Inventory management and valuation

- See a Dashboard of holdings: most expensive item held and sold, total value held and sold, and acquisitions and sales over time by both volume and dollar amount.
- Browse **My Collection** in card or record view, search across item details, and filter by category, genre, edition, and printing.
- Switch between active and sold inventory, with item counts and totals scoped to the selected view.
- Edit or delete entries, mark items as sold, and restore sold items to their previous status.
- Edit names, makers, categories, statuses, and amounts inline in record view without opening the edit modal.
- Track total cost basis and estimated value for active items.
- Capture the sold price and sold date from the sell action, edit form, Quick Add flow, guided flow, or CSV import.
- Show realized gain for sold collectibles using the actual sale price rather than the previous estimate.
- Open targeted AbeBooks and eBay searches from **Find similar copies**; book searches include edition and printing details for more relevant comparisons.

### Importing, exporting, and reporting

- Download a CSV template and bulk-import inventory with validation and useful error messages.
- Bulk edit and bulk delete by re-uploading an exported CSV: rows are matched on their reference number (FF-0001), a `delete` column removes items, and a preview shows exactly what will be added, changed, and removed before anything is saved.
- Import sale information and book-specific genre, edition, and printing fields.
- Create a printer-friendly active-collection report with photo counts and financial totals, or save it as a PDF for insurance and estate records.

### Product pages and feedback

- Explore the collector-focused home page and learn more about the project on the **About** page.
- Review shipped, planned, and longer-term work on the **Now / Next / Later Roadmap**.
- Open the **Contribute** page to read the source, run it locally, and pick up the `good first issue` and `help wanted` lists, read live from GitHub.
- Send feedback from inside the app when logged in, with optional photo attachments.
- Measure key product interactions with Google Analytics events.

## Tech stack

- Next.js
- React
- Tailwind CSS
- Supabase Auth
- Supabase database
- Supabase Storage for item and receipt photos

## Database setup

A fresh Supabase project needs one file: [`supabase/schema.sql`](supabase/schema.sql).
Paste it into the dashboard's SQL Editor and run it. It is idempotent and safe to
re-run, and it creates:

- `inventory_items` and `feedback`, with owner-only Row Level Security policies
- the unique per-user index behind the `FF-0001` reference numbers
- the private `item-photos` storage bucket and its per-user access policies

The other files in `supabase/` are the incremental patches that built this schema
up over time. They exist for the production database's history and don't need to
be run on a new project. When you change the schema, update `schema.sql` **and**
add a new patch file, so fresh setups and existing databases stay in step.

Row Level Security is not optional. The app's queries filter mutations by row id
alone, so owner-scoped policies on `inventory_items` are the only thing keeping
one collector's data away from another — `supabase/inventory-items-rls.sql` has
the verification query for checking an existing project.

Copy `.env.example` to `.env.local` and fill in your Supabase project's URL and
anon key (Project Settings -> API in the Supabase dashboard).

## Server routes

Some features run server-side because they need keys that must never reach the
browser. The app runs fine without those keys — those features are simply
unavailable until you set them.

### Photo identification

The "take a picture and fill in the fields" flow needs `OPENAI_API_KEY` set --
it calls `app/api/identify-book`, a server-side route that sends the photo(s)
to OpenAI's Responses API with the `web_search` tool enabled and returns
structured fields. The key is read only on the server and must never be
prefixed with `NEXT_PUBLIC_`. `OPENAI_MODEL` optionally overrides the model
(must support `web_search`; defaults to `gpt-5.5`).

Valuation is grounded in live search results, not the model's own training
knowledge: it identifies the exact edition/printing from visible evidence
first, searches for comparable sales, prefers sold/auction results over
asking prices, and returns a value range plus the comparables and source URLs
it used rather than a single invented number. Users can add a copyright page,
number line, or ISBN photo on the review screen and re-check for a more
confident edition/printing read.

Every identification is a paid, search-grounded API call -- meaningfully more
expensive than a plain vision request -- so the route verifies the caller's
Supabase session before spending anything, caps image size and count, and
throttles per user (a few seconds between calls, `IDENTIFY_DAILY_LIMIT` per
day, default 10). That throttle lives in process memory, which on serverless
means per-instance -- it stops runaway retries but is not a hard spend cap.
The real cap is a prepaid credit balance with auto-recharge off on the OpenAI
account; a persisted per-user counter is worth adding before the app has many
users.

Values returned by this flow are model estimates from a single photograph, not
appraisals, and the review screen says so.

### Delete-account feature

The "Delete my account" flow (My Account page) needs `SUPABASE_SERVICE_ROLE_KEY`
set -- it calls `app/api/delete-account`, a server-side route that removes
the user's storage photos, `inventory_items` rows, `feedback` rows, and
finally the auth user itself via the Supabase Admin API, which only works
with the service role key (never the anon key). Get the key from Project
Settings -> API -> service_role ("secret"), and set it in `.env.local` for
local dev and in Vercel's environment variables for production. It must
never be prefixed with `NEXT_PUBLIC_` and is never sent to the browser.

### Feedback to GitHub issues

The in-app feedback form writes to the `feedback` table, and
`app/api/feedback-intake` triages each submission and files it as a GitHub issue
as it arrives. There is no review step and no admin screen.

Issues quote the user's report first, then a clearly-marked machine-written
triage — type, severity, area, a suggested approach naming real files in this
repo, open questions, and possible duplicates among the currently open issues.
The footer says which half is which and never implies a maintainer read it.

Two kinds of submission are not filed. They stay in the `feedback` table with a
`triage_status` saying why, readable in the Supabase table editor:

- **Not actionable** — greetings, test submissions, kind words. Marked
  `dismissed`.
- **Still looks personal after redaction** — the issue would be public and
  permanently indexed, and nobody is going to read it first. Left `triaged`,
  with the triage stored, so it can be filed by hand if it's worth it.

Anything that fails to file, or is past the per-user rate limit, stays there too.

Before a submission is filed or even sent to the model, the pipeline:

- **Masks personal details.** Emails, phone numbers, street addresses, and
  card-like numbers are replaced. ISBNs survive, since they're the most useful
  thing a user can give you about a book.
- **Treats the feedback as untrusted.** It's text a stranger wrote. The triage
  prompt says so, and instructions embedded in feedback get reported rather than
  followed. The model's label choices are filtered against an allowlist and its
  duplicate references against the issues actually open, so neither can invent
  repository state.
- **Keeps screenshots private.** Attached photos stay in the private storage
  bucket. The issue notes they exist; it doesn't publish them.
- **Never publishes who sent it.** The user id is never selected by the route.

Set `GITHUB_TOKEN` (write access to issues) and `OPENAI_API_KEY` and filing is
on. `FEEDBACK_AUTO_FILE=false` turns it off; `FEEDBACK_AUTO_FILE_DAILY_LIMIT`
(default 5) caps how many issues one person can file in 24 hours.
`GITHUB_PROJECT_NUMBER` optionally adds new issues to a project board.

## Project structure

```
app/
  InventoryApp.jsx          Nearly the entire UI: nav, pages, modals, data access
  layout.js, page.js        Next.js App Router entry points
  api/identify-book/        AI photo identification (OpenAI, server-only key)
  api/delete-account/       Account and data deletion (service role key)
  api/contribute/           Open GitHub issues, for the in-app Contribute page
  api/feedback-intake/      Triages feedback on submit and files it as an issue
src/lib/                    Supabase browser and admin clients, shared constants
supabase/                   schema.sql plus the incremental patches behind it
.github/                    Issue and PR templates, CI, Dependabot
```

## Contributing

Pull requests are welcome, and so are bug reports, feature ideas, and doc fixes
from people who never touch the code. Read [CONTRIBUTING.md](CONTRIBUTING.md)
first — it covers local setup, the house style, and what to verify before
opening a PR. Everyone taking part agrees to the
[Code of Conduct](CODE_OF_CONDUCT.md).

## Security

Please report vulnerabilities privately rather than in a public issue. See
[SECURITY.md](SECURITY.md).

## License

[GNU Affero General Public License v3.0](LICENSE).

You are free to use, study, modify, and share FirstFinder. If you run a modified
version as a service other people can reach over a network, the AGPL requires
you to offer them the source of your version too. That's the point: it keeps
FirstFinder, and anything built from it, open for collectors.
