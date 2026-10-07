// The site-wide announcement banner: what an admin may set, and how the app
// reads it back. Validation lives here, not only in the route, so the admin
// form and the server agree on one set of rules and both are under test.

export const BANNER_MESSAGE_MAX = 160;
export const BANNER_LINK_LABEL_MAX = 40;

// Where the banner's link may go: in-app pages, by name. Not a free-text URL.
// An admin account is one stolen password away from being an attacker's, and
// a banner every visitor sees that links wherever its author typed is the
// best phishing link this site could hand out. A fixed list costs one line
// here per new destination.
//
// `signedIn` pages send a signed-out visitor to log in instead, the same rule
// the footer follows. `href` pages are real routes outside the app shell.
export const BANNER_DESTINATIONS = [
  { view: "features", label: "Features" },
  { view: "explore", label: "Explore", href: "/explore" },
  { view: "roadmap", label: "Roadmap" },
  { view: "about", label: "About" },
  { view: "contribute", label: "Contribute" },
  { view: "dashboard", label: "Dashboard", signedIn: true },
  { view: "addItems", label: "Add Items", signedIn: true },
  { view: "wishlist", label: "Wishlist", signedIn: true },
  { view: "account", label: "My Account", signedIn: true }
];

export function bannerDestination(view) {
  return BANNER_DESTINATIONS.find((destination) => destination.view === view) || null;
}

export const emptyBanner = { enabled: false, message: "", linkLabel: "", linkView: "", updatedAt: null };

export function fromDbBanner(row) {
  if (!row) return { ...emptyBanner };
  return {
    enabled: row.enabled === true,
    message: row.message || "",
    linkLabel: row.link_label || "",
    linkView: row.link_view || "",
    updatedAt: row.updated_at || null
  };
}

// Returns { ok: true, row } ready to write, or { ok: false, error } in words
// an admin can act on. A link is both halves or neither: a label with nowhere
// to go is a dead button, and a destination with no label is invisible.
export function validateBanner(input) {
  const message = String(input?.message ?? "").trim();
  const linkLabel = String(input?.linkLabel ?? "").trim();
  const linkView = String(input?.linkView ?? "").trim();
  const enabled = input?.enabled === true;

  if (message.length > BANNER_MESSAGE_MAX) {
    return { ok: false, error: `Keep the message to ${BANNER_MESSAGE_MAX} characters.` };
  }
  if (enabled && !message) {
    return { ok: false, error: "Write a message before turning the banner on." };
  }
  if (linkLabel.length > BANNER_LINK_LABEL_MAX) {
    return { ok: false, error: `Keep the link text to ${BANNER_LINK_LABEL_MAX} characters.` };
  }
  if (linkView && !bannerDestination(linkView)) {
    return { ok: false, error: "Pick a link destination from the list." };
  }
  if (Boolean(linkLabel) !== Boolean(linkView)) {
    return { ok: false, error: "A link needs both its text and where it goes, or neither." };
  }

  return {
    ok: true,
    row: { enabled, message, link_label: linkLabel || null, link_view: linkView || null }
  };
}

// What a dismissal is remembered against. Any save stamps a new updated_at,
// so editing the banner shows it again to people who closed the old one --
// a new announcement deserves a new look.
export function bannerDismissalId(banner) {
  return banner?.updatedAt ? String(banner.updatedAt) : "";
}

// Whether the app should draw it for this viewer.
export function shouldShowBanner(banner, dismissedId) {
  if (!banner?.enabled || !banner.message) return false;
  const id = bannerDismissalId(banner);
  return !id || id !== dismissedId;
}
