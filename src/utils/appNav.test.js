import { describe, expect, it } from "vitest";
import { HOME_TITLE, VIEW_PATHS, appNavItems, documentTitle, isPrivateView, landingView, pathForView, viewForPath, viewTitle } from "./appNav";

const views = (items) => items.map((item) => item.view);

describe("appNavItems", () => {
  it("gives a signed-out visitor the short list", () => {
    expect(views(appNavItems({ isLoggedIn: false }))).toEqual(["home", "explore", "roadmap", "about"]);
  });

  it("gives a collector the full list, with Explore as a real link", () => {
    const items = appNavItems({ isLoggedIn: true });
    expect(views(items)).toEqual(["dashboard", "inventory", "wishlist", "addItems", "explore", "feedback", "about", "roadmap", "account"]);
    expect(items.find((item) => item.view === "explore").href).toBe("/explore");
  });

  it("shows counts only once they are known", () => {
    const loading = appNavItems({ isLoggedIn: true });
    expect(loading[1].label).toBe("My Collection");
    const loaded = appNavItems({ isLoggedIn: true, inventoryCount: 0, wishlistCount: 3 });
    expect(loaded[1].label).toBe("My Collection (0)");
    expect(loaded[2].label).toBe("Wishlist (3)");
  });
});

describe("landingView", () => {
  it("opens the requested view for a collector", () => {
    expect(landingView("inventory", true)).toBe("inventory");
    expect(landingView("about", true)).toBe("about");
  });

  it("falls back to the dashboard for a collector asking for something unknown or signed-out only", () => {
    expect(landingView("nonsense", true)).toBe("dashboard");
    expect(landingView("login", true)).toBe("dashboard");
    expect(landingView("home", true)).toBe("dashboard");
    expect(landingView(null, true)).toBe("dashboard");
  });

  it("opens public pages for a collector too", () => {
    expect(landingView("privacy", true)).toBe("privacy");
    expect(landingView("features", true)).toBe("features");
  });

  it("never opens the two views that can't be opened cold", () => {
    expect(landingView("identify", true)).toBe("addItems");
    expect(landingView("identify", false)).toBe("login");
    expect(landingView("resetPassword", true)).toBe("dashboard");
    expect(landingView("resetPassword", false)).toBe("login");
  });

  it("sends a signed-out visitor asking for a collector's page to the login form", () => {
    expect(landingView("inventory", false)).toBe("login");
    expect(landingView("account", false)).toBe("login");
  });

  it("opens public views for a signed-out visitor, and home for anything else", () => {
    expect(landingView("about", false)).toBe("about");
    expect(landingView("signup", false)).toBe("signup");
    expect(landingView("admin", false)).toBe("home");
  });
});

describe("view paths", () => {
  it("round-trips every view through its path", () => {
    for (const [view, path] of Object.entries(VIEW_PATHS)) {
      expect(pathForView(view)).toBe(path);
      expect(viewForPath(path)).toBe(view);
    }
  });

  it("gives every view its own path", () => {
    const paths = Object.values(VIEW_PATHS);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("ignores a trailing slash", () => {
    expect(viewForPath("/collection/")).toBe("inventory");
    expect(viewForPath("/")).toBe("home");
  });

  it("says nothing about addresses outside the app", () => {
    expect(viewForPath("/explore")).toBeNull();
    expect(viewForPath("/c/someone")).toBeNull();
    expect(viewForPath("/collection/extra")).toBeNull();
    expect(pathForView("explore")).toBeNull();
  });

  it("marks only the collection's own pages as private", () => {
    expect(isPrivateView("inventory")).toBe(true);
    expect(isPrivateView("about")).toBe(false);
    expect(isPrivateView("login")).toBe(false);
  });

  it("knows a path for every tab the nav offers inside the app", () => {
    for (const isLoggedIn of [true, false]) {
      for (const item of appNavItems({ isLoggedIn })) {
        if (!item.href) expect(pathForView(item.view)).not.toBeNull();
      }
    }
  });
});

describe("titles", () => {
  it("names every view that has an address", () => {
    for (const view of Object.keys(VIEW_PATHS)) {
      if (view !== "home") expect(viewTitle(view)).toBeTruthy();
    }
  });

  it("matches the layout's template in the browser, and keeps home's full title", () => {
    expect(documentTitle("inventory")).toBe("My Collection | FirstFinder");
    expect(documentTitle("home")).toBe(HOME_TITLE);
  });
});
