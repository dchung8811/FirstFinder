import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../src/lib/supabaseAdmin";
import { classifySignInMethods, countLookup, normalizeLookupEmail } from "../../../src/utils/emailLookup";

// The sign-in card's first step: is this address new, does it have a
// password, or does it sign in with Google or Apple? The trade-off of
// answering that at all is in src/utils/emailLookup.js.
//
// Every failure answers "unknown" with a 200 rather than an error, so the card
// quietly falls back to asking for a password and nothing here can stop
// someone signing in.

// Enough for a household on one Wi-Fi network signing in a few times over,
// few enough that checking a list of addresses is slow work.
const LOOKUP_RULE = { limit: 20, windowMs: 10 * 60 * 1000 };

// Per server instance, so it slows a script down rather than stopping it
// outright; a Vercel Firewall rate-limit rule on this path is the stronger
// version. Only the requester's IP is held, in memory, for ten minutes -- never
// the addresses looked up.
const windows = new Map();
const MAX_TRACKED = 5000;

function requesterKey(request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

function answer(body) {
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const email = normalizeLookupEmail(body?.email);
  if (!email) return answer({ status: "unknown" });

  const key = requesterKey(request);
  const now = Date.now();
  if (windows.size > MAX_TRACKED) {
    for (const [requester, window] of windows) {
      if (window.resetAt <= now) windows.delete(requester);
    }
    if (windows.size > MAX_TRACKED) windows.clear();
  }
  const counted = countLookup(windows.get(key), now, LOOKUP_RULE);
  windows.set(key, counted.window);
  if (!counted.allowed) return answer({ status: "unknown" });

  let supabaseAdmin;
  try {
    supabaseAdmin = createSupabaseAdminClient();
  } catch (error) {
    console.error("Email lookup setup error:", error.message);
    return answer({ status: "unknown" });
  }

  const { data, error } = await supabaseAdmin.rpc("email_sign_in_methods", { p_email: email });
  if (error) {
    // Most likely supabase/email-sign-in-methods.sql hasn't been run yet.
    console.error("Email lookup error:", error.message);
    return answer({ status: "unknown" });
  }
  return answer(classifySignInMethods(data));
}
