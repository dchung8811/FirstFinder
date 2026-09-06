# Security Policy

FirstFinder holds things people would rather not have leaked: photos of
receipts (which often show a home address and the last four digits of a card),
what someone owns, what they paid, and what it's worth. Security reports are
taken seriously here.

## Supported versions

FirstFinder is a hosted web app with a single deployed version. Only the current
`main` branch and what's live at <https://first-finder.vercel.app> are
supported. There are no back-ported fixes to older commits.

## Reporting a vulnerability

**Please don't open a public issue, PR, or discussion for a security problem.**

Report it privately, either way:

- **GitHub** — [open a private security advisory](https://github.com/dchung8811/FirstFinder/security/advisories/new)
  (Security → Report a vulnerability). This is preferred; it keeps the report
  and the fix in one place.
- **Email** — thebookbarterer@gmail.com with "Security" in the subject.

Helpful things to include: what you found, the steps to reproduce it, what an
attacker could actually get, and any thoughts on a fix. A proof of concept
against your own test account is ideal.

## What to expect

This is a solo-maintained project, not a company with an on-call rotation.
Realistically:

- **Acknowledgement within 5 days.** If you haven't heard back in a week, send a
  follow-up — the first one probably went to spam.
- An assessment and a plan once the report is confirmed.
- A fix deployed as fast as the severity warrants; anything that exposes one
  user's data to another gets dropped-everything treatment.
- Credit in the advisory and the release notes, if you'd like it. There is no
  bug bounty — this project has no revenue.

## Please don't

When testing, stay inside these lines:

- Use your own test accounts and your own data. Don't access, modify, or
  exfiltrate anyone else's collection, photos, or feedback.
- No denial of service, load testing, or spamming the AI identification
  endpoint — every call there costs the maintainer real money.
- No social engineering of users, and no physical or automated scanning of
  Supabase's or Vercel's infrastructure. Their own security programs cover
  their platforms.
- Don't publicly disclose the issue until a fix is out, or 90 days have passed
  with no response.

## Areas worth a close look

If you're auditing, these are where the sharp edges are:

- **Row Level Security.** The app queries with the public anon key and filters
  rows by `id` alone in places, so owner-only RLS policies on `inventory_items`
  and `feedback` are what keeps collections apart. See `supabase/schema.sql`.
- **Storage policies.** The `item-photos` bucket is private and scoped by the
  first path segment (`<user_id>/...`); photos are served through short-lived
  signed URLs.
- **The service role key.** It bypasses RLS entirely and must only ever be read
  inside route handlers (`src/lib/supabaseAdmin.js`). Anything that leaks it
  into a client bundle is a critical finding.
- **`app/api/delete-account`** — it deletes data on the caller's behalf, so the
  authorization check there matters.
- **`app/api/identify-book`** — authenticated, throttled, and billed per call.

## Out of scope

Reports that will be closed without a fix: missing security headers with no
demonstrated impact, rate limits on unauthenticated read-only endpoints, output
of automated scanners with no working exploit, best-practice suggestions with no
attack behind them, and vulnerabilities in Supabase or Vercel themselves (report
those to them).
