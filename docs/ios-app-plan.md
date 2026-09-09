# FirstFinder for iOS — build plan

A native iOS client for FirstFinder. Deliberately **not** a port of the web app:
the web app is where you sit down with a spreadsheet and a stack of receipts,
and the phone is where you are standing in a shop basement with a book in your
hand. This plan builds the second thing.

Scope was set by three constraints: a dashboard with recent finds and reporting,
photo identification plus manual entry (**no bulk import**), in-app feedback, and
the same edge-case handling the web app already has.

## The short version

Reuse the entire backend — Supabase and the existing Next.js routes need no
rewrite. Build a native SwiftUI client in five phases: read path, then write
path, then AI, then reporting and feedback, then submission. Roughly seven to
eight weeks of focused work.

Three things should be settled **before the first line of Swift**, because all
three get more expensive once an app exists: the AGPL/App Store license
conflict, Sign in with Apple, and the two-identifications-per-day cap.

## 1. What already exists and does not need rebuilding

| Capability | Where it lives today | How iOS uses it |
| --- | --- | --- |
| Auth (Google, email/password) | Supabase Auth | `supabase-swift`, directly |
| Inventory CRUD | `inventory_items` + RLS | `supabase-swift` PostgREST, directly |
| Photo storage | Private `item-photos` bucket, owner-only policies | `supabase-swift` Storage + signed URLs |
| Feedback | `feedback` table + RLS | `supabase-swift`, directly |
| AI identification | `POST /api/identify-book` | HTTPS with a Bearer access token |
| Feedback → GitHub issue | `POST /api/feedback-intake` | HTTPS with a Bearer access token |
| Account deletion | `POST /api/delete-account` | HTTPS with a Bearer access token |
| Identify daily cap | `claim_identify_call()` in Postgres | Server-side; the client just reads the result |

The structural fact that makes this a seven-week project instead of a six-month
one: **Row Level Security already does the authorization.** Every policy on
`inventory_items` is `auth.uid() = user_id`, and the storage policies key on the
first path segment of the object name. A native client holding the anon key is
exactly as safe as a browser holding it. There is no new server-side
authorization work, and no new API surface to design for the data itself.

The three Next.js routes are equally reusable as-is. Each one takes the user's
Supabase access token in an `Authorization: Bearer` header and verifies it
server-side before doing anything, so a native caller is indistinguishable from
the browser. Native apps do not make CORS preflight requests, so nothing needs
relaxing there either.

## 2. Three things to settle before writing Swift

### 2.1 AGPL-3.0 and the App Store (legal — must fix)

The project is AGPL-3.0. The FSF's long-standing position, and the reason VLC
was pulled from the App Store in 2011, is that GPL-family terms conflict with
Apple's App Store terms of service: Apple imposes device-count and DRM
restrictions that the license forbids anyone from adding. Shipping an AGPL
binary to the App Store invites a takedown, and the person who can file it is
anyone holding copyright in the work.

`git log` shows two author identities, both yours, and `CONTRIBUTING.md` takes
contributions under the same license without a separate CLA. So you are the sole
copyright holder and can fix this unilaterally — today. That stops being true the
moment an outside pull request lands, which is a good reason to do it early.

Three options, best first:

1. **Add an App Store exception to the AGPL grant.** A short additional-permission
   clause under AGPL §7, in which the copyright holder permits distribution
   through app stores notwithstanding their additional terms. One license, one
   repository, and the project stays honestly open source.
2. **Dual-license the iOS client** under Apache-2.0 or MPL-2.0. Works, but now
   there are two licenses to explain to contributors.
3. **Keep the iOS client private and proprietary.** Cheapest legally, and it
   contradicts the promise on the Contribute page that you can read every line.

This affects source file headers, so decide before there are files to head.

### 2.2 Sign in with Apple (App Store gate — must add)

App Store Review Guideline 4.8 requires an app that offers third-party sign-in
to also offer an equivalent privacy-preserving option. FirstFinder offers Google,
so it needs Sign in with Apple. Supabase Auth supports the Apple provider
natively, so this is configuration plus a button, not an auth rewrite.

Do it on the **web app first**. It is the same provider configuration, it is a
smaller change in a codebase you already know, and it proves the setup before
any Swift depends on it.

