import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../src/lib/supabaseAdmin";
import { dailyBudget, identifyDailyLimit, scanDailyLimit, todayUtc } from "../../../src/utils/dailyBudget";

// How many photo identifications and scans the caller has left today, without
// spending one. identify-book only reports what's left after a successful
// call, which is too late: on a phone the camera is the front door, and a
// collector should see "1 left today" before photographing a shelf, not after.
//
// Reads only. The usage tables are written solely by the claim functions the
// spending routes call, so this can never use up an allowance by being asked.
// Returns the caller's own counts and nothing else.

export const dynamic = "force-dynamic";

export async function GET(request) {
  const accessToken = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!accessToken) {
    return NextResponse.json({ error: "Missing authorization token." }, { status: 401 });
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = createSupabaseAdminClient();
  } catch (error) {
    console.error("Identify budget setup error:", error.message);
    return NextResponse.json({ error: "Photo identification isn't configured on the server yet." }, { status: 500 });
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: "Could not verify your session. Please log in again." }, { status: 401 });
  }

  const userId = userData.user.id;
  const now = new Date();
  const today = todayUtc(now);

  const [identifyUsage, identifyOverride, scanUsage] = await Promise.all([
    supabaseAdmin.from("identify_usage").select("call_count").eq("user_id", userId).eq("usage_date", today).maybeSingle(),
    supabaseAdmin.from("identify_limits").select("daily_limit").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("scan_usage").select("call_count").eq("user_id", userId).eq("usage_date", today).maybeSingle()
  ]);

  const failed = [identifyUsage, identifyOverride, scanUsage].find((result) => result.error);
  if (failed) {
    // The allowance is advice; the spending routes still enforce the real
    // cap. So say we couldn't check, and let the caller carry on without it.
    console.error("Identify budget read failed:", failed.error.message);
    return NextResponse.json({ error: "Couldn't check today's allowance." }, { status: 503 });
  }

  return NextResponse.json(
    {
      identify: dailyBudget({
        used: identifyUsage.data?.call_count,
        defaultLimit: identifyDailyLimit(process.env.IDENTIFY_DAILY_LIMIT),
        overrideLimit: identifyOverride.data?.daily_limit ?? null,
        now
      }),
      // Scanning has no per-account override table, only the global cap.
      scan: dailyBudget({
        used: scanUsage.data?.call_count,
        defaultLimit: scanDailyLimit(process.env.SCAN_DAILY_LIMIT),
        now
      })
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
