# FirstFinder

FirstFinder is a collectible inventory app for tracking books and other collectibles.

## Current features

- Google login with Supabase Auth
- Add inventory quickly
- Tutorial-style add flow
- View inventory as cards or records
- Active and sold tabs
- Edit items
- Mark sold and restore
- CSV template download and bulk upload
- Cost basis and estimated value tracking
- Sale price/date capture, with realized gain shown once an item is sold
- Category filter on the inventory list
- "Find similar copies" links out to AbeBooks/eBay search results
- Printable collection report for insurance/estate records
- In-app feedback form (logged-in users only) with optional photo attachments
- My Account page: member since, editable name, first collectible loaded
- Delete-account (self-service, permanently removes the account, its data, and its photos)
- About page

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

The app's queries filter mutations by row id alone, so Row Level Security
with owner-scoped policies on `inventory_items` is required, not optional --
see `supabase/inventory-items-rls.sql` for the verification query and
enforcement statements. The production project already has this configured
correctly; a fresh project should be checked and, if needed, have that
script run.

Copy `.env.example` to `.env.local` and fill in your Supabase project's URL
and anon key (Project Settings -> API in the Supabase dashboard).

### Delete-account feature

The "Delete my account" flow (My Account page) needs `SUPABASE_SERVICE_ROLE_KEY`
set -- it calls `app/api/delete-account`, a server-side route that removes
the user's storage photos, `inventory_items` rows, `feedback` rows, and
finally the auth user itself via the Supabase Admin API, which only works
with the service role key (never the anon key). Get the key from Project
Settings -> API -> service_role ("secret"), and set it in `.env.local` for
local dev and in Vercel's environment variables for production. It must
never be prefixed with `NEXT_PUBLIC_` and is never sent to the browser.