One wrinkle worth knowing: Apple's private relay addresses
(`@privaterelay.appleid.com`) mean the stored email may not be a reachable
inbox. Nothing in the current schema depends on deliverable email, but the
My Account screen should not present it as one.

### 2.3 Two identifications per day (product — should revisit)

`IDENTIFY_DAILY_LIMIT` defaults to 2, and the route comment is candid about why:
each call is a reasoning model plus one or more web search round-trips, on a
self-funded app. That is defensible on the web, where photo identification is
one of several ways in.

On a phone it is a different feature. "Point the camera at a book" *is* the app,
and a collector working through a shelf hits the wall on their second item and
concludes the app is broken. Two things follow:

- **Show the remaining allowance before capture, not after.** Today `remaining`
  and `dailyLimit` only come back on a *successful* identification, which is too
  late to set expectations. Add a cheap `GET /api/identify-budget` that reads
  `identify_usage` and `identify_limits` and returns `{used, remaining, dailyLimit}`.
  No model call, no meaningful cost.
- **Pick the mobile number deliberately.** Even three to five materially changes
  how the app feels. The alternative is making manual entry fast enough that
  hitting the cap is a shrug rather than a dead end — which is worth doing
  regardless.

This is a spending decision, not a technical one, so it is flagged rather than
decided here.

## 3. Scope

**In v1**

- Auth: Apple, Google, email and password; password reset; stay signed in
- Dashboard: recent finds, value and count tiles, category and period filters, empty states
- Collection: list, search, item detail
- Offline **browsing**: a local read cache, so the dashboard and collection still
  render with no signal instead of showing an empty shelf (see §5)
- Add: Quick Add (manual) and AI photo identification
- Item lifecycle: edit, delete, mark sold, restore
- Report: collection report exported as a PDF through the share sheet
- Feedback: description plus photos
- Account: display name, member since, delete account

**Out, deliberately**

- Bulk CSV import, bulk edit, bulk delete — excluded by request, and a CSV round
  trip is a desktop-shaped interaction anyway
- The guided tutorial add flow — it exists on the web to teach the schema, and a
  phone is not where you learn a schema. Quick Add plus AI covers both speeds.
- Card/record view toggle and inline record editing — spreadsheet affordances
- Home, About, Roadmap, Contribute and Terms as full in-app pages — link out to
  the web instead. Note that the destinations do not exist yet: the only routable
  pages today are `/`, `/books`, and the per-work identification pages. Terms is
  reachable only as an `activeView` inside `InventoryApp.jsx`, with no URL, and
  there is no privacy policy in the repo at all. Both need real web routes before
  submission — see Phase 5.
- CSV export — the PDF report covers the real need (insurance, estate). CSV stays
  on the web.
- Sample data loading

**Deferred, not cut**

- Offline **adding** — queueing writes made with no signal and reconciling them
  later. That is the genuinely hard half, and it stays deferred. Offline browsing
  is a read cache, is much cheaper, and is in v1 above; the web roadmap's "Later"
  entry covers both, but the phone splits them.
- Push notifications
- An iPad-specific layout. Build size-class-clean; do not design for it yet.
- Widgets, Shortcuts, App Intents

### Why edit, sold and delete are in, when the ask was dashboard, add and feedback

Without them the app is a write-only hole. Someone adds an item on their phone,
fat-fingers the title, and has to open a laptop to fix it — the kind of gap that
produces one-star reviews about an app that otherwise works. It is also nearly
free: the same form and the same save path as Quick Add.

## 4. Build order

The principle: **read before write, write before AI, AI before polish.** Each
phase should end somewhere worth putting on TestFlight.

### Phase 0 — Foundations (~1 week)

Not a feature, but everything else assumes it.

- Xcode project, SwiftUI, Swift 6, deployment target per the assumption in §7
- `supabase-swift` via SPM, session persisted in the Keychain
- An `Item` model mapping `inventory_items` **field for field**, including the
  `estimated_value` null-versus-zero distinction. Get that one wrong and every
  total in the app is wrong.
- An API client for the three Next.js routes with the full error taxonomy typed
- A toast/banner primitive matching the web app's success, warning and error states
- `PrivacyInfo.xcprivacy`, `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`
- Sign in with Apple capability, and the Supabase provider configured

