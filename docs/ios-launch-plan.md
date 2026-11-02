# FirstFinder for iOS — from prototype to App Store

`docs/ios-app-plan.md` is the original build plan. Since it was written, the
read-only prototype on `ios-prototype` has built every screen and checked them
against the live account: the dashboard across categories and periods,
Collection, Wishlist, the insurance report, My Account and Admin. This plan covers what is left between
that prototype and a launch. Where the two plans disagree, this one is newer.

Work happens on `ios-app`, branched from `ios-prototype`. Server and web changes
go to `main` as separate small PRs, each merged before the app depends on it.

## Decisions (settled 2026-11-01)

| Question | Decision |
| --- | --- |
| AGPL vs the App Store | Add an App Store exception under AGPL §7. The repo has no outside authors yet (only dependabot), so this needs no one else's consent — but only until the first outside PR lands. Do it first. |
| Apple Developer Program | Not enrolled yet. Everything that doesn't need it is built first. |
| Server and web changes | Allowed, as separate PRs to `main`. |
| Offline | Cache the collection on the phone, encrypted with iOS file protection (readable only while unlocked), wiped on sign-out. Browsing works offline; saving still needs signal. |

## What's left, in order

### 1. Server prerequisites (PRs to `main`)

1. **License exception.** `LICENSE` gets the §7 additional permission;
   `README` and `CONTRIBUTING` say contributions are accepted under it.
2. **`GET /api/identify-budget`** — `{ used, remaining, dailyLimit, resetsAt }`
   for identify and scan, read from the existing usage and limits tables. No
   model call. The app shows the allowance *before* the camera opens.
3. **Versioned routes.** `/api/v1/*` for every route the app calls, re-exporting
   today's handlers so the web keeps working unchanged. Rule from here on:
   only add response fields, never remove or rename one.
4. **`GET /api/v1/client-config`** — `{ minimumIosVersion, message }`, so a
   breaking server change can ask old builds to update.
5. **Sign in with Apple on the web** — blocked on enrollment (Services ID, key,
   Supabase provider config). Code can be ready behind the provider switch.

### 2. The app writes

- `LiveReadStore` becomes `LiveStore`: inserts, updates and deletes on the
  collector's own rows, photo upload and removal, the same RLS the web relies on.
- `LocalOverlay`, the "Prototype" banner and "local" chips go from live mode.
  Sample mode stays, for demos and App Store screenshots.
- `ReadOnlyGuardTests` becomes a **write-path guard**: writes only from
  `LiveStore`, still never the service role key, still only allowed tables and
  functions. The guard keeps its teeth; it just changes what it guards.
- Photos: HEIC → JPEG, 200–400 KB per photo like the web, upload progress, and
  an item that saves even if a photo fails (the web's rule).
- Reference numbers: retry with a fresh max on a unique-index collision.

### 3. Real AI

- Identify and scan through `/api/v1/identify-book` and `/api/v1/scan-book`,
  with the server's own error messages (not-a-book, cooldown, cap with the UTC
  reset, out of credit vs busy, incomplete).
- Allowance shown before capture. The mobile daily cap is a spending decision
  for you; `identify_limits` already supports per-user overrides.

### 4. Auth

- Sign in with Apple (needs enrollment), Google (done), email.
- Sign-up and password reset for real, with the reset link opening the app
  (universal link on `firstfinder.app`, needs enrollment for the entitlement).
- My Account handles Apple's private-relay addresses honestly.
- Delete account through `/api/v1/delete-account` (Apple requires in-app deletion).

### 5. Offline cache

- Rows and small thumbnails in the app's container with
  `NSFileProtectionComplete`; full-size photos stay network-only.
- Wiped on sign-out and on account switch. Opens from cache, then refreshes.

### 6. Hardening

- A real iPhone: camera, permissions denied, Low Data Mode, backgrounding
  mid-upload, storage full.
- VoiceOver, Dynamic Type, Reduce Motion, dark mode — each screen once.
- The §5 edge-case table in `ios-app-plan.md`, row by row.

### 7. Submission

- Bundle ID `app.firstfinder` (the prototype's `.prototype` ID is retired),
  signing, `PrivacyInfo.xcprivacy`, privacy nutrition labels.
- App Store screenshots from sample mode (never live data).
- A **demo account for App Review** with sample data in it — Review signs in.
- TestFlight with a few collectors, then submit.

## Only you can do

- Enroll in the Apple Developer Program.
- Create the Sign in with Apple Services ID and key, and paste them into
  Supabase (Authentication → Providers → Apple).
- Merge each server PR.
- Decide the mobile identify cap.
- Create the App Store Connect listing, the review demo account, and press Submit.
