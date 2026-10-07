// Turning a failed write into something a collector can act on.
//
// The case this was built for: a session ended on the server while an edit
// form was open on a phone. The refresh token was gone, the access token
// expired a second into the save, and the UPDATE went out as the anon role.
// Row Level Security let it touch zero rows, so `.single()` refused the empty
// result and the reader was shown PostgREST's own words -- "Cannot coerce the
// result to a single JSON object" -- for what was really "you've been signed
// out".
//
// Every write in the app filters by primary key on a row the reader can see,
// so zero rows back means RLS stopped it, and the overwhelmingly likely reason
// is a dead session. A row deleted from another device produces the same
// code; "sign in again" is still a reasonable next step there, since signing
// in reloads the collection and the row will be gone.

// PostgREST's code for "`.single()` expected one row and got some other number".
export const NO_ROW_WRITTEN_CODE = "PGRST116";

export const SIGNED_OUT_WRITE_MESSAGE =
  "You've been signed out, so this didn't save. Sign in again, then make the change again.";

export function isNoRowWrittenError(error) {
  return Boolean(error) && error.code === NO_ROW_WRITTEN_CODE;
}

export function describeWriteError(error) {
  if (!error) return "";
  if (isNoRowWrittenError(error)) return SIGNED_OUT_WRITE_MESSAGE;
  return error.message || "Something went wrong saving that. Please try again.";
}
