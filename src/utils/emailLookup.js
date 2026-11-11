// The first step of signing in: what /api/email-lookup tells the card about an
// address, so it can ask for a password, offer to create an account, or point
// at the Google or Apple button the account was made with.
//
// This deliberately tells anyone whether an address has a FirstFinder account,
// which the app otherwise refused to do. The maintainer chose the one-step card
// over that (November 2026), with two things keeping it narrow: the answer is
// only ever new / password / which social provider -- never a name, a date or
// anything from the collection -- and lookups are rate limited per address the
// request came from. Supabase's own sign-up already answered "is this address
// registered?" to anyone who tried, so the new part is mostly the provider.

// The sign-in providers the card has a button for. Anything else on an
// account (there is nothing else today) reads as "has a password", so the
// collector is never pointed at a button that doesn't exist.
export const SOCIAL_PROVIDERS = ["google", "apple"];

export const LOOKUP_STATUSES = ["new", "password", "social", "unknown"];

// RFC 5321 caps an address at 254 characters; nothing longer is looked up.
const MAX_EMAIL_LENGTH = 254;

// A trimmed, lowercased address worth looking up, or null. The shape check is
// loose on purpose: Supabase is the real judge, and a false "no" here would
// only stop someone signing in.
export function normalizeLookupEmail(value) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > MAX_EMAIL_LENGTH || /\s/.test(email)) return null;
  const at = email.indexOf("@");
  if (at < 1 || at !== email.lastIndexOf("@")) return null;
  const domain = email.slice(at + 1);
  if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) return null;
  return email;
}

// The sign-in methods on an account, as public.email_sign_in_methods returns
// them (null when there is no account), turned into what the card should do.
// An address with a password anywhere on it gets the password step, even if
// Google is on it too: the collector typed an email, so they're likely to
// know the password.
export function classifySignInMethods(methods) {
  if (methods === null || methods === undefined) return { status: "new" };
  if (!Array.isArray(methods)) return { status: "unknown" };
  if (methods.length === 0 || methods.includes("email")) return { status: "password" };
  const providers = SOCIAL_PROVIDERS.filter((provider) => methods.includes(provider));
  return providers.length > 0 ? { status: "social", providers } : { status: "password" };
}

// One fixed window of lookups for one requester. Returns the window to keep
// and whether this lookup is allowed. Pure so the route's Map is the only
// state, and so the arithmetic is tested.
export function countLookup(window, now, { limit, windowMs }) {
  if (!window || window.resetAt <= now) {
    return { window: { count: 1, resetAt: now + windowMs }, allowed: true };
  }
  const count = window.count + 1;
  return { window: { count, resetAt: window.resetAt }, allowed: count <= limit };
}

// The answer the card reads, from whatever the route got back. Anything it
// doesn't recognise becomes "unknown", which the card treats as "ask for a
// password and offer both next steps" -- the flow from before the lookup.
export function readLookupAnswer(body) {
  const status = LOOKUP_STATUSES.includes(body?.status) ? body.status : "unknown";
  if (status !== "social") return { status };
  const providers = Array.isArray(body.providers) ? SOCIAL_PROVIDERS.filter((provider) => body.providers.includes(provider)) : [];
  return providers.length > 0 ? { status, providers } : { status: "unknown" };
}