*Done when:* you can sign in with all three providers, print the user id, sign
out, and relaunch still signed in.

### Phase 1 — Dashboard and collection, read only (~2 weeks)

Read-only on purpose: iOS is pointed at production data (§7), so the phase where
you are learning the stack should not be able to corrupt anything. Seed the
account from the web app and compare.

- Fetch and map inventory rows
- Dashboard: held/sold split, total value held and sold, most expensive held and
  sold, item and category counts
- Recent finds: one batched `createSignedUrls` call for six covers rather than
  one per thumbnail, one-hour expiry, and hide the strip entirely when nothing
  resolves — which is what the web app already does
- Category and period filters, not persisted across launches, carrying the
  "N items have no date and cannot be placed in a period" disclaimer
- Two distinct empty states: nothing catalogued at all, and nothing matching the
  current filters
- Collection list, search over the same fields the web searches, item detail
  with photos
- The offline read cache: persist the mapped rows on fetch and render from them
  when the network is gone, with a banner saying what is being shown and how
  stale it is. It belongs in this phase because it is the same mapping work, and
  building it later means retrofitting every read path instead of writing them
  cached once. Signed photo URLs expire in an hour and deliberately are **not**
  cached with the rows, so an offline shelf shows titles and figures without
  covers rather than broken thumbnails.

*Done when:* every figure matches the web dashboard exactly for the same account
and the same filter combination. If they do not, the model mapping is wrong —
find it here, not after Phase 2 has written data on top of it.

### Phase 2 — Manual add and item lifecycle (~1.5 weeks)

Every genuinely hard edge case lives in this phase.

- Quick Add: name, category, author (books and comics), maker, book
  genre/edition/printing, status, condition, purchase date, source, purchase
  price, estimated value, notes
- Reference number allocation: read the current max, add one, and **retry on a
  unique-violation (23505)**. The web app surfaces that error rather than
  retrying; a phone has worse connectivity and more chances to race, so a small
  bounded retry belongs here — and is worth porting back to the web.
- Photo capture and picking → normalize HEIC to JPEG → compress → insert the row,
  then upload photos and record each one **as it lands**, rather than writing the
  photo columns once after the whole set finishes. This is a deliberate departure
  from the web, which does the single trailing update: a browser tab is rarely
  killed mid-upload, an app on a phone routinely is, and the trailing-update
  shape leaves the row claiming no photos while the uploaded objects sit orphaned
  in storage. Checkpointing per photo is what makes the exit test below
  achievable — and what keeps the "detect on next open and offer to re-attach"
  case in §5 a narrow repair rather than the normal path.
- Partial photo failure: the item is saved, the warning names which photos
  failed, and the item survives
- Duplicate warning before saving, using the same edition/printing signature
- Edit, delete behind a confirmation, mark sold capturing sold price and date,
  and restore to `previous_status` rather than to "Owned"

*Done when:* killing the app mid-upload leaves the item present with whatever
photos made it, and the app says so on relaunch; and saving in airplane mode
produces a clear failure rather than a spinner.

### Phase 3 — AI identification (~1.5 weeks)

By now this is a thin layer: capture, call, prefill the Phase 2 form.

- Capture up to four photos in one session
- HEIC to JPEG, compressed to stay under the route's 6MB-per-image and
  16MB-total caps. The web targets 200–400KB per photo; match it.
- Show the remaining allowance *before* capture
- Map every server error to its own actionable message (§5)
- Review screen: prefilled fields, the value range, the
  first-edition-if-true range, a confidence badge, the edition rationale, and
  the comparables list with tappable source URLs and sold-versus-asking labels
- Add more photos and re-identify: model fields are replaced, because the new
  evidence is the point, while the user's own entries (purchase price, date,
  source, notes) survive untouched
- **Never prefill cost basis.** The web app is deliberate about this — only the
  collector knows what they paid, and a guess corrupts every gain calculation.
- Save through the Phase 2 path

*Done when:* a photo of a mug returns "that doesn't look like a book," a first
edition returns comparables with working links, and the third attempt in one day
returns the cap message with the correct reset time.

### Phase 4 — Report, feedback, account (~1 week)

