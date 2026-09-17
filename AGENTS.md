<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# FirstFinder

A free, open-source inventory app for collectors — books, cards, comics,
memorabilia. Next.js App Router on Supabase (Postgres, Auth, Storage), deployed
on Vercel. One maintainer, working in spare time.

The data is personal: people photograph receipts with their home addresses on
them and record what their collection is worth. Treat privacy failures as more
serious than bugs.

## Commands

| | |
| --- | --- |
| `npm run dev` | Local app on :3000 |
| `npm test` | Vitest, ~500 tests, under 3 seconds — run this |
| `npm run build` | Needs the two `NEXT_PUBLIC_SUPABASE_*` vars set |
| `npm run lint` | Reports a known pre-existing backlog — see below |

## Layout

```
app/
  InventoryApp.jsx       Nearly the whole signed-in UI, in one file
  api/*/route.js         Server routes — the only place the service role key is allowed
  c/[slug]/              Public shared-collection pages
  books/                 Public first-edition guides (SEO surface)
src/lib/                 Stateful: Supabase clients, auth, network, browser storage
src/utils/               Pure functions only — this is where the tests are
src/content/books/       Hand-written guide content, one file per book
supabase/                schema.sql plus the patches that produced it
scripts/                 Book-catalog seeding
```

**`src/utils` is pure and must stay that way.** Nothing in it imports Supabase,
touches the network, or reaches into `src/lib`. That is what lets the whole
suite run in Node with no environment and no mocks, in under three seconds. New
logic worth testing goes here; the stateful caller stays in `src/lib` or the
component. Putting an import of `src/lib` into `src/utils` breaks the property
the test suite depends on.

## Things that are easy to get wrong

**`app/InventoryApp.jsx` is one large client component on purpose.** An
`activeView` state variable acts as the router. It is a deliberate trade for a
solo project — one file you can read top to bottom. Do not split it up as its
own change. If a feature genuinely needs a piece extracted, extract only that
piece and say why.

**The service role key bypasses Row Level Security entirely.** `src/lib/supabaseAdmin.js`
may only be imported from `app/api/*/route.js` handlers. Never from a
`"use client"` file, never from a component, and never prefix a secret with
`NEXT_PUBLIC_`. Browser code uses `src/lib/supabaseClient.js` (anon key) and is
governed by RLS.

**Database changes go in two places:** `supabase/schema.sql` (the source of
truth a fresh project runs) *and* a new patch file alongside it (what production
runs). Existing patches are history — don't edit them.

**Money is nullable.** An unknown estimate is `null`, never `0`. A collector
who hasn't appraised something is not a collector who owns something worthless,
and the dashboard totals depend on the difference.

**Colors come from the existing palette** as Tailwind arbitrary values
(`bg-[#f6efe3]`, `text-[#123f38]`). Don't introduce a new accent color casually.

**Comments explain *why*, not *what*.** The existing ones are the model —
`eslint.config.mjs` and `.env.example` are the best examples. If a decision
would surprise the next reader, record the reason.

## What CI actually gates

`.github/workflows/ci.yml` runs on every PR:

1. `npm test` — the full Vitest suite.
2. `no-undef` across the repo, and **only** that rule. Full `npm run lint` still
   reports a pre-existing backlog in `InventoryApp.jsx` and the books pages, so
   gating on all of it would fail every PR. `no-undef` is gated because a
   component reading a name it doesn't have ships green and throws at runtime —
   it happened twice, and `eslint.config.mjs` tells that story.
3. `npm run build`, with placeholder Supabase env vars.

Nothing else is automated. **No test covers a React component, a route handler,
or anything touching Supabase.** The tests pass and the build succeeds while the
UI is broken, so for any change to `app/`, say plainly what you verified and
what you couldn't.

## Before you call a change done

- `npm test` passes.
- `npx eslint . --quiet` reports no `no-undef`.
- `npm run build` passes for anything non-trivial.
- No secrets, no `.env.local`, no real collection data or addresses in the diff.
- Commit messages in the imperative mood, described from a collector's point of
  view: "Warn on possible duplicate items when adding new inventory".
