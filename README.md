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

Run both of these once per Supabase project, in the dashboard's SQL Editor:

- `supabase/photo-storage-setup.sql` -- adds the photo storage bucket and columns.
- `supabase/inventory-items-rls.sql` -- enables Row Level Security so a
  signed-in user can only read or write their own inventory rows. The app's
  queries filter by row id alone, so this is required, not optional.

Copy `.env.example` to `.env.local` and fill in your Supabase project's URL
and anon key (Project Settings -> API in the Supabase dashboard).
