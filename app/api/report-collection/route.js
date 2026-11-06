import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../src/lib/supabaseAdmin";
import { requireUser } from "../../../src/lib/requireUser";
import { REPORT_DAILY_LIMIT, shouldAutoHide, validateReport } from "../../../src/utils/contentReports";

// Reporting a shared collection.
//
// Deliberately not /api/feedback-intake: that files public GitHub issues, and a
// report can quote the very thing that shouldn't be public. These stay in a table
// only the service role can read, and are worked from /admin.
//
// Signed-in only, so there is no anonymous write to the database and each report
// counts towards a person. Someone signed out is offered email instead.
export async function POST(request) {
  let supabaseAdmin;
  try {
    supabaseAdmin = createSupabaseAdminClient();
  } catch (error) {
    console.error("Report setup error:", error.message);
    return NextResponse.json({ error: "Reporting isn't configured on the server yet." }, { status: 500 });
  }

  const user = await requireUser(supabaseAdmin, request);
  if (!user.ok) return NextResponse.json({ error: user.error }, { status: user.status });

  const body = await request.json().catch(() => null);
  const report = validateReport(body);
  if (!report.ok) return NextResponse.json({ error: report.error }, { status: 400 });

  const { data: share, error: shareError } = await supabaseAdmin
    .from("shared_collections")
    .select("user_id, slug")
    .eq("slug", report.value.slug)
    .neq("visibility", "off")
    .maybeSingle();

  if (shareError) {
    console.error("Report lookup error:", shareError.message);
    return NextResponse.json({ error: "Could not send your report. Please try again." }, { status: 500 });
  }
  if (!share) return NextResponse.json({ error: "That page couldn't be found." }, { status: 404 });
  if (share.user_id === user.userId) {
    return NextResponse.json({ error: "This is your own page." }, { status: 400 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabaseAdmin
    .from("content_reports")
    .select("id", { count: "exact", head: true })
    .eq("reporter_id", user.userId)
    .gte("created_at", since);

  if (countError) {
    console.error("Report limit error:", countError.message);
    return NextResponse.json({ error: "Could not send your report. Please try again." }, { status: 500 });
  }
  if ((count || 0) >= REPORT_DAILY_LIMIT) {
    return NextResponse.json({ error: "You've sent a lot of reports today. Please email us at thebookbarterer@gmail.com." }, { status: 429 });
  }

  const { error: insertError } = await supabaseAdmin.from("content_reports").insert({
    owner_id: share.user_id,
    reporter_id: user.userId,
    slug: share.slug,
    item_id: report.value.itemId,
    reason: report.value.reason,
    details: report.value.details
  });

  if (insertError) {
    console.error("Report insert error:", insertError.message);
    return NextResponse.json({ error: "Could not send your report. Please try again." }, { status: 500 });
  }

  // After the insert, and allowed to fail: the report is safely filed and still
  // reaches the queue, so the reporter shouldn't be told it didn't work.
  const { data: open, error: openError } = await supabaseAdmin
    .from("content_reports")
    .select("reporter_id, reason")
    .eq("owner_id", share.user_id)
    .eq("status", "open");

  if (openError) {
    console.error("Report auto-hide read error:", openError.message);
  } else if (shouldAutoHide(open)) {
    const { error: hideError } = await supabaseAdmin
      .from("moderated_collections")
      .upsert({ owner_id: share.user_id, source: "auto" }, { onConflict: "owner_id", ignoreDuplicates: true });
    if (hideError) console.error("Report auto-hide error:", hideError.message);
  }

  return NextResponse.json({ ok: true });
}
