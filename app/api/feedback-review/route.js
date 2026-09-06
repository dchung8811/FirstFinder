import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../src/lib/supabaseAdmin";
import { GITHUB_SLUG } from "../../../src/lib/project";
import { ALLOWED_LABELS, TRIAGE_STATUS, composeIssueBody, redactPersonalInfo } from "../../../src/lib/feedbackTriage";
import { triageOne } from "../../../src/lib/feedbackTriagePrompt";
import { createIssue, fetchOpenIssueTitles } from "../../../src/lib/feedbackGithub";

// The maintainer side of the in-app feedback form: read what users sent, let a
// model draft a triage for each one, then file the approved ones as GitHub
// issues.
//
// Everything here is gated on ADMIN_USER_IDS. It runs with the service role key
// because the review queue by definition reads other people's rows, which the
// table's RLS policies correctly forbid -- so the identity check below is the
// only thing standing between a logged-in user and everyone's feedback. Treat
// it accordingly.

// How many pieces of feedback one triage request will process. Each is a
// separate paid API call, so the cap is what stops a fat-fingered "triage all"
// on a queue of 400 from being an expensive afternoon.
const MAX_TRIAGE_BATCH = 10;

// Feedback longer than this is truncated before being sent to the model and
// before being quoted into an issue. Generous for a real report; bounded
// against someone pasting a novel into the box.
const MAX_DESCRIPTION_CHARS = 6000;

// GitHub rejects issue bodies over 65536 characters outright.
const MAX_ISSUE_BODY_CHARS = 60000;
const MAX_ISSUE_TITLE_CHARS = 240;

// Open issues shown to the model so it can spot duplicates. Titles only -- the
// bodies would dwarf the actual feedback in the prompt.
const DUPLICATE_CANDIDATES = 60;

function adminUserIds() {
  return (process.env.ADMIN_USER_IDS || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

// Resolves the caller to an admin, or returns the response to send back.
// Returning the failure rather than throwing keeps the two handlers' happy
// paths flat.
async function requireAdmin(request) {
  const accessToken = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!accessToken) {
    return { error: NextResponse.json({ error: "Missing authorization token." }, { status: 401 }) };
  }

  const admins = adminUserIds();
  if (admins.length === 0) {
    // Deliberately fails closed. An unset ADMIN_USER_IDS is a deployment that
    // has not decided who the maintainers are, and the wrong reading of that is
    // "everyone".
    console.error("Feedback review: ADMIN_USER_IDS is not set, refusing all access.");
    return { error: NextResponse.json({ error: "Feedback review isn't configured on this deployment." }, { status: 503 }) };
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = createSupabaseAdminClient();
  } catch (error) {
    console.error("Feedback review setup error:", error.message);
    return { error: NextResponse.json({ error: "Feedback review isn't configured on this deployment." }, { status: 503 }) };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data?.user) {
    return { error: NextResponse.json({ error: "Could not verify your session. Please log in again." }, { status: 401 }) };
  }

  if (!admins.includes(data.user.id)) {
    // Same 404 a non-existent route would give. A logged-in user probing for
    // this endpoint learns nothing about whether it exists.
    return { error: NextResponse.json({ error: "Not found." }, { status: 404 }) };
  }

  return { supabaseAdmin, userId: data.user.id };
}

// Handlers ----------------------------------------------------------------

// The review queue. Returns every piece of feedback that still needs a decision,
// oldest first, plus the recently published ones for context.
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  const { data, error } = await auth.supabaseAdmin
    .from("feedback")
    .select("id, description, photos, status, triage, triage_status, triage_error, triaged_at, github_issue_number, github_issue_url, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("Feedback review list error:", error.message);
    return NextResponse.json({ error: "Couldn't load the feedback queue." }, { status: 500 });
  }

  // The user_id is deliberately not selected above and never leaves the server.
  // Nothing in the review flow needs to know which user sent which report, and
  // the less of that association is on screen next to a "publish to a public
  // repo" button, the better.
  const rows = (data || []).map((row) => {
    const { text: redacted, redactions } = redactPersonalInfo(row.description || "");
    return {
      id: row.id,
      description: row.description,
      redactedDescription: redacted,
      redactionCount: redactions.length,
      photoCount: Array.isArray(row.photos) ? row.photos.length : 0,
      triage: row.triage,
      triageStatus: row.triage_status || TRIAGE_STATUS.NEW,
      triageError: row.triage_error,
      issueNumber: row.github_issue_number,
      issueUrl: row.github_issue_url,
      createdAt: row.created_at
    };
  });

  return NextResponse.json({
    rows,
    repoSlug: GITHUB_SLUG,
    // Lets the UI disable the publish button with a real reason instead of
    // letting the maintainer find out after they have edited a body.
    canPublish: Boolean(process.env.GITHUB_TOKEN),
    canTriage: Boolean(process.env.OPENAI_API_KEY)
  });
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;
  const { supabaseAdmin } = auth;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const action = body?.action;

  if (action === "triage") return handleTriage(supabaseAdmin, body);
  if (action === "publish") return handlePublish(supabaseAdmin, body);
  if (action === "dismiss") return handleDismiss(supabaseAdmin, body);

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

async function handleTriage(supabaseAdmin, body) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Triage needs OPENAI_API_KEY to be set." }, { status: 503 });
  }

  const ids = (Array.isArray(body.ids) ? body.ids : [body.id]).filter(Boolean).slice(0, MAX_TRIAGE_BATCH);
  if (ids.length === 0) {
    return NextResponse.json({ error: "No feedback selected." }, { status: 400 });
  }

  const { data: rows, error } = await supabaseAdmin
    .from("feedback")
    .select("id, description, created_at")
    .in("id", ids);

  if (error) {
    console.error("Feedback triage load error:", error.message);
    return NextResponse.json({ error: "Couldn't load that feedback." }, { status: 500 });
  }

  // Fetched once for the whole batch rather than per row.
  const openIssues = process.env.GITHUB_TOKEN ? await fetchOpenIssueTitles(process.env.GITHUB_TOKEN) : [];

  const results = [];
  for (const row of rows || []) {
    // Redacted before it reaches the model, not just before it reaches GitHub.
    // There is no reason for a user's email address to be in an API request to
    // a third party either.
    const { text: redacted } = redactPersonalInfo(row.description || "");
    const description = redacted.slice(0, MAX_DESCRIPTION_CHARS);

    try {
      const triage = await triageOne({ apiKey, description, openIssues });
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

      results.push({ id: row.id, ok: true, triage });
    } catch (triageError) {
      console.error("Feedback triage error:", row.id, triageError.message);
      await supabaseAdmin
        .from("feedback")
        .update({
          triage_status: TRIAGE_STATUS.ERROR,
          triage_error: triageError.message,
          updated_at: new Date().toISOString()
        })
        .eq("id", row.id);

      results.push({ id: row.id, ok: false, error: triageError.message });
    }
  }

  return NextResponse.json({ results });
}