- Collection report: active items, photo counts, cost basis and value totals,
  generated date, rendered to PDF and handed to the share sheet
- Feedback: description and photos saved to `feedback`, then a best-effort call
  to `/api/feedback-intake` that is **not awaited**. Filing is the app's problem,
  not the user's — the web app is explicit about this and the phone should be too.
- My Account: display name, member since, first-collectible date, and account
  deletion behind a real confirmation

*Done when:* the report PDF opens legibly in Files and Mail, and feedback lands
in the table even with issue filing switched off.

### Phase 5 — Submission (~1 week, mostly waiting)

- Privacy nutrition labels, filled in accurately: photos, email, usage data
- Screenshots, description, and a TestFlight round with real collectors
- **Publish `/terms` and `/privacy` as real web routes on the Next.js app**, and
  link both from inside the iOS app. Neither exists today: Terms lives only as
  client state in `InventoryApp.jsx`, and no privacy policy has been written at
  all. This is a hard gate rather than a nicety — App Store Connect will not
  accept a submission without a reachable privacy policy URL, so writing the
  policy is real work that belongs on the critical path, not paperwork to do on
  the day.
- The same valuation disclaimers the web Terms carry: these are estimates, not
  appraisals, and an insurer decides what it will accept

**Realistic total: seven to eight weeks of focused solo work** — the read cache
in phase 1 is real persistence work, not a free afternoon. At a nights-and-
weekends pace, plan for ten or eleven calendar weeks.

### If you only build three things

Dashboard, Quick Add with photos, AI identification. That is a coherent and
genuinely useful app. Reporting, feedback and account management can follow in
1.1 without anyone feeling cheated.

## 5. Edge cases and graceful degradation

Parity with what the web app already handles:

| Case | Web behavior | iOS requirement |
| --- | --- | --- |
| Photo upload partially fails | Item saved; warning names the failures | Same; never lose the item |
| Signed URL expired (1 hour) | Re-fetched on view | Same; no broken-image placeholders |
| Signed URL batch errors | Records returned unchanged, logged, no crash | Same; hide the strip |
| Image cannot be decoded | Falls back to the original file | Normalize HEIC; fall back to original bytes |
| `estimated_value` null vs 0 | Distinguished; null excluded from totals | Optional `Double`, never defaulted to 0 |
| Model returns low > high | Clamped; null when both are ≤ 0 | Port `toValueRange` exactly |
| Model returns `isBook: false` | 422, "try a photo of the cover" | Same message |
| Identify cooldown (3s) | 429, "going a little fast" | Same, and disable the button |
| Daily cap reached | 429 quoting the *effective* limit and midnight UTC reset | Same — quote the effective limit, not the default |
| Out of credit vs service busy | Two different messages | Keep the distinction |
| Identification incomplete | 502, "try again, or with fewer photos" | Same |
| Possible duplicate on add | Warned before saving | Same |
| Reference number collision | Unique index rejects; error surfaced | Retry with a fresh max, bounded |
| Feedback issue filing fails | Feedback still saved; user not told | Same; never block the success path |
| Empty collection | Dedicated empty state with a call to action | Same |
| Filters match nothing | Distinct state with a clear-filters button | Same |
| Undated items under a period filter | Excluded, and counted in a disclaimer | Same — dropping them silently misleads |
| Token refresh or refocus | Does not reload or navigate away | Do not bounce to login on transient failures |
| Restoring a sold item | Returns to `previous_status` | Same |

And the cases the web never had to handle, which are the actual new work:

| iOS-only case | Handling |
| --- | --- |
| No connectivity | Detect with `NWPathMonitor`, show a banner, disable identification, and serve the dashboard from a local read cache instead of an empty shelf. This is the highest-value item on the list: the roadmap already notes that book fairs and shop basements are exactly where signal is worst, and on a phone that stops being hypothetical. |
| Backgrounded mid-upload | Foreground upload with visible progress in v1, plus a "finish uploading" prompt on relaunch. A background `URLSession` is the 1.1 answer. |
| Camera or library permission denied | Explain what is lost, deep-link to Settings, and keep manual entry fully usable |
| HEIC, Live Photos, screenshots, very large originals | Normalize to JPEG before anything else touches the bytes |
| Low Data Mode or cellular | Warn before a multi-megabyte identification upload; compress harder |
| App terminated mid-save | The row exists without photos; detect on next open and offer to re-attach |
| Device storage full | Fail the capture cleanly without corrupting the draft |
| Dynamic Type, VoiceOver, reduced motion | HTML gave the web semantics for free; SwiftUI needs deliberate labels, especially on stat tiles and the comparables list |
| Clock skew and time zones | The cap resets at midnight **UTC**. Say UTC; rendering it in local time will confuse people. |

