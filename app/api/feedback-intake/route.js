import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../src/lib/supabaseAdmin";
import { TRIAGE_STATUS, composeIssueBody, redactPersonalInfo } from "../../../src/lib/feedbackTriage";
import { triageOne } from "../../../src/lib/feedbackTriagePrompt";
import { createIssue, fetchOpenIssueTitles } from "../../../src/lib/feedbackGithub";

// Turns a piece of feedback into a GitHub issue the moment it is submitted.
//
// The client inserts the feedback row itself (it owns the photo upload, and
// that flow already works), then calls this with the row's id. This route
// verifies the caller actually owns that row, triages it, and files it.
//
// Two kinds of feedback are deliberately NOT filed. They stay in the feedback
// table with a triage_status saying why, readable in the Supabase table editor:
//
//   - anything triage judges not actionable. Feedback forms collect a steady
//     trickle of "hi", test submissions, and kind words, and a repo whose
//     issue tracker fills up with those is worse off than one with no
//     automation at all.
//   - anything that still looks like it contains personal information after
//     redaction. The issue would be public and permanently indexed, and the
//     person who wrote it thought they were filling in a support form.
//
// Everything else -- the real bug reports and feature requests, which is the
// bulk of it -- goes straight to GitHub with nobody in the loop.

const MAX_DESCRIPTION_CHARS = 6000;
const MAX_ISSUE_BODY_CHARS = 60000;
const MAX_ISSUE_TITLE_CHARS = 240;

// One person can only put so many issues into a public repo per day. This is
// the backstop against both a stuck retry loop and someone who works out that
// the feedback box writes to a public tracker. Past the cap, feedback is still
// saved -- it just isn't filed.
const AUTO_FILE_DAILY_LIMIT = Number(process.env.FEEDBACK_AUTO_FILE_DAILY_LIMIT) || 5;

function autoFileEnabled() {
  // Opt out without a code change; otherwise on whenever both keys needed to
  // do the work are present.
  if (String(process.env.FEEDBACK_AUTO_FILE).toLowerCase() === "false") return false;
  return Boolean(process.env.GITHUB_TOKEN && process.env.OPENAI_API_KEY);
}

// Records why a piece of feedback was not filed. Never throws: the user's feedback is already saved,
// and none of this is their problem.
async function park(supabaseAdmin, id, status, reason) {
  try {
    await supabaseAdmin
      .from("feedback")
      .update({
        triage_status: status,
        triage_error: reason || null,
        updated_at: new Date().toISOString()
      })
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
  if (row.github_issue_url || row.triage_status !== TRIAGE_STATUS.NEW) {
    return NextResponse.json({ filed: false, reason: "already_handled" });
  }

  if (!autoFileEnabled()) {
    // Nothing to do and nothing wrong: the feedback is saved either way.
    return NextResponse.json({ filed: false, reason: "auto_file_disabled" });
  }

  // Per-user daily cap, counted over the last 24 hours rather than the calendar
  // day so it can't be reset by waiting for midnight in the right timezone.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabaseAdmin
    .from("feedback")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);

  if (!countError && (count || 0) > AUTO_FILE_DAILY_LIMIT) {
    await park(supabaseAdmin, row.id, TRIAGE_STATUS.NEW, `Not filed: more than ${AUTO_FILE_DAILY_LIMIT} submissions from this user in 24 hours.`);
    return NextResponse.json({ filed: false, reason: "rate_limited" });
  }

  // Redacted before it reaches the model, not just before it reaches GitHub --
  // there is no reason for a user's email address to be in an API request to a
  // third party either.
  const { text: redacted } = redactPersonalInfo(row.description || "");
  const description = redacted.slice(0, MAX_DESCRIPTION_CHARS);

  let triage;
  try {
    const openIssues = await fetchOpenIssueTitles(process.env.GITHUB_TOKEN);
    triage = await triageOne({ apiKey: process.env.OPENAI_API_KEY, description, openIssues });
  } catch (error) {
    console.error("Feedback intake triage error:", row.id, error.message);
    await park(supabaseAdmin, row.id, TRIAGE_STATUS.ERROR, error.message);
    return NextResponse.json({ filed: false, reason: "triage_failed" });
  }

  await supabaseAdmin
    .from("feedback")
    .update({
      triage,
      triage_status: TRIAGE_STATUS.TRIAGED,
      triage_error: null,
      triaged_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", row.id);

  // Not a bug report -- a greeting, a test, or kind words. Marked dismissed
  // rather than filed; still readable in the feedback table if you want to see
  // what people are sending.
  if (!triage.actionable) {
    await park(supabaseAdmin, row.id, TRIAGE_STATUS.DISMISSED, null);
    return NextResponse.json({ filed: false, reason: "not_actionable" });
  }

  // Real feedback, but something identifying survived redaction. Not filed:
  // the issue would be public and permanent, and nobody is going to read it
  // first. Left as `triaged` with the triage stored, so it can be filed by hand
  // from the Supabase table if it turns out to be worth it.
  if (triage.containsPersonalInfo) {
    return NextResponse.json({ filed: false, reason: "needs_review" });
  }

  const title = String(triage.title || "Feedback from the in-app form")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_ISSUE_TITLE_CHARS);

  const issueBody = composeIssueBody({
    feedbackId: row.id,
    submittedAt: row.created_at ? new Date(row.created_at).toISOString().slice(0, 10) : null,
    description: (row.description || "").slice(0, MAX_DESCRIPTION_CHARS),
    triage,
    photoCount: Array.isArray(row.photos) ? row.photos.length : 0
  }).slice(0, MAX_ISSUE_BODY_CHARS);

  let issue;
  try {
    // triageOne has already filtered these against the repo's real labels.
    issue = await createIssue({ token: process.env.GITHUB_TOKEN, title, body: issueBody, labels: triage.labels });
  } catch (error) {
    console.error("Feedback intake publish error:", row.id, error.message);
    await park(supabaseAdmin, row.id, TRIAGE_STATUS.TRIAGED, `Couldn't file: ${error.message}`);
    return NextResponse.json({ filed: false, reason: "publish_failed" });
  }

  const { error: updateError } = await supabaseAdmin
    .from("feedback")
    .update({
      triage_status: TRIAGE_STATUS.PUBLISHED,
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
