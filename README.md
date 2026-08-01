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

The app's queries filter mutations by row id alone, so Row Level Security
with owner-scoped policies on `inventory_items` is required, not optional --
see `supabase/inventory-items-rls.sql` for the verification query and
enforcement statements. The production project already has this configured
correctly; a fresh project should be checked and, if needed, have that
script run.

Copy `.env.example` to `.env.local` and fill in your Supabase project's URL
and anon key (Project Settings -> API in the Supabase dashboard).
