// What the nav bar offers, and where a link into the app is allowed to land.
//
// Kept apart from the component that draws it because two places draw it: the
// app itself (InventoryApp.jsx) and the routes that live outside the app shell
// but should look like part of it (/explore). Both build their tabs from here,
// so a tab added to one can't be missing from the other.

// Every view has its own address, so a page can be bookmarked, refreshed,
// shared, and reached with the back button. Paths are the names a collector
// would type, not the view names in the code. Home is the bare domain.
export const VIEW_PATHS = {
  home: "/",
  dashboard: "/dashboard",
  inventory: "/collection",
  wishlist: "/wishlist",
  addItems: "/add",
  tutorial: "/add-manually",
  identify: "/identify",
  insuranceExport: "/insurance-report",
  feedback: "/feedback",
  account: "/account",
  about: "/about",
  roadmap: "/roadmap",
  features: "/features",
  contribute: "/contribute",
  privacy: "/privacy",
  terms: "/terms",
  login: "/login",
  signup: "/signup",
  resetPassword: "/reset-password"
};

const VIEW_BY_PATH = Object.fromEntries(Object.entries(VIEW_PATHS).map(([view, path]) => [path, view]));

export function pathForView(view) {
  return VIEW_PATHS[view] || null;
}

// A trailing slash is the same page. Anything else that isn't on the list is
// not an app page at all -- /explore, /c/<slug> -- and returns null.
export function viewForPath(pathname) {
  const path = String(pathname || "/").replace(/(.)\/+$/, "$1");
  return VIEW_BY_PATH[path] || null;
}

// What each page is called in the browser tab and in search results. The
// root layout's "%s | FirstFinder" template is applied on the server; the app
// applies the same shape itself when it changes view in the browser, where no
// new metadata is fetched. Home keeps the full descriptive title -- see
// app/layout.js for why the bare name is a weak one.
export const HOME_TITLE = "FirstFinder — Catalog your collection and identify first editions";

const VIEW_TITLES = {
  dashboard: "Dashboard",
  inventory: "My Collection",
  wishlist: "Wishlist",
  addItems: "Add Items",
  tutorial: "Add an item",
  identify: "Review identification",
  insuranceExport: "Insurance report",
  feedback: "Feedback",
  account: "My Account",
  about: "About",
  roadmap: "Roadmap",
  features: "Features",
  contribute: "Contribute",
  privacy: "Privacy Policy",
  terms: "Terms of Service",
  login: "Log in",
  signup: "Sign up",
  resetPassword: "Reset password"
};

export function viewTitle(view) {
  return VIEW_TITLES[view] || null;
}

export function documentTitle(view) {
  const title = viewTitle(view);
  return title ? `${title} | FirstFinder` : HOME_TITLE;
}

// Pages that only make sense with an account. Someone signed out who asks for
// one is sent to log in, and lands on it afterwards.
const PRIVATE_VIEWS = new Set(["dashboard", "inventory", "wishlist", "addItems", "tutorial", "identify", "insuranceExport", "feedback", "account"]);
// Open to anyone, signed in or not.
const PUBLIC_VIEWS = new Set(["about", "roadmap", "features", "contribute", "privacy", "terms"]);
// Only for someone signed out: a collector has nothing to do on a login form,
// and home is the pitch to people who haven't started yet.
const SIGNED_OUT_ONLY_VIEWS = new Set(["home", "login", "signup"]);

export function isPrivateView(view) {
  return PRIVATE_VIEWS.has(view);
}

// Counts are null until the fetch behind them has landed: "My Collection (0)"
// while it is still loading reads as an empty collection, which is worse than
// no number at all. Routes outside the app never load them, so they pass none.
export function appNavItems({ isLoggedIn, inventoryCount = null, wishlistCount = null }) {
  const count = (value) => (value === null || value === undefined ? "" : ` (${value})`);
  return isLoggedIn
    ? [
        { view: "dashboard", label: "Dashboard" },
        { view: "inventory", label: `My Collection${count(inventoryCount)}` },
        // Its own tab, beside the collection rather than inside it: what you
        // are hunting is not a subset of what you own.
        { view: "wishlist", label: `Wishlist${count(wishlistCount)}` },
        { view: "addItems", label: "Add Items" },
        // A real route, not a view: a server-rendered public page, so it
        // carries an href and navigates out of the app shell.
        { view: "explore", label: "Explore", href: "/explore" },
        // Feedback sits where Roadmap used to, because the nav row only has
        // space for the first few and this is the one worth spending it on: a
        // collector who wants to tell us something should not have to find a
        // menu first. Roadmap keeps its place, further down -- which on most
        // widths means inside the menu.
        { view: "feedback", label: "Feedback" },
        { view: "about", label: "About" },
        { view: "roadmap", label: "Roadmap" },
        { view: "account", label: "My Account" }
      ]
    : [
        { view: "home", label: "Get Started" },
        { view: "explore", label: "Explore", href: "/explore" },
        { view: "roadmap", label: "Roadmap" },
        { view: "about", label: "About" }
      ];
}

// Where a request for a view actually lands -- from an address typed in, a
// bookmark, the back button, or a /?view=<name> link from a page outside the
// app. Anything unrecognised falls back to the usual front door rather than a
// blank screen.
//
// Two views can't be opened cold. "identify" reviews a photo that was just
// taken, which only exists in memory, so it falls back to Add Items. "Reset
// password" needs the one-time session from the reset email, which is how the
// app reaches it; asked for directly, it is the login form (signed out) or the
// dashboard (signed in).
export function landingView(requested, isLoggedIn) {
  if (requested === "identify") return isLoggedIn ? "addItems" : "login";
  if (isLoggedIn) {
    return PRIVATE_VIEWS.has(requested) || PUBLIC_VIEWS.has(requested) ? requested : "dashboard";
  }
  if (PUBLIC_VIEWS.has(requested) || SIGNED_OUT_ONLY_VIEWS.has(requested)) return requested;
  return PRIVATE_VIEWS.has(requested) || requested === "resetPassword" ? "login" : "home";
}