## 6. Architecture, and the one thing that genuinely changes

**Native SwiftUI. No shared code. No new backend.**

There is nothing to share: the web app is a single 6,100-line React component
that could not be lifted into React Native without a rewrite. And the reason this
app exists on a phone at all is camera capture, which is exactly where
cross-platform frameworks hurt most. The six weeks buys a native client, not a
port.

Keep the Next.js routes as the backend for identification, feedback and account
deletion. Moving identification to a Supabase Edge Function would decouple iOS
from Vercel deploys and is probably the right eventual move — but it is a week of
work that no user can see. Do it when there is a second client and a reason.

### Shipping to the App Store turns the API into a public contract

This is the real architectural consequence, and it is easy to miss.

Today, `/api/identify-book`'s response shape can change and the web app can be
redeployed in the same commit. Once a build is in someone's pocket, a
six-month-old copy of the client is still calling that route, and App Review
stands between you and a fix.

So, from now on:

- **Never remove or rename a response field. Only add.** The route already
  accepts a lone `image` alongside `images` so "an older client doesn't break
  mid-deploy" — that instinct is exactly right, and it now becomes a rule rather
  than a courtesy.
- **Version the endpoints** (`/api/v1/identify-book`) before the first
  submission, not after.
- **Add a server-driven update signal** — a `minimumClientVersion` field the app
  checks — so a genuinely breaking change has an escape hatch that does not
  depend on everyone updating voluntarily.
- **Error messages are now UI inside a binary you cannot patch.** They already
  live server-side, which is fortunate: keep them there, so wording can change
  without a release.

All of that is nearly free if done before submission, and expensive afterwards.

## 7. Assumptions

Stated explicitly, with the reasoning that got there:

1. **iOS uses the same Supabase project and production data.** The README
   positions FirstFinder as one catalog for one collector; a separate project
   would fork someone's collection between phone and browser. The cost is that
   iOS bugs write to real data, which is precisely why Phase 1 is read-only.
2. **Solo, self-funded, minimal ongoing cost.** The README says "passion project,
   self-funded," and the identification cap exists specifically to control spend.
   So: no new infrastructure, no separate backend, nothing with a monthly bill.
3. **Native SwiftUI rather than React Native or Expo.** There is no reusable code,
   and camera quality is the product.
4. **iOS 17 as the deployment floor.** It is the oldest release where SwiftUI's
   observation and navigation APIs are pleasant to work in, and supporting older
   versions costs real effort for a shrinking audience. Worth verifying rather
   than assuming: `NEXT_PUBLIC_GA_ID` is already wired up, so the mobile Safari
   iOS version breakdown is sitting in your analytics. If a meaningful share is
   still on 16, reconsider — and note the web app remains the fallback for anyone
   stranded either way.
5. **The App Store is the only distribution target.** No sideloading, no Android
   in this plan, because the request was iOS.
6. **You are the sole copyright holder.** `git log` shows only two author
   identities, both yours, and `CONTRIBUTING.md` takes contributions under the
   same license with no separate CLA. That is what makes the license fix in §2.1
   a decision you can make alone — and what makes it urgent, since the first
   outside pull request ends it.
7. **Feature parity with the web app is never a goal.** Stated in the request,
   and worth writing down anyway: parity pressure is the thing that turns a
   seven-week app into a six-month one.

## 8. The first five things to do

1. Decide the license fix (§2.1) and commit it.
2. Enable Sign in with Apple in Supabase and wire it into the **web** app first.
3. Add `GET /api/identify-budget`, and decide the mobile daily cap.
4. Version the API routes.
5. Create the Xcode project and get one signed-in session reading one row from
   `inventory_items`.

Only the last of those needs Swift, which is the point: the blockers are far
cheaper to clear now than once there is an app depending on them.
