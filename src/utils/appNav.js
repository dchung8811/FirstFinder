// What the nav bar offers, and where a link into the app is allowed to land.
//
// Kept apart from the component that draws it because two places draw it: the
// app itself (InventoryApp.jsx) and the routes that live outside the app shell
// but should look like part of it (/explore). Both build their tabs from here,
// so a tab added to one can't be missing from the other.

const SIGNED_IN_VIEWS = new Set(["dashboard", "inventory", "wishlist", "addItems", "feedback", "about", "roadmap", "account"]);
const SIGNED_OUT_VIEWS = new Set(["home", "about", "roadmap", "login", "signup"]);

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

// Where a /?view=<name> link actually lands. Anything unrecognised falls back
// to the usual front door rather than a blank screen, and a signed-in page
// asked for by someone signed out goes to the login form -- not to an empty
// collection, which is what rendering the view without an account would show.
export function landingView(requested, isLoggedIn) {
  if (isLoggedIn) return SIGNED_IN_VIEWS.has(requested) ? requested : "dashboard";
  if (SIGNED_OUT_VIEWS.has(requested)) return requested;
  return SIGNED_IN_VIEWS.has(requested) ? "login" : "home";
}
