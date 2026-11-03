# FirstFinder for iOS

The FirstFinder iPhone app, in SwiftUI, on the same Supabase project and
`/api/v1` routes as the website. It is on its way from a prototype to the App
Store; `docs/ios-launch-plan.md` has what's left.

It reads and saves a collector's own collection the way the website does:
`Logic/Writes.swift` builds every save exactly as `app/InventoryApp.jsx` would,
and `Stores/LiveStore.swift` is the only file that sends one. `WriteGuardTests`
scans every file under `ios/` and fails on a write from anywhere else, to any
table or function not on its list, to any site path outside `/api/v1`, or on any
trace of the service role key.

## Running it

1. Copy `Config/Secrets.example.xcconfig` to `Config/Secrets.xcconfig` and fill
   in the Supabase URL and anon key from `.env.local`. Write the URL as
   `https:/$()/…`: xcconfig treats `//` as a comment.
2. Open `FirstFinder.xcodeproj`, pick an iPhone simulator and run.

Without `Secrets.xcconfig` the app starts in Sample mode, on invented data.

**Test saves on a test account, never a real collection.** Live mode saves to
whichever account is signed in.

## Live and Sample

More → Developer switches between them. Sample saves in memory, for demos and
App Store screenshots, and shows a "Sample data" strip so it can't be mistaken
for a real collection. It can also be set to come back empty or to fail every
read and write, which is how the empty and error states are reviewed.
Screenshots for the repo and the App Store come from Sample mode only.

## What it keeps

The Supabase session, in the Keychain. Photos picked but not yet saved are
held in memory until they upload. Nothing else is written to disk yet; the
encrypted offline cache is still to come. Offline shows what was last fetched
during this launch, and saving needs a connection.
