import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../src/lib/supabaseAdmin";
import { requireAdmin, adminUserIds } from "../../../../src/lib/adminAuth";
import { buildPlatformChecks, worstStatus } from "../../../../src/utils/platformLimits";
import { buildComputeChecks } from "../../../../src/utils/computeMetrics";
import { readComputeMetrics } from "../../../../src/lib/computeMetrics";
import { GITHUB_SLUG, REPO_URL } from "../../../../src/lib/project";

// Everything the admin dashboard shows, in one response.
//
// Two rules govern what may leave this route, and they are the reason the
// whole feature is safe to have:
//
//   1. Aggregates only. Never a row, never an email, never an item name. The
//      SQL function does the counting inside Postgres and returns totals, so
//      even a complete compromise of an admin session leaks the shape of the
//      platform rather than anyone's collection. The difference between
//      "counts" and "rows" here is the difference between an embarrassment and
//      a breach.
//   2. The exclusion list is the admin list. The maintainer's own account
//      holds 192 of 193 items, so an unadjusted total says nothing about
//      whether anyone else is using this. Every figure comes back both ways --
//      the UI leads with the excluding number and keeps the true total beside
//      it, so nothing is hidden, only demoted.

export const dynamic = "force-dynamic";

// GitHub is rate-limited and its numbers move slowly; the database is neither.
// So the Supabase half is recomputed on every request (one function call, a few
// milliseconds) and only the GitHub half is cached. A 60-second poll therefore
// costs one query and, at most, one GitHub call every five minutes.
const GITHUB_CACHE_SECONDS = 300;

const GITHUB_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "FirstFinder-Admin-Dashboard",
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {})
};

// GitHub reports the rate limit and the token's own expiry, so neither has to
// be assumed. Never throws: GitHub being down or slow must not take the
// Supabase half of the dashboard down with it, so this degrades to null and
// the page renders the rest.
async function readGithub() {
  try {
    const [rateResponse, repoResponse] = await Promise.all([
      fetch("https://api.github.com/rate_limit", {
        headers: GITHUB_HEADERS,
        next: { revalidate: GITHUB_CACHE_SECONDS }
      }),
      fetch(`https://api.github.com/repos/${GITHUB_SLUG}`, {
        headers: GITHUB_HEADERS,
        next: { revalidate: GITHUB_CACHE_SECONDS }
      })
    ]);

    if (!rateResponse.ok) throw new Error(`rate_limit responded ${rateResponse.status}`);

    const rate = await rateResponse.json();
    const core = rate?.resources?.core || {};
    const repo = repoResponse.ok ? await repoResponse.json() : null;

    return {
      authenticated: Boolean(process.env.GITHUB_TOKEN),
      rateLimit: core.limit ?? null,
      rateUsed: core.used ?? null,
      rateRemaining: core.remaining ?? null,
      rateResetAt: core.reset ? new Date(core.reset * 1000).toISOString() : null,
      // Only fine-grained tokens send this header. A classic or non-expiring
      // token returns nothing, and the expiry check is skipped rather than
      // inventing a date -- see buildPlatformChecks.
      tokenExpiresAt: rateResponse.headers.get("github-authentication-token-expiration") || null,
      repo: repo
        ? {
            stars: repo.stargazers_count ?? 0,
            forks: repo.forks_count ?? 0,
            // GitHub's open_issues_count counts open pull requests too. Rather
            // than spend a second request to separate them, the label in the UI
            // says "issues + PRs" -- an accurate name for the number we have
            // beats a prettier name for a number we would have to guess at.
            openIssuesAndPrs: repo.open_issues_count ?? 0,
            lastPushedAt: repo.pushed_at || null
          }
        : null,
      url: REPO_URL
    };
  } catch (error) {
    console.error("Admin stats: GitHub read failed:", error.message);
    return null;
  }
}

export async function GET(request) {
  let supabaseAdmin;
  try {
    supabaseAdmin = createSupabaseAdminClient();
  } catch (error) {
    console.error("Admin stats setup error:", error.message);
    return NextResponse.json({ error: "Server is not configured for admin access." }, { status: 500 });
  }

  const gate = await requireAdmin(supabaseAdmin, request);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const excluded = adminUserIds();

  // Fetched alongside the rest rather than after it: the metrics endpoint is
  // the slowest thing on this page and the only one that can time out.
  const [{ data: metrics, error: metricsError }, github, compute] = await Promise.all([
    supabaseAdmin.rpc("admin_platform_metrics", { p_exclude: excluded }),
    readGithub(),
    readComputeMetrics()
  ]);

  if (metricsError) {
    console.error("Admin stats query error:", metricsError.message);
    return NextResponse.json({ error: "Could not read platform metrics." }, { status: 500 });
  }

  // The plan decides whether free-tier allowances are the right yardstick, and
  // it is not worth a Management API token to discover -- an env var that a
  // future upgrade updates alongside the upgrade itself is enough. The
  // dashboard says which plan it is quoting, so a stale value is visible
  // rather than silently wrong.
  const plan = process.env.SUPABASE_PLAN || "free";

  // Quota checks first, then the health of the machine underneath them. Both
  // render through the same row, but they answer different questions -- see
  // the note at the top of computeMetrics.js.
  const checks = [
    ...buildPlatformChecks({
      capacity: metrics?.capacity || {},
      plan,
      now: new Date(),
      github
    }),
    ...buildComputeChecks(compute)
  ];

  return NextResponse.json({
    ok: true,
    generatedAt: metrics?.generated_at || new Date().toISOString(),
    excludedAccounts: excluded.length,
    plan,
    metrics,
    github,
    compute,
    checks,
    status: worstStatus(checks)
  });
}
