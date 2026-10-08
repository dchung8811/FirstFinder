// Consent to product-update email, kept on the account's Supabase user
// metadata next to full_name rather than in a table of its own. Sign-up has
// no session until the address is confirmed, so RLS would refuse an insert at
// the one moment the choice is made; signUp's options.data is written with the
// account itself. Deleting the account deletes the record with it.
//
// The timestamp is the consent record: when the collector last switched this
// on or off. Anyone sending to the list should read it, not just the flag.
export const EMAIL_UPDATES_KEY = "email_updates";
export const EMAIL_UPDATES_CHANGED_AT_KEY = "email_updates_changed_at";

// Only an explicit true counts. Accounts from before this existed have no key
// at all, and an absent answer is not a yes.
export function isSubscribedToEmailUpdates(user) {
  return user?.user_metadata?.[EMAIL_UPDATES_KEY] === true;
}

export function emailUpdatesMetadata(subscribed, now = new Date()) {
  return {
    [EMAIL_UPDATES_KEY]: subscribed === true,
    [EMAIL_UPDATES_CHANGED_AT_KEY]: now.toISOString()
  };
}

// Google sign-up leaves the page for the provider and come back on a
// fresh load, so a ticked box on the sign-up form has to survive that trip in
// browser storage. It is kept only briefly: a flag left behind by a cancelled
// sign-in must not opt in whoever signs in on this browser tomorrow.
export const PENDING_EMAIL_UPDATES_KEY = "firstfinder:pending-email-updates";
export const PENDING_EMAIL_UPDATES_TTL_MS = 15 * 60 * 1000;

export function serializePendingEmailUpdates(now = new Date()) {
  return JSON.stringify({ subscribed: true, at: now.getTime() });
}

// True only for a well-formed, unexpired opt-in. Anything else -- missing,
// corrupt, stale, or from the future -- is treated as no answer.
export function isPendingEmailUpdatesValid(raw, now = new Date()) {
  if (!raw) return false;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return false;
  }
  if (parsed?.subscribed !== true || typeof parsed.at !== "number") return false;
  const age = now.getTime() - parsed.at;
  return age >= 0 && age <= PENDING_EMAIL_UPDATES_TTL_MS;
}
