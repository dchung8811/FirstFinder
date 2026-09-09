// The install manifest, which is what makes FirstFinder installable to a home
// screen and lets it launch without browser chrome (issue #60).
//
// The point is not the icon on the home screen. It is that an installed app
// keeps its service worker and its cached shell, so the collector who opens
// FirstFinder in a shop basement with one bar gets their collection instead of
// a dinosaur -- see public/sw.js and src/utils/offlineCollection.js.

export default function manifest() {
  return {
    name: "FirstFinder — catalog your collection",
    short_name: "FirstFinder",
    description: "Catalog what you collect, identify first editions, and check what you already own -- at the fair, in the shop, or on the sofa.",
    // The signed-in app and the marketing home page are the same route, so
    // there is only one sensible place to launch: the launcher decides which
    // one it shows by whether a session is restored.
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    // The page's own paper colour, so the launch screen does not flash white
    // before the first paint.
    background_color: "#f6efe3",
    theme_color: "#123f38",
    categories: ["books", "lifestyle", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Padded to the safe zone, so Android's circular and squircle masks crop
      // the background rather than the mark.
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };
}
