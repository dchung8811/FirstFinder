import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "../../../src/lib/supabaseAdmin";

const PHOTO_BUCKET = "item-photos";

// Supabase Storage's per-call maximum. Asking for more is silently capped, so
// this is the page size AND the signal that another page may exist.
const LIST_PAGE_SIZE = 1000;

// Photos live at <userId>/<itemId>/<file>, so the top level under a user is one
// folder per item and the recursion below is one call per item. Doing those
// strictly in sequence means a thousand round trips end to end, which is how a
// correctness fix turns into a function timeout. Ten at a time keeps a large
// collection inside the request budget without hammering storage.
const FOLDER_CONCURRENCY = 10;

// remove() takes a list; very large collections get chunked rather than sent as
// one enormous request, matching how signPhotoPaths batches its signing.
const REMOVE_BATCH_SIZE = 100;

// Collects every file under a prefix.
//
// THROWS on a listing failure, and that is the point. This used to return
// whatever it had on error, so a storage outage read as "this user has no
// photos" -- and the caller went on to delete the account, stranding every
// file with no owner and no way to find them again. An error here has to stop
// the deletion, not quietly shrink it.
async function listAllFiles(supabaseAdmin, bucket, prefix) {
  const files = [];
  const folders = [];

  // Paged to exhaustion. Listing one page of 1000 and stopping was a silent
  // ceiling: a collector with more than a thousand photographed items had the
  // remainder skipped, was told deletion succeeded, and left the rest behind.
  for (let offset = 0; ; offset += LIST_PAGE_SIZE) {
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .list(prefix, { limit: LIST_PAGE_SIZE, offset });

    if (error) {
      throw new Error(`Could not list ${prefix || bucket}: ${error.message}`);
    }

    const page = data || [];
    for (const entry of page) {
      const fullPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      // Folder entries come back with a null id; real files have a uuid.
      if (entry.id) files.push(fullPath);
      else folders.push(fullPath);
    }

    // A short page is the last page.
    if (page.length < LIST_PAGE_SIZE) break;
  }

  for (let start = 0; start < folders.length; start += FOLDER_CONCURRENCY) {
    const batch = folders.slice(start, start + FOLDER_CONCURRENCY);
    const nested = await Promise.all(batch.map((folder) => listAllFiles(supabaseAdmin, bucket, folder)));
    nested.forEach((list) => files.push(...list));
  }

  return files;
}

// Deletes every listed file, in batches. Throws on the first failure so the
// caller can stop before the account goes.
async function removeAllFiles(supabaseAdmin, bucket, paths) {
  for (let start = 0; start < paths.length; start += REMOVE_BATCH_SIZE) {
    const batch = paths.slice(start, start + REMOVE_BATCH_SIZE);
    const { error } = await supabaseAdmin.storage.from(bucket).remove(batch);
    if (error) throw new Error(`Could not delete photos: ${error.message}`);
  }
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
    // Photos first, and the account only if they actually went.
    //
    // Storage does not cascade from auth.users, so the auth row is the only
    // thing tying these files to a person. Deleting the account while the
    // photos remain -- which is what logging the error and carrying on did --
    // orphans them permanently and reports success for a deletion that did not
    // happen. Better to leave the account in place and let them retry: an
    // account that still exists can be deleted again, files nobody owns cannot
    // be found.
    try {
      const filePaths = await listAllFiles(supabaseAdmin, PHOTO_BUCKET, userId);
      if (filePaths.length > 0) {
        await removeAllFiles(supabaseAdmin, PHOTO_BUCKET, filePaths);
      }
    } catch (storageError) {
      console.error("Delete account storage cleanup error:", storageError.message);
      return NextResponse.json(
        {
          error:
            "We couldn't delete your photos, so your account has been left in place. Please try again in a moment, or contact support if it keeps happening."
        },
        { status: 500 }
      );
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
