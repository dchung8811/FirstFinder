// Whether a sign-in provider will actually work from the browser, asked of
// Supabase rather than assumed.
//
// "Enabled" in the Supabase dashboard is not enough. Apple is switched on for
// the iOS app, which signs in natively with an ID token, but the web redirect
// flow also needs a Services ID and signing key. Without them /authorize
// answers with a bare JSON 400, and signInWithOAuth has already sent the
// browser there -- the collector lands on a page of raw error text instead of
// back on the login form. So the login page asks first and only shows the
// button once the redirect is live. Finishing the setup in Supabase turns the
// button on with no deploy.
//
// A working provider answers with a 302 to its own sign-in page;
// redirect: "manual" stops there without following it, so nothing reaches
// Apple. The client uses the implicit flow (no PKCE), so the request writes no
// server-side state either.
const cache = new Map();

export function isOAuthProviderReady(provider) {
  if (!cache.has(provider)) {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/authorize?provider=${encodeURIComponent(provider)}`;
    const check = fetch(url, { redirect: "manual" })
      .then((response) => response.type === "opaqueredirect")
      .catch(() => false);
    // A failed check is not remembered, so a flaky connection on one visit
    // doesn't hide the button for the rest of the session.
    check.then((ready) => {
      if (!ready) cache.delete(provider);
    });
    cache.set(provider, check);
  }
  return cache.get(provider);
}
