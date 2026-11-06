import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../src/lib/supabaseAdmin";
import { requireUser } from "../../../src/lib/requireUser";
import { BLOCK_REASON, buildBlockList, isUuid, shouldFileBlockReport } from "../../../src/utils/contentReports";
import { isValidShareSlug } from "../../../src/utils/publicCollection";

// A collector's blocks. A block is stored against the owner, so it survives the
// owner's "Reset link", and the owner's id never leaves this route.
//
// Blocked pages are hidden by the app rather than left out of /explore by the
// server, because Explore is shared and rendered for no one in particular, and
// the app shows it signed out in a web view.
export const dynamic = "force-dynamic";

async function gate(request) {
  let supabaseAdmin;
  try {
    supabaseAdmin = createSupabaseAdminClient();
  } catch (error) {
    console.error("Blocks setup error:", error.message);
    return { response: NextResponse.json({ error: "Blocking isn't configured on the server yet." }, { status: 500 }) };
  }
  const user = await requireUser(supabaseAdmin, request);
  if (!user.ok) return { response: NextResponse.json({ error: user.error }, { status: user.status }) };
  return { supabaseAdmin, userId: user.userId };
}

async function listBlocks(supabaseAdmin, userId) {
  const { data: blocks, error } = await supabaseAdmin
    .from("collection_blocks")
    .select("id, owner_id, slug_at_block")
    .eq("blocker_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!blocks.length) return [];

  const { data: shares, error: sharesError } = await supabaseAdmin
    .from("shared_collections")
    .select("user_id, slug, title, visibility")
    .in("user_id", blocks.map((block) => block.owner_id));
  if (sharesError) throw sharesError;

  return buildBlockList(blocks, shares);
}

// Blocking tells the maintainer too, as App Review expects. Unblocking deletes
// the block, so without these checks blocking and unblocking in a loop would file
// a report each time and push other people's reports out of the queue.
//
// Never throws: the block itself worked, and it's what the collector asked for.
async function fileBlockReport(supabaseAdmin, userId, share) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [today, open] = await Promise.all([
    supabaseAdmin
      .from("content_reports")
      .select("id", { count: "exact", head: true })
      .eq("reporter_id", userId)
      .gte("created_at", since),
    supabaseAdmin
      .from("content_reports")
      .select("id", { count: "exact", head: true })
      .eq("reporter_id", userId)
      .eq("owner_id", share.user_id)
      .eq("reason", BLOCK_REASON)
      .eq("status", "open")
  ]);
  if (today.error || open.error) {
    console.error("Block report check error:", (today.error || open.error).message);
    return;
  }
  if (!shouldFileBlockReport({ reportsToday: today.count, openBlockReports: open.count })) return;

  const { error } = await supabaseAdmin.from("content_reports").insert({
    owner_id: share.user_id,
    reporter_id: userId,
    slug: share.slug,
    reason: BLOCK_REASON
  });
  if (error) console.error("Block report error:", error.message);
}

export async function GET(request) {
  const { supabaseAdmin, userId, response } = await gate(request);
  if (response) return response;
  try {
    return NextResponse.json({ blocks: await listBlocks(supabaseAdmin, userId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Blocks read error:", error.message);
    return NextResponse.json({ error: "Could not load your blocked collectors." }, { status: 500 });
  }
}

// POST for both directions, with an action, so an installed app needs only the
// one kind of authenticated write it already has.
export async function POST(request) {
  const { supabaseAdmin, userId, response } = await gate(request);
  if (response) return response;

  const body = await request.json().catch(() => null);

  try {
    if (body?.action === "unblock") {
      if (!isUuid(body.id)) return NextResponse.json({ error: "That block couldn't be found." }, { status: 400 });
      // The blocker_id filter is what stops one account lifting another's block.
      const { error } = await supabaseAdmin.from("collection_blocks").delete().eq("id", body.id).eq("blocker_id", userId);
      if (error) throw error;
    } else if (body?.action === "block") {
      if (!isValidShareSlug(body.slug)) return NextResponse.json({ error: "That page couldn't be found." }, { status: 400 });

      const { data: share, error: shareError } = await supabaseAdmin
        .from("shared_collections")
        .select("user_id, slug")
        .eq("slug", body.slug)
        .neq("visibility", "off")
        .maybeSingle();
      if (shareError) throw shareError;
      if (!share) return NextResponse.json({ error: "That page couldn't be found." }, { status: 404 });
      if (share.user_id === userId) return NextResponse.json({ error: "This is your own page." }, { status: 400 });

      const { data: created, error: blockError } = await supabaseAdmin
        .from("collection_blocks")
        .upsert(
          { blocker_id: userId, owner_id: share.user_id, slug_at_block: share.slug },
          { onConflict: "blocker_id,owner_id", ignoreDuplicates: true }
        )
        .select("id");
      if (blockError) throw blockError;

      if (created?.length) await fileBlockReport(supabaseAdmin, userId, share);
    } else {
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    return NextResponse.json({ blocks: await listBlocks(supabaseAdmin, userId) });
  } catch (error) {
    console.error("Blocks write error:", error.message);
    return NextResponse.json({ error: "Could not save that. Please try again." }, { status: 500 });
  }
}
