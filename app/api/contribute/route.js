import { NextResponse } from "next/server";
import {
  GITHUB_SLUG,
  GOOD_FIRST_ISSUE_LABEL,
  HELP_WANTED_LABEL
} from "../../../src/lib/project";

// Feeds the in-app Contribute page the issues that are actually open right now,
// so the page can't drift out of date the way a hand-maintained list would.
//
// This runs on the server rather than fetching GitHub from the browser for two
// reasons: the response is cached once for everyone instead of once per visitor
// (unauthenticated GitHub allows 60 requests an hour per IP), and an optional
// token can be used without shipping it to the browser.

const GITHUB_API = `https://api.github.com/repos/${GITHUB_SLUG}`;

// Long enough that a busy day of visitors costs a handful of GitHub calls, short
// enough that an issue closed this morning is gone from the page by lunch.
const CACHE_SECONDS = 900;

// One page of open issues is far more than the page shows. Fetching them all at
// once and bucketing here costs one request instead of one per label.
const ISSUE_PAGE_SIZE = 100;

// How many to actually render per bucket. A wall of issues reads as a backlog,
// not an invitation.
const MAX_PER_BUCKET = 6;

const REQUEST_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  // GitHub asks every caller to identify itself, and rejects some requests
  // without it.
  "User-Agent": "FirstFinder-Contribute-Page",
  // Optional. Raises the rate limit from 60/hour to 5000/hour, which only
  // matters if the deployment shares an outbound IP with noisy neighbors. A
  // read-only token with no scopes is enough -- this only reads public data.
  ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {})
};

async function getJson(url) {
  const response = await fetch(url, {
    headers: REQUEST_HEADERS,
    next: { revalidate: CACHE_SECONDS }
  });

  if (!response.ok) {
    throw new Error(`GitHub responded ${response.status} for ${url}`);
  }

  return response.json();
}

function hasLabel(issue, name) {
  return (issue.labels || []).some(
    (label) => (typeof label === "string" ? label : label?.name || "").toLowerCase() === name
  );
}

function toIssueSummary(issue) {
  return {
    number: issue.number,
    title: issue.title,
    url: issue.html_url,
    comments: issue.comments,
    // Only the labels a contributor would find informative -- the two bucket
    // labels are already implied by which list the issue is in.
    labels: (issue.labels || [])
      .map((label) => (typeof label === "string" ? label : label?.name || ""))
      .filter((name) => name && ![GOOD_FIRST_ISSUE_LABEL, HELP_WANTED_LABEL].includes(name.toLowerCase()))
      .slice(0, 3),
    // Present only when nobody has picked it up, so the page can say so.
    assigned: Boolean(issue.assignee)
  };
}

export async function GET() {
  try {
    const [repo, issues] = await Promise.all([
      getJson(GITHUB_API),
      getJson(`${GITHUB_API}/issues?state=open&per_page=${ISSUE_PAGE_SIZE}&sort=updated&direction=desc`)
    ]);

    // The issues endpoint returns pull requests too -- they carry a
    // pull_request key, and nothing else distinguishes them.
    const openIssues = (Array.isArray(issues) ? issues : []).filter((issue) => !issue.pull_request);

    const goodFirstIssues = openIssues.filter((issue) => hasLabel(issue, GOOD_FIRST_ISSUE_LABEL));
    const helpWanted = openIssues.filter(
      (issue) => hasLabel(issue, HELP_WANTED_LABEL) && !hasLabel(issue, GOOD_FIRST_ISSUE_LABEL)
    );

    return NextResponse.json({
      ok: true,
      repo: {
        stars: repo.stargazers_count ?? 0,
        forks: repo.forks_count ?? 0,
        openIssues: openIssues.length,
        // Lets the page say how recently the project was actually touched,
        // which is what someone deciding whether to contribute wants to know.
        lastPushedAt: repo.pushed_at || null
      },
      goodFirstIssues: goodFirstIssues.slice(0, MAX_PER_BUCKET).map(toIssueSummary),
      helpWanted: helpWanted.slice(0, MAX_PER_BUCKET).map(toIssueSummary)
    });
  } catch (error) {
    // GitHub being down, rate-limited, or slow must not break the page. It
    // degrades to the static links it already renders, so this returns 200 with
    // ok:false rather than an error the client would have to special-case.
    console.error("Contribute issue fetch error:", error.message);
    return NextResponse.json({ ok: false, repo: null, goodFirstIssues: [], helpWanted: [] });
  }
}
