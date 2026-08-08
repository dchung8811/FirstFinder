# FirstFinder

FirstFinder is a collectible inventory app for tracking books and other collectibles.

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
- Send feedback from inside the app when logged in, with optional photo attachments.
- Measure key product interactions with Google Analytics events.

## Tech stack

- Next.js
- React
- Tailwind CSS
- Supabase Auth
- Supabase database
- Supabase Storage for item and receipt photos

## One-time setup

Run these once per Supabase project, in the dashboard's SQL Editor:

- `supabase/photo-storage-setup.sql` -- adds the photo storage bucket and columns.
- `supabase/ux-batch-fields.sql` -- adds sold price/date, prior-status-on-restore, and Book-specific detail columns; also makes estimated_value nullable.
- `supabase/feedback-table.sql` -- creates the `feedback` table (with its own RLS policies) used by the logged-in "Send feedback" page. Feedback photos reuse the existing item-photos storage bucket, so no new bucket setup is needed.
- `supabase/condition-field.sql` -- adds the `condition` column used by the Condition field.
- `supabase/reference-number.sql` -- adds the `reference_number` column (shown as FF-0001), backfills existing rows, and adds the unique per-user index. Required by the CSV bulk edit/delete tool, which matches rows on this number.

The app's queries filter mutations by row id alone, so Row Level Security
with owner-scoped policies on `inventory_items` is required, not optional --
see `supabase/inventory-items-rls.sql` for the verification query and
enforcement statements. The production project already has this configured
correctly; a fresh project should be checked and, if needed, have that
script run.

Copy `.env.example` to `.env.local` and fill in your Supabase project's URL
and anon key (Project Settings -> API in the Supabase dashboard).

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
