import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../src/lib/supabaseAdmin";

const PHOTO_BUCKET = "item-photos";

// Supabase Storage's list() only returns one directory level at a time --
// recurse into every pseudo-folder to collect every file under a prefix.
// Folder entries come back with a null id; real files have a uuid.
async function listAllFiles(supabaseAdmin, bucket, prefix) {
  const results = [];
  const { data, error } = await supabaseAdmin.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error || !data) return results;

  for (const entry of data) {
    const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id) {
      results.push(fullPath);
    } else {
      const nested = await listAllFiles(supabaseAdmin, bucket, fullPath);
      results.push(...nested);
    }
  }

  return results;
}

// Deletes the requesting user's own account: storage photos, inventory
// rows, feedback rows, and finally the auth user itself. Runs server-side
// with the service role key so it can call the Admin API and bypass RLS --
// the caller's identity is verified from their own access token first, so
// this can only ever delete the account making the request.
export async function POST(request) {
  const authHeader = request.headers.get("authorization") || "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "");

  if (!accessToken) {
    return NextResponse.json({ error: "Missing authorization token." }, { status: 401 });
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = createSupabaseAdminClient();
  } catch (error) {
    console.error("Delete account setup error:", error.message);
    return NextResponse.json({ error: "Account deletion isn't configured on the server yet." }, { status: 500 });
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);

  if (userError || !userData?.user) {
    return NextResponse.json({ error: "Could not verify your session. Please log in again." }, { status: 401 });
  }

  const userId = userData.user.id;

  try {
    const filePaths = await listAllFiles(supabaseAdmin, PHOTO_BUCKET, userId);
    if (filePaths.length > 0) {
      const { error: removeError } = await supabaseAdmin.storage.from(PHOTO_BUCKET).remove(filePaths);
      if (removeError) console.error("Delete account storage cleanup error:", removeError.message);
    }

    const { error: inventoryError } = await supabaseAdmin.from("inventory_items").delete().eq("user_id", userId);
    if (inventoryError) console.error("Delete account inventory cleanup error:", inventoryError.message);

    const { error: feedbackError } = await supabaseAdmin.from("feedback").delete().eq("user_id", userId);
    if (feedbackError) console.error("Delete account feedback cleanup error:", feedbackError.message);

    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteUserError) {
      console.error("Delete account auth error:", deleteUserError.message);
      return NextResponse.json({ error: deleteUserError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete account error:", error.message);
    return NextResponse.json({ error: "Something went wrong deleting your account. Please try again or contact support." }, { status: 500 });
  }
}
