// Who counts as an admin, and the check every admin route runs first.
//
// This is the only privilege escalation in the app. Everything else is
// owner-scoped RLS: a signed-in collector can reach their own rows and nothing
// else, enforced by Postgres. The admin dashboard breaks that shape by design
// -- it reads across every account -- so the gate deserves more care than the
// feature behind it.
//
// Three deliberate choices:
//
//   1. An environment variable, not a database column or a JWT claim. Granting
//      admin should require a deploy, not an UPDATE. There is no UI for it for
//      the same reason supabase/identify-daily-limit.sql has no UI for raising
//      someone's cap: the act should be deliberate and leave a trace.
//   2. User ids, not email addresses. Email is changeable by the account
//      holder through Supabase's own flows, so an allowlist keyed on it can be
//      joined by anyone who can set their address to a string we trust. Ids
//      are immutable.
//   3. This repo is public and AGPL-licensed. Every line of the gate is
//      readable by anyone, and the deployed allowlist is not -- which is the
//      right way round. Nothing here may rely on the route's path or shape
//      being unguessable.

// Comma-separated Supabase user ids. Empty or unset means nobody is an admin
// and the dashboard is unreachable -- the correct default for a variable that
// grants access to the whole platform's data, and what a fork gets on day one.
export function adminUserIds() {
  return String(process.env.ADMIN_USER_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export function isAdminUserId(userId) {
  if (!userId) return false;
  return adminUserIds().includes(userId);
}

// Verifies the caller's access token and that they are on the allowlist.
//
// Returns { ok: true, userId } or { ok: false, status, error }. The two failure
// messages are intentionally identical in tone and never distinguish "you are
// not an admin" from "your token is bad": a probe should not be able to use
// this route to discover whether an account it has stolen is privileged.
//
// Takes the admin client rather than building one so the caller can fail
// cleanly if the service role key is missing, and so this stays testable.
export async function requireAdmin(supabaseAdmin, request) {
  const accessToken = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!accessToken) {
    return { ok: false, status: 401, error: "Not authorized." };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data?.user) {
    return { ok: false, status: 401, error: "Not authorized." };
  }

  if (!isAdminUserId(data.user.id)) {
    // Worth logging, unlike a bad token: this is a real account that reached an
    // admin route, which is either a misconfigured allowlist or someone
    // poking at it.
    console.warn("Admin route: rejected non-admin user", data.user.id);
    return { ok: false, status: 403, error: "Not authorized." };
  }

  return { ok: true, userId: data.user.id };
}
