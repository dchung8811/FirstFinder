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

Photo uploads need a storage bucket and two columns. Run
`supabase/photo-storage-setup.sql` in the Supabase dashboard SQL Editor once
per project.
