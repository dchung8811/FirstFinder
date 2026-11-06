// Who is calling, from their own access token. Takes the admin client rather
// than building one, so a route can fail cleanly if the service role key is
// missing, and so this module holds no key of its own.
export async function requireUser(supabaseAdmin, request) {
  const accessToken = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!accessToken) return { ok: false, status: 401, error: "Please log in first." };

  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data?.user) {
    return { ok: false, status: 401, error: "Could not verify your session. Please log in again." };
  }
  return { ok: true, userId: data.user.id };
}
