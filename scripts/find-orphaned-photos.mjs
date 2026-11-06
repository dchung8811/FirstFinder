// Finds photos whose owner no longer exists, and with --delete removes them.
//
//   npm run photos:orphans               # report only, changes nothing
//   npm run photos:orphans -- --delete   # remove what the report found
//
// Why this exists (#131): storage does not cascade from auth.users. The in-app
// route (app/api/delete-account) removes a collector's photos before it removes
// them, but deleting a user from the Supabase dashboard or the Admin API skips
// that route. Their rows go with them; their photos -- receipts with home
// addresses on them among them -- stay in the bucket with nothing pointing at
// them, so nobody can find them again from inside the app. Run this after
// removing anyone that way.
//
// Prints counts and folder names (the deleted users' ids), never file names or
// contents.
//
// Uses the service role key, because only it can list every user and every
// folder. Like the catalog seed, this runs on a maintainer's machine and never
// ships to a browser. Never put this key in NEXT_PUBLIC_ anything.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { classifyPhotoFolders, deletionBlocker, ownerLookupVerdict } from "./orphaned-photos.mjs";

const PHOTO_BUCKET = "item-photos";

// Storage's per-call maximum, and the signal that another page may exist.
const LIST_PAGE_SIZE = 1000;
const USERS_PAGE_SIZE = 1000;
const FOLDER_CONCURRENCY = 10;
const REMOVE_BATCH_SIZE = 100;

// Same file the app and the catalog seed read, so nobody keeps a second copy of
// the same secrets.
function loadEnvLocal() {
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const value = match[2].replace(/^["']|["']$/g, "");
      if (!process.env[match[1]]) process.env[match[1]] = value;
    }
  } catch {
    // No .env.local is fine -- the variables may come from the shell.
  }
}

// One page of a storage folder at a time, until a short page. Throws on any
// error: a listing that quietly came back empty would read as "nothing here",
// which is the exact mistake app/api/delete-account had to be fixed for.
async function listEntries(admin, prefix) {
  const entries = [];
  for (let offset = 0; ; offset += LIST_PAGE_SIZE) {
    const { data, error } = await admin.storage
      .from(PHOTO_BUCKET)
      .list(prefix, { limit: LIST_PAGE_SIZE, offset });
    if (error) throw new Error(`Could not list ${prefix || PHOTO_BUCKET}: ${error.message}`);
    const page = data || [];
    entries.push(...page);
    if (page.length < LIST_PAGE_SIZE) return entries;
  }
}

// Every file under a prefix. Mirrors listAllFiles in app/api/delete-account;
// it is copied rather than shared because route files import next/server, which
// a plain Node script can't load.
async function listAllFiles(admin, prefix) {
  const files = [];
  const folders = [];
  for (const entry of await listEntries(admin, prefix)) {
    const fullPath = `${prefix}/${entry.name}`;
    // Folder entries come back with a null id; real files have one.
    if (entry.id) files.push(fullPath);
    else folders.push(fullPath);
  }
  for (let start = 0; start < folders.length; start += FOLDER_CONCURRENCY) {
    const batch = folders.slice(start, start + FOLDER_CONCURRENCY);
    const nested = await Promise.all(batch.map((folder) => listAllFiles(admin, folder)));
    nested.forEach((list) => files.push(...list));
  }
  return files;
}

async function listAllUserIds(admin) {
  const ids = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: USERS_PAGE_SIZE });
    if (error) throw new Error(`Could not list users: ${error.message}`);
    const users = data?.users || [];
    ids.push(...users.map((user) => user.id));
    if (users.length < USERS_PAGE_SIZE) return ids;
  }
}

// Asks about each candidate by id before anything acts on it. The paged user
// list can't be trusted alone: listUsers pages by position, so an account deleted
// between two pages shifts the rest up, and whoever crosses the page boundary is
// missing from the list while still very much existing. Throws on any unclear
// answer, so a run either finishes knowing who is gone or changes nothing.
async function confirmOrphans(admin, candidates) {
  const confirmed = [];
  const stillOwned = [];
  for (const folder of candidates) {
    const verdict = ownerLookupVerdict(await admin.auth.admin.getUserById(folder));
    if (verdict === "unknown") throw new Error(`Could not confirm whether ${folder} still exists. Nothing was deleted.`);
    (verdict === "gone" ? confirmed : stillOwned).push(folder);
  }
  return { confirmed, stillOwned };
}

async function main() {
  loadEnvLocal();
  const shouldDelete = process.argv.slice(2).includes("--delete");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (in .env.local or the shell).");
  }
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  // Folders before users, on purpose. Someone who signs up mid-run and uploads
  // a photo is then either missing from the folder list (so never considered)
  // or present in the user list. Listing users first would leave a window where
  // a brand-new collector's first photo looks orphaned.
  const topLevel = await listEntries(admin, "");
  const userIds = await listAllUserIds(admin);

  // Files sitting at the bucket root aren't anyone's folder; the app never
  // writes there. Report them with the other unrecognized names.
  const folderNames = topLevel.filter((entry) => !entry.id).map((entry) => entry.name);
  const rootFiles = topLevel.filter((entry) => entry.id).map((entry) => entry.name);
  const { owned, orphaned: candidates, unrecognized } = classifyPhotoFolders(folderNames, userIds);
  unrecognized.push(...rootFiles);

  const { confirmed: orphaned, stillOwned } = await confirmOrphans(admin, candidates);
  owned.push(...stillOwned);

  console.log(`${userIds.length} users, ${folderNames.length} photo folders.`);
  console.log(`  ${owned.length} belong to an existing user`);
  console.log(`  ${orphaned.length} belong to a user who no longer exists`);
  if (unrecognized.length > 0) {
    console.log(`  ${unrecognized.length} not named like a user id (left alone): ${unrecognized.join(", ")}`);
  }

  const orphanedFiles = [];
  for (const folder of orphaned) {
    const files = await listAllFiles(admin, folder);
    console.log(`    ${folder}  ${files.length} file${files.length === 1 ? "" : "s"}`);
    orphanedFiles.push(...files);
  }

  if (orphanedFiles.length === 0) {
    console.log("\nNothing to clean up.");
    return;
  }

  if (!shouldDelete) {
    console.log(`\nReport only. Re-run with --delete to remove these ${orphanedFiles.length} files.`);
    return;
  }

  const blocker = deletionBlocker({ userCount: userIds.length, owned, orphaned });
  if (blocker) throw new Error(blocker);

  for (let start = 0; start < orphanedFiles.length; start += REMOVE_BATCH_SIZE) {
    const batch = orphanedFiles.slice(start, start + REMOVE_BATCH_SIZE);
    const { error } = await admin.storage.from(PHOTO_BUCKET).remove(batch);
    if (error) throw new Error(`Stopped after ${start} files: ${error.message}. Re-run to finish.`);
  }
  console.log(`\nRemoved ${orphanedFiles.length} files from ${orphaned.length} folders.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
