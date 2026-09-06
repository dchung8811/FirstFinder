// Everything that talks to GitHub on behalf of the feedback pipeline. Shared by
// the automatic path (app/api/feedback-intake, which files as feedback arrives)
// and the manual queue (app/api/feedback-review, which files the exceptions the
// automatic path parks).

import { GITHUB_SLUG } from "./project";

const GITHUB_API = `https://api.github.com/repos/${GITHUB_SLUG}`;

// Open issues shown to the model for duplicate detection. Titles only -- the
// bodies would dwarf the actual feedback in the prompt.
const DUPLICATE_CANDIDATES = 60;

export function githubHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "FirstFinder-Feedback",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };
}

export async function fetchOpenIssueTitles(token) {
  if (!token) return [];

  try {
    const response = await fetch(
      `${GITHUB_API}/issues?state=open&per_page=${DUPLICATE_CANDIDATES}&sort=updated&direction=desc`,
      { headers: githubHeaders(token), cache: "no-store" }
    );
    if (!response.ok) return [];
    const issues = await response.json();
    return (Array.isArray(issues) ? issues : [])
      .filter((issue) => !issue.pull_request)
      .map((issue) => ({ number: issue.number, title: issue.title }));
  } catch (error) {
    // Duplicate detection is a nicety. Losing it must not block triage.
    console.error("Feedback: could not list open issues:", error.message);
    return [];
  }
}

// Adds a freshly filed issue to the project board, if one is configured. Best
// effort by design: the issue already exists by this point, and failing the
// whole operation because a board column could not be updated would leave the
// caller thinking nothing happened when an issue is in fact live.
export async function addIssueToProject(token, issueNodeId) {
  const projectNumber = Number(process.env.GITHUB_PROJECT_NUMBER);
  if (!projectNumber || !issueNodeId) return null;

  const owner = GITHUB_SLUG.split("/")[0];

  async function graphql(query, variables) {
    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: githubHeaders(token),
      body: JSON.stringify({ query, variables })
    });
    const payload = await response.json();
    if (payload.errors) throw new Error(payload.errors.map((entry) => entry.message).join("; "));
    return payload.data;
  }

  try {
    // User-owned project, matching where this repo's board actually lives. An
    // org-owned board would need `organization(login:)` here instead.
    const lookup = await graphql(
      `query($owner: String!, $number: Int!) {
         user(login: $owner) { projectV2(number: $number) { id } }
       }`,
      { owner, number: projectNumber }
    );

    const projectId = lookup?.user?.projectV2?.id;
    if (!projectId) return null;

    await graphql(
      `mutation($projectId: ID!, $contentId: ID!) {
         addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) { item { id } }
       }`,
      { projectId, contentId: issueNodeId }
    );

    return projectNumber;
  } catch (error) {
    console.error("Feedback: could not add issue to project board:", error.message);
    return null;
  }
}

// Creates the issue. Throws with a message worth showing a maintainer -- both
// callers turn that into either an API error or a logged reason for parking the
// feedback, and "GitHub said no" without saying why is useless in both.
export async function createIssue({ token, title, body, labels }) {
  const response = await fetch(`${GITHUB_API}/issues`, {
    method: "POST",
    headers: githubHeaders(token),
    body: JSON.stringify({ title, body, labels })
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("Feedback: GitHub issue creation failed:", response.status, detail.slice(0, 500));
    if (response.status === 401 || response.status === 403) {
      throw new Error("GitHub rejected the token. It needs write access to issues on this repo.");
    }
    if (response.status === 410) {
      throw new Error("Issues are disabled on this repository.");
    }
    throw new Error("GitHub wouldn't create the issue. Check the server logs.");
  }

  const issue = await response.json();
  const addedToProject = await addIssueToProject(token, issue.node_id);

  return { number: issue.number, url: issue.html_url, addedToProject };
}
