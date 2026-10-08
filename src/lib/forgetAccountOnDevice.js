// Everything one collector leaves in this browser, removed in one call.
//
// Signing out happens in two places -- the app's own Log out and the nav bar
// on /explore -- and both have to take the same things with them. Kept in one
// function so a store added later can't be cleared by one button and left
// behind by the other. Account deletion clears the same stores itself, in
// InventoryApp's delete handler, alongside the server-side delete.

import { clearOfflineCollection } from "./offlineStore";
import { clearSignedUrls } from "./signedUrlStore";
import { clearQueue } from "./offlineQueueStore";

export async function forgetAccountOnDevice(userId) {
  // The snapshot is one person's shelf sitting in a browser other people use.
  clearOfflineCollection(userId);
  // The photo URLs are worse than the snapshot: each one is a bearer token
  // that opens a photo for anyone holding it, with no login.
  clearSignedUrls(userId);
  // The queue holds photographs and unsaved finds, and this is a device
  // someone else may sign in on next.
  await clearQueue(userId);
}
