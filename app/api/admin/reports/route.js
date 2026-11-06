import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../src/lib/supabaseAdmin";
import { requireAdmin } from "../../../../src/lib/adminAuth";
import { groupReportsByOwner, isUuid } from "../../../../src/utils/contentReports";

// The moderation queue for /admin: open reports, pages currently down, and the
// three things a maintainer can do about them. Reporters' identities stay out of
// the response; deciding about a page doesn't need them.
export const dynamic = "force-dynamic";

async function gate(request) {
  let supabaseAdmin;
  try {
    supabaseAdmin = createSupabaseAdminClient();
  } catch (error) {
    console.error("Admin reports setup error:", error.message);
    return { response: NextResponse.json({ error: "Server is not configured for admin access." }, { status: 500 }) };
  }
  const check = await requireAdmin(supabaseAdmin, request);
  if (!check.ok) return { response: NextResponse.json({ error: check.error }, { status: check.status }) };
  return { supabaseAdmin };
}

async function loadQueue(supabaseAdmin) {
  const [{ data: reports, error: reportsError }, { data: hidden, error: hiddenError }] = await Promise.all([
    supabaseAdmin
      .from("content_reports")
      .select("id, owner_id, slug, item_id, reason, details, created_at")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(200),
    supabaseAdmin.from("moderated_collections").select("owner_id, source, hidden_at").order("hidden_at", { ascending: false })
  ]);
  if (reportsError) throw reportsError;
  if (hiddenError) throw hiddenError;

  const ownerIds = [...new Set([...reports.map((row) => row.owner_id), ...hidden.map((row) => row.owner_id)])];
  let shares = [];
  if (ownerIds.length) {
    const { data, error } = await supabaseAdmin.from("shared_collections").select("user_id, slug, title").in("user_id", ownerIds);
    if (error) throw error;
    shares = data;
  }

  const shareByOwner = new Map(shares.map((share) => [share.user_id, share]));
  const hiddenOwners = new Set(hidden.map((row) => row.owner_id));
  return {
    pages: groupReportsByOwner(reports, shares).map((page) => ({ ...page, hidden: hiddenOwners.has(page.ownerId) })),
    hidden: hidden.map((row) => ({
      ownerId: row.owner_id,
      source: row.source,
      hiddenAt: row.hidden_at,
      slug: shareByOwner.get(row.owner_id)?.slug || "",
      title: shareByOwner.get(row.owner_id)?.title?.trim() || "Untitled collection"
    }))
  };
}

export async function GET(request) {
  const { supabaseAdmin, response } = await gate(request);
  if (response) return response;
  try {
    return NextResponse.json(await loadQueue(supabaseAdmin));
  } catch (error) {
    console.error("Admin reports read failed:", error.message);
    return NextResponse.json({ error: "Could not read the reports. Has supabase/content-moderation.sql been run?" }, { status: 500 });
  }
}

export async function POST(request) {
  const { supabaseAdmin, response } = await gate(request);
  if (response) return response;

  const body = await request.json().catch(() => null);
  if (!isUuid(body?.ownerId)) return NextResponse.json({ error: "That page couldn't be found." }, { status: 400 });

  const resolveOpen = (status) =>
    supabaseAdmin
      .from("content_reports")
      .update({ status, resolved_at: new Date().toISOString() })
      .eq("owner_id", body.ownerId)
      .eq("status", "open");

  try {
    if (body.action === "hide") {
      const { error } = await supabaseAdmin
        .from("moderated_collections")
        .upsert({ owner_id: body.ownerId, source: "admin", hidden_at: new Date().toISOString() }, { onConflict: "owner_id" });
      if (error) throw error;
      const { error: resolveError } = await resolveOpen("actioned");
      if (resolveError) throw resolveError;
    } else if (body.action === "dismiss" || body.action === "restore") {
      // Restoring closes the open reports too, or the next single report would
      // find three open ones and take the page straight back down.
      const { error: resolveError } = await resolveOpen("dismissed");
      if (resolveError) throw resolveError;
      if (body.action === "restore") {
        const { error } = await supabaseAdmin.from("moderated_collections").delete().eq("owner_id", body.ownerId);
        if (error) throw error;
      }
    } else {
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
    return NextResponse.json(await loadQueue(supabaseAdmin));
  } catch (error) {
    console.error("Admin reports write failed:", error.message);
    return NextResponse.json({ error: "Could not save that. Please try again." }, { status: 500 });
  }
}
