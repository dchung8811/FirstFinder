import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../../src/lib/supabaseAdmin";
import { requireAdmin } from "../../../../src/lib/adminAuth";

// Answers one question for the signed-in caller: are you an admin?
//
// The nav needs this because the allowlist lives in a server-only environment
// variable, and it must stay there. The alternatives are both worse: shipping
// the id list to the browser publishes who the maintainers are to every
// visitor, and calling the full stats route just to decide whether to draw a
// menu item does a dozen counts to render one word.
//
// This tells you only about yourself. It never reveals how many admins exist
// or who they are, and a non-admin learns exactly what they could already work
// out by opening /admin -- so it is safe to call from anyone's session.
//
// It is also not a security boundary. Hiding the menu item is a convenience,
// not a gate; /api/admin/stats does its own check on every request, and that
// is the thing actually protecting the data.

export const dynamic = "force-dynamic";

export async function GET(request) {
  let supabaseAdmin;
  try {
    supabaseAdmin = createSupabaseAdminClient();
  } catch (error) {
    // A deployment missing its service role key has no admins, which is the
    // safe reading. Answering 200/false keeps this off the app's error paths:
    // the nav simply does not grow an Admin tab.
    console.error("Admin access check setup error:", error.message);
    return NextResponse.json({ admin: false });
  }

  const gate = await requireAdmin(supabaseAdmin, request);
  // Always 200. This is a question about the caller, not a protected resource,
  // and a 401 here would show up in the browser console of every ordinary
  // collector who is simply not an admin.
  return NextResponse.json({ admin: gate.ok });
}
