import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../src/lib/supabaseAdmin";
import { FEEDBACK_STATUS, composeIssueBody, deriveIssueTitle } from "../../../src/lib/feedbackIssue";
import { createIssue } from "../../../src/lib/feedbackGithub";

// Files a piece of feedback as a GitHub issue the moment it is submitted.
//
// The client inserts the feedback row itself (it owns the photo upload, and
// that flow already works), then calls this with the row's id. This verifies
// the caller actually owns that row and opens the issue.
//
// Every submission becomes an issue. There is no classifier deciding what is
// worth filing and no model writing an opinion about it -- the issue is the
// user's report, and triage happens on GitHub where the maintainer already
// works. The one thing done to the text is masking personal details, since the
// issue is public and permanent and the person writing thought they were
// filling in a support form.

const MAX_DESCRIPTION_CHARS = 6000;
const MAX_ISSUE_BODY_CHARS = 60000;

// One person can only put so many issues into a public repo per day. With every
// submission filed, this is the only thing standing between a stuck retry loop
// -- or someone who works out that the feedback box writes to a public tracker
// -- and a flooded issue list. Past the cap, feedback is still saved.
const DAILY_LIMIT = Number(process.env.FEEDBACK_AUTO_FILE_DAILY_LIMIT) || 5;

function filingEnabled() {
  // Opt out without a code change; otherwise on whenever the token needed to do
  // the work is present.
  if (String(process.env.FEEDBACK_AUTO_FILE).toLowerCase() === "false") return false;
  return Boolean(process.env.GITHUB_TOKEN);
}

// Records why a piece of feedback was not filed. Never throws: the feedback is
// already saved, and none of this is the user's problem.
async function park(supabaseAdmin, id, status, reason) {
  try {
    await supabaseAdmin
      .from("feedback")
      .update({ triage_status: status, triage_error: reason || null, updated_at: new Date().toISOString() })
      .eq("id", id);
  } catch (error) {
    console.error("Feedback intake: could not park feedback", id, error.message);
  }
}

export async function POST(request) {
  const accessToken = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!accessToken) {
    return NextResponse.json({ error: "Missing authorization token." }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const id = body?.id;
  if (!id) return NextResponse.json({ error: "No feedback id." }, { status: 400 });

  let supabaseAdmin;
  try {
    supabaseAdmin = createSupabaseAdminClient();
  } catch (error) {
    console.error("Feedback intake setup error:", error.message);
    return NextResponse.json({ filed: false }, { status: 200 });
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: "Could not verify your session." }, { status: 401 });
  }
  const userId = userData.user.id;

  const { data: row, error: rowError } = await supabaseAdmin
    .from("feedback")
    .select("id, user_id, description, photos, triage_status, github_issue_url, created_at")
    .eq("id", id)
    .single();

  if (rowError || !row) {
    return NextResponse.json({ error: "Couldn't find that feedback." }, { status: 404 });
  }

  // The id came from the browser, so ownership is checked rather than assumed.
  // Without this, any logged-in user could name someone else's feedback id and
  // have its contents published.
  if (row.user_id !== userId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // Already handled -- a double submit or a retry.
  if (row.github_issue_url || row.triage_status !== FEEDBACK_STATUS.NEW) {
    return NextResponse.json({ filed: false, reason: "already_handled" });
  }

  if (!filingEnabled()) {
    return NextResponse.json({ filed: false, reason: "filing_disabled" });
  }

  // Counted over a rolling 24 hours rather than the calendar day, so it can't
  // be reset by waiting for midnight in the right timezone.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabaseAdmin
    .from("feedback")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);

  if (!countError && (count || 0) > DAILY_LIMIT) {
    await park(supabaseAdmin, row.id, FEEDBACK_STATUS.NEW, `Not filed: more than ${DAILY_LIMIT} submissions from this user in 24 hours.`);
    return NextResponse.json({ filed: false, reason: "rate_limited" });
  }

  const description = (row.description || "").slice(0, MAX_DESCRIPTION_CHARS);
  const title = deriveIssueTitle(description);
  const issueBody = composeIssueBody({
    feedbackId: row.id,
    submittedAt: row.created_at ? new Date(row.created_at).toISOString().slice(0, 10) : null,
    description,
    photoCount: Array.isArray(row.photos) ? row.photos.length : 0
  }).slice(0, MAX_ISSUE_BODY_CHARS);

  let issue;
  try {
    // No labels. Nothing here has judged what this is, and a wrong label is
    // worse than none -- labelling is part of the triage the maintainer does.
    issue = await createIssue({ token: process.env.GITHUB_TOKEN, title, body: issueBody, labels: [] });
  } catch (error) {
    console.error("Feedback intake publish error:", row.id, error.message);
    await park(supabaseAdmin, row.id, FEEDBACK_STATUS.ERROR, `Couldn't file: ${error.message}`);
    return NextResponse.json({ filed: false, reason: "publish_failed" });
  }

  const { error: updateError } = await supabaseAdmin
    .from("feedback")
    .update({
      triage_status: FEEDBACK_STATUS.PUBLISHED,
      github_issue_number: issue.number,
      github_issue_url: issue.url,
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", row.id);

  // The issue is live regardless -- log loudly so a row that still looks
  // unfiled doesn't get filed a second time by hand.
  if (updateError) {
    console.error("Feedback intake bookkeeping error:", row.id, issue.url, updateError.message);
  }

  return NextResponse.json({ filed: true, issue: { number: issue.number, url: issue.url } });
}