async function handlePublish(supabaseAdmin, body) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Filing issues needs GITHUB_TOKEN to be set, with write access to issues." }, { status: 503 });
  }

  const id = body.id;
  if (!id) return NextResponse.json({ error: "No feedback selected." }, { status: 400 });

  const { data: row, error } = await supabaseAdmin
    .from("feedback")
    .select("id, description, photos, triage, triage_status, github_issue_url, created_at")
    .eq("id", id)
    .single();

  if (error || !row) {
    return NextResponse.json({ error: "Couldn't find that feedback." }, { status: 404 });
  }

  // Guards against a double-click or a stale tab filing the same report twice.
  if (row.github_issue_url) {
    return NextResponse.json({ error: `Already filed as ${row.github_issue_url}.` }, { status: 409 });
  }

  if (row.triage?.containsPersonalInfo && !body.acknowledgedPii) {
    // The reviewer is the last line of defense on a permanently public page.
    // If triage thinks identifying detail survived redaction, they have to say
    // out loud that they looked.
    return NextResponse.json({
      error: "Triage flagged possible personal information in this report. Confirm you've read and edited it before filing.",
      needsPiiAcknowledgement: true
    }, { status: 409 });
  }

  // The reviewer's edits win over the draft -- editing is the point of the
  // review step -- but the results are still bounded and the labels still
  // filtered, because "the maintainer's browser sent it" is not the same as
  // "a maintainer typed it".
  const title = String(body.title || row.triage?.title || "Feedback from the in-app form")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_ISSUE_TITLE_CHARS);

  const draftBody = composeIssueBody({
    feedbackId: row.id,
    submittedAt: row.created_at ? new Date(row.created_at).toISOString().slice(0, 10) : null,
    description: (row.description || "").slice(0, MAX_DESCRIPTION_CHARS),
    triage: row.triage,
    photoCount: Array.isArray(row.photos) ? row.photos.length : 0,
    // This path is the review queue -- a maintainer is reading it right now.
    reviewed: true
  });

  const issueBody = String(body.body || draftBody).slice(0, MAX_ISSUE_BODY_CHARS);

  const labels = (Array.isArray(body.labels) ? body.labels : row.triage?.labels || [])
    .filter((label) => ALLOWED_LABELS.includes(label));

  let issue;
  try {
    issue = await createIssue({ token, title, body: issueBody, labels });
  } catch (publishError) {
    return NextResponse.json({ error: publishError.message }, { status: 502 });
  }

  try {
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

    // The issue is live at this point. A failed bookkeeping update means the
    // row will look unpublished and could be filed twice, so say so loudly
    // instead of reporting a clean success.
    if (updateError) {
      console.error("Feedback publish bookkeeping error:", updateError.message);
      return NextResponse.json({
        issue: { number: issue.number, url: issue.url },
        warning: "The issue was created, but recording it against the feedback failed — don't file this one again."
      });
    }

    return NextResponse.json({
      issue: { number: issue.number, url: issue.url },
      addedToProject: issue.addedToProject
    });
  } catch (bookkeepingError) {
    // The issue exists. Never report this as a plain failure.
    console.error("Feedback publish bookkeeping error:", bookkeepingError.message);
    return NextResponse.json({
      issue: { number: issue.number, url: issue.url },
      warning: "The issue was created, but recording it against the feedback failed — don't file this one again."
    });
  }
}

async function handleDismiss(supabaseAdmin, body) {
  const id = body.id;
  if (!id) return NextResponse.json({ error: "No feedback selected." }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("feedback")
    .update({ triage_status: TRIAGE_STATUS.DISMISSED, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("Feedback dismiss error:", error.message);
    return NextResponse.json({ error: "Couldn't update that feedback." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
