// The guided tour: one stop per part of the app, each spotlighting a feature
// on that page. Kept free of the DOM, React and Supabase so the steps, the
// auto-start rule and the card placement are under test; app/GuidedTour.jsx
// is the stateful part that draws it.
//
// Each step names the view to open (`view`, a name from src/utils/appNav.js)
// and the `data-tour` values to spotlight, tried in order. The first one on
// the page wins, which is how a step survives a layout that differs by width:
// the Explore tab sits in the tab row on a laptop and inside the menu on a
// phone, so its step lists both. With no targets, or none found, the step is
// a card in the middle of the screen.

export const TOUR_STEPS = [
  {
    id: "welcome",
    section: "Welcome",
    title: "Welcome to FirstFinder",
    body: "A one-minute look around: adding finds, your collection, the hunt, and sharing your shelf. You can replay it anytime from Tutorial."
  },
  {
    id: "dashboard",
    section: "Dashboard",
    title: "Your collection at a glance",
    body: "What you own, what you paid, and what it's worth, filling in as you add finds. Anything you haven't valued yet stays blank rather than counting as zero.",
    view: "dashboard",
    targets: ["dashboard-summary"]
  },
  {
    id: "scan",
    section: "Add Items",
    title: "Snap a picture",
    body: "Photograph the cover and the copyright page, and FirstFinder fills in the title, edition and printing for you. Check what it found, then save.",
    view: "addItems",
    targets: ["add-scan", "add-quick"]
  },
  {
    id: "quick-add",
    section: "Add Items",
    title: "Or type it in",
    body: "Every field is optional except the name. Add what you paid, where it came from, and a photo of the receipt as proof of purchase.",
    view: "addItems",
    targets: ["add-quick"]
  },
  {
    id: "bulk",
    section: "Add Items",
    title: "Bring a spreadsheet",
    body: "Already keep a list? Download the template, fill it in, and import the whole thing at once. You'll see a preview before anything is saved.",
    view: "addItems",
    targets: ["add-bulk"],
    // The import is hidden on phones (see AddItemsPage), so the step is too.
    wideScreenOnly: true
  },
  {
    id: "collection-tools",
    section: "My Collection",
    title: "Find anything",
    body: "Search, filter and sort everything you own, and switch between a list, a table and a wall of covers.",
    view: "inventory",
    targets: ["collection-tools"]
  },
  {
    id: "collection-share",
    section: "My Collection",
    title: "Share your shelf",
    body: "Turn on a public page for your collection and send the link to anyone. The ⋯ menu has an insurance report and your sold items.",
    view: "inventory",
    targets: ["collection-actions"]
  },
  {
    id: "wishlist",
    section: "Wishlist",
    title: "Keep a list of the hunt",
    body: "The books you're still looking for, with the edition you want and the most you'd pay. When you find one, mark it found and it moves into your collection.",
    view: "wishlist",
    targets: ["wishlist-add"]
  },
  {
    id: "explore",
    section: "Explore",
    title: "See other shelves",
    body: "Collections other collectors chose to share. Browse for ideas, or to see what a first printing looks like on someone else's shelf.",
    targets: ["nav-explore", "nav-menu"]
  },
  {
    id: "tutorial",
    section: "Tutorial",
    title: "Take this tour again anytime",
    body: "Tutorial is up here whenever you want a refresher. Your account, Feedback, the Roadmap and Help are in this bar too.",
    targets: ["nav-tutorial", "nav-menu"]
  }
];

// Wider than a phone: Tailwind's md breakpoint, the same one AddItemsPage
// hides the CSV import below. The two have to agree, or the tour points at
// something that isn't there.
export const WIDE_SCREEN_QUERY = "(min-width: 768px)";

// Whether a step is shown on this screen: wide-screen-only ones are skipped
// on phones.
export function stepFits(step, wideScreen) {
  return wideScreen || !step.wideScreenOnly;
}

// The steps shown on this screen, for counting where the collector is.
export function tourStepsFor(wideScreen) {
  return TOUR_STEPS.filter((step) => stepFits(step, wideScreen));
}

// The index in TOUR_STEPS of the next (or, going back, previous) step shown on
// this screen, or null past either end. Progress keeps indexes into the full
// list, so it stays valid when the screen changes size mid-tour.
export function nearbyStep(from, direction, wideScreen = true) {
  for (let index = from + direction; index >= 0 && index < TOUR_STEPS.length; index += direction) {
    if (stepFits(TOUR_STEPS[index], wideScreen)) return index;
  }
  return null;
}

// Views the tour may start over by itself. Not the identify review, the full
// add form or the reset-password form: each holds something the collector is
// in the middle of, and the tour opens other views on its way round.
const AUTO_START_VIEWS = new Set(["dashboard", "addItems", "inventory", "wishlist", "account"]);

// Whether to start the tour unasked. Only for someone who has never taken or
// skipped it (`tourState` is the user_metadata.tour flag) and whose collection
// has finished loading empty: that is a new collector. Someone with forty
// books who predates the tour knows their way round already, and starting it
// before the collection loads would guess from a count that isn't known yet.
export function shouldAutoStartTour({ isLoggedIn, tourState, collectionLoaded, collectionSize, view }) {
  if (!isLoggedIn || tourState) return false;
  if (!collectionLoaded || collectionSize !== 0) return false;
  return AUTO_START_VIEWS.has(view);
}

// The value written to user_metadata.tour once the tour is finished or
// skipped, so it never starts by itself again on any device.
export const TOUR_DONE = "done";

// Window event that starts the tour from anywhere: the Tutorial tab and the
// footer link.
export const START_TOUR_EVENT = "firstfinder:start-tour";

// Space kept between the card and the screen edge, and between the card and
// the spotlight.
export const EDGE = 16;
export const GAP = 14;

// Where the card goes: below the spotlight if it fits, else above, else
// pinned to the bottom of the screen (a target taller than the screen).
// Centred on the target and kept on screen. Without a target it sits in the
// middle.
export function placeTooltip(target, tooltip, viewport) {
  const maxLeft = Math.max(EDGE, viewport.width - tooltip.width - EDGE);
  const clampLeft = (left) => Math.min(Math.max(left, EDGE), maxLeft);

  if (!target) {
    return {
      top: Math.max(EDGE, (viewport.height - tooltip.height) / 2),
      left: clampLeft((viewport.width - tooltip.width) / 2),
      side: "center"
    };
  }

  const left = clampLeft(target.left + target.width / 2 - tooltip.width / 2);
  const below = target.top + target.height + GAP;
  if (below + tooltip.height <= viewport.height - EDGE) return { top: below, left, side: "below" };
  const above = target.top - GAP - tooltip.height;
  if (above >= EDGE) return { top: above, left, side: "above" };
  return { top: Math.max(EDGE, viewport.height - tooltip.height - EDGE), left, side: "pinned" };
}
