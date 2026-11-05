// Decides which photo folders have lost their owner. Pure, so it can be pinned
// by tests: scripts/find-orphaned-photos.mjs does the listing and deleting, and
// a wrong answer here deletes a real collector's photos with no way back.
//
// Photos live at <userId>/<itemId>/<file>, and the storage policies key on that
// first segment being auth.uid(). So a top-level folder named like a user id
// whose user no longer exists belongs to nobody.

const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Sorts the bucket's top-level names into folders that still have a user,
// folders that don't, and names that aren't user ids at all. The last group is
// reported and never deleted: the app never writes anything there, so whatever
// it is, someone put it there on purpose, and a cleanup script is the wrong
// place to guess what.
export function classifyPhotoFolders(folderNames, userIds) {
  const users = new Set(Array.from(userIds, (id) => String(id).toLowerCase()));
  const owned = [];
  const orphaned = [];
  const unrecognized = [];

  for (const name of folderNames) {
    if (!USER_ID.test(name)) unrecognized.push(name);
    else if (users.has(name.toLowerCase())) owned.push(name);
    else orphaned.push(name);
  }

  return { owned, orphaned, unrecognized };
}

// Returns why a delete run must stop, or null when it may go ahead.
//
// Both refusals guard the same mistake: pointing the script at a key or project
// that can list storage but not the users who own it. Then every folder looks
// orphaned, and --delete would empty the bucket. A real cleanup always leaves
// at least one collector's photos in place, so "every folder is orphaned" is
// treated as a sign of a misconfiguration, not as a result.
export function deletionBlocker({ userCount, owned, orphaned }) {
  if (userCount === 0) {
    return "No users came back from the project, so every photo would look orphaned. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY point at the same project.";
  }
  if (orphaned.length > 0 && owned.length === 0) {
    return "Every photo folder looks orphaned, which means the user list and the bucket don't match. Refusing to delete anything.";
  }
  return null;
}
