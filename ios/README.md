# FirstFinder iOS prototype

A clickable SwiftUI prototype for reviewing the whole FirstFinder experience on a
phone. It is not the App Store app planned in `docs/ios-app-plan.md`.

It signs in to a real account and **reads** it. It never writes to it: every
add, edit, sale, delete, want, share toggle and feedback submission lands in an
in-memory overlay that is gone when the app quits. `ReadOnlyGuardTests` scans
every file under `ios/` and fails on anything that could write.

## Running it

1. Copy `Config/Secrets.example.xcconfig` to `Config/Secrets.xcconfig` and fill
   in the Supabase URL and anon key from `.env.local`. Write the URL as
   `https:/$()/…`: xcconfig treats `//` as a comment.
2. Open `FirstFinder.xcodeproj`, pick an iPhone simulator and run.

Without `Secrets.xcconfig` the app starts in Sample mode, on invented data.

## Live and Sample

More → Developer switches between them. Sample can also be set to come back
empty or to fail every read, which is how the empty and error states are
reviewed. Screenshots for the repo come from Sample mode only. Live mode
shows a real collection.

## What it keeps

The Supabase session, in the Keychain. Nothing else: no rows, photos or web
pages are written to disk. Offline shows what was last fetched during this
launch.
