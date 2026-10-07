import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../src/lib/supabaseAdmin";
import { requireAdmin } from "../../../../src/lib/adminAuth";
import { fromDbBanner, validateBanner } from "../../../../src/utils/siteBanner";

// Reads and saves the site-wide banner for /admin.
//
// The app reads the banner itself with the anon key, but that read only sees
// it while it is switched on (see supabase/site-banner.sql). The admin form has
// to load a banner that is off too, and saving needs a write no API key has, so
// both go through here, behind the same gate as the stats route.

export const dynamic = "force-dynamic";

const COLUMNS = "enabled, message, link_label, link_view, updated_at";

async function gate(request) {
  let supabaseAdmin;
  try {
    supabaseAdmin = createSupabaseAdminClient();
  } catch (error) {
    console.error("Admin banner setup error:", error.message);
    return { response: NextResponse.json({ error: "Server is not configured for admin access." }, { status: 500 }) };
  }

  const check = await requireAdmin(supabaseAdmin, request);
  if (!check.ok) {
    return { response: NextResponse.json({ error: check.error }, { status: check.status }) };
  }
  return { supabaseAdmin };
}

export async function GET(request) {
  const { supabaseAdmin, response } = await gate(request);
  if (response) return response;

  const { data, error } = await supabaseAdmin.from("site_banner").select(COLUMNS).eq("id", 1).maybeSingle();
  if (error) {
    console.error("Admin banner read failed:", error.message);
    // The likeliest cause on a new deploy is the patch not having run yet, and
    // that is worth saying in the form rather than as a bare 500.
    return NextResponse.json({ error: "Could not read the banner. Has supabase/site-banner.sql been run?" }, { status: 500 });
  }

  return NextResponse.json({ banner: fromDbBanner(data) });
}

export async function PUT(request) {
  const { supabaseAdmin, response } = await gate(request);
  if (response) return response;

  const body = await request.json().catch(() => null);
  const result = validateBanner(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // updated_at is set here rather than left to the default, which only fires
  // on insert. It is what a dismissal is remembered against, so every save has
  // to move it or an edited banner would stay hidden from people who closed
  // the old one.
  const { data, error } = await supabaseAdmin
    .from("site_banner")
    .upsert({ id: 1, ...result.row, updated_at: new Date().toISOString() })
    .select(COLUMNS)
    .single();

  if (error) {
    console.error("Admin banner save failed:", error.message);
    return NextResponse.json({ error: "Could not save the banner." }, { status: 500 });
  }

  return NextResponse.json({ banner: fromDbBanner(data) });
}
